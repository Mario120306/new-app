import type { BaseService } from './BaseService';
import { Order } from '../entities/Order';
import type { OrderItem } from '../entities/Order';
import { normalizeOrderEtat, resolveOrderStateId } from '../utils/orderState';

export class OrderService implements BaseService<Order> {
  private orders: Order[] = [];

  getAll(): Order[] {
    return this.orders;
  }

  getById(id: number): Order | undefined {
    return this.orders.find((o) => o.id === id);
  }

  add(item: Order): Order {
    const newId = Math.max(...this.orders.map((o) => o.id), 0) + 1;
    item.id = newId;
    this.orders.push(item);
    return item;
  }

  deleteById(id: number): boolean {
    const index = this.orders.findIndex((o) => o.id === id);
    if (index !== -1) {
      this.orders.splice(index, 1);
      return true;
    }
    return false;
  }

  resetData(): void {
    this.orders = [];
  }

  /**
   * Parse l'ID depuis une balise enfant <id> (PrestaShop CDATA) ou attribut id
   */
  private parseId(el: Element): number {
    // Avoid using ':scope' which can throw on some XML DOM implementations
    // Prefer direct children only (to not pick nested <id> from associations)
    for (const child of Array.from(el.children)) {
      if (child.tagName === 'id' && child.textContent) {
        const parsed = parseInt(child.textContent.trim(), 10)
        if (!isNaN(parsed) && parsed > 0) return parsed
      }
    }
    const idAttr = el.getAttribute('id')
    if (idAttr) {
      const parsed = parseInt(idAttr, 10)
      if (!isNaN(parsed) && parsed > 0) return parsed
    }
    return 0
  }
  
  private safeText(parent: Element | Document, selectorCandidates: string[]): string {
    for (const sel of selectorCandidates) {
      const node = parent.querySelector(sel)
      if (node && node.textContent && node.textContent.trim() !== '') return node.textContent.trim()
    }
    return ''
  }

  private extractLastHistoryStateId(el: Element): number {
    const candidates = [
      'order_histories > order_history',
      'associations > order_histories > order_history',
    ]

    for (const selector of candidates) {
      const nodes = el.querySelectorAll(selector)
      if (!nodes || nodes.length === 0) continue

      for (let index = nodes.length - 1; index >= 0; index -= 1) {
        const historyNode = nodes[index]
        const stateIdText = historyNode.querySelector('id_order_state')?.textContent?.trim()
        const stateId = parseInt(stateIdText || '0', 10)
        if (Number.isFinite(stateId) && stateId > 0) {
          return stateId
        }
      }
    }

    return 0
  }

  private resolveStateId(currentState: string, payment: string, historyStateId: number): number {
    const parsedCurrentState = parseInt((currentState || '').trim(), 10)
    if (Number.isFinite(parsedCurrentState) && parsedCurrentState > 0) {
      return parsedCurrentState
    }

    if (historyStateId > 0) {
      return historyStateId
    }

    const normalizedState = normalizeOrderEtat(currentState || payment)
    return resolveOrderStateId(normalizedState)
  }

  private parseIntSafe(parent: Element | Document, selectorCandidates: string[], defaultValue = 0): number {
    const txt = this.safeText(parent, selectorCandidates)
    const n = parseInt(txt || String(defaultValue), 10)
    return Number.isFinite(n) && n > 0 ? n : defaultValue
  }

  private parseFloatSafe(parent: Element | Document, selectorCandidates: string[], defaultValue = 0): number {
    const txt = this.safeText(parent, selectorCandidates)
    const n = parseFloat(txt || String(defaultValue))
    return Number.isFinite(n) ? n : defaultValue
  }

  private extractRowElements(orderEl: Element): Element[] {
    // Try common variants where rows may be present
    const candidates = [
      'order_row',
      'order_rows > order_row',
      'associations > order_rows > order_row',
      'order_detail',
      'order_details > order_detail',
      'associations > order_details > order_detail',
    ]

    for (const sel of candidates) {
      const nodes = orderEl.querySelectorAll(sel)
      if (nodes && nodes.length > 0) return Array.from(nodes) as Element[]
    }

    return []
  }

  createListBy(doc: Document): Order[] {
    const orderList: Order[] = [];
    const elements = Array.from(doc.getElementsByTagName('order'));
    if (!elements || elements.length === 0) {
      // Debug: show what we received
      const errorNode = doc.querySelector('error')
      if (errorNode) {
        const errorMsg = errorNode.querySelector('message')?.textContent || 'Unknown error'
        console.warn('[OrderService] API Error:', errorMsg)
      } else {
        const rootTag = doc.documentElement?.tagName || 'unknown'
        const childTags = Array.from(doc.documentElement?.children || []).map(c => c.tagName).slice(0, 5).join(', ')
        console.warn(`[OrderService] No <order> elements found. Root: <${rootTag}>, Children: ${childTags}`)
      }
      return orderList
    }

    elements.forEach((el) => {
      const id = this.parseId(el as Element);
      const id_customer = this.parseIntSafe(el as Element, ['id_customer', 'associations > customer > id'])
      const customer_email = this.safeText(el as Element, ['customer_email', 'email'])
      const customer_name = this.safeText(el as Element, ['customer_name', 'customer_firstname', 'firstname'])
      const date_add = this.safeText(el as Element, ['date_add', 'date_add'])
      let current_state = this.safeText(el as Element, ['current_state'])
      const total_paid = this.parseFloatSafe(el as Element, ['total_paid'])
      const total_paid_tax_excl = this.parseFloatSafe(el as Element, ['total_paid_tax_excl', 'total_products'])
      const id_carrier = this.parseIntSafe(el as Element, ['id_carrier'])
      const id_address_delivery = this.parseIntSafe(el as Element, ['id_address_delivery'])
      const id_address_invoice = this.parseIntSafe(el as Element, ['id_address_invoice'])
      const id_cart = this.parseIntSafe(el as Element, ['id_cart'])
      const payment = this.safeText(el as Element, ['payment'])
      const module = this.safeText(el as Element, ['module'])
      const historyStateId = this.extractLastHistoryStateId(el as Element)

      // If current_state is empty, attempt to read last history id or textual state
      if (!current_state) {
        const orderHistoryNodes = (el as Element).querySelectorAll('order_histories > order_history');
        if (orderHistoryNodes.length > 0) {
          const lastHistory = orderHistoryNodes[orderHistoryNodes.length - 1];
          const stateId = lastHistory.querySelector('id_order_state')?.textContent?.trim();
          if (stateId) {
            current_state = stateId
          }
        }
      }

      const items: OrderItem[] = [];
      const rowElements = this.extractRowElements(el as Element)
      rowElements.forEach((rowEl) => {
        const productId = parseInt((rowEl.querySelector('product_id')?.textContent || rowEl.querySelector('id_product')?.textContent || '0').trim(), 10)
        const productAttributeId = parseInt((rowEl.querySelector('product_attribute_id')?.textContent || rowEl.querySelector('id_product_attribute')?.textContent || '0').trim(), 10)
        const quantity = parseInt((rowEl.querySelector('product_quantity')?.textContent || rowEl.querySelector('product_qty')?.textContent || '0').trim(), 10)
        const price = parseFloat((rowEl.querySelector('product_price')?.textContent || rowEl.querySelector('unit_price_tax_excl')?.textContent || '0').trim())
        const name = rowEl.querySelector('product_name')?.textContent || rowEl.querySelector('name')?.textContent || ''
        const reference = rowEl.querySelector('product_reference')?.textContent || rowEl.querySelector('reference')?.textContent || ''

        items.push({
          product_id: Number.isFinite(productId) ? productId : 0,
          product_attribute_id: Number.isFinite(productAttributeId) ? productAttributeId : 0,
          product_quantity: Number.isFinite(quantity) ? quantity : 0,
          product_price: Number.isFinite(price) ? price : 0,
          product_name: name || '',
          reference: reference || '',
        })
      })

      const resolvedStateId = this.resolveStateId(current_state, payment, historyStateId)
      const stateLabel = this.getStateLabel(String(resolvedStateId))

      const order = new Order(id, id_customer, customer_email, customer_name, date_add, stateLabel, items, total_paid, id_carrier, id_address_delivery, id_address_invoice, id_cart, module, total_paid_tax_excl)
      
      if (Number.isFinite(resolvedStateId) && resolvedStateId > 0) {
        order.state_id = resolvedStateId
      }
      orderList.push(order)
    })
    return orderList;
  }

  createOneBy(doc: Document): Order {
    const el = doc.querySelector('order');
    if (!el) return new Order();

    const id = this.parseId(el as Element);
    const id_customer = this.parseIntSafe(el as Element, ['id_customer', 'associations > customer > id'])
    const customer_email = this.safeText(el as Element, ['customer_email', 'email'])
    const customer_name = this.safeText(el as Element, ['customer_name', 'customer_firstname', 'firstname'])
    const date_add = this.safeText(el as Element, ['date_add'])
    let current_state = this.safeText(el as Element, ['current_state'])
    const total_paid = this.parseFloatSafe(el as Element, ['total_paid'])
    const total_paid_tax_excl = this.parseFloatSafe(el as Element, ['total_paid_tax_excl', 'total_products'])
    const id_carrier = this.parseIntSafe(el as Element, ['id_carrier'])
    const id_address_delivery = this.parseIntSafe(el as Element, ['id_address_delivery'])
    const id_address_invoice = this.parseIntSafe(el as Element, ['id_address_invoice'])
    const id_cart = this.parseIntSafe(el as Element, ['id_cart'])
    const payment = this.safeText(el as Element, ['payment'])
    const module = this.safeText(el as Element, ['module'])
    const historyStateId = this.extractLastHistoryStateId(el as Element)

    if (!current_state) {
      const orderHistoryNodes = el.querySelectorAll('order_histories > order_history');
      if (orderHistoryNodes.length > 0) {
        const lastHistory = orderHistoryNodes[orderHistoryNodes.length - 1];
        const stateId = lastHistory.querySelector('id_order_state')?.textContent?.trim();
        if (stateId) {
          current_state = stateId;
        }
      }
    }

    const items: OrderItem[] = [];
    const rowElements = this.extractRowElements(el as Element)
    rowElements.forEach((rowEl) => {
      const productId = parseInt((rowEl.querySelector('product_id')?.textContent || rowEl.querySelector('id_product')?.textContent || '0').trim(), 10)
      const productAttributeId = parseInt((rowEl.querySelector('product_attribute_id')?.textContent || rowEl.querySelector('id_product_attribute')?.textContent || '0').trim(), 10)
      const quantity = parseInt((rowEl.querySelector('product_quantity')?.textContent || rowEl.querySelector('product_qty')?.textContent || '0').trim(), 10)
      const price = parseFloat((rowEl.querySelector('product_price')?.textContent || rowEl.querySelector('unit_price_tax_excl')?.textContent || '0').trim())
      const name = rowEl.querySelector('product_name')?.textContent || rowEl.querySelector('name')?.textContent || ''
      const reference = rowEl.querySelector('product_reference')?.textContent || rowEl.querySelector('reference')?.textContent || ''

      items.push({
        product_id: Number.isFinite(productId) ? productId : 0,
        product_attribute_id: Number.isFinite(productAttributeId) ? productAttributeId : 0,
        product_quantity: Number.isFinite(quantity) ? quantity : 0,
        product_price: Number.isFinite(price) ? price : 0,
        product_name: name || '',
        reference: reference || '',
      })
    })

    const resolvedStateId = this.resolveStateId(current_state, payment, historyStateId)
    const stateLabel = this.getStateLabel(String(resolvedStateId));

    const order = new Order(id, id_customer, customer_email, customer_name, date_add, stateLabel, items, total_paid, id_carrier, id_address_delivery, id_address_invoice, id_cart, module, total_paid_tax_excl);
    
    if (Number.isFinite(resolvedStateId) && resolvedStateId > 0) {
      order.state_id = resolvedStateId
    }
    return order
  }

  /**
   * Convertit l'id_order_state PrestaShop en libellé lisible
   * États métiers utilisés :
   * 1 = Dans le panier (cart)
  * 2 = Payé
  * 5 = Livré
   * 6 = Annulé
   * (3 est gardé en compatibilité historique comme Annulé)
   */
  private getStateLabel(stateValue: string): string {
    const stateMap: Record<string, string> = {
      '1': 'Dans le panier',
    '2': 'Payé',
      '3': 'Annulé',
    '5': 'Livré',
      '6': 'Annulé',
      // États conservés pour compatibilité
      '4': 'Expédié',
      '7': 'Remboursé',
      '8': 'Erreur de paiement',
      '9': 'En attente de réapprovisionnement',
      '10': 'En attente de virement bancaire',
      '11': 'En attente de paiement PayPal',
      '12': 'Autorisation acceptée à distance',
    }
    return stateMap[stateValue] || stateValue || 'Inconnu'
  }
}
