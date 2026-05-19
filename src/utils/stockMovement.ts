export type StockMovementLine = {
  product_id: number
  product_attribute_id?: number
  product_quantity: number
}

/** Applique un delta de stock via le bridge PHP (stock + historique journalier). */
export async function applyStockDelta(
  idProduct: number,
  idProductAttribute: number,
  delta: number,
  movementDate: string
): Promise<boolean> {
  if (!idProduct || delta === 0) return true

  const base = (import.meta.env.VITE_PRESTASHOP_BASE_URL || '/prestashop').replace(/\/$/, '')
  const date = movementDate.slice(0, 10)
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <manual_stock_movement>
    <id_product>${idProduct}</id_product>
    <id_product_attribute>${idProductAttribute}</id_product_attribute>
    <delta>${delta}</delta>
    <movement_date>${date}</movement_date>
  </manual_stock_movement>
</prestashop>`

  try {
    console.log('[applyStockDelta] Sending XML POST to stock_movement.php:', xml)
    const bridgeResp = await fetch(`${base}/bridge/stock_movement.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml' },
      body: xml,
    })
    console.log('[applyStockDelta] Bridge response status:', bridgeResp.status)
    if (bridgeResp.ok) return true
  } catch (err) {
    console.log('[applyStockDelta] Bridge fetch error:', err)
  }

  try {
    const params = new URLSearchParams({
      id_product: String(idProduct),
      id_product_attribute: String(idProductAttribute),
      delta: String(delta),
      movement_date: date,
    })
    console.log('[applyStockDelta] Trying fallback update_stock.php?', params.toString())
    const fallback = await fetch(`${base}/update_stock.php?${params}`)
    const data = await fallback.json()
    console.log('[applyStockDelta] Fallback response:', data)
    return Boolean(data.success)
  } catch (err) {
    console.log('[applyStockDelta] Fallback error:', err)
    return false
  }
}

/** Déduit le stock pour chaque ligne d'une commande payée ou livrée. */
export async function applyOrderStockMovements(
  items: StockMovementLine[],
  movementDate: string
): Promise<void> {
  console.log('[applyOrderStockMovements] Processing', items.length, 'items for date', movementDate)
  for (const item of items) {
    const idProduct = Number(item.product_id || 0)
    const idAttr = Number(item.product_attribute_id || 0)
    const qty = Math.trunc(Number(item.product_quantity || 0))
    console.log('[applyOrderStockMovements] Item:', { idProduct, idAttr, qty })
    if (!idProduct || qty <= 0) {
      console.log('[applyOrderStockMovements] Skipping - invalid product or qty')
      continue
    }
    const result = await applyStockDelta(idProduct, idAttr, -Math.abs(qty), movementDate)
    console.log('[applyOrderStockMovements] applyStockDelta result:', result)
  }
}

/** @deprecated Utiliser applyOrderStockMovements */
export const applyDeliveredOrderStockMovements = applyOrderStockMovements
