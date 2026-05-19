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
    const bridgeResp = await fetch(`${base}/bridge/stock_movement.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml' },
      body: xml,
    })
    if (bridgeResp.ok) return true
  } catch {
    // ignore
  }

  try {
    const params = new URLSearchParams({
      id_product: String(idProduct),
      id_product_attribute: String(idProductAttribute),
      delta: String(delta),
      movement_date: date,
    })
    const fallback = await fetch(`${base}/update_stock.php?${params}`)
    const data = await fallback.json()
    return Boolean(data.success)
  } catch {
    return false
  }
}

/** Déduit le stock pour chaque ligne d'une commande payée ou livrée. */
export async function applyOrderStockMovements(
  items: StockMovementLine[],
  movementDate: string
): Promise<void> {
  for (const item of items) {
    const idProduct = Number(item.product_id || 0)
    const idAttr = Number(item.product_attribute_id || 0)
    const qty = Math.trunc(Number(item.product_quantity || 0))
    if (!idProduct || qty <= 0) continue
    await applyStockDelta(idProduct, idAttr, -Math.abs(qty), movementDate)
  }
}

/** @deprecated Utiliser applyOrderStockMovements */
export const applyDeliveredOrderStockMovements = applyOrderStockMovements
