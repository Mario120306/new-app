import { StockAvailable } from '../entities/StockAvailable'
import type { BaseService } from './BaseService'

export class StockAvailableService implements BaseService<StockAvailable> {
  private items: StockAvailable[] = []

  getAll(): StockAvailable[] { return [...this.items] }
  getById(id: number): StockAvailable | undefined { return this.items.find(i => i.id === id) }
  add(item: StockAvailable): StockAvailable { this.items.push(item); return item }
  deleteById(id: number): boolean { const initial = this.items.length; this.items = this.items.filter(i => i.id !== id); return this.items.length !== initial }
  resetData(): void { this.items = [] }

  createListBy(doc: Document): StockAvailable[] {
    const nodes = Array.from(doc.getElementsByTagName('stock_available'))
    const results = nodes.map((node) => {
      const get = (tag: string) => node.getElementsByTagName(tag)[0]?.textContent || undefined
      const idText = get('id')
      const id = idText ? Number(idText) : 0
      const id_product_text = get('id_product')
      const id_product = id_product_text ? Number(id_product_text) : 0
      const id_product_attribute_text = get('id_product_attribute')
      const id_product_attribute = id_product_attribute_text ? Number(id_product_attribute_text) : 0
      const qtyText = get('quantity')
      const quantity = qtyText ? Number(qtyText) : 0

      return new StockAvailable(id, id_product, id_product_attribute, quantity)
    })

    this.items = results
    return results
  }

  createOneBy(doc: Document): StockAvailable {
    const node = doc.getElementsByTagName('stock_available')[0]
    if (!node) return new StockAvailable(0, 0, 0, 0)

    const get = (tag: string) => node.getElementsByTagName(tag)[0]?.textContent || undefined
    const idText = get('id')
    const id = idText ? Number(idText) : 0
    const id_product_text = get('id_product')
    const id_product = id_product_text ? Number(id_product_text) : 0
    const id_product_attribute_text = get('id_product_attribute')
    const id_product_attribute = id_product_attribute_text ? Number(id_product_attribute_text) : 0
    const qtyText = get('quantity')
    const quantity = qtyText ? Number(qtyText) : 0

    return new StockAvailable(id, id_product, id_product_attribute, quantity)
  }

  async findByProduct(productId: number, attrId: number = 0): Promise<StockAvailable | undefined> {
    const baseUrl = import.meta.env.VITE_PRESTASHOP_API_BASE_URL || '/prestashop/api'
    const url = `${baseUrl}/stock_availables?display=full&filter[id_product]=[${productId}]&filter[id_product_attribute]=[${attrId}]`
    const wsKey = 'BZSMWP6E43Z8H41ACW75XU5XAQRAQG9B'
    
    const response = await fetch(url, {
      headers: { Authorization: 'Basic ' + btoa(wsKey + ':') }
    })
    if (!response.ok) return undefined
    
    const xml = await response.text()
    const doc = new DOMParser().parseFromString(xml, 'application/xml')
    return this.createListBy(doc)[0]
  }

  async updateStock(stockId: number, productId: number, attrId: number, quantity: number): Promise<boolean> {
    const baseUrl = import.meta.env.VITE_PRESTASHOP_API_BASE_URL || '/prestashop/api'
    const wsKey = 'BZSMWP6E43Z8H41ACW75XU5XAQRAQG9B'
    const stock = new StockAvailable(stockId, productId, attrId, quantity)
    
    const response = await fetch(`${baseUrl}/stock_availables/${stockId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/xml',
        Authorization: 'Basic ' + btoa(wsKey + ':')
      },
      body: stock.getUpdateXML()
    })
    return response.ok
  }
}
