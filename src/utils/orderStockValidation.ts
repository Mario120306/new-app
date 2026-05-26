import { fetchStockQuantityByProductId } from './stockQuantity'

export type StockValidationItem = {
  product_id: number
  product_quantity: number
  product_name?: string
  reference?: string
}

export type StockValidationIssue = {
  product_id: number
  product_name: string
  required: number
  available: number
}

export type StockValidationResult = {
  ok: boolean
  issues: StockValidationIssue[]
}

export async function validateOrderStock(items: StockValidationItem[]): Promise<StockValidationResult> {
  const stockMap = await fetchStockQuantityByProductId()
  const requestedByProduct = new Map<number, StockValidationItem & { required: number }>()

  for (const item of items) {
    const productId = Number(item.product_id || 0)
    const quantity = Math.trunc(Number(item.product_quantity || 0))

    if (!productId || quantity <= 0) {
      continue
    }

    const current = requestedByProduct.get(productId)
    if (current) {
      current.required += quantity
      if (!current.product_name && item.product_name) {
        current.product_name = item.product_name
      }
      if (!current.reference && item.reference) {
        current.reference = item.reference
      }
      continue
    }

    requestedByProduct.set(productId, {
      ...item,
      required: quantity,
    })
  }

  const issues: StockValidationIssue[] = []

  for (const [productId, item] of requestedByProduct.entries()) {
    const available = Number(stockMap[productId] ?? 0)
    if (item.required > available) {
      issues.push({
        product_id: productId,
        product_name: item.product_name || item.reference || `Produit #${productId}`,
        required: item.required,
        available,
      })
    }
  }

  return {
    ok: issues.length === 0,
    issues,
  }
}

export function formatStockValidationMessage(issues: StockValidationIssue[]): string {
  if (issues.length === 0) {
    return ''
  }

  const firstIssue = issues[0]
  if (issues.length === 1) {
    return `${firstIssue.product_name}: ${firstIssue.required} demandé(s), ${firstIssue.available} disponible(s)`
  }

  return `${issues.length} produit(s) n'ont pas assez de stock. Premier cas: ${firstIssue.product_name} (${firstIssue.required} demandé(s), ${firstIssue.available} disponible(s))`
}