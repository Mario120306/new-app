export interface CartItem {
  product_id: number
  product_name: string
  product_price: number
  quantity: number
  reference: string
  image_id: number
}

/**
 * CartService - In-memory cart management with per-customer instances
 */
export class CartService {
  private static instances: Map<number, CartService> = new Map()
  
  private customerId: number
  private items: CartItem[] = []

  private constructor(customerId: number) {
    this.customerId = customerId
  }

  /**
   * Get singleton instance for a customer
   */
  static getInstance(customerId?: number): CartService {
    const id = customerId ?? parseInt(window.localStorage.getItem('new-app-customer-id') || '0', 10)
    
    if (!this.instances.has(id)) {
      this.instances.set(id, new CartService(id))
    }
    
    return this.instances.get(id)!
  }

  /**
   * Add or update product in cart
   */
  addItem(item: CartItem): void {
    const existing = this.items.find((i) => i.product_id === item.product_id)
    if (existing) {
      existing.quantity += item.quantity
    } else {
      this.items.push(item)
    }
  }

  /**
   * Remove product from cart
   */
  removeItem(productId: number): void {
    this.items = this.items.filter((i) => i.product_id !== productId)
  }

  /**
   * Update quantity of product
   */
  updateQuantity(productId: number, quantity: number): void {
    const item = this.items.find((i) => i.product_id === productId)
    if (item) {
      if (quantity <= 0) {
        this.removeItem(productId)
      } else {
        item.quantity = quantity
      }
    }
  }

  /**
   * Get all items currently in cart
   */
  getItems(): CartItem[] {
    return [...this.items]
  }

  /**
   * Set items directly (used when loading from API)
   */
  setItems(items: CartItem[]): void {
    this.items = items
  }

  /**
   * Get item count
   */
  getItemCount(): number {
    return this.items.reduce((total, item) => total + item.quantity, 0)
  }

  /**
   * Calculate total price
   */
  getTotalPrice(): number {
    return this.items.reduce((total, item) => total + item.product_price * item.quantity, 0)
  }

  /**
   * Clear all items from cart
   */
  clear(): void {
    this.items = []
  }

  /**
   * Check if cart is empty
   */
  isEmpty(): boolean {
    return this.items.length === 0
  }

  /**
   * Persist current in-memory items to PrestaShop API
   */
  async persistToAPI(): Promise<void> {
    if (this.customerId <= 0) return

    try {
      const { CartApiService } = await import('../api/CartApiService')
      const apiService = new CartApiService(this.customerId)
      
      await apiService.saveCartItems(this.items.map(i => ({
        product_id: i.product_id,
        quantity: i.quantity
      })))
    } catch (error) {
      console.error('[CartService] Failed to persist cart to API:', error)
    }
  }

  /**
   * Clear all instances (e.g., on logout)
   */
  static clearAllInstances(): void {
    this.instances.clear()
  }

  /**
   * Clear specific customer instance
   */
  static clearInstance(customerId: number): void {
    this.instances.delete(customerId)
  }
}
