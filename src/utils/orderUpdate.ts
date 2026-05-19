import { applyOrderStockMovements, type StockMovementLine } from './stockMovement'
import { writeSyncedStockOrderIds, readSyncedStockOrderIds } from './stockRules'

export type OrderStateUpdateResult = {
  success: boolean
  changed?: boolean
  new_state?: number
  previous_state?: number
  prestashop_stock_handled?: boolean
  message?: string
}

export async function updateOrderStateBridge(
  orderId: number,
  nextStateId: 5 | 6
): Promise<OrderStateUpdateResult> {
  const base = (import.meta.env.VITE_PRESTASHOP_BASE_URL || '/prestashop').replace(/\/$/, '')
  const params = new URLSearchParams({
    id_order: String(orderId),
    id_order_state: String(nextStateId),
  })

  const response = await fetch(`${base}/bridge/update_order_state.php?${params}`, {
    method: 'POST',
  })

  const data = (await response.json().catch(() => ({}))) as OrderStateUpdateResult

  if (!response.ok || !data.success) {
    return {
      success: false,
      message: data.message || `HTTP ${response.status}`,
    }
  }

  return data
}

/** Après passage en « livré », applique notre mouvement de stock si PrestaShop ne l'a pas déjà fait. */
export async function syncStockAfterOrderDelivered(
  orderId: number,
  items: StockMovementLine[],
  movementDate: string,
  prestashopStockHandled: boolean
): Promise<void> {
  const synced = new Set(readSyncedStockOrderIds())
  if (synced.has(orderId)) {
    return
  }

  if (!prestashopStockHandled && items.length > 0) {
    await applyOrderStockMovements(items, movementDate)
  }

  synced.add(orderId)
  writeSyncedStockOrderIds(Array.from(synced))
  window.dispatchEvent(new Event('prestashop-stock-updated'))
}
