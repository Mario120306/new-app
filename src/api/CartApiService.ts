import { Cart } from '../entities/Cart'

/**
 * API Service for managing carts in PrestaShop
 * Uses PrestaShop API as the source of truth for cart data
 */
export class CartApiService {
  private cartId: number | null = null

  private customerId: number

  constructor(customerId: number) {
    this.customerId = customerId
  }

  /**
   * Get or create cart for this customer
   */
  async getOrCreateCart(): Promise<number> {
    // If we already have a cart ID, verify it still exists
    if (this.cartId) {
      try {
        const existingCart = await this.getCart(this.cartId)
        if (existingCart) {
          return this.cartId
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('Existing cart not found, checking API for other carts:', error)
        this.cartId = null
      }
    }

    // If no cart ID in storage, check if there's one in the API for this customer
    if (!this.cartId) {
      try {
        // eslint-disable-next-line no-console
        console.log('[CartApiService] Searching for existing cart in API for customer:', this.customerId)
        const cart = new Cart(0, this.customerId)
        const tryFetch = async (params: URLSearchParams) => {
          return fetch(`/prestashop/api/carts?${params.toString()}`, {
            method: 'GET',
            headers: {
              'Authorization': 'Basic ' + btoa(cart.getWsKey() + ':'),
            },
          })
        }

        const buildParams = (customerValue: string, includeSort: boolean) => {
          const params = new URLSearchParams()
          params.set('filter[id_customer]', customerValue)
          params.set('limit', '1')
          if (includeSort) {
            // Some PrestaShop versions don't allow date_add on carts; id is usually safe.
            params.set('sort', '[id_DESC]')
          }
          params.set('display', '[id]')
          return params
        }

        let response = await tryFetch(buildParams(String(this.customerId), true))
        if (!response.ok) {
          response = await tryFetch(buildParams(String(this.customerId), false))
        }
        if (!response.ok) {
          response = await tryFetch(buildParams(`[${this.customerId}]`, false))
        }

        if (response.ok) {
          const xmlText = await response.text()
          const parser = new DOMParser()
          const doc = parser.parseFromString(xmlText, 'text/xml')
          const firstCartId = doc.querySelector('cart > id')?.textContent
          if (firstCartId) {
            this.cartId = parseInt(firstCartId, 10)
            // eslint-disable-next-line no-console
            console.log('[CartApiService] Found existing cart in API:', this.cartId)
            return this.cartId
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[CartApiService] Failed to search for existing cart:', err)
      }
    }

    // Create new cart
    const cart = new Cart(0, this.customerId)
    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <cart>
    <id_customer>${this.customerId}</id_customer>
    <id_address_delivery>0</id_address_delivery>
    <id_address_invoice>0</id_address_invoice>
    <id_currency>1</id_currency>
    <id_lang>1</id_lang>
    <id_carrier>0</id_carrier>
    <associations>
      <cart_rows>
      </cart_rows>
    </associations>
  </cart>
</prestashop>`

    try {
      // eslint-disable-next-line no-console
      console.log('[CartApiService] Creating new cart for customer:', this.customerId)

      const response = await fetch('/prestashop/api/carts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
          'Authorization': 'Basic ' + btoa(cart.getWsKey() + ':'),
        },
        body: xmlBody,
      })

      if (!response.ok) {
        throw new Error(`Failed to create cart: ${response.status}`)
      }

      const xmlText = await response.text()
      const parser = new DOMParser()
      const doc = parser.parseFromString(xmlText, 'text/xml')
      const cartIdElement = doc.querySelector('cart > id')
      const newCartId = cartIdElement ? parseInt(cartIdElement.textContent || '0', 10) : 0

      if (newCartId > 0) {
        this.cartId = newCartId
        return this.cartId
      }

      throw new Error('No cart ID returned from API')
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[CartApiService] Error creating cart:', error)
      throw error
    }
  }

  /**
   * Get cart details from PrestaShop
   */
  async getCart(cartId: number): Promise<Cart | null> {
    try {
      const cart = new Cart(cartId, this.customerId)
      const response = await fetch(`/prestashop/api/carts/${cartId}`, {
        method: 'GET',
        headers: {
          'Authorization': 'Basic ' + btoa(cart.getWsKey() + ':'),
        },
      })

      if (response.status === 404) return null
      if (!response.ok) throw new Error(`Failed to fetch cart: ${response.status}`)

      const xmlText = await response.text()
      const parser = new DOMParser()
      const doc = parser.parseFromString(xmlText, 'text/xml')
      const cartElement = doc.querySelector('cart')
      if (!cartElement) return null

      const cartIdText = cartElement.querySelector('id')?.textContent || '0'
      const customerId = parseInt(cartElement.querySelector('id_customer')?.textContent || '0', 10)

      return new Cart(parseInt(cartIdText, 10), customerId)
    } catch (error) {
      return null
    }
  }

  /**
   * Load customer carts from PrestaShop
   */
  async loadCustomerCarts(): Promise<Array<{ product_id: number; quantity: number }>> {
    try {
      const cart = new Cart(0, this.customerId)
      const tryFetch = async (params: URLSearchParams) => {
        return fetch(`/prestashop/api/carts?${params.toString()}`, {
          method: 'GET',
          headers: {
            'Authorization': 'Basic ' + btoa(cart.getWsKey() + ':'),
          },
        })
      }

      const buildParams = (customerValue: string, includeSort: boolean) => {
        const params = new URLSearchParams()
        params.set('filter[id_customer]', customerValue)
        params.set('limit', '10')
        if (includeSort) {
          params.set('sort', '[id_DESC]')
        }
        params.set('display', '[id]')
        return params
      }

      let response = await tryFetch(buildParams(String(this.customerId), true))
      if (!response.ok) {
        response = await tryFetch(buildParams(String(this.customerId), false))
      }
      if (!response.ok) {
        response = await tryFetch(buildParams(`[${this.customerId}]`, false))
      }

      if (!response.ok) {
        try {
          const text = await response.text()
          // eslint-disable-next-line no-console
          console.warn('[CartApiService] list carts request failed', response.status, text)
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('[CartApiService] list carts request failed', response.status)
        }
        return []
      }

      const xmlText = await response.text()
      const parser = new DOMParser()
      const doc = parser.parseFromString(xmlText, 'text/xml')

      const cartIds = Array.from(doc.querySelectorAll('cart'))
        .map((cartElement) => parseInt(cartElement.querySelector('id')?.textContent || '0', 10))
        .filter((cartId) => cartId > 0)

      if (cartIds.length === 0) return []

      const parseItemsFromCartDocument = (cartDocument: Document): Array<{ product_id: number; quantity: number }> => {
        const items: Array<{ product_id: number; quantity: number }> = []
        const cartRowElements = Array.from(cartDocument.querySelectorAll('cart_row'))

        cartRowElements.forEach((rowEl) => {
          const productId = parseInt(rowEl.querySelector('id_product')?.textContent || rowEl.getAttribute('id_product') || '0', 10)
          const quantity = parseInt(rowEl.querySelector('quantity')?.textContent || rowEl.getAttribute('quantity') || '0', 10)
          if (productId > 0 && quantity > 0) {
            items.push({ product_id: productId, quantity })
          }
        })

        if (items.length === 0) {
          // Some PrestaShop responses flatten cart rows differently.
          const productNodes = Array.from(cartDocument.querySelectorAll('id_product'))
          productNodes.forEach((productNode) => {
            const productId = parseInt(productNode.textContent || '0', 10)
            const quantityText = productNode.parentElement?.querySelector('quantity')?.textContent || '0'
            const quantity = parseInt(quantityText, 10)
            if (productId > 0 && quantity > 0) {
              items.push({ product_id: productId, quantity })
            }
          })
        }

        return items
      }

      const sortedCartIds = [...cartIds].reverse()
      for (const cartId of cartIds) {
        const cartResponse = await fetch(`/prestashop/api/carts/${cartId}?display=full`, {
          method: 'GET',
          headers: {
            'Authorization': 'Basic ' + btoa(cart.getWsKey() + ':'),
          },
        })

        if (!cartResponse.ok) {
          continue
        }

        const cartXmlText = await cartResponse.text()
        const cartDocument = parser.parseFromString(cartXmlText, 'text/xml')
        const items = parseItemsFromCartDocument(cartDocument)

        if (items.length > 0) {
          this.cartId = cartId
          return items
        }
      }

      for (const cartId of sortedCartIds) {
        const cartResponse = await fetch(`/prestashop/api/carts/${cartId}?display=full`, {
          method: 'GET',
          headers: {
            'Authorization': 'Basic ' + btoa(cart.getWsKey() + ':'),
          },
        })

        if (!cartResponse.ok) continue

        const cartXmlText = await cartResponse.text()
        const cartDocument = parser.parseFromString(cartXmlText, 'text/xml')
        const items = parseItemsFromCartDocument(cartDocument)

        if (items.length === 0) {
          const cartRowCount = cartDocument.querySelectorAll('cart_row').length
          if (cartRowCount > 0) {
            // If rows exist but parsing failed, still keep this cart id for debugging and fallback.
            this.cartId = cartId
          }
        }
      }

      return []
    } catch (error) {
      return []
    }
  }

  /**
   * Save current cart items to PrestaShop
   */
  async saveCartItems(items: Array<{ product_id: number; quantity: number }>): Promise<void> {
    if (this.customerId <= 0) return

    try {
      const cartId = await this.getOrCreateCart()
      const cart = new Cart(cartId, this.customerId)

      const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <cart>
    <id>${cartId}</id>
    <id_customer>${this.customerId}</id_customer>
    <id_address_delivery>0</id_address_delivery>
    <id_address_invoice>0</id_address_invoice>
    <id_currency>1</id_currency>
    <id_lang>1</id_lang>
    <id_carrier>0</id_carrier>
    <associations>
      <cart_rows>
        ${items.map(item => `
        <cart_row>
          <id_product>${item.product_id}</id_product>
          <id_product_attribute>0</id_product_attribute>
          <id_address_delivery>0</id_address_delivery>
          <quantity>${item.quantity}</quantity>
        </cart_row>`).join('')}
      </cart_rows>
    </associations>
  </cart>
</prestashop>`

      const response = await fetch(`/prestashop/api/carts/${cartId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/xml',
          'Authorization': 'Basic ' + btoa(cart.getWsKey() + ':'),
        },
        body: xmlBody,
      })

      if (!response.ok) {
        throw new Error(`Failed to update cart: ${response.status}`)
      }
    } catch (error) {
      console.error('[CartApiService] Error saving cart:', error)
      throw error
    }
  }

  /**
   * Clear cart ID from storage
   */
  clearCartId(): void {
    this.cartId = null
  }
}
