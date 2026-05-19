const SYNCED_STOCK_ORDERS_KEY = 'new-app-synced-stock-orders'
const LEGACY_SYNCED_DELIVERY_KEY = 'new-app-synced-delivery-orders'

export function readSyncedStockOrderIds(): number[] {
  const ids = new Set<number>()

  for (const key of [SYNCED_STOCK_ORDERS_KEY, LEGACY_SYNCED_DELIVERY_KEY]) {
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) continue
      for (const value of parsed) {
        const id = Number(value)
        if (Number.isFinite(id) && id > 0) ids.add(id)
      }
    } catch {
      // ignore
    }
  }

  return Array.from(ids)
}

export function writeSyncedStockOrderIds(orderIds: number[]): void {
  const unique = Array.from(
    new Set(orderIds.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0))
  )
  window.localStorage.setItem(SYNCED_STOCK_ORDERS_KEY, JSON.stringify(unique))
  window.localStorage.removeItem(LEGACY_SYNCED_DELIVERY_KEY)
}

export function clearSyncedStockOrderIds(): void {
  window.localStorage.removeItem(SYNCED_STOCK_ORDERS_KEY)
  window.localStorage.removeItem(LEGACY_SYNCED_DELIVERY_KEY)
}
