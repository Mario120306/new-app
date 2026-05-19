import { useEffect, useMemo, useState, useRef } from 'react'
import { API } from '../../api/API'
import { CartApiService } from '../../api/CartApiService'
import { Category } from '../../entities/Category'
import { Order } from '../../entities/Order'
import { Product } from '../../entities/Product'
import { CategoryService } from '../../service/CategoryService'
import { OrderService } from '../../service/OrderService'
import { ProductService } from '../../service/ProductService'
import { CartService, type CartItem } from '../../service/CartService'
import { ApiError } from '../../utils/ApiError'
import { fetchStockQuantityByProductId } from '../../utils/stockQuantity'
import { CartPage } from './CartPage'
import FrontUserSelect, { type FrontSelectedUser } from '../auth/FrontUserSelect'
import FrontSidebar from './FrontSidebar'
import FrontOrdersSection from './FrontOrdersSection'
import FrontProductsSection from './FrontProductsSection'
import FrontProductDetailSection from './FrontProductDetailSection'

type FrontView = 'products' | 'cart' | 'orders' | 'switch-user'
type CategoryFilter = number | 'all'

function parseNumberInput(value: string): number | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : undefined
}

function buildCategoryNameMap(categories: Category[]): Record<number, string> {
  const map: Record<number, string> = {}

  categories.forEach((category) => {
    if (category.id) {
      map[category.id] = category.name || `Categorie ${category.id}`
    }
  })

  return map
}

function formatOrderDate(value: string): string {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function getProductImageUrl(product: Product): string {
  const imageIdRaw = product.id_default_image ?? product.id
  const imageId = Number(imageIdRaw || 0)
  if (!imageId) {
    return ''
  }

  const configuredBase = import.meta.env.VITE_PRESTASHOP_BASE_URL
    || (import.meta.env.VITE_PRESTASHOP_API_BASE_URL || '').replace(/\/api\/?$/, '')
    || '/prestashop'
  const base = configuredBase.replace(/\/$/, '')

  // Use direct filesystem-style image URL to avoid SEO-route 403 under Apache/XAMPP setups.
  const imagePath = String(imageId).split('').join('/')
  return `${base}/img/p/${imagePath}/${imageId}.jpg`
}

function getProductLaunchDate(product: Product): Date | undefined {
  if (product.available_date instanceof Date && !Number.isNaN(product.available_date.getTime())) {
    return product.available_date
  }

  if (product.date_add instanceof Date && !Number.isNaN(product.date_add.getTime())) {
    return product.date_add
  }

  return undefined
}

function getProductBadge(product: Product): 'HOT' | 'NEW' | '' {
  const launchDate = getProductLaunchDate(product)
  if (!launchDate) return ''

  const now = new Date()
  const diffDays = (now.getTime() - launchDate.getTime()) / (1000 * 60 * 60 * 24)

  if (diffDays < 0) return ''
  if (diffDays <= 1) return 'HOT'
  if (diffDays <= 7) return 'NEW'
  return ''
}      

function getBadgeStyle(variant: 'hot' | 'new' | 'active' | 'inactive'): React.CSSProperties {
  if (variant === 'hot') {
    return {
      background: 'linear-gradient(135deg, #ff7a59 0%, #ff4d4f 100%)',
      color: '#fff',
    }
  }

  if (variant === 'new') {
    return {
      background: 'linear-gradient(135deg, #4a90e2 0%, #357abd 100%)',
      color: '#fff',
    }
  }

  return variant === 'active'
    ? {
        background: 'rgba(155, 231, 168, 0.18)',
        color: '#9be7a8',
      }
    : {
        background: 'rgba(255, 255, 255, 0.12)',
        color: '#c4c9d4',
      }
}

function formatProductDate(value?: Date): string {
  if (!value || Number.isNaN(value.getTime())) return '-'
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
  }).format(value)
}

type FrontOfficeLayoutProps = {
  onLogout: () => void
  customerEmail?: string
  customerId?: number
  onCustomerChange?: (session: FrontSelectedUser) => void
}

export default function FrontOfficeLayout({ onLogout, customerEmail, customerId = 0, onCustomerChange }: FrontOfficeLayoutProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryNames, setCategoryNames] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [activeView, setActiveView] = useState<FrontView>('products')
  const [cartItemCount, setCartItemCount] = useState(0)
  const [orders, setOrders] = useState<Order[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersError, setOrdersError] = useState('')
  const [ordersRefreshToken, setOrdersRefreshToken] = useState(0)
  const [lastOrderId, setLastOrderId] = useState<number | null>(null)
  
  // Search and filter states
  const [searchName, setSearchName] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<CategoryFilter>('all')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')

  const goToView = (view: FrontView) => {
    setActiveView(view)
    setSelectedProduct(null)
  }

  useEffect(() => {
    let isCancelled = false

    async function loadProducts() {
      setLoading(true)
      setError('')

      try {
        const api = new API()
        const service = new ProductService()
        const categoryService = new CategoryService()
        const mere = new Product()
        const categoryMere = new Category()

        const [list, fetchedCategories] = await Promise.all([
          api.fetch<Product>({
            method: 'GET',
            mere,
            service,
            params: new URLSearchParams({ display: 'full', limit: '100' }),
          }),
          api.fetch<Category>({
            method: 'GET',
            mere: categoryMere,
            service: categoryService,
            params: new URLSearchParams({ display: '[id,name,link_rewrite]', limit: '500' }),
          }),
        ])

        try {
          const quantityMap = await fetchStockQuantityByProductId()
          list.forEach((p) => {
            if (p.id && quantityMap[p.id] !== undefined) {
              p.quantity = quantityMap[p.id]
            }
          })
        } catch (stockErr) {
          console.warn('[WARN] Unable to fetch stock_availables:', stockErr)
        }

        const nextCategoryNames = buildCategoryNameMap(fetchedCategories)

        if (!isCancelled) {
          setProducts(list)
          setCategories(fetchedCategories)
          setCategoryNames(nextCategoryNames)
        }
      } catch (err) {
        if (!isCancelled) {
          if (err instanceof ApiError) {
            setError(err.message || 'Impossible de charger les produits')
          } else {
            setError(err instanceof Error ? err.message : 'Impossible de charger les produits')
          }
        }
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    void loadProducts()
    return () => {
      isCancelled = true
    }
  }, [])

  // Resynchroniser le stock affiché (back-office, import, onglet visible).
  useEffect(() => {
    const refreshStock = async () => {
      try {
        const quantityMap = await fetchStockQuantityByProductId()
        setProducts((prev) =>
          prev.map((p) =>
            p.id && quantityMap[p.id] !== undefined ? { ...p, quantity: quantityMap[p.id] } : p
          )
        )
      } catch {
        // ignore
      }
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshStock()
      }
    }

    const onStockUpdated = () => {
      void refreshStock()
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('prestashop-stock-updated', onStockUpdated)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('prestashop-stock-updated', onStockUpdated)
    }
  }, [])

  // Track previous customer to detect real customer changes
  const previousCustomerRef = useRef<number | null>(null)

  // Load cart from API when customer changes
  useEffect(() => {
    const loadCartFromAPI = async () => {
      if (customerId <= 0) {
        setCartItemCount(0)
        return
      }

      // If products are not loaded yet, we should wait
      if (products.length === 0 && loading) {
        console.log('[INFO] Products still loading, waiting to load cart...')
        return
      }

      try {
        // eslint-disable-next-line no-console
        console.log('[INFO] Loading cart from API for customerId:', customerId)
        
        // Load product IDs and quantities from PrestaShop cart
        const cartApiService = new CartApiService(customerId)
        const cartItems = await cartApiService.loadCustomerCarts()
        
        // eslint-disable-next-line no-console
        console.log('[INFO] Got', cartItems.length, 'items from PrestaShop API')

        if (cartItems.length === 0) {
          const cartService = CartService.getInstance(customerId)
          const localCount = cartService.getItemCount()

          // If API has no cart yet but the user already added items locally,
          // do NOT wipe the local cart.
          if (localCount > 0) {
            setCartItemCount(localCount)
            return
          }

          cartService.setItems([])
          setCartItemCount(0)
          return
        }

        // Convert to CartItem objects by looking up product details
        const fullCartItems: CartItem[] = []
        const api = new API()
        const productService = new ProductService()

        for (const cartItem of cartItems) {
          let product = products.find((p) => p.id === cartItem.product_id)
          
          // If product not in our local 100-limit list, fetch it specifically
          if (!product) {
            try {
              console.log('[INFO] Product %d not in local list, fetching from API...', cartItem.product_id)
              const results = await api.fetch<Product>({
                method: 'GET',
                mere: new Product(),
                service: productService,
                params: new URLSearchParams({ display: 'full', 'filter[id]': `[${cartItem.product_id}]` }),
              })
              if (results.length > 0) {
                product = results[0]
              }
            } catch (err) {
              console.warn('[WARN] Failed to fetch missing product details:', cartItem.product_id, err)
            }
          }

          if (product && product.id) {
            fullCartItems.push({
              product_id: product.id,
              product_name: product.name || `Product ${product.id}`,
              product_price: product.price ?? 0,
              quantity: cartItem.quantity,
              reference: product.reference || '',
              image_id: product.id_default_image ?? product.id ?? 0,
            })
          } else {
            // Placeholder for unknown product so we don't lose the item
            fullCartItems.push({
              product_id: cartItem.product_id,
              product_name: `Produit #${cartItem.product_id}`,
              product_price: 0,
              quantity: cartItem.quantity,
              reference: '',
              image_id: 0,
            })
          }
        }

        // Load into CartService
        const cartService = CartService.getInstance(customerId)
        cartService.setItems(fullCartItems)
        setCartItemCount(cartService.getItemCount())

        // Log customer change
        if (previousCustomerRef.current !== null && previousCustomerRef.current !== customerId) {
          // eslint-disable-next-line no-console
          console.log('[INFO] Customer changed from', previousCustomerRef.current, 'to', customerId)
          // Clear old instance to avoid cross-customer data
          CartService.clearInstance(previousCustomerRef.current)
        }
        previousCustomerRef.current = customerId
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[ERROR] Failed to load cart from API:', err)
        // Still update cart count even if API fails
        const cartService = CartService.getInstance(customerId)
        setCartItemCount(cartService.getItemCount())
      }
    }

    loadCartFromAPI()
  }, [customerId, products, loading])

  useEffect(() => {
    if (customerId <= 0) {
      setOrders([])
      return
    }

    let isCancelled = false

    async function loadOrders() {
      setOrdersLoading(true)
      setOrdersError('')

      try {
        const api = new API()
        const orderService = new OrderService()
        const orderMere = new Order()

        const fetchOrders = async (customerValue?: string) => {
          const params = new URLSearchParams()
          params.append('display', 'full')
          params.append('limit', '200')
          if (customerValue) {
            params.append('filter[id_customer]', customerValue)
          }

          return api.fetch<Order>({
            method: 'GET',
            mere: orderMere,
            service: orderService,
            params,
          })
        }

        // Prefer server-side filtering (best for performance/privacy).
        let list = await fetchOrders(String(customerId))

        // Some PS setups expect bracketed filters; try again if empty.
        if (list.length === 0) {
          list = await fetchOrders(`[${customerId}]`)
        }

        // If still empty, fallback to recent orders without filter and filter client-side.
        if (list.length === 0) {
          const recent = await fetchOrders(undefined)
          list = recent.filter((order) => order.id_customer === customerId)
        }

        if (!isCancelled) {
          const sorted = [...list].sort((left, right) => {
            return new Date(right.date_add || '').getTime() - new Date(left.date_add || '').getTime()
          })
          setOrders(sorted)
          // eslint-disable-next-line no-console
          console.log('[FrontOfficeLayout] Loaded orders:', sorted.length, sorted.slice(0, 2))
        }
      } catch (err) {
        if (!isCancelled) {
          setOrdersError(err instanceof Error ? err.message : 'Impossible de charger vos commandes')
          setOrders([])
        }
      } finally {
        if (!isCancelled) {
          setOrdersLoading(false)
        }
      }
    }

    void loadOrders()

    return () => {
      isCancelled = true
    }
  }, [customerId, ordersRefreshToken])

  const refreshCartCount = () => {
    setCartItemCount(CartService.getInstance(customerId).getItemCount())
  }

  const handleAddToCart = async (product: Product) => {
    // Vérifier que l'utilisateur n'est pas anonyme
    if (customerId <= 0) {
      alert('❌ Vous devez être connecté pour ajouter des produits au panier.')
      return
    }

    if (!product.id || !product.name || product.price === undefined) return

    console.log('[INFO] Adding product to cart:', product.id, product.name)
    const cartService = CartService.getInstance(customerId)
    
    cartService.addItem({
      product_id: product.id,
      product_name: product.name,
      product_price: product.price,
      quantity: 1,
      reference: product.reference || '',
      image_id: product.id_default_image || product.id,
    })

    // Persister vers l'API PrestaShop avant de rafraîchir l'UI
    await cartService.persistToAPI()

    refreshCartCount()
  }

  const totalProducts = products.length
  const averagePrice = useMemo(() => {
    if (!products.length) return 0
    const total = products.reduce((sum, item) => sum + (item.price || 0), 0)
    return total / products.length
  }, [products])

  const getCategoryNames = (product: Product): string => {
    const defaultCategoryId = product.id_category_default
    if (defaultCategoryId) {
      return categoryNames[defaultCategoryId] || '-'
    }

    const categories = product.associations?.categories
    if (Array.isArray(categories) && categories.length > 0) {
      const firstCategory = categories[0] as any
      const categoryId = Number(firstCategory?.value ?? firstCategory?.id ?? firstCategory)
      if (Number.isFinite(categoryId) && categoryId > 0) {
        return categoryNames[categoryId] || firstCategory?.name || '-'
      }
      return firstCategory?.name || '-'
    }

    return '-'
  }

  // Filter products based on search criteria
  const filteredProducts = useMemo(() => {
    const normalizedSearchName = searchName.trim().toLowerCase()
    const min = parseNumberInput(minPrice)
    const max = parseNumberInput(maxPrice)

    return products.filter((product) => {
      const name = (product.name || '').toLowerCase()
      const price = product.price ?? 0
      const productCategoryId = product.id_category_default ?? 0

      if (normalizedSearchName && !name.includes(normalizedSearchName)) {
        return false
      }

      if (selectedCategoryId !== 'all' && productCategoryId !== selectedCategoryId) {
        return false
      }

      if (min !== undefined && price < min) {
        return false
      }
      if (max !== undefined && price > max) {
        return false
      }

      return true
    })
  }, [products, searchName, selectedCategoryId, minPrice, maxPrice])

  return (
    <div className="app-layout">
      <FrontSidebar
        activeView={activeView}
        cartItemCount={cartItemCount}
        customerEmail={customerEmail}
        onViewChange={goToView}
        onLogout={onLogout}
      />

      <main className="content front-content">
        {activeView === 'switch-user' ? (
          <FrontUserSelect 
            title="Changer d'utilisateur"
            onLoginSuccess={(session) => {
              onCustomerChange?.(session)
              goToView('products')
            }}
          />
        ) : activeView === 'cart' ? (
          <CartPage 
              customerEmail={customerEmail || ''} 
              customerId={customerId && customerId > 0 
                ? customerId 
                : parseInt(window.localStorage.getItem('new-app-customer-id') || '0', 10)
              }
              
            onBackClick={() => { goToView('products') }}
            onCheckoutComplete={(_orderId) => {
              setLastOrderId(_orderId)
              setOrdersRefreshToken((value) => value + 1)
              refreshCartCount()
              setTimeout(() => {
                goToView('orders')
              }, 2000)
            }}
            
          />
        ) : (
          <>
        <section className="front-hero">
          <div>
            <p className="dashboard-kicker">FrontOffice</p>
            <h1>Accueil client</h1>
            <p>Decouvrez les produits disponibles dans votre boutique PrestaShop.</p>
          </div>

          <div className="front-stats">
            <article className="front-stat-card">
              <h3>Produits</h3>
              <strong>{totalProducts}</strong>
            </article>
            <article className="front-stat-card">
              <h3>Prix moyen</h3>
              <strong>{averagePrice.toFixed(2)}£</strong>
            </article>
          </div>
        </section>

        {activeView === 'orders' && (
          <FrontOrdersSection
            orders={orders}
            ordersLoading={ordersLoading}
            ordersError={ordersError}
            lastOrderId={lastOrderId}
            formatOrderDate={formatOrderDate}
          />
        )}

        {activeView === 'products' && !selectedProduct && (
          <FrontProductsSection
            loading={loading}
            error={error}
            searchName={searchName}
            onSearchNameChange={setSearchName}
            selectedCategoryId={selectedCategoryId}
            onCategoryChange={setSelectedCategoryId}
            minPrice={minPrice}
            maxPrice={maxPrice}
            onMinPriceChange={setMinPrice}
            onMaxPriceChange={setMaxPrice}
            categories={categories}
            filteredProducts={filteredProducts}
            getProductImageUrl={getProductImageUrl}
            getProductBadge={getProductBadge}
            getBadgeStyle={getBadgeStyle}
            getProductLaunchDate={getProductLaunchDate}
            formatProductDate={formatProductDate}
            getCategoryNames={getCategoryNames}
            onSelectProduct={setSelectedProduct}
            onAddToCart={handleAddToCart}
          />
        )}

        {activeView === 'products' && selectedProduct && (
          <FrontProductDetailSection
            selectedProduct={selectedProduct}
            onBack={() => setSelectedProduct(null)}
            getCategoryNames={getCategoryNames}
          />
        )}
        </>
        )}
      </main>
    </div>
  )
}


