import { useState, useEffect, Fragment } from 'react'
import type { Order } from '../../entities/Order'
import { API } from '../../api/API'
import { Order as OrderEntity } from '../../entities/Order'
import { OrderService } from '../../service/OrderService'
import { formatStockValidationMessage, validateOrderStock } from '../../utils/orderStockValidation'

type FrontOrdersSectionProps = {
  orders: Order[]
  ordersLoading: boolean
  ordersError: string
  lastOrderId: number | null
  formatOrderDate: (value: string) => string
  onDuplicateComplete?: (orderId: number) => void
}

export default function FrontOrdersSection({ orders, ordersLoading, ordersError, lastOrderId, formatOrderDate, onDuplicateComplete }: FrontOrdersSectionProps) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const [duplicateCounts, setDuplicateCounts] = useState<Record<number, number>>({})
  const [duplicateMsg, setDuplicateMsg] = useState<Record<number, string>>({})
  const [localOrders, setLocalOrders] = useState<Order[]>(orders)

  const toggle = (id: number) => {
    setExpanded((s) => ({ ...s, [id]: !s[id] }))
  }

  const setCount = (id: number, value: number) => {
    setDuplicateCounts((s) => ({ ...s, [id]: value }))
  }

  // sync local copy when `orders` prop changes
  useEffect(() => {
    setLocalOrders(orders)
  }, [orders])

  const handleDuplicate = async (orderId: number) => {
    const count = duplicateCounts[orderId] || 1
    const original = localOrders.find((o) => o.id === orderId) || orders.find((o) => o.id === orderId)
    if (!original) return

    setDuplicateMsg((s) => ({ ...s, [orderId]: '' }))

    // deep clone
    const clone: Order = JSON.parse(JSON.stringify(original))

    // new unique id
    const maxId = Math.max(0, ...localOrders.map((o) => o.id), Number(lastOrderId ?? 0))
    clone.id = maxId + 1
    clone.date_add = new Date().toISOString().slice(0, 19).replace('T', ' ')

    // multiply quantities
    if (Array.isArray(clone.items)) {
      clone.items = clone.items.map((it) => ({ ...it, product_quantity: (it.product_quantity || 0) * count }))

      // Preserve original order-level totals (taxes, discounts, shipping) when possible.
      // If original.total_paid is available, multiply it by count; otherwise, fall back to summing item prices.
      const originalTotal = (original && typeof original.total_paid === 'number')
        ? original.total_paid
        : clone.items.reduce((s, it) => s + (Number(it.product_price) || 0) * (Number(it.product_quantity) || 0), 0)

      clone.total_paid = Number((originalTotal * count).toFixed(2))

      const originalTaxExcl = (original && typeof original.total_paid_tax_excl === 'number')
        ? original.total_paid_tax_excl
        : originalTotal
      clone.total_paid_tax_excl = Number((originalTaxExcl * count).toFixed(2))
    }

    const stockCheck = await validateOrderStock(
      (clone.items || []).map((item) => ({
        product_id: item.product_id,
        product_quantity: item.product_quantity,
        product_name: item.product_name,
        reference: item.reference,
      }))
    )

    if (!stockCheck.ok) {
      setDuplicateMsg((s) => ({ ...s, [orderId]: `Stock insuffisant: ${formatStockValidationMessage(stockCheck.issues)}` }))
      return
    }

    const orderDate = new Date().toISOString().slice(0, 19).replace('T', ' ')
    clone.date_add = orderDate

    const requestOrder = new OrderEntity(
      0,
      clone.id_customer,
      clone.customer_email,
      clone.customer_name,
      orderDate,
      clone.state,
      clone.items,
      clone.total_paid,
      clone.id_carrier,
      clone.id_address_delivery,
      clone.id_address_invoice,
      clone.id_cart || original.id_cart,
      clone.module,
      clone.total_paid_tax_excl,
      clone.secure_key
    )
    requestOrder.state_id = clone.state_id

    try {
      const api = new API()
      const orderService = new OrderService()
      const result = await api.fetch<OrderEntity>({
        method: 'POST',
        mere: requestOrder,
        service: orderService,
        body: requestOrder.getCreateXML(),
      })

      const createdOrderId = result[0]?.id || Math.max(0, ...localOrders.map((o) => o.id), Number(lastOrderId ?? 0)) + 1
      requestOrder.id = createdOrderId

      // insert duplicated order at top
      setLocalOrders((prev) => [requestOrder, ...prev])
      onDuplicateComplete?.(createdOrderId)

      setDuplicateMsg((s) => ({ ...s, [orderId]: `Commande dupliquée ${count} fois et enregistrée.` }))
      setTimeout(() => {
        setDuplicateMsg((s) => {
          const ns = { ...s }
          delete ns[orderId]
          return ns
        })
      }, 3000)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur lors de la duplication'
      setDuplicateMsg((s) => ({ ...s, [orderId]: message }))
    }
  }

  return (
    <section className="front-products-section">
      <h2>Mes commandes</h2>

      {ordersLoading && <p>Chargement de vos commandes...</p>}
      {!ordersLoading && ordersError && <div className="form-error">{ordersError}</div>}

      {!ordersLoading && !ordersError && lastOrderId && (
        <div className="front-stat-card" style={{ marginBottom: '12px' }}>
          <strong>Commande #{lastOrderId}</strong>
          <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.72)' }}>
            Votre derniere commande a ete enregistree avec succes.
          </p>
        </div>
      )}

      {!ordersLoading && !ordersError && (
        <div className="front-table-wrapper">
          <table className="front-products-table">
            <thead>
              <tr>
                <th>Commande</th>
                <th>Date</th>
                <th>Total</th>
                <th>Livraison</th>
                <th>Statut</th>
                <th>Articles</th>
              </tr>
            </thead>
            <tbody>
              {localOrders.map((order, idx) => {
                const totalItems = Array.isArray(order.items) ? order.items.reduce((sum, item) => sum + (item.product_quantity || 0), 0) : 0

                return (
                  <Fragment key={`order-fragment-${order.id}-${idx}`}>
                    <tr key={`order-${order.id}-${idx}`}>
                      <td>#{order.id}</td>
                      <td>{formatOrderDate(order.date_add)}</td>
                      <td>{Number(order.total_paid || 0).toFixed(2)} £</td>
                      <td>0.00 £</td>
                      <td>
                        <span className="status-badge active">{order.state || 'En attente de paiement'}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button type="button" className="action-btn view-btn" onClick={() => toggle(order.id)}>
                            {totalItems} article(s)
                          </button>

                          <input
                            type="number"
                            min={1}
                            value={duplicateCounts[order.id] ?? 1}
                            onChange={(e) => setCount(order.id, Math.max(1, Number(e.target.value) || 1))}
                            style={{ width: 68, padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(0,0,0,0.12)' }}
                            aria-label={`Nombre de duplications pour la commande ${order.id}`}
                          />

                          <button
                            type="button"
                            className="action-btn dup-btn"
                            onClick={() => handleDuplicate(order.id)}
                            style={{ padding: '8px 10px', borderRadius: 8 }}
                          >
                            Dupliquer
                          </button>
                        </div>
                        {duplicateMsg[order.id] && (
                          <div style={{ marginTop: 6, fontSize: 13, color: '#9be7a8' }}>{duplicateMsg[order.id]}</div>
                        )}
                      </td>
                    </tr>

                    {expanded[order.id] && (
                      <tr key={`order-details-${order.id}-${idx}`}>
                        <td colSpan={6} style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.03)' }}>
                          {Array.isArray(order.items) && order.items.length > 0 ? (
                            <div>
                              <strong>Lignes :</strong>
                              <ul style={{ marginTop: '8px' }}>
                                {order.items.map((it, i) => (
                                  <li key={`o-${order.id}-it-${i}`}>
                                    {it.product_name || `Produit ${it.product_id}`} — qty: {it.product_quantity || 0} — {Number(it.product_price || 0).toFixed(2)}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : (
                            <div>Aucun article dans cette commande.</div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>

          {localOrders.length === 0 && (
            <p className="no-results">Aucune commande pour le moment.</p>
          )}
        </div>
      )}
    </section>
  )
}
