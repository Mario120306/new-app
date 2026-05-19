import { useEffect, useState } from 'react'
import { Order } from '../../entities/Order'
import { Customer } from '../../entities/Customer'
import { OrderService } from '../../service/OrderService'
import { CustomerService } from '../../service/CustomerService'
import { API } from '../../api/API'
import { updateOrderStateBridge, syncStockAfterOrderDelivered } from '../../utils/orderUpdate'

type OrderState = '1' | '2' | '5' | '6' | 'all'

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null)
  const [status, setStatus] = useState('')
  const [filterState, setFilterState] = useState<OrderState>('all')
  const [logs, setLogs] = useState<string[]>([])

  const api = new API()
  const stateConfig: Record<string, { label: string; color: string }> = {
    '1': { label: 'Dans le panier', color: '#ff9800' },
    '2': { label: 'Payé', color: '#4caf50' },
    '5': { label: 'Payé livré', color: '#42a5f5' },
    '6': { label: 'Annulé', color: '#f44336' },
  }

  useEffect(() => {
    loadOrders()
  }, [])

  async function loadOrders() {
    setLoading(true)
    setStatus('')
    setLogs([])
    const nextLogs: string[] = []
    try {
      nextLogs.push('Chargement des commandes...')
      const orderService = new OrderService()
      const customerService = new CustomerService()
      const [resultOrders, resultCustomers] = await Promise.all([
        api.fetch<Order>({
          method: 'GET',
          mere: new Order(),
          service: orderService,
          params: new URLSearchParams({
            display: 'full',
            limit: '100',
          }),
        }),
        api.fetch<Customer>({
          method: 'GET',
          mere: new Customer(),
          service: customerService,
          params: new URLSearchParams({
            display: 'full',
            limit: '100',
          }),
        }),
      ])

      const orderList = Array.isArray(resultOrders) ? resultOrders : resultOrders ? [resultOrders] : []
      const customerList = Array.isArray(resultCustomers) ? resultCustomers : resultCustomers ? [resultCustomers] : []

      setOrders(orderList)
      setCustomers(customerList)
      nextLogs.push(`✓ ${orderList.length} commande(s) chargée(s)`)
      nextLogs.push(`✓ ${customerList.length} client(s) chargée(s)`)
      setStatus(`✓ ${orderList.length} commande(s) disponible(s)`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      nextLogs.push(`✗ Erreur: ${msg}`)
      setStatus(`✗ Erreur de chargement`)
      setOrders([])
      setCustomers([])
    } finally {
      setLogs(nextLogs)
      setLoading(false)
    }
  }

  function getCustomerById(idCustomer: number): Customer | undefined {
    return customers.find((customer) => customer.id === idCustomer)
  }

  function getCustomerDisplayName(order: Order): string {
    if (order.customer_name) return order.customer_name
    const customer = getCustomerById(order.id_customer)
    if (!customer) return `Client #${order.id_customer}`
    const fullName = [customer.firstname, customer.lastname].filter(Boolean).join(' ').trim()
    return fullName || `Client #${order.id_customer}`
  }

  function getCustomerDisplayEmail(order: Order): string {
    if (order.customer_email) return order.customer_email
    const customer = getCustomerById(order.id_customer)
    return customer?.email || ''
  }

  function getStateKey(order: Order): string {
    const fromId = Number(order.state_id || 0)
    if (fromId === 1 || fromId === 2 || fromId === 5 || fromId === 6) {
      return String(fromId)
    }
    if (fromId === 3) {
      return '6'
    }

    const normalized = (order.state || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')

    if (normalized.includes('panier')) return '1'
    if (normalized.includes('livr')) return '5'
    if (normalized.includes('annul')) return '6'
    if (normalized.includes('paiement')) return '2'
    
    // Default: commands without state go to cart (panier)
    return '1'
  }

  function getStateLabelByKey(stateKey: string): string {
    return stateConfig[stateKey]?.label || 'Inconnu'
  }

  async function updateOrderState(order: Order, nextStateId: '5' | '6') {
    if (!order.id) return

    setUpdatingOrderId(order.id)
    setStatus('')
    try {
      const result = await updateOrderStateBridge(order.id, Number(nextStateId) as 5 | 6)

      if (!result.success) {
        throw new Error(result.message || 'Mise à jour du statut refusée')
      }

      const newStateId = result.new_state ?? Number(nextStateId)
      const stateKey = [1, 2, 5, 6].includes(newStateId) ? String(newStateId) : nextStateId

      setOrders((current) =>
        current.map((item) => {
          if (item.id !== order.id) return item
          return Object.assign(item, {
            state_id: newStateId,
            state: getStateLabelByKey(stateKey),
          })
        })
      )

      if (nextStateId === '5' && result.changed !== false) {
        const movementDate = (order.date_add || new Date().toISOString()).slice(0, 10)
        const itemsForMovement = (order.items || []).map((item) => ({
          product_id: item.product_id,
          product_attribute_id: item.product_attribute_id,
          product_quantity: item.product_quantity,
        }))
        console.log('[OrdersPage] Stock movement for order', order.id, ':', itemsForMovement)
        console.log('[OrdersPage] prestashop_stock_handled =', result.prestashop_stock_handled)
        
        await syncStockAfterOrderDelivered(
          order.id,
          itemsForMovement,
          movementDate,
          Boolean(result.prestashop_stock_handled)
        )
      }

      setStatus(`✓ Commande #${order.id} mise à jour en ${getStateLabelByKey(stateKey)}`)
      setLogs((current) => [
        `Commande #${order.id} -> ${getStateLabelByKey(stateKey)} (état API=${newStateId})`,
        ...current,
      ])
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      setStatus(`✗ Impossible de mettre à jour la commande #${order.id}`)
      setLogs((current) => [`✗ Commande #${order.id}: ${msg}`, ...current])
    } finally {
      setUpdatingOrderId(null)
    }
  }

  // Filtrer les commandes selon l'état sélectionné
  const filteredOrders = filterState === 'all'
    ? orders
    : orders.filter((order) => getStateKey(order) === filterState)

  // Compter par état
  const countByState = {
    '1': orders.filter((o) => getStateKey(o) === '1').length,
    '2': orders.filter((o) => getStateKey(o) === '2').length,
    '5': orders.filter((o) => getStateKey(o) === '5').length,
    '6': orders.filter((o) => getStateKey(o) === '6').length,
  }

  const cardStyle: React.CSSProperties = {
    padding: 28,
    borderRadius: 12,
    background: 'linear-gradient(135deg, rgba(74, 144, 226, 0.08) 0%, rgba(155, 231, 168, 0.05) 100%)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    backdropFilter: 'blur(10px)',
    marginBottom: 20,
  }

  const buttonStyle = (isActive: boolean, color: string): React.CSSProperties => ({
    padding: '12px 20px',
    borderRadius: 8,
    border: isActive ? `2px solid ${color}` : '1px solid rgba(255, 255, 255, 0.2)',
    background: isActive ? `${color}15` : 'rgba(0, 0, 0, 0.2)',
    color: isActive ? color : '#ccc',
    cursor: 'pointer',
    fontWeight: isActive ? 600 : 500,
    fontSize: 14,
    transition: 'all 0.3s ease',
    opacity: loading ? 0.5 : 1,
  })

  return (
    <section style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>
        Commandes
      </div>
      <h1 style={{ marginTop: 0, marginBottom: 8, fontSize: 36, fontWeight: 700, color: '#fff' }}>
        Gestion des Commandes
      </h1>
      <p style={{ color: '#aaa', marginBottom: 32, fontSize: 15, lineHeight: 1.6 }}>
        Visualisez et filtrez vos commandes selon leur état de paiement et de traitement.
      </p>

      {status && (
        <div style={cardStyle}>
          <p style={{ margin: 0, color: status.includes('✓') ? '#9be7a8' : '#ff6b6b', fontSize: 14 }}>
            {status}
          </p>
        </div>
      )}

      <div style={cardStyle}>
        <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 600, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Filtrer par état
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={() => setFilterState('all')} style={buttonStyle(filterState === 'all', '#4a90e2')} disabled={loading}>
            Tous ({orders.length})
          </button>
          {Object.entries(stateConfig).map(([stateKey, config]) => (
            <button
              key={stateKey}
              onClick={() => setFilterState(stateKey as OrderState)}
              style={buttonStyle(filterState === stateKey, config.color)}
              disabled={loading}
            >
              {config.label} ({countByState[stateKey as keyof typeof countByState]})
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={cardStyle}>
          <p style={{ margin: 0, color: '#aaa', fontSize: 14 }}>Chargement des commandes...</p>
        </div>
      ) : (
        <div style={{ ...cardStyle, overflowX: 'auto', padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, color: '#e0e0e0' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                {['ID', 'Client', 'Email', 'Date', 'Total', 'Statut', 'Articles', 'Actions'].map((col) => (
                  <th key={col} style={{ padding: '16px 20px', textAlign: col === 'Total' ? 'right' : col === 'Statut' || col === 'Articles' ? 'center' : 'left', fontWeight: 600, fontSize: 13, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '40px 20px', textAlign: 'center', color: '#666', fontSize: 14 }}>
                    Aucune commande pour cet état
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order, idx) => {
                  const totalItems = order.items.reduce((sum, item) => sum + item.product_quantity, 0)
                  const stateKey = getStateKey(order)
                  const config = stateConfig[stateKey] || { label: order.state, color: '#999' }
                  return (
                    <tr key={order.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', backgroundColor: idx % 2 === 0 ? 'rgba(0, 0, 0, 0.1)' : 'transparent' }}>
                      <td style={{ padding: '16px 20px', fontWeight: 600, color: '#4a90e2' }}>#{order.id}</td>
                      <td style={{ padding: '16px 20px' }}>{getCustomerDisplayName(order)}</td>
                      <td style={{ padding: '16px 20px', fontSize: 13, color: '#aaa' }}>{getCustomerDisplayEmail(order)}</td>
                      <td style={{ padding: '16px 20px', fontSize: 13, color: '#aaa' }}>{new Date(order.date_add).toLocaleDateString('fr-FR')}</td>
                      <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 600, color: '#9be7a8' }}>{Number(order.total_paid || 0).toFixed(2)} €</td>
                      <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                        <span style={{ display: 'inline-block', padding: '6px 12px', borderRadius: 6, backgroundColor: `${config.color}20`, color: config.color, fontWeight: 600, fontSize: 12 }}>
                          {config.label}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 600 }}>{totalItems}</td>
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={() => updateOrderState(order, '5')}
                            disabled={loading || updatingOrderId === order.id || getStateKey(order) === '5' || getStateKey(order) === '6'}
                            style={{
                              padding: '8px 12px',
                              borderRadius: 8,
                              border: '1px solid rgba(66,165,245,0.45)',
                              background: 'rgba(66,165,245,0.12)',
                              color: '#7cc3ff',
                              cursor: loading || updatingOrderId === order.id || getStateKey(order) === '5' || getStateKey(order) === '6' ? 'not-allowed' : 'pointer',
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            {updatingOrderId === order.id ? '...' : 'Livrer'}
                          </button>
                          <button
                            type="button"
                            onClick={() => updateOrderState(order, '6')}
                            disabled={loading || updatingOrderId === order.id || getStateKey(order) === '6'}
                            style={{
                              padding: '8px 12px',
                              borderRadius: 8,
                              border: '1px solid rgba(244,67,54,0.45)',
                              background: 'rgba(244,67,54,0.12)',
                              color: '#ff8a80',
                              cursor: loading || updatingOrderId === order.id || getStateKey(order) === '6' ? 'not-allowed' : 'pointer',
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            Annuler
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {logs.length > 0 && (
        <div style={cardStyle}>
          <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Logs
          </div>
          <div style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)', borderRadius: 6, padding: 12, fontSize: 12, fontFamily: 'monospace', color: '#aaa', maxHeight: '200px', overflowY: 'auto', lineHeight: 1.6 }}>
            {logs.map((log, i) => (
              <div key={i}>{log}</div>
            ))}
          </div>
        </div>
      )}

      {!loading && orders.length > 0 && (
        <div style={cardStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
            <div>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>{orders.length}</div>
            </div>
            {Object.entries(stateConfig).map(([stateKey, config]) => (
              <div key={stateKey}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{config.label}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: config.color }}>{countByState[stateKey as keyof typeof countByState]}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
