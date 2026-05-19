import { useEffect, useMemo, useState } from 'react'
import { API } from '../../api/API'
import { Category } from '../../entities/Category'
import { Order } from '../../entities/Order'
import { Product } from '../../entities/Product'
import { StockAvailable } from '../../entities/StockAvailable'
import { CategoryService } from '../../service/CategoryService'
import { OrderService } from '../../service/OrderService'
import { ProductService } from '../../service/ProductService'
import { StockAvailableService } from '../../service/StockAvailableService'

type CategoryAggregate = {
  id: number
  name: string
  salesHt: number
  purchaseHt: number
  profitHt: number
  physicalQty: number
  reservedQty: number
  availableQty: number
}

const cardStyle: React.CSSProperties = {
  padding: 24,
  borderRadius: 16,
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
  backdropFilter: 'blur(10px)',
}

function formatPrice(value: number): string {
  return `${value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}

function formatQty(value: number): string {
  return value.toLocaleString('fr-FR', { maximumFractionDigits: 0 })
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function isPaidOrDelivered(order: Order): boolean {
  if (order.state_id === 2 || order.state_id === 5) return true
  const state = normalizeText(order.state || '')
  return state.includes('pay') || state.includes('livr')
}

function isReserved(order: Order): boolean {
  if (order.state_id === 2) return true
  const state = normalizeText(order.state || '')
  return state.includes('pay') && !state.includes('livr')
}

export default function StatisticsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [stocks, setStocks] = useState<StockAvailable[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setStatus('')
    try {
      const api = new API()
      const productService = new ProductService()
      const categoryService = new CategoryService()
      const orderService = new OrderService()
      const stockService = new StockAvailableService()

      const [productList, categoryList, orderList, stockList] = await Promise.all([
        api.fetch<Product>({
          method: 'GET',
          mere: new Product(),
          service: productService,
          params: new URLSearchParams({ display: 'full', limit: '1000' }),
        }),
        api.fetch<Category>({
          method: 'GET',
          mere: new Category(),
          service: categoryService,
          params: new URLSearchParams({ display: 'full', limit: '1000' }),
        }),
        api.fetch<Order>({
          method: 'GET',
          mere: new Order(),
          service: orderService,
          params: new URLSearchParams({ display: 'full', limit: '1000' }),
        }),
        api.fetch<StockAvailable>({
          method: 'GET',
          mere: new StockAvailable(),
          service: stockService,
          params: new URLSearchParams({ display: 'full', limit: '1000' }),
        }),
      ])

      setProducts(productList)
      setCategories(categoryList)
      setOrders(orderList)
      setStocks(stockList)
      setStatus(`✓ ${productList.length} produit(s), ${orderList.length} commande(s) chargée(s)`)
    } catch (err) {
      setProducts([])
      setCategories([])
      setOrders([])
      setStocks([])
      setStatus(`✗ ${err instanceof Error ? err.message : 'Erreur inconnue'}`)
    } finally {
      setLoading(false)
    }
  }

  const categoryRows = useMemo(() => {
    const categoryNameById = new Map<number, string>()
    categories.forEach((category) => {
      if (typeof category.id === 'number' && category.id > 0) {
        categoryNameById.set(category.id, category.name || `Catégorie #${category.id}`)
      }
    })

    const productById = new Map<number, Product>()
    products.forEach((product) => {
      if (typeof product.id === 'number' && product.id > 0) {
        productById.set(product.id, product)
      }
    })

    const stockByProductId = new Map<number, number>()
    stocks.forEach((stock) => {
      if (!stock.id_product) return
      const current = stockByProductId.get(stock.id_product) || 0
      stockByProductId.set(stock.id_product, current + Number(stock.quantity || 0))
    })

    const categoryByProductId = new Map<number, number>()
    products.forEach((product) => {
      const defaultCategory = Number(product.id_category_default || 0)
      const associationCategory = product.associations?.categories?.[0]?.value || 0
      categoryByProductId.set(product.id || 0, defaultCategory > 0 ? defaultCategory : associationCategory)
    })

    const aggregates = new Map<number, CategoryAggregate>()

    const ensureCategory = (categoryId: number): CategoryAggregate => {
      if (!aggregates.has(categoryId)) {
        aggregates.set(categoryId, {
          id: categoryId,
          name: categoryId > 0 ? (categoryNameById.get(categoryId) || `Catégorie #${categoryId}`) : 'Sans catégorie',
          salesHt: 0,
          purchaseHt: 0,
          profitHt: 0,
          physicalQty: 0,
          reservedQty: 0,
          availableQty: 0,
        })
      }
      return aggregates.get(categoryId)!
    }

    products.forEach((product) => {
      const productId = product.id || 0
      if (productId <= 0) return
      const categoryId = categoryByProductId.get(productId) || 0
      const row = ensureCategory(categoryId)
      row.physicalQty += Number(stockByProductId.get(productId) ?? product.quantity ?? 0)
    })

    orders.filter(isReserved).forEach((order) => {
      order.items.forEach((item) => {
        const product = productById.get(item.product_id)
        const categoryId = categoryByProductId.get(item.product_id) || product?.id_category_default || 0
        const row = ensureCategory(categoryId)
        row.reservedQty += Number(item.product_quantity || 0)
      })
    })

    orders.filter(isPaidOrDelivered).forEach((order) => {
      order.items.forEach((item) => {
        const product = productById.get(item.product_id)
        const categoryId = categoryByProductId.get(item.product_id) || product?.id_category_default || 0
        const row = ensureCategory(categoryId)
        const quantity = Number(item.product_quantity || 0)
        const salesHt = Number(item.product_price || 0) * quantity
        const purchaseHt = Number(product?.wholesale_price || 0) * quantity

        row.salesHt += salesHt
        row.purchaseHt += purchaseHt
      })
    })

    return Array.from(aggregates.values())
      .map((row) => ({
        ...row,
        profitHt: row.salesHt - row.purchaseHt,
        availableQty: row.physicalQty - row.reservedQty,
      }))
      .sort((left, right) => right.profitHt - left.profitHt)
  }, [categories, orders, products, stocks])

  const totals = useMemo(() => {
    const salesHt = categoryRows.reduce((sum, row) => sum + row.salesHt, 0)
    const purchaseHt = categoryRows.reduce((sum, row) => sum + row.purchaseHt, 0)
    const profitHt = salesHt - purchaseHt

    return {
      salesHt,
      purchaseHt,
      profitHt,
    }
  }, [categoryRows])

  return (
    <section style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto' }}>
      <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>
        Statistiques
      </div>
      <h1 style={{ marginTop: 0, marginBottom: 8, fontSize: 36, fontWeight: 700, color: '#fff' }}>
        Tableau de bord analytique
      </h1>
      <p style={{ color: '#aaa', marginBottom: 28, fontSize: 15, lineHeight: 1.6 }}>
        Montants HT, bénéfice par catégorie et synthèse des quantités physiques, réservées et disponibles.
      </p>

      {status && (
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <p style={{ margin: 0, color: status.startsWith('✓') ? '#9be7a8' : '#ff6b6b', fontSize: 14 }}>
            {status}
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 8, fontWeight: 600 }}>VENTES HT</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: '#9be7a8' }}>{formatPrice(totals.salesHt)}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 8, fontWeight: 600 }}>ACHATS HT</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: '#4a90e2' }}>{formatPrice(totals.purchaseHt)}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 8, fontWeight: 600 }}>BÉNÉFICE HT</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: totals.profitHt >= 0 ? '#9be7a8' : '#ff8a80' }}>{formatPrice(totals.profitHt)}</div>
        </div>
      </div>

      {loading ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: 48, color: '#aaa' }}>Chargement des statistiques...</div>
      ) : (
        <div style={{ display: 'grid', gap: 20 }}>
          <section style={cardStyle}>
            <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 18, fontWeight: 600, color: '#fff' }}>Bénéfice par catégorie</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#888', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px' }}>Catégorie</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Ventes HT</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Achats HT</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Bénéfice HT</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: '18px 16px', color: '#666', textAlign: 'center' }}>
                        Aucune donnée disponible.
                      </td>
                    </tr>
                  ) : (
                    categoryRows.map((row) => (
                      <tr key={`profit-${row.id}-${row.name}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#fff' }}>{row.name}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#9be7a8', fontWeight: 600 }}>{formatPrice(row.salesHt)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#4a90e2', fontWeight: 600 }}>{formatPrice(row.purchaseHt)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: row.profitHt >= 0 ? '#9be7a8' : '#ff8a80', fontWeight: 700 }}>{formatPrice(row.profitHt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section style={cardStyle}>
            <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 18, fontWeight: 600, color: '#fff' }}>Stock par catégorie</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#888', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px' }}>Catégorie</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Qté physique</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Qté reservé</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Qté disponible</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: '18px 16px', color: '#666', textAlign: 'center' }}>
                        Aucune donnée de stock disponible.
                      </td>
                    </tr>
                  ) : (
                    categoryRows.map((row) => (
                      <tr key={`stock-${row.id}-${row.name}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#fff' }}>{row.name}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>{formatQty(row.physicalQty)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#ffb86b' }}>{formatQty(row.reservedQty)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#9be7a8' }}>{formatQty(row.availableQty)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}