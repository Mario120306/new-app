import { useState, useEffect, useMemo, useRef } from 'react'
import { Product } from '../../entities/Product'
import { ProductService } from '../../service/ProductService'
import { CategoryService } from '../../service/CategoryService'
import { StockAvailableService } from '../../service/StockAvailableService'
import { OrderService } from '../../service/OrderService'
import { Category } from '../../entities/Category'
import { applyStockDelta } from '../../utils/stockMovement'
import { orderStateTriggersStockMovement } from '../../utils/orderState'
import { readSyncedStockOrderIds, writeSyncedStockOrderIds } from '../../utils/stockRules'

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Filters
  const [filterName, setFilterName] = useState('')
  const [filterRef, setFilterRef] = useState('')
  const [filterCat, setFilterCat] = useState<number | 'all'>('all')

  // Stock Management Modal
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isStockModalOpen, setIsStockModalOpen] = useState(false)
  const [newStockQty, setNewStockQty] = useState<number>(0)
  const [isUpdatingStock, setIsUpdatingStock] = useState(false)

  // Stock Evolution View
  const [showEvolutionId, setShowEvolutionId] = useState<number | null>(null)
  const [stockEvolutionLoading, setStockEvolutionLoading] = useState(false)
  const [stockEvolutionError, setStockEvolutionError] = useState('')
  const [stockEvolutionRows, setStockEvolutionRows] = useState<Array<{
    date: string
    openingQty: number
    incomingQty: number
    outgoingQty: number
    netChange: number
    closingQty: number
  }>>([])
  const hasLoggedDuplicateCategories = useRef(false)

  type StockHistoryEntry = {
    date: string
    openingQty: number
    closingQty: number
    delta: number
  }

  type CustomStockRow = {
    movement_date: string
    id_product: number
    id_product_attribute: number
    qty_delta_total: number
    qty_after_last_update: number
    date_add: string
    date_upd: string
  }

  const productService = new ProductService()
  const categoryService = new CategoryService()
  const stockService = new StockAvailableService()
  const orderService = new OrderService()

  const csvEscape = (value: unknown): string => {
    const raw = value === null || value === undefined ? '' : String(value)
    const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    return `"${normalized.replace(/"/g, '""')}"`
  }

  const toIsoDate = (value?: Date): string => {
    if (!value) return ''
    const t = value.getTime()
    if (Number.isNaN(t)) return ''
    return value.toISOString().slice(0, 10)
  }

  const sanitizeFileName = (value: string): string => {
    return value
      .trim()
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, ' ')
      .slice(0, 80)
  }

  const downloadCsv = (filename: string, csvContent: string) => {
    const blob = new Blob([`\ufeff${csvContent}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const exportProductAsCsv = (product: Product) => {
    const categoryName =
      (typeof product.id_category_default === 'number'
        ? categories.find((c) => c.id === product.id_category_default)?.name
        : undefined) || ''

    const sep = ';'
    const header = [
      'id',
      'reference',
      'name',
      'price',
      'quantity',
      'default_category_id',
      'default_category_name',
      'active',
      'date_add',
      'available_date',
    ]

    const row = [
      product.id ?? '',
      product.reference ?? '',
      product.name ?? '',
      typeof product.price === 'number' ? product.price.toFixed(2) : '',
      typeof product.quantity === 'number' ? product.quantity : '',
      product.id_category_default ?? '',
      categoryName,
      product.active ? 1 : 0,
      toIsoDate(product.date_add),
      toIsoDate(product.available_date),
    ]

    const csv = [`sep=${sep}`, header.map(csvEscape).join(sep), row.map(csvEscape).join(sep)].join('\n')
    const safeName = sanitizeFileName(product.name || 'product')
    const fileName = `product_${product.id ?? 'unknown'}_${safeName}.csv`
    downloadCsv(fileName, csv)
  }

  const getStockHistoryKey = (productId: number) => `new-app-stock-history-${productId}`

  const readStockHistory = (productId: number): StockHistoryEntry[] => {
    try {
      const raw = window.localStorage.getItem(getStockHistoryKey(productId))
      if (!raw) return []
      const parsed = JSON.parse(raw) as StockHistoryEntry[]
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  const writeStockHistory = (productId: number, entries: StockHistoryEntry[]) => {
    window.localStorage.setItem(getStockHistoryKey(productId), JSON.stringify(entries))
  }

  const formatDayLabel = (value: string): string => {
    const date = new Date(`${value}T00:00:00`)
    if (Number.isNaN(date.getTime())) return value
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date)
  }

  const parseCustomStockRows = (xml: string): CustomStockRow[] => {
    const doc = new DOMParser().parseFromString(xml, 'application/xml')
    const rows = Array.from(doc.getElementsByTagName('row'))

    return rows.map((row) => ({
      movement_date: row.getElementsByTagName('movement_date')[0]?.textContent?.trim() || '',
      id_product: Number(row.getElementsByTagName('id_product')[0]?.textContent || 0),
      id_product_attribute: Number(row.getElementsByTagName('id_product_attribute')[0]?.textContent || 0),
      qty_delta_total: Number(row.getElementsByTagName('qty_delta_total')[0]?.textContent || 0),
      qty_after_last_update: Number(row.getElementsByTagName('qty_after_last_update')[0]?.textContent || 0),
      date_add: row.getElementsByTagName('date_add')[0]?.textContent?.trim() || '',
      date_upd: row.getElementsByTagName('date_upd')[0]?.textContent?.trim() || '',
    }))
  }

  const getPrestaBase = () => (import.meta.env.VITE_PRESTASHOP_BASE_URL || '/prestashop').replace(/\/$/, '')

  const postCustomStockMovement = async (
    idProduct: number,
    idProductAttribute: number,
    delta: number,
    movementDate: string
  ): Promise<boolean> => {
    const ok = await applyStockDelta(idProduct, idProductAttribute, delta, movementDate)
    if (ok) {
      window.dispatchEvent(new Event('prestashop-stock-updated'))
      return true
    }
    console.warn(
      `[ProductsPage] Mouvement de stock échoué (produit=${idProduct}, variante=${idProductAttribute}, delta=${delta}, date=${movementDate})`
    )
    return false
  }

  const fetchCustomStockRows = async (productId: number): Promise<CustomStockRow[]> => {
    const base = getPrestaBase()

    try {
      const response = await fetch(`${base}/bridge/stock_history.php?id_product=${productId}`)
      if (response.ok) {
        return parseCustomStockRows(await response.text())
      }
    } catch {
      // ignore
    }

    return []
  }

  const syncOrdersStock = async (orders: Array<ReturnType<OrderService['createListBy']>[number]>) => {
    const syncedOrderIds = new Set(readSyncedStockOrderIds())

    for (const order of orders) {
      if (!order?.id || !orderStateTriggersStockMovement(order.state_id, order.state)) continue
      if (syncedOrderIds.has(order.id)) continue

      const stockMovements = new Map<string, { idProduct: number; idProductAttribute: number; delta: number }>()

      for (const item of order.items || []) {
        const idProduct = Number(item.product_id || 0)
        const idProductAttribute = Number(item.product_attribute_id || 0)
        const quantity = Math.trunc(Number(item.product_quantity || 0))
        if (!idProduct || quantity <= 0) continue

        const key = `${idProduct}:${idProductAttribute}`
        const current = stockMovements.get(key)
        const delta = -Math.abs(quantity)

        if (current) {
          current.delta += delta
        } else {
          stockMovements.set(key, { idProduct, idProductAttribute, delta })
        }
      }

      let allOk = true
      const movementDate = (order.date_add || new Date().toISOString().slice(0, 10)).slice(0, 10)

      for (const movement of stockMovements.values()) {
        if (movement.delta === 0) continue

        const ok = await postCustomStockMovement(
          movement.idProduct,
          movement.idProductAttribute,
          movement.delta,
          movementDate
        )

        if (!ok) {
          allOk = false
          console.warn(
            `[ProductsPage] Impossible de créer le mouvement de stock pour la commande ${order.id} (produit=${movement.idProduct}, variante=${movement.idProductAttribute}, delta=${movement.delta})`
          )
        }
      }

      if (allOk) {
        syncedOrderIds.add(order.id)
      }
    }

    writeSyncedStockOrderIds(Array.from(syncedOrderIds))
    window.dispatchEvent(new Event('prestashop-stock-updated'))
  }

  const loadStockEvolution = async (productId: number) => {
    setStockEvolutionLoading(true)
    setStockEvolutionError('')
    setStockEvolutionRows([])

    try {
      const rows = await fetchCustomStockRows(productId)
      if (rows.length === 0) {
        setStockEvolutionError('Aucun stock trouvé pour ce produit.')
        return
      }

      const sortedRows = [...rows].sort((a, b) => {
        const aKey = `${a.date_upd || ''}|${a.movement_date || ''}`
        const bKey = `${b.date_upd || ''}|${b.movement_date || ''}`
        return aKey.localeCompare(bKey)
      })

      const grouped: Record<string, { date: string; openingQty: number; closingQty: number; incoming: number; outgoing: number; net: number }> = {}

      let previousClosing = sortedRows[0]?.qty_after_last_update ?? 0
      sortedRows.forEach((entry) => {
        const dateKey = entry.movement_date || entry.date_upd.slice(0, 10) || new Date().toISOString().slice(0, 10)
        if (!grouped[dateKey]) {
          grouped[dateKey] = {
            date: dateKey,
            openingQty: previousClosing,
            closingQty: entry.qty_after_last_update,
            incoming: 0,
            outgoing: 0,
            net: 0,
          }
        }

        if (entry.qty_delta_total > 0) grouped[dateKey].incoming += entry.qty_delta_total
        else grouped[dateKey].outgoing += Math.abs(entry.qty_delta_total)

        grouped[dateKey].net += entry.qty_delta_total
        grouped[dateKey].closingQty = entry.qty_after_last_update
        previousClosing = entry.qty_after_last_update
      })

      const nextRows = Object.values(grouped)
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((g) => ({
          date: g.date,
          openingQty: g.openingQty,
          incomingQty: g.incoming,
          outgoingQty: g.outgoing,
          netChange: g.net,
          closingQty: g.closingQty,
        }))

      setStockEvolutionRows(nextRows)
    } catch (err) {
      setStockEvolutionError(err instanceof Error ? err.message : 'Impossible de charger l\'évolution du stock')
    } finally {
      setStockEvolutionLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (showEvolutionId === null) {
      setStockEvolutionRows([])
      setStockEvolutionError('')
      setStockEvolutionLoading(false)
      return
    }

    void loadStockEvolution(showEvolutionId)
  }, [showEvolutionId])

  async function fetchData() {
    setIsLoading(true)
    try {
      const baseUrl = import.meta.env.VITE_PRESTASHOP_API_BASE_URL || '/prestashop/api'
      const wsKey = 'BZSMWP6E43Z8H41ACW75XU5XAQRAQG9B'
      
      // 1. Fetch Products
      const prodResp = await fetch(`${baseUrl}/products?display=full`, {
        headers: { Authorization: 'Basic ' + btoa(wsKey + ':') }
      })
      let productList: Product[] = []
      if (prodResp.ok) {
        const xml = await prodResp.text()
        const doc = new DOMParser().parseFromString(xml, 'application/xml')
        productList = productService.createListBy(doc)
      }

      // 2. Fetch Orders and sync delivered orders stock movements dynamically here
      const orderResp = await fetch(`${baseUrl}/orders?display=full&limit=0,1000`, {
        headers: { Authorization: 'Basic ' + btoa(wsKey + ':') }
      })
      if (orderResp.ok) {
        const xml = await orderResp.text()
        const doc = new DOMParser().parseFromString(xml, 'application/xml')
        const orderList = orderService.createListBy(doc)
        await syncOrdersStock(orderList)
      }

      // 3. Fetch Stock Availables (fallback source)
      const stockResp = await fetch(`${baseUrl}/stock_availables?display=full`, {
        headers: { Authorization: 'Basic ' + btoa(wsKey + ':') }
      })
      if (stockResp.ok) {
        const xml = await stockResp.text()
        const doc = new DOMParser().parseFromString(xml, 'application/xml')
        const stockList = stockService.createListBy(doc)

        // Merge stock into products
        // If the product has combinations, use the sum of combination stocks.
        // Otherwise, use the simple stock line (id_product_attribute = 0).
        const stockByProduct = new Map<number, typeof stockList>()
        for (const stock of stockList) {
          const productId = stock.id_product || 0
          if (!stockByProduct.has(productId)) {
            stockByProduct.set(productId, [])
          }
          stockByProduct.get(productId)?.push(stock)
        }

        productList = productList.map(p => {
          const rows = stockByProduct.get(p.id || 0) || []
          const combinationRows = rows.filter(r => (r.id_product_attribute || 0) > 0)
          const simpleRows = rows.filter(r => (r.id_product_attribute || 0) === 0)

          const quantity = combinationRows.length > 0
            ? combinationRows.reduce((sum, row) => sum + (row.quantity || 0), 0)
            : simpleRows.reduce((sum, row) => sum + (row.quantity || 0), 0)

          p.quantity = Number.isFinite(quantity) ? quantity : 0
          return p
        })
      }

      setProducts(productList)

      // 4. Fetch Categories
      const catResp = await fetch(`${baseUrl}/categories?display=full`, {
        headers: { Authorization: 'Basic ' + btoa(wsKey + ':') }
      })
      if (catResp.ok) {
        const xml = await catResp.text()
        const doc = new DOMParser().parseFromString(xml, 'application/xml')
        const parsedCategories = categoryService.createListBy(doc)
        const uniqueById = new Map<number, Category>()
        let duplicateCount = 0

        for (const category of parsedCategories) {
          if (typeof category.id !== 'number') {
            continue
          }

          if (uniqueById.has(category.id)) {
            duplicateCount++
            continue
          }

          uniqueById.set(category.id, category)
        }

        if (duplicateCount > 0 && !hasLoggedDuplicateCategories.current) {
          console.warn(`[ProductsPage] ${duplicateCount} catégorie(s) dupliquée(s) ignorée(s) depuis l'API.`)
          hasLoggedDuplicateCategories.current = true
        }

        setCategories(Array.from(uniqueById.values()))
      }
    } catch (err) {
      console.error('Error fetching data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchName = p.name?.toLowerCase().includes(filterName.toLowerCase())
      const matchRef = p.reference?.toLowerCase().includes(filterRef.toLowerCase())
      const matchCat = filterCat === 'all' || p.id_category_default === filterCat
      return matchName && matchRef && matchCat
    })
  }, [products, filterName, filterRef, filterCat])

  const uniqueCategories = useMemo(() => {
    const byId = new Map<number, Category>()
    for (const cat of categories) {
      if (typeof cat.id === 'number' && !byId.has(cat.id)) {
        byId.set(cat.id, cat)
      }
    }
    return Array.from(byId.values())
  }, [categories])

  async function handleUpdateStock() {
    if (!selectedProduct) return
    setIsUpdatingStock(true)
    try {
      const currentQty = selectedProduct.quantity ?? 0
      const delta = newStockQty - currentQty
      
      if (delta === 0) {
        setIsStockModalOpen(false)
        return
      }

      const base = (import.meta.env.VITE_PRESTASHOP_BASE_URL || '/prestashop').replace(/\/$/, '')
      const url = `${base}/update_stock.php?id_product=${selectedProduct.id}&delta=${delta}`
      
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.success) {
        const today = new Date().toISOString().slice(0, 10)
        const history = readStockHistory(selectedProduct.id!)
        
        history.push({
          date: today,
          openingQty: currentQty,
          closingQty: data.new_quantity,
          delta: delta,
        })
        writeStockHistory(selectedProduct.id!, history)

        // Update local state
        setProducts(prev => prev.map(p => {
          if (p.id === selectedProduct.id) {
            p.quantity = data.new_quantity
          }
          return p
        }))
        window.dispatchEvent(new Event('prestashop-stock-updated'))
        setIsStockModalOpen(false)
      } else {
        alert('Erreur lors de la mise à jour : ' + (data.message || 'Erreur inconnue'))
      }
    } catch (err) {
      console.error('Error updating stock:', err)
      alert('Impossible de contacter le serveur de mise à jour des stocks.')
    } finally {
      setIsUpdatingStock(false)
    }
  }

  // Simulation de l'évolution du stock sur 7 jours
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ marginBottom: 24, fontSize: 28, fontWeight: 700 }}>Fiche Produits & Stocks</h1>

      {/* FILTRES */}
      <div style={{ 
        display: 'flex', 
        gap: 16, 
        marginBottom: 24, 
        padding: 20, 
        background: 'rgba(255,255,255,0.03)', 
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.05)'
      }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 4 }}>Filtrer par Nom</label>
          <input 
            type="text" 
            placeholder="Rechercher un produit..." 
            value={filterName}
            onChange={e => setFilterName(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 4 }}>Référence</label>
          <input 
            type="text" 
            placeholder="Ex: REF001..." 
            value={filterRef}
            onChange={e => setFilterRef(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 4 }}>Catégorie</label>
          <select 
            value={filterCat}
            onChange={e => setFilterCat(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            style={inputStyle}
          >
            <option value="all">Toutes les catégories</option>
            {uniqueCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>Chargement du catalogue...</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', color: '#fff' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <th style={{ padding: 12 }}>Réf</th>
              <th style={{ padding: 12 }}>Produit</th>
              <th style={{ padding: 12 }}>Prix</th>
              <th style={{ padding: 12 }}>Stock</th>
              <th style={{ padding: 12, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }}>
                <td style={{ padding: 12, color: '#aaa', fontSize: 13 }}>{p.reference}</td>
                <td style={{ padding: 12, fontWeight: 500 }}>{p.name}</td>
                <td style={{ padding: 12 }}>{p.price?.toFixed(2)} €</td>
                <td style={{ padding: 12 }}>
                  <span style={{ 
                    padding: '4px 8px', 
                    borderRadius: 4, 
                    background: (p.quantity ?? 0) > 5 ? 'rgba(74, 144, 226, 0.1)' : 'rgba(231, 76, 60, 0.1)',
                    color: (p.quantity ?? 0) > 5 ? '#4a90e2' : '#e74c3c',
                    fontSize: 13,
                    fontWeight: 600
                  }}>
                    {p.quantity ?? 0} en stock
                  </span>
                </td>
                <td style={{ padding: 12, textAlign: 'right', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => exportProductAsCsv(p)}
                    style={actionButtonStyle('#c4c9d4')}
                  >
                    Exporter CSV
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedProduct(p)
                      setNewStockQty(p.quantity ?? 0)
                      setIsStockModalOpen(true)
                    }}
                    style={actionButtonStyle('#4a90e2')}
                  >
                    Gérer Stock
                  </button>
                  <button 
                    onClick={() => setShowEvolutionId((current) => (current === p.id ? null : (p.id ?? null)))}
                    style={actionButtonStyle('#9be7a8')}
                  >
                    Évolution
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* MODAL GESTION STOCK */}
      {isStockModalOpen && selectedProduct && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h3 style={{ marginBottom: 16 }}>Ajuster le stock : {selectedProduct.name}</h3>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, color: '#aaa', marginBottom: 8 }}>Nouvelle quantité totale</label>
              <input 
                type="number" 
                value={newStockQty} 
                onChange={e => setNewStockQty(Number(e.target.value))}
                style={{ ...inputStyle, fontSize: 20, textAlign: 'center' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                onClick={() => setIsStockModalOpen(false)}
                style={{ ...btnStyle, background: 'rgba(255,255,255,0.1)' }}
              >
                Annuler
              </button>
              <button 
                onClick={handleUpdateStock}
                disabled={isUpdatingStock}
                style={{ ...btnStyle, background: '#4a90e2', flex: 1 }}
              >
                {isUpdatingStock ? 'Mise à jour...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ÉVOLUTION STOCK */}
      {showEvolutionId !== null && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalContentStyle, width: 500 }}>
            <h3 style={{ marginBottom: 20 }}>Évolution journalière du stock</h3>
            <p style={{ marginTop: -10, marginBottom: 16, color: '#aaa', fontSize: 13 }}>
              {products.find(p => p.id === showEvolutionId)?.name || 'Produit sélectionné'}
            </p>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: 16, borderRadius: 8 }}>
              {stockEvolutionLoading ? (
                <p style={{ margin: 0, color: '#aaa' }}>Chargement de l'évolution du stock...</p>
              ) : stockEvolutionError ? (
                <p style={{ margin: 0, color: '#ff8a80' }}>{stockEvolutionError}</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#888', fontSize: 12 }}>
                      <th style={{ textAlign: 'left', padding: 8 }}>Date</th>
                      <th style={{ textAlign: 'right', padding: 8 }}>Entrées</th>
                      <th style={{ textAlign: 'right', padding: 8 }}>Sorties</th>
                      <th style={{ textAlign: 'right', padding: 8 }}>Stock début</th>
                      <th style={{ textAlign: 'right', padding: 8 }}>Stock fin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockEvolutionRows.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ padding: 10, color: '#aaa' }}>Aucune date trouvée.</td>
                      </tr>
                    )}
                    {stockEvolutionRows.map((row) => (
                      <tr key={row.date} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: 10 }}>{formatDayLabel(row.date)}</td>
                        <td style={{ padding: 10, textAlign: 'right', fontWeight: 600, color: '#9be7a8' }}>{row.incomingQty}</td>
                        <td style={{ padding: 10, textAlign: 'right', fontWeight: 600, color: '#ffb86b' }}>{row.outgoingQty}</td>
                        <td style={{ padding: 10, textAlign: 'right', fontWeight: 600, color: '#c4c9d4' }}>{row.openingQty}</td>
                        <td style={{ padding: 10, textAlign: 'right', fontWeight: 700, color: '#4a90e2' }}>{row.closingQty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <button 
              onClick={() => setShowEvolutionId(null)}
              style={{ ...btnStyle, marginTop: 24, background: 'rgba(255,255,255,0.1)' }}
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 8,
  background: 'rgba(0,0,0,0.2)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#fff',
  fontSize: 14,
  outline: 'none'
}

const actionButtonStyle = (color: string): React.CSSProperties => ({
  padding: '6px 12px',
  borderRadius: 6,
  background: 'transparent',
  border: `1px solid ${color}`,
  color: color,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s'
})

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.8)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000
}

const modalContentStyle: React.CSSProperties = {
  background: '#1a1d23',
  padding: 32,
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.1)',
  width: 350,
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
}

const btnStyle: React.CSSProperties = {
  padding: '12px 20px',
  borderRadius: 10,
  border: 'none',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: 14
}