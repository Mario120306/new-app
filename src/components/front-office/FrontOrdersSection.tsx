import { useState } from 'react'
import type { Order } from '../../entities/Order'

type FrontOrdersSectionProps = {
  orders: Order[]
  ordersLoading: boolean
  ordersError: string
  lastOrderId: number | null
  formatOrderDate: (value: string) => string
}

export default function FrontOrdersSection({ orders, ordersLoading, ordersError, lastOrderId, formatOrderDate }: FrontOrdersSectionProps) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})

  const toggle = (id: number) => {
    setExpanded((s) => ({ ...s, [id]: !s[id] }))
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
              {orders.map((order, idx) => {
                const totalItems = Array.isArray(order.items) ? order.items.reduce((sum, item) => sum + (item.product_quantity || 0), 0) : 0

                return (
                  <>
                    <tr key={`order-${order.id}-${idx}`}>
                      <td>#{order.id}</td>
                      <td>{formatOrderDate(order.date_add)}</td>
                      <td>{Number(order.total_paid || 0).toFixed(2)} £</td>
                      <td>0.00 £</td>
                      <td>
                        <span className="status-badge active">{order.state || 'En attente de paiement'}</span>
                      </td>
                      <td>
                        <button type="button" className="action-btn view-btn" onClick={() => toggle(order.id)}>
                          {totalItems} article(s)
                        </button>
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
                  </>
                )
              })}
            </tbody>
          </table>

          {orders.length === 0 && (
            <p className="no-results">Aucune commande pour le moment.</p>
          )}
        </div>
      )}
    </section>
  )
}
