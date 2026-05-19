export type StockAvailableRow = {
  id_product?: number | string
  id_product_attribute?: number | string
  quantity?: number | string
}

export function buildStockQuantityMap(stockList: StockAvailableRow[]): Record<number, number> {
  const map: Record<number, number> = {}
  const byProduct: Record<number, Array<{ attrId: number; quantity: number }>> = {}

  stockList.forEach((stockItem) => {
    const productId = Number(stockItem.id_product || 0)
    if (!productId) return

    const attrId = Number(stockItem.id_product_attribute || 0)
    const quantity = Number(stockItem.quantity || 0)

    if (!byProduct[productId]) {
      byProduct[productId] = []
    }
    byProduct[productId].push({
      attrId: Number.isFinite(attrId) ? attrId : 0,
      quantity: Number.isFinite(quantity) ? quantity : 0,
    })
  })

  Object.entries(byProduct).forEach(([productIdRaw, rows]) => {
    const productId = Number(productIdRaw)
    const combinationRows = rows.filter((row) => row.attrId > 0)
    const simpleRows = rows.filter((row) => row.attrId === 0)

    const total = combinationRows.length > 0
      ? combinationRows.reduce((sum, row) => sum + row.quantity, 0)
      : simpleRows.reduce((sum, row) => sum + row.quantity, 0)

    map[productId] = total
  })

  return map
}

/** Quantités actuelles depuis ps_stock_available (même source que le back-office). */
export async function fetchStockQuantityByProductId(): Promise<Record<number, number>> {
  const baseUrl = (import.meta.env.VITE_PRESTASHOP_API_BASE_URL || '/prestashop/api').replace(/\/$/, '')
  const wsKey = 'BZSMWP6E43Z8H41ACW75XU5XAQRAQG9B'

  const response = await fetch(
    `${baseUrl}/stock_availables?display=[id,id_product,id_product_attribute,quantity]&limit=0,5000`,
    { headers: { Authorization: 'Basic ' + btoa(wsKey + ':') } }
  )

  if (!response.ok) {
    throw new Error(`stock_availables: ${response.status}`)
  }

  const xml = await response.text()
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const nodes = Array.from(doc.getElementsByTagName('stock_available'))
  const stockList: StockAvailableRow[] = nodes.map((node) => ({
    id_product: node.getElementsByTagName('id_product')[0]?.textContent ?? undefined,
    id_product_attribute: node.getElementsByTagName('id_product_attribute')[0]?.textContent ?? undefined,
    quantity: node.getElementsByTagName('quantity')[0]?.textContent ?? undefined,
  }))

  return buildStockQuantityMap(stockList)
}
