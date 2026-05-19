import { Cart } from '../entities/Cart'
import type { BaseService } from './BaseService'

export class CartApiService implements BaseService<Cart> {
  private carts: Cart[] = []

  getAll(): Cart[] {
    return this.carts
  }

  getById(id: number): Cart | undefined {
    return this.carts.find((c) => c.id === id)
  }

  add(item: Cart): Cart {
    this.carts.push(item)
    return item
  }

  deleteById(id: number): boolean {
    const index = this.carts.findIndex((c) => c.id === id)
    if (index > -1) {
      this.carts.splice(index, 1)
      return true
    }
    return false
  }

  resetData(): void {
    this.carts = []
  }

  createListBy(doc: Document): Cart[] {
    const carts: Cart[] = []
    const elements = doc.querySelectorAll('cart')
    elements.forEach((el) => {
      let id = 0
      const idEl = el.querySelector(':scope > id')
      if (idEl && idEl.textContent) {
        id = parseInt(idEl.textContent.trim(), 10)
      } else {
        const idAttr = el.getAttribute('id')
        if (idAttr) id = parseInt(idAttr, 10)
      }
      if (id > 0) {
        const id_customer = parseInt(el.querySelector('id_customer')?.textContent || '0', 10)
        const date_add = el.querySelector('date_add')?.textContent || ''
        carts.push(new Cart(id, id_customer, date_add))
      }
    })
    return carts
  }

  createOneBy(doc: Document): Cart {
    const el = doc.querySelector('cart')
    if (!el) return new Cart()

    let id = 0
    const idEl = el.querySelector(':scope > id')
    if (idEl && idEl.textContent) {
      id = parseInt(idEl.textContent.trim(), 10)
    } else {
      const idAttr = el.getAttribute('id')
      if (idAttr) id = parseInt(idAttr, 10)
    }
    if (id <= 0) return new Cart()

    const id_customer = parseInt(el.querySelector('id_customer')?.textContent || '0', 10)
    const date_add = el.querySelector('date_add')?.textContent || ''
    return new Cart(id, id_customer, date_add)
  }
}
