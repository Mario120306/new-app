import { useState, useEffect, useMemo } from 'react'
import { OrderService } from '../../service/OrderService'
import { Order } from '../../entities/Order'

type CartSnapshot = {
  id: number
  id_customer: number
  id_order?: number
  totalHt: number
  totalTtc: number
}

export default function DashboardPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [carts, setCarts] = useState<CartSnapshot[]>([])
  const [productTaxRateById, setProductTaxRateById] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(true)
  const orderService = new OrderService()

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date()
    return today.toISOString().slice(0, 10)
  })

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setIsLoading(true)
    try {
      const baseUrl = import.meta.env.VITE_PRESTASHOP_API_BASE_URL || '/prestashop/api'
      const wsKey = 'BZSMWP6E43Z8H41ACW75XU5XAQRAQG9B'

      async function fetchOrdersWithFallback(): Promise<Order[]> {
        const urls = [
          // Some PS setups accept `limit=1000`, others require `limit=0,1000`
          `${baseUrl}/orders?display=[id,id_customer,date_add,current_state,total_paid,total_paid_tax_excl,id_cart,payment,module]&limit=1000`,
          `${baseUrl}/orders?display=[id,id_customer,date_add,current_state,total_paid,total_paid_tax_excl,id_cart,payment,module]&limit=0,1000`,
          `${baseUrl}/orders?display=full&limit=1000`,
          `${baseUrl}/orders?display=full&limit=0,1000`,
        ]

        for (const url of urls) {
          try {
            const resp = await fetch(url, { headers: { Authorization: 'Basic ' + btoa(wsKey + ':') } })
            if (!resp.ok) continue
            const xml = await resp.text()
            const doc = new DOMParser().parseFromString(xml, 'application/xml')
            const errorMsg = doc.querySelector('error > message')?.textContent?.trim()
            if (errorMsg) {
              console.warn('[Dashboard] Orders API error:', errorMsg)
              continue
            }
            const parsed = orderService.createListBy(doc)
            if (parsed.length > 0) {
              const hasDate = parsed.some((o) => !!o.date_add)
              const hasTotals = parsed.some((o) => (o.total_paid || 0) > 0) || parsed.some((o) => (o.total_paid_tax_excl || 0) > 0)
              const hasState = parsed.some((o) => ((o as any).state_id || 0) > 0) || parsed.some((o) => (o.state || '') !== 'Inconnu')
              const hasItems = parsed.some((o) => Array.isArray(o.items) && o.items.length > 0)
              // For accurate totals (matching CSV method), we need order_rows (items), so require display=full payload.
              if (hasDate && hasTotals && hasState && hasItems) return parsed
              // If we got partial/id-only orders (missing totals/state), try next URL (usually display=full)
            }
          } catch (e) {
            console.warn('[Dashboard] Orders fetch failed', e)
          }
        }
        return []
      }

      const [ordersList, productsResponse, cartsResponse, customersResponse, taxRulesResponse] = await Promise.all([
        fetchOrdersWithFallback(),
        fetch(`${baseUrl}/products?display=[id,price,id_tax_rules_group]`, {
          headers: { Authorization: 'Basic ' + btoa(wsKey + ':') }
        }),
        fetch(`${baseUrl}/carts?display=full&limit=1000`, {
          headers: { Authorization: 'Basic ' + btoa(wsKey + ':') }
        }),
        fetch(`${baseUrl}/customers?display=[id,firstname,lastname,email]`, {
          headers: { Authorization: 'Basic ' + btoa(wsKey + ':') }
        }),
        fetch(`${baseUrl}/tax_rule_groups?display=[id,name]`, {
          headers: { Authorization: 'Basic ' + btoa(wsKey + ':') }
        }).catch(() => null)
      ])

      setOrders(ordersList)
      if (ordersList.length === 0) {
        console.warn('[Dashboard] No orders loaded (ordersList is empty)')
      }

      const taxRates = new Map<number, number>()
      if (taxRulesResponse && taxRulesResponse.ok) {
        try {
          const xml = await taxRulesResponse.text()
          const doc = new DOMParser().parseFromString(xml, 'application/xml')
          const groups = Array.from(doc.getElementsByTagName('tax_rule_group'))
          groups.forEach((node) => {
            const id = Number(node.getElementsByTagName('id')[0]?.textContent || 0)
            const name = node.getElementsByTagName('name')[0]?.textContent || ''
            if (id > 0) {
              const match = name.match(/(\d+(?:\.\d+)?)\s*%/)
              if (match) {
                taxRates.set(id, parseFloat(match[1]) / 100)
              } else {
                taxRates.set(id, 0.20)
              }
            }
          })
        } catch (e) {
          console.warn('Failed to parse tax rules XML', e)
        }
      }

      const productPrices = new Map<number, { price: number; taxRate: number }>()
      if (productsResponse.ok) {
        const productsXml = await productsResponse.text()
        const productsDoc = new DOMParser().parseFromString(productsXml, 'application/xml')
        const productNodes = Array.from(productsDoc.getElementsByTagName('product'))
        productNodes.forEach((node) => {
          const id = Number(node.getElementsByTagName('id')[0]?.textContent || 0)
          const price = Number(node.getElementsByTagName('price')[0]?.textContent || 0)
          const taxGroupId = Number(node.getElementsByTagName('id_tax_rules_group')[0]?.textContent || 0)
          if (id > 0) {
            const taxRate = taxRates.has(taxGroupId) ? (taxRates.get(taxGroupId) ?? 0.20) : 0.20
            productPrices.set(id, {
              price: Number.isFinite(price) ? price : 0,
              taxRate
            })
          }
        })
      }

      // Keep tax rates available for order total recomputation
      const nextTaxRateById: Record<string, number> = {}
      productPrices.forEach((v, k) => {
        nextTaxRateById[String(k)] = v.taxRate
      })
      setProductTaxRateById(nextTaxRateById)

      if (cartsResponse.ok) {
        const cartsXml = await cartsResponse.text()
        const cartsDoc = new DOMParser().parseFromString(cartsXml, 'application/xml')
        const cartNodes = Array.from(cartsDoc.getElementsByTagName('cart'))

        const parsedCarts: CartSnapshot[] = cartNodes.map((node) => {
          const id = Number(node.getElementsByTagName('id')[0]?.textContent || 0)
          const idCustomer = Number(node.getElementsByTagName('id_customer')[0]?.textContent || 0)

          const cartRowNodes = Array.from(node.getElementsByTagName('cart_row'))
          let totalHt = 0
          let totalTtc = 0

          cartRowNodes.forEach((rowNode) => {
            const productId = Number(rowNode.getElementsByTagName('id_product')[0]?.textContent || 0)
            const qty = Number(rowNode.getElementsByTagName('quantity')[0]?.textContent || 0)
            const prodInfo = productPrices.get(productId)

            const unitPriceHt = prodInfo?.price || 0
            const taxRate = prodInfo?.taxRate ?? 0.20

            const lineHt = unitPriceHt * qty
            const lineTtc = lineHt * (1 + taxRate)

            totalHt += lineHt
            totalTtc += lineTtc
          })

          return {
            id,
            id_customer: idCustomer,
            totalHt,
            totalTtc,
          }
        }).filter((c) => c.id > 0)

        setCarts(parsedCarts)
      }

      if (customersResponse && customersResponse.ok) {
        try {
          const custXml = await customersResponse.text()
          const custDoc = new DOMParser().parseFromString(custXml, 'application/xml')
          const custNodes = Array.from(custDoc.getElementsByTagName('customer'))
          const parsed = custNodes.map((n) => ({
            id: Number(n.getElementsByTagName('id')[0]?.textContent || 0),
            firstname: n.getElementsByTagName('firstname')[0]?.textContent || '',
            lastname: n.getElementsByTagName('lastname')[0]?.textContent || '',
            email: n.getElementsByTagName('email')[0]?.textContent || '',
          })).filter(c => c.id > 0)
          setCustomers(parsed)
        } catch (e) {
          console.warn('Failed to parse customers XML', e)
        }
      }
    } catch (err) {
      console.error('Error fetching orders:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Grouper les commandes par jour
  const dailyStats = useMemo(() => {
    const stats: Record<string, { count: number; total: number }> = {}

    orders.forEach((o) => {
      if (!o.date_add) return
      const date = o.date_add.split(' ')[0] // YYYY-MM-DD
      if (!stats[date]) stats[date] = { count: 0, total: 0 }
      stats[date].count += 1
      stats[date].total += computeOrderTotals(o).ttc
    })

    return Object.entries(stats)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [orders])

  // Récupérer les stats pour la date sélectionnée
  const selectedDateStats = useMemo(() => {
    const ordersForDate = orders.filter((o) => {
      if (!o.date_add) return false
      return o.date_add.split(' ')[0] === selectedDate
    })

    const total = ordersForDate.reduce((sum, o) => sum + computeOrderTotals(o).ttc, 0)

    return {
      count: ordersForDate.length,
      total,
      average: ordersForDate.length > 0 ? total / ordersForDate.length : 0,
      orders: ordersForDate,
    }
  }, [orders, selectedDate])

  // Liste des dates disponibles
  const availableDates = useMemo(() => {
    const dates = new Set<string>()
    orders.forEach(o => {
      if (o.date_add) {
        dates.add(o.date_add.split(' ')[0])
      }
    })
    return Array.from(dates).sort((a, b) => b.localeCompare(a))
  }, [orders])

  const cartsNotOrdered = useMemo(() => {
    const orderedCartIds = new Set(orders.map((o) => o.id_cart).filter((id) => id > 0))
    return carts.filter((c) => !orderedCartIds.has(c.id))
  }, [carts, orders])

  const cartsCountWithCustomer = useMemo(() => {
    return cartsNotOrdered.filter((c) => c.id_customer > 0).length
  }, [cartsNotOrdered])

  const cartsCountWithoutCustomer = useMemo(() => {
    return cartsNotOrdered.filter((c) => !c.id_customer || c.id_customer === 0).length
  }, [cartsNotOrdered])

  // Toutes les commandes valides (Paiement effectue + Livre, exclut Panier/Annule)
  const ordersWithPayment = useMemo(() => {
    return orders.filter((o) => {
      if (o.state_id === 1) return false
      if (o.state_id === 3 || o.state_id === 6) return false
      const state = (o.state || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
      const isExcluded = state.includes('panier') || state.includes('annul')
      return !isExcluded
    })
  }, [orders])

  function computeOrderTotals(o: Order): { ht: number; ttc: number } {
    // Prefer recomputing from order rows to match the expected method (line totals + product tax)
    if (Array.isArray(o.items) && o.items.length > 0) {
      let ht = 0
      let ttc = 0
      for (const it of o.items) {
        const unitHt = Number(it.product_price || 0)
        const qty = Number(it.product_quantity || 0)
        const lineHt = unitHt * qty
        const taxRate = productTaxRateById[String(it.product_id)] ?? 0.20
        ht += lineHt
        ttc += lineHt * (1 + taxRate)
      }
      return { ht, ttc }
    }

    return {
      ht: Number(o.total_paid_tax_excl || 0),
      ttc: Number(o.total_paid || 0),
    }
  }

  const generalTotalHt = useMemo(() => {
    const sum = ordersWithPayment.reduce((sum, o) => sum + computeOrderTotals(o).ht, 0)
    return Number(sum.toFixed(2))
  }, [ordersWithPayment, productTaxRateById])

  const generalTotal = useMemo(() => {
    const sum = ordersWithPayment.reduce((sum, o) => sum + computeOrderTotals(o).ttc, 0)
    return Number(sum.toFixed(2))
  }, [ordersWithPayment, productTaxRateById])

  const cartsTotalHt = useMemo(() => {
    const sum = cartsNotOrdered.reduce((s, c) => s + (c.totalHt || 0), 0)
    return Number(sum.toFixed(2))
  }, [cartsNotOrdered])

  const cartsTotalTtc = useMemo(() => {
    const sum = cartsNotOrdered.reduce((s, c) => s + (c.totalTtc || 0), 0)
    return Number(sum.toFixed(2))
  }, [cartsNotOrdered])

  const cartsNotOrderedHt = cartsTotalHt
  const cartsNotOrderedTtc = cartsTotalTtc

  const totalLineCount = useMemo(() => ordersWithPayment.length + cartsNotOrdered.length, [ordersWithPayment.length, cartsNotOrdered.length])

  const conversionRate = useMemo(() => {
    if (totalLineCount === 0) return 0
    return (ordersWithPayment.length / totalLineCount) * 100
  }, [ordersWithPayment.length, totalLineCount])

  const abandonmentRate = useMemo(() => {
    if (totalLineCount === 0) return 0
    return (cartsNotOrdered.length / totalLineCount) * 100
  }, [cartsNotOrdered.length, totalLineCount])

  const cartsAvgTtc = useMemo(() => {
    if (cartsNotOrdered.length === 0) return 0
    return cartsNotOrderedTtc / cartsNotOrdered.length
  }, [cartsNotOrderedTtc, cartsNotOrdered.length])

  const ordersAvgTtc = useMemo(() => {
    if (ordersWithPayment.length === 0) return 0
    return generalTotal / ordersWithPayment.length
  }, [generalTotal, ordersWithPayment.length])

  function getCustomerById(idCustomer: number) {
    return customers.find((c) => c.id === idCustomer)
  }

  function getCustomerDisplayName(o: Order) {
    if (o.customer_name) return o.customer_name
    const c = getCustomerById(o.id_customer)
    if (!c) return `Client #${o.id_customer}`
    const full = [c.firstname, c.lastname].filter(Boolean).join(' ').trim()
    return full || `Client #${o.id_customer}`
  }

  function getCustomerDisplayEmail(o: Order) {
    if (o.customer_email) return o.customer_email
    const c = getCustomerById(o.id_customer)
    return c?.email || ''
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>
            Vue d'ensemble
          </div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700 }}>Tableau de bord</h1>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(140px, 1fr))', gap: 12, alignItems: 'center' }}>
          <div style={{ ...cardStyle, textAlign: 'center', padding: 16 }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 8, fontWeight: 600 }}>TOTAL LIGNES</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{totalLineCount}</div>
          </div>

          <div style={{ ...cardStyle, textAlign: 'center', padding: 16 }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>COMMANDES</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{ordersWithPayment.length}</div>
          </div>

          <div style={{ ...cardStyle, textAlign: 'center', padding: 16 }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>PANIERS</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{cartsNotOrdered.length}</div>
          </div>

          <div style={{ ...cardStyle, textAlign: 'center', padding: 16 }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>CONVERSION</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#9be7a8' }}>{formatPercent(conversionRate)}</div>
          </div>

          <div style={{ ...cardStyle, textAlign: 'center', padding: 16 }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>ABANDON</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#ffb86b' }}>{formatPercent(abandonmentRate)}</div>
          </div>
        </div>
      </div>

      <section style={cardStyle}>
        <h3 style={{ marginBottom: 20, fontSize: 18, fontWeight: 600 }}>Taux généraux</h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {/* Card 1: Taux généraux */}
          <div style={{ background: 'rgba(155, 231, 168, 0.08)', border: '1px solid rgba(155, 231, 168, 0.2)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 13, color: '#9be7a8', fontWeight: 700, marginBottom: 10 }}>Taux généraux</div>
            <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
              <div style={metricLineStyle}><span>Taux de conversion</span><strong>{formatPercent(conversionRate)}</strong></div>
              <div style={metricLineStyle}><span>Taux d'abandon panier</span><strong>{formatPercent(abandonmentRate)}</strong></div>
              <div style={metricLineStyle}><span>Total lignes</span><strong>{totalLineCount}</strong></div>
            </div>
          </div>

          {/* Card 2: Commandes generales (paiement effectue + livre) */}
          <div style={{ background: 'rgba(74, 144, 226, 0.08)', border: '1px solid rgba(74, 144, 226, 0.2)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 13, color: '#4a90e2', fontWeight: 700, marginBottom: 10 }}>Commandes generales paiement effectue + livre</div>
            <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
              <div style={metricLineStyle}><span>Nombre de commandes</span><strong>{ordersWithPayment.length}</strong></div>
              <div style={metricLineStyle}><span>Total HT général</span><strong>{formatPrice(generalTotalHt)}</strong></div>
              <div style={metricLineStyle}><span>Total TTC général</span><strong>{formatPrice(generalTotal)}</strong></div>
              <div style={metricLineStyle}><span>Panier moyen TTC</span><strong>{formatPrice(ordersAvgTtc)}</strong></div>
            </div>
          </div>

          {/* Card 3: Paniers non commandés dans le panier + sans état */}
          <div style={{ background: 'rgba(255, 184, 107, 0.08)', border: '1px solid rgba(255, 184, 107, 0.2)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 13, color: '#ffb86b', fontWeight: 700, marginBottom: 4 }}>Paniers non commandés dans le panier + sans état</div>
            <div style={{ fontSize: 12, color: '#aaa', marginBottom: 10, fontStyle: 'italic' }}>
              {cartsCountWithCustomer} « dans le panier » + {cartsCountWithoutCustomer} sans état = {cartsNotOrdered.length} paniers
            </div>
            <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
              <div style={metricLineStyle}><span>Nombre général</span><strong>{cartsNotOrdered.length}</strong></div>
              <div style={metricLineStyle}><span>Panier HT général</span><strong>{formatPrice(cartsNotOrderedHt)}</strong></div>
              <div style={metricLineStyle}><span>Paniers TTC général</span><strong>{formatPrice(cartsNotOrderedTtc)}</strong></div>
              <div style={metricLineStyle}><span>Panier moyen TTC</span><strong>{formatPrice(cartsAvgTtc)}</strong></div>
            </div>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 100, color: '#666' }}>Chargement des statistiques...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
          {/* SÉLECTEUR DE DATE */}
          <section style={cardStyle}>
            <h3 style={{ marginBottom: 20, fontSize: 18, fontWeight: 600 }}>Statistiques pour une date</h3>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 8, fontWeight: 600 }}>
                  Sélectionner une date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  style={{

                    padding: '10px 12px',
                    borderRadius: 8,
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff',
                    fontSize: 14,
                    cursor: 'pointer'
                  }}
                />
              </div>
              <div style={{ minWidth: '220px' }}>
                <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 8, fontWeight: 600 }}>
                  Dates disponibles
                </label>
                <select
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  style={{

                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff',
                    fontSize: 14,
                    cursor: 'pointer'
                  }}
                >
                  {availableDates.map((date) => (
                    <option key={`available-date-${date}`} value={date}>
                      {formatDate(date)}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Commandes</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#4a90e2' }}>
                    {selectedDateStats.count}
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Total</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#9be7a8' }}>
                    {formatPrice(selectedDateStats.total)}
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Moyenne</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#ffb86b' }}>
                    {formatPrice(selectedDateStats.average)}
                  </div>
                </div>
              </div>
            </div>

            {/* Détail des commandes de la date sélectionnée */}
            {selectedDateStats.count > 0 && (
              <div style={{ marginTop: 24, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 24 }}>
                <h4 style={{ marginBottom: 16, fontSize: 14, fontWeight: 600 }}>Commandes du {formatDate(selectedDate)}</h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#888' }}>
                        <th style={{ padding: '8px 12px' }}>Commande</th>
                        <th style={{ padding: '8px 12px' }}>Client</th>
                        <th style={{ padding: '8px 12px' }}>Email</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Montant</th>
                        <th style={{ padding: '8px 12px' }}>État</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedDateStats.orders.map((o) => (
                        (() => {
                          const normalizedState = (o.state || '')
                            .toLowerCase()
                            .normalize('NFD')
                            .replace(/[\u0300-\u036f]/g, '')
                          const isCanceled = normalizedState.includes('annul') || o.state_id === 6 || o.state_id === 3
                          return (
                        <tr key={`order-${o.id}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 600 }}>#{o.id}</td>
                          <td style={{ padding: '8px 12px' }}>{getCustomerDisplayName(o)}</td>
                          <td style={{ padding: '8px 12px', color: '#aaa', fontSize: 12 }}>{getCustomerDisplayEmail(o)}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#9be7a8' }}>
                            {formatPrice(o.total_paid || 0)}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <span style={{
                              fontSize: 11,
                              padding: '4px 8px',
                              borderRadius: 4,
                              background: isCanceled ? 'rgba(255,107,107,0.1)' : 'rgba(155,231,168,0.1)',
                              color: isCanceled ? '#ff6b6b' : '#9be7a8',
                              fontWeight: 600
                            }}>
                              {o.state || 'En attente'}
                            </span>
                          </td>
                        </tr>
                          )
                        })()
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {selectedDateStats.count === 0 && (
              <div style={{ marginTop: 16, padding: 16, textAlign: 'center', color: '#666', fontSize: 13 }}>
                Aucune commande pour le {formatDate(selectedDate)}
              </div>
            )}
          </section>

          <section style={cardStyle}>
            <h3 style={{ marginBottom: 20, fontSize: 18, fontWeight: 600 }}>Historique de toutes les dates</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#888', fontSize: 13 }}>
                    <th style={{ padding: '12px 16px' }}>Date</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Nb Commandes</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Montant Total</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Moyenne</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyStats.map((stat) => (
                    <tr
                      key={`daily-${stat.date}`}
                      onClick={() => setSelectedDate(stat.date)}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        transition: 'background 0.2s',
                        background: selectedDate === stat.date ? 'rgba(74, 144, 226, 0.1)' : 'transparent',
                        cursor: 'pointer'
                      }}
                    >
                      <td style={{ padding: '16px', fontWeight: 500 }}>{formatDate(stat.date)}</td>
                      <td style={{ padding: '16px', textAlign: 'center' }}>
                        <span style={{
                          background: 'rgba(74, 144, 226, 0.1)',
                          color: '#4a90e2',
                          padding: '4px 12px',
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 700
                        }}>
                          {stat.count}
                        </span>
                      </td>
                      <td style={{ padding: '16px', textAlign: 'right', fontWeight: 600, color: '#9be7a8' }}>
                        {formatPrice(stat.total)}
                      </td>
                      <td style={{ padding: '16px', textAlign: 'right', fontWeight: 600, color: '#ffb86b' }}>
                        {formatPrice(stat.total / stat.count)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>




        </div>
      )}
    </div>
  )
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function formatPrice(amount: number): string {
  return amount.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + ' €'
}

function formatPercent(value: number): string {
  return value.toLocaleString('fr-FR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }) + ' %'
}

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.08)',
  padding: 24,
  backdropFilter: 'blur(10px)'
}

const metricLineStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
}
