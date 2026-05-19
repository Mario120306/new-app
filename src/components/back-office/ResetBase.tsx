import { useState } from 'react'
import { API } from '../../api/API'
import { Product } from '../../entities/Product'
import { ProductVariant } from '../../entities/ProductVariant'
import { Customer } from '../../entities/Customer'
import { Order } from '../../entities/Order'
import { Cart } from '../../entities/Cart'
import { ProductService } from '../../service/ProductService'
import { ProductVariantService } from '../../service/ProductVariantService'
import { CustomerService } from '../../service/CustomerService'
import { OrderService } from '../../service/OrderService'

const productService = new ProductService()
const productVariantService = new ProductVariantService()
const customerService = new CustomerService()
const orderService = new OrderService()
const api = new API()

export default function RestBase() {
  const [entity, setEntity] = useState('products')
  const [status, setStatus] = useState('')
  const [logs, setLogs] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const entities = [
    { key: 'full-reset', label: 'Reset Complet (Orchestré)' },
    { key: 'stock', label: 'Stock (tables + cache local)' },
    { key: 'products', label: 'Products' },
    { key: 'variants', label: 'Product Variants' },
    { key: 'carts', label: 'Carts' },
    { key: 'customers', label: 'Customers' },
    { key: 'orders', label: 'Orders' },
  ]

  const clearStockLocalCache = () => {
    try {
      window.localStorage.removeItem('new-app-synced-stock-orders')
      window.localStorage.removeItem('new-app-synced-delivery-orders')
      const keysToRemove: string[] = []
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i)
        if (key?.startsWith('new-app-stock-history-')) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach((key) => window.localStorage.removeItem(key))
    } catch {
      // ignore
    }
  }

  const resetStockTables = async (logs: string[]): Promise<boolean> => {
    const base = (import.meta.env.VITE_PRESTASHOP_BASE_URL || '/prestashop').replace(/\/$/, '')
    const response = await fetch(`${base}/bridge/reset_stock_tables.php`, { method: 'POST' })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data.success) {
      logs.push(`Stock: échec (${data.message || response.status})`)
      return false
    }
    clearStockLocalCache()
    logs.push('Stock: ps_monapi_stock_daily vidée, ps_stock_available remis à 0')
    logs.push('Stock: cache local (commandes livrées synchronisées) effacé')
    return true
  }

  async function getIdsForResource(endpoint: string, wsKey: string): Promise<number[]> {
    try {
      const base = (import.meta.env.VITE_PRESTASHOP_API_BASE_URL || '/prestashop/api').replace(/\/$/, '')
      const url = `${base}/${endpoint}`
      
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/xml',
          'Authorization': 'Basic ' + btoa(wsKey + ':'),
        },
      })

      if (!res.ok) {
        console.warn(`[getIdsForResource] ${endpoint} retorna ${res.status}`)
        return []
      }

      const text = await res.text()
      const doc = new DOMParser().parseFromString(text, 'application/xml')
      
      // Check for error in XML
      if (doc.querySelector('error') || text.includes('error')) {
        return []
      }

      const container = doc.documentElement.firstElementChild
      if (!container) return []

      const ids = Array.from(container.children)
        .map((el) => {
          const attr = el.getAttribute('id')
          if (attr) return parseInt(attr, 10)
          const idNode = el.querySelector('id')
          return idNode ? parseInt(idNode.textContent || '0', 10) : 0
        })
        .filter((n) => n > 0)

      return ids
    } catch (err) {
      console.warn('[getIdsForResource] Erreur:', err)
      return []
    }
  }

  async function deleteResourceBatch(endpoint: string, label: string, wsKey: string, logs: string[]): Promise<{ deleted: number; failed: number }> {
    const ids = await getIdsForResource(endpoint, wsKey)
    let deleted = 0
    let failed = 0
    for (const id of ids) {
      // Passe catégorie racine (protégée par PrestaShop)
      if (id === 1 && endpoint === 'categories') {
        logs.push(`${label} ${id}: ignoré (catégorie racine protégée)`)
        continue
      }

      const result = await deleteViaAPI(endpoint, id, label, wsKey)
      if (result.ok) deleted++
      else failed++
      logs.push(result.message)
    }
    return { deleted, failed }
  }

  function extractMessageFromResponse(text: string): string {
    const match = text.match(/<message>([\s\S]*?)<\/message>/i)
    if (match?.[1]) return match[1].trim()
    const errorMatch = text.match(/<error[^>]*>([\s\S]*?)<\/error>/i)
    if (errorMatch?.[1]) return errorMatch[1].trim()
    return text.trim().slice(0, 300)
  }

  async function deleteViaAPI(endpoint: string, id: number, label: string, wsKey: string): Promise<{ ok: boolean; message: string }> {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_PRESTASHOP_API_BASE_URL || '/prestashop/api'}/${endpoint}/${id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: 'Basic ' + btoa(wsKey + ':'),
          },
        }
      )

      if (response.ok) {
        return { ok: true, message: `${label} ${id}: supprimé` }
      } else {
        const errorText = await response.text().catch(() => '')
        const message = extractMessageFromResponse(errorText)
        return { ok: false, message: `${label} ${id}: échec (${response.status}) ${message}` }
      }
    } catch (err) {
      return { ok: false, message: `${label} ${id}: erreur - ${err instanceof Error ? err.message : String(err)}` }
    }
  }

  async function handleReset() {
    setStatus('')
    setLogs([])
    setIsLoading(true)

    const nextLogs: string[] = []
    let deleted = 0
    let failed = 0

    try {
      if (entity === 'full-reset') {
        // Ordre orchestré pour respecter les dépendances
        nextLogs.push('🔄 Début du reset orchestré...')
        const mere = new Product()
        const wsKey = mere.getWsKey()

        // Ordre de suppression : respecter les dépendances (API endpoints uniquement)
        const order = [
          { endpoint: 'orders', label: 'Commande' },
          { endpoint: 'carts', label: 'Panier' },
          { endpoint: 'combinations', label: 'Variante' },
          { endpoint: 'addresses', label: 'Adresse' },
          { endpoint: 'customers', label: 'Client' },
          { endpoint: 'products', label: 'Produit' },
          { endpoint: 'categories', label: 'Catégorie' },
        ]

        for (const res of order) {
          nextLogs.push(`Suppression de ${res.label}...`)
          const batch = await deleteResourceBatch(res.endpoint, res.label, wsKey, nextLogs)
          deleted += batch.deleted
          failed += batch.failed
          if (batch.deleted > 0) {
            nextLogs.push(`✓ ${batch.deleted} ${res.label}(s) supprimé(s)`)
          }
          if (batch.failed > 0) {
            nextLogs.push(`✗ ${batch.failed} ${res.label}(s) échoué(s)`)
          }
        }

        nextLogs.push('Réinitialisation des tables de stock...')
        const stockOk = await resetStockTables(nextLogs)
        if (!stockOk) failed++

        nextLogs.push('✅ Reset orchestré terminé')
      } else if (entity === 'stock') {
        const stockOk = await resetStockTables(nextLogs)
        if (stockOk) deleted++
        else failed++

      } else if (entity === 'products') {
        const mere = new Product()
        const products = await api.fetch({ method: 'GET', mere, service: productService })

        for (const product of products) {
          if (!product.id) {
            failed++
            nextLogs.push('Produit sans id: suppression impossible')
            continue
          }

          const result = await deleteViaAPI('products', product.id, 'Produit', mere.getWsKey())
          if (result.ok) deleted++
          else failed++
          nextLogs.push(result.message)
        }

        productService.resetData()
      } else if (entity === 'variants') {
        const mere = new ProductVariant()
        const variants = await api.fetch({ method: 'GET', mere, service: productVariantService })

        for (const variant of variants) {
          if (!variant.id) {
            failed++
            nextLogs.push('Variante sans id: suppression impossible')
            continue
          }

          const result = await deleteViaAPI('combinations', variant.id, 'Variante', mere.getWsKey())
          if (result.ok) deleted++
          else failed++
          nextLogs.push(result.message)
        }

        productVariantService.resetData()
      } else if (entity === 'customers') {
        const mere = new Customer()
        const customers = await api.fetch({ method: 'GET', mere, service: customerService })

        for (const customer of customers) {
          if (!customer.id) {
            failed++
            nextLogs.push('Client sans id: suppression impossible')
            continue
          }

          const result = await deleteViaAPI('customers', customer.id, 'Client', mere.getWsKey())
          if (result.ok) deleted++
          else failed++
          nextLogs.push(result.message)
        }

        customerService.resetData()
      } else if (entity === 'carts') {
        const mere = new Cart()
        const ids = await getIdsForResource('carts', mere.getWsKey())

        for (const id of ids) {
          if (!id) {
            failed++
            nextLogs.push('Panier sans id: suppression impossible')
            continue
          }

          const result = await deleteViaAPI('carts', id, 'Panier', mere.getWsKey())
          if (result.ok) deleted++
          else failed++
          nextLogs.push(result.message)
        }

      } else if (entity === 'orders') {
        const mere = new Order()
        const orders = await api.fetch({ method: 'GET', mere, service: orderService })

        for (const order of orders) {
          if (!order.id) {
            failed++
            nextLogs.push('Commande sans id: suppression impossible')
            continue
          }

          const result = await deleteViaAPI('orders', order.id, 'Commande', mere.getWsKey())
          if (result.ok) deleted++
          else failed++
          nextLogs.push(result.message)
        }

        orderService.resetData()
      }

      setLogs(nextLogs)
      setStatus(`Reset effectué. Supprimés: ${deleted}, erreurs: ${failed}`)
    } catch (err) {
      setStatus('Erreur lors du reset: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="dashboard-card">
      <div className="dashboard-kicker">Base de données</div>
      <h1>RestBase</h1>
      <p>Gestion de la base de données - Reset via API PrestaShop.</p>

      <div style={{ marginTop: 18 }}>
        <label style={{ display: 'block', marginBottom: 8 }}>Sélectionnez l'entité à reset :</label>
        <select 
          value={entity} 
          onChange={(e) => setEntity(e.target.value)} 
          disabled={isLoading}
          style={{ padding: 8, borderRadius: 6, opacity: isLoading ? 0.5 : 1 }}
        >
          {entities.map((it) => (
            <option key={it.key} value={it.key}>{it.label}</option>
          ))}
        </select>
      </div>

      <div style={{ marginTop: 12 }}>
        <button 
          className="logout-button" 
          type="button" 
          onClick={handleReset}
          disabled={isLoading}
          style={{ opacity: isLoading ? 0.6 : 1, cursor: isLoading ? 'not-allowed' : 'pointer' }}
        >
          {isLoading ? 'Reset en cours...' : 'Reset des données'}
        </button>
      </div>

      {status && (
        <div style={{ marginTop: 12, color: status.startsWith('Erreur') ? '#ff6b6b' : '#9be7a8' }}>{status}</div>
      )}

      {logs.length > 0 && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.06)', textAlign: 'left' }}>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>Détails</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {logs.map((line, index) => (
              <li key={`${index}-${line}`}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
