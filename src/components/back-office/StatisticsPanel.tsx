import { useMemo } from 'react'
import { Order } from '../../entities/Order'

type ProductInfo = {
  id: number
  price: number
  cost: number
  category_name: string
  stock_available: number
  stock_reserved: number
}

type CategoryStats = {
  name: string
  qty_sold: number
  qty_physical: number
  qty_reserved: number
  qty_available: number
  sales_ht: number
  sales_ttc: number
  cost_total: number
  profit: number
}

interface StatisticsPanelProps {
  orders: Order[]
  products: ProductInfo[]
  productTaxRateById: Record<string, number>
}

export default function StatisticsPanel({ orders, products, productTaxRateById }: StatisticsPanelProps) {
  const productById = useMemo(() => {
    const map = new Map<number, ProductInfo>()
    for (const p of products) map.set(p.id, p)
    return map
  }, [products])

  // Filtre les commandes valides (non panier, non annulée)
  const validOrders = useMemo(() => {
    return orders.filter((o) => {
      if (o.state_id === 1 || o.state_id === 3 || o.state_id === 6) return false
      const state = (o.state || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
      return !state.includes('panier') && !state.includes('annul')
    })
  }, [orders])

  // Quantité réservée: commandes non livrées et non annulées.
  const reservedQtyByCategory = useMemo(() => {
    const reservedByCategory: Record<string, number> = {}

    const pendingOrders = orders.filter((o) => {
      const state = (o.state || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')

      const isDelivered = o.state_id === 5 || state.includes('livr')
      const isCanceled = o.state_id === 3 || o.state_id === 6 || state.includes('annul')
      return !isDelivered && !isCanceled
    })

    for (const order of pendingOrders) {
      if (!Array.isArray(order.items)) continue
      for (const item of order.items) {
        const product = productById.get(Number(item.product_id || 0))
        const category = product?.category_name || 'Sans catégorie'
        const qty = Math.trunc(Number(item.product_quantity || 0))
        if (!Number.isFinite(qty) || qty <= 0) continue
        reservedByCategory[category] = (reservedByCategory[category] || 0) + qty
      }
    }

    return reservedByCategory
  }, [orders, productById])

  // Quantité déjà sortie du stock: commandes livrées uniquement.
  const deliveredQtyByCategory = useMemo(() => {
    const deliveredByCategory: Record<string, number> = {}

    const deliveredOrders = orders.filter((o) => {
      const state = (o.state || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
      return o.state_id === 5 || state.includes('livr')
    })

    for (const order of deliveredOrders) {
      if (!Array.isArray(order.items)) continue
      for (const item of order.items) {
        const product = productById.get(Number(item.product_id || 0))
        const category = product?.category_name || 'Sans catégorie'
        const qty = Math.trunc(Number(item.product_quantity || 0))
        if (!Number.isFinite(qty) || qty <= 0) continue
        deliveredByCategory[category] = (deliveredByCategory[category] || 0) + qty
      }
    }

    return deliveredByCategory
  }, [orders, productById])

  // Statistiques globales
  const globalStats = useMemo(() => {
    let totalSalesHt = 0
    let totalSalesTtc = 0
    let totalCost = 0

    validOrders.forEach((order) => {
      if (Array.isArray(order.items)) {
        order.items.forEach((item) => {
          const unitPrice = Number(item.product_price || 0)
          const qty = Number(item.product_quantity || 0)
          const lineHt = unitPrice * qty
          const taxRate = productTaxRateById[String(item.product_id)] ?? 0.2
          totalSalesHt += lineHt
          totalSalesTtc += lineHt * (1 + taxRate)

          // Trouver le produit pour son coût
          const prod = productById.get(Number(item.product_id || 0))
          if (prod) {
            totalCost += (prod.cost || 0) * qty
          }
        })
      }
    })

    const profit = totalSalesHt - totalCost
    const profitMargin = totalSalesHt > 0 ? (profit / totalSalesHt) * 100 : 0

    return {
      totalSalesHt: Number(totalSalesHt.toFixed(2)),
      totalSalesTtc: Number(totalSalesTtc.toFixed(2)),
      totalCost: Number(totalCost.toFixed(2)),
      profit: Number(profit.toFixed(2)),
      profitMargin: Number(profitMargin.toFixed(2)),
    }
  }, [validOrders, productById, productTaxRateById])

  // Statistiques par catégorie
  const categoryStats = useMemo(() => {
    const categories: Record<string, CategoryStats> = {}

    // Initialiser les catégories avec les stocks
    products.forEach((prod) => {
      const catName = prod.category_name || 'Sans catégorie'
      if (!categories[catName]) {
        categories[catName] = {
          name: catName,
          qty_sold: 0,
          qty_physical: 0,
          qty_reserved: 0,
          qty_available: 0,
          sales_ht: 0,
          sales_ttc: 0,
          cost_total: 0,
          profit: 0,
        }
      }
      categories[catName].qty_physical += prod.stock_available
      categories[catName].qty_reserved += prod.stock_reserved || 0
      categories[catName].qty_available += prod.stock_available - (prod.stock_reserved || 0)
    })

    // Ajouter les ventes par catégorie
    validOrders.forEach((order) => {
      if (Array.isArray(order.items)) {
        order.items.forEach((item) => {
          const prod = productById.get(Number(item.product_id || 0))
          if (prod) {
            const catName = prod.category_name || 'Sans catégorie'
            const unitPrice = Number(item.product_price || 0)
            const qty = Number(item.product_quantity || 0)
            const lineHt = unitPrice * qty
            const taxRate = productTaxRateById[String(item.product_id)] ?? 0.2

            if (categories[catName]) {
              categories[catName].qty_sold += qty
              categories[catName].sales_ht += lineHt
              categories[catName].sales_ttc += lineHt * (1 + taxRate)
              categories[catName].cost_total += (prod.cost || 0) * qty
            }
          }
        })
      }
    })

    // Calculer les bénéfices
    Object.keys(categories).forEach((catName) => {
      const reservedFromOrders = reservedQtyByCategory[catName] || 0
      const deliveredQty = deliveredQtyByCategory[catName] || 0
      const physicalWithInitial = categories[catName].qty_physical + deliveredQty
      categories[catName].qty_physical = physicalWithInitial
      categories[catName].qty_reserved = reservedFromOrders
      categories[catName].qty_available = physicalWithInitial - reservedFromOrders
      categories[catName].profit = categories[catName].sales_ht - categories[catName].cost_total
    })

    return Object.values(categories).sort((a, b) => b.sales_ht - a.sales_ht)
  }, [products, validOrders, productTaxRateById, productById, reservedQtyByCategory, deliveredQtyByCategory])

  const cardStyle = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  }

  const formatPrice = (n: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(n)
  }

  return (
    <>
      {/* Statistiques globales */}
      <section style={cardStyle}>
        <h3 style={{ marginBottom: 20, fontSize: 18, fontWeight: 600 }}>Statistiques Globales</h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
          }}
        >
          <div style={{ padding: 16, background: 'rgba(155,231,168,0.05)', borderRadius: 8, border: '1px solid rgba(155,231,168,0.2)' }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 8, fontWeight: 600 }}>VENTES (HT)</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#9be7a8' }}>{formatPrice(globalStats.totalSalesHt)}</div>
          </div>

          <div style={{ padding: 16, background: 'rgba(66,165,245,0.05)', borderRadius: 8, border: '1px solid rgba(66,165,245,0.2)' }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 8, fontWeight: 600 }}>VENTES (TTC)</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#42a5f5' }}>{formatPrice(globalStats.totalSalesTtc)}</div>
          </div>

          <div style={{ padding: 16, background: 'rgba(255,183,107,0.05)', borderRadius: 8, border: '1px solid rgba(255,183,107,0.2)' }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 8, fontWeight: 600 }}>COÛT D'ACHAT</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#ffb86b' }}>{formatPrice(globalStats.totalCost)}</div>
          </div>

          <div style={{ padding: 16, background: 'rgba(255,107,107,0.05)', borderRadius: 8, border: '1px solid rgba(255,107,107,0.2)' }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 8, fontWeight: 600 }}>BÉNÉFICE</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: globalStats.profit >= 0 ? '#9be7a8' : '#ff6b6b' }}>
              {formatPrice(globalStats.profit)}
            </div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>Marge: {globalStats.profitMargin.toFixed(1)}%</div>
          </div>
        </div>
      </section>

      {/* Tableau par catégorie */}
      <section style={cardStyle}>
        <h3 style={{ marginBottom: 20, fontSize: 18, fontWeight: 600 }}>Statistiques par Catégorie</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#888', fontSize: 12 }}>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Catégorie</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>Qté Vendue</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>Qté Physique</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>Qté Réservé</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>Qté Disponible</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>Ventes (HT)</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>Coût</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>Bénéfice</th>
              </tr>
            </thead>
            <tbody>
              {categoryStats.map((cat) => (
                <tr key={cat.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 500 }}>{cat.name}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', color: '#4a90e2' }}>{cat.qty_sold}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', color: '#aaa' }}>{cat.qty_physical}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', color: '#ffb86b' }}>{cat.qty_reserved}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', color: '#9be7a8' }}>{cat.qty_available}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 500 }}>{formatPrice(cat.sales_ht)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: '#ffb86b' }}>{formatPrice(cat.cost_total)}</td>
                  <td
                    style={{
                      padding: '12px 16px',
                      textAlign: 'right',
                      fontWeight: 600,
                      color: cat.profit >= 0 ? '#9be7a8' : '#ff6b6b',
                    }}
                  >
                    {formatPrice(cat.profit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {categoryStats.length === 0 && (
          <div style={{ textAlign: 'center', padding: 24, color: '#666' }}>Aucune catégorie</div>
        )}
      </section>

      <section style={cardStyle}>
        <h3 style={{ marginBottom: 20, fontSize: 18, fontWeight: 600 }}>Stock par catégorie</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#888', fontSize: 12 }}>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Catégorie</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>Qté physique</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>Qté reservé</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>Qté disponible</th>
              </tr>
            </thead>
            <tbody>
              {categoryStats.map((cat) => (
                <tr key={`stock-${cat.name}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 500 }}>{cat.name}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', color: '#aaa' }}>{cat.qty_physical}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', color: '#ffb86b' }}>{cat.qty_reserved}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', color: cat.qty_available >= 0 ? '#9be7a8' : '#ff6b6b' }}>{cat.qty_available}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
