import { useState, useEffect } from 'react'
import { CartService, type CartItem } from '../../service/CartService'
import { API } from '../../api/API'
import { Product } from '../../entities/Product'
import { Order, type OrderItem } from '../../entities/Order'
import { OrderService } from '../../service/OrderService'
import { Carrier } from '../../entities/Carrier'
import { CarrierService } from '../../service/CarrierService'
import { Address } from '../../entities/Address'
import { AddressService } from '../../service/AddressService'
import { Customer } from '../../entities/Customer'
import { CustomerService } from '../../service/CustomerService'
import { Cart } from '../../entities/Cart'
import { CartApiService } from '../../api/CartApiService'
import { ProductService } from '../../service/ProductService'
import '../../style/App.css'

interface CartPageProps {
  customerEmail: string
  customerId: number
  onCheckoutComplete?: (orderId: number) => void
  onBackClick?: () => void
}

export function CartPage({ customerEmail, customerId, onCheckoutComplete, onBackClick }: CartPageProps) {
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [selectedCarrierId, setSelectedCarrierId] = useState<number>(0)
  const [customerAddressId, setCustomerAddressId] = useState<number>(0)

  // ── Panier + transporteurs ──────────────────
  useEffect(() => {
    let isCancelled = false

    const loadCartAndCarriers = async () => {
      try {
        const api = new API()

        if (customerId > 0) {
          const cartApiService = new CartApiService(customerId)
          const apiCartItems = await cartApiService.loadCustomerCarts()
          const productService = new ProductService()
          const cartService = CartService.getInstance(customerId)

          if (apiCartItems.length === 0) {
            const fallbackItems = cartService.getItems()
            if (fallbackItems.length > 0) {
              console.log('[INFO] API cart is empty, using in-memory cart with', fallbackItems.length, 'items')
              if (!isCancelled) {
                setCartItems(fallbackItems)
              }
              return
            }
          }

          const loadedItems: CartItem[] = []

          for (const apiCartItem of apiCartItems) {
            let productName = `Produit #${apiCartItem.product_id}`
            let productPrice = 0
            let reference = ''
            let imageId = apiCartItem.product_id

            try {
              const productResult = await api.fetch<Product>({
                method: 'GET',
                mere: new Product(),
                service: productService,
                params: new URLSearchParams({
                  display: 'full',
                  'filter[id]': `[${apiCartItem.product_id}]`,
                }),
              })

              if (productResult.length > 0 && productResult[0].id) {
                const product = productResult[0]
                productName = product.name || productName
                productPrice = product.price ?? 0
                reference = product.reference || ''
                imageId = product.id_default_image ?? product.id ?? apiCartItem.product_id
              }
            } catch (err) {
              console.warn('[WARN] Failed to load product for cart item:', apiCartItem.product_id, err)
            }

            loadedItems.push({
              product_id: apiCartItem.product_id,
              product_name: productName,
              product_price: productPrice,
              quantity: apiCartItem.quantity,
              reference,
              image_id: imageId,
            })
          }

          cartService.setItems(loadedItems)
          if (!isCancelled) {
            setCartItems(loadedItems)
          }
        } else {
          const cartService = CartService.getInstance(customerId)
          if (!isCancelled) {
            setCartItems(cartService.getItems())
          }
        }

        const carrierService = new CarrierService()
        const carrierMere = new Carrier()

        const carrierList = await api.fetch<Carrier>({
          method: 'GET',
          mere: carrierMere,
          service: carrierService,
          params: new URLSearchParams({ display: '[id,name,active]', limit: '50' }),
        })

        if (carrierList.length > 0) {
          const activeCarrier = carrierList.find((c) => c.active) || carrierList[0]
          if (!isCancelled) {
            setSelectedCarrierId(activeCarrier.id)
          }
        }
      } catch (err) {
        console.error('[ERROR] Failed to load cart and carriers:', err)
      }
    }

    void loadCartAndCarriers()

    return () => {
      isCancelled = true
    }
  }, [customerId])

  // ── Adresse client — se relance dès que customerId est disponible ────────
  useEffect(() => {
    if (customerId <= 0) {
      console.warn('[WARN] customerId not ready yet:', customerId)
      return
    }

    console.log('[INFO] Loading address for customerId:', customerId)
    const loadCustomerAddress = async () => {
      try {
        const api = new API()
        const addressService = new AddressService()
        const addressMere = new Address()

        // ── Tentative 1 : filtre côté API (syntaxe PrestaShop correcte) ──
        const filterParams = new URLSearchParams()
        filterParams.append('display', '[id,id_customer]')
        filterParams.append('filter[id_customer]', `[${customerId}]`)
        filterParams.append('limit', '50')

        const filtered = await api.fetch<Address>({
          method: 'GET',
          mere: addressMere,
          service: addressService,
          params: filterParams,
        })
        console.log('[INFO] Filtered addresses:', filtered)

        const match = filtered.filter(
          (a) => Number(a.id_customer) === Number(customerId)
        )

        if (match.length > 0) {
          setCustomerAddressId(match[0].id)
          console.log('[INFO] Address found (filtered):', match[0].id)
          return
        }

        // ── Tentative 2 : tout charger sans filtre ──
        console.warn('[WARN] No match with filter, loading all addresses...')
        const all = await api.fetch<Address>({
          method: 'GET',
          mere: addressMere,
          service: addressService,
          params: new URLSearchParams({
            display: '[id,id_customer]',
            limit: '100',
          }),
        })
        console.log('[INFO] All addresses:', all)

        const fallback = all.filter(
          (a) => Number(a.id_customer) === Number(customerId)
        )
        console.log('[INFO] Fallback match:', fallback)

        if (fallback.length > 0) {
          setCustomerAddressId(fallback[0].id)
          console.log('[INFO] Address found (fallback):', fallback[0].id)
          return
        }

        // ── Tentative 3 : créer une adresse par défaut pour ce client ──
        console.warn('[WARN] No address found — creating default address for customer', customerId)

        // Récupérer les vraies infos client (firstname, lastname) depuis l'API
        const customerService = new CustomerService()
        const customerMere = new Customer()
        const customerFilterParams = new URLSearchParams()
        customerFilterParams.append('display', '[id,firstname,lastname]')
        customerFilterParams.append('filter[id]', `[${customerId}]`)
        customerFilterParams.append('limit', '1')

        let firstname = 'Client'
        let lastname = 'Client'
        try {
          const customers = await api.fetch<Customer>({
            method: 'GET',
            mere: customerMere,
            service: customerService,
            params: customerFilterParams,
          })
          if (customers.length > 0) {
            firstname = customers[0].firstname || 'Client'
            lastname = customers[0].lastname || 'Client'
          }
          console.log('[INFO] Customer info for address:', firstname, lastname)
        } catch (custErr) {
          console.warn('[WARN] Could not fetch customer info, using defaults:', custErr)
        }

        const newAddress = new Address(0, {
          id_customer: customerId,
          id_country: 128,
          firstname,
          lastname,
          address1: 'Adresse par défaut',
          city: 'Antananarivo',
          postcode: '101',
          alias: 'Adresse par défaut',
        })

        console.log('[INFO] Creating address with XML:', newAddress.getCreateXML())

        const created = await api.fetch<Address>({
          method: 'POST',
          mere: addressMere,
          service: addressService,
          body: newAddress.getCreateXML(),
        })

        if (created.length > 0 && created[0].id > 0) {
          setCustomerAddressId(created[0].id)
          console.log('[INFO] Default address created with id:', created[0].id)
        } else {
          console.error('[ERROR] Failed to create default address')
        }
      } catch (err) {
        console.error('[ERROR] Failed to load customer address:', err)
      }
    }

    loadCustomerAddress()
  }, [customerId, customerEmail]) // ← se relance quand customerId change

  const handleRemoveItem = (productId: number) => {
    const cartService = CartService.getInstance(customerId)
    cartService.removeItem(productId)
    setCartItems(cartService.getItems())
    // Persister vers l'API
    void cartService.persistToAPI()
  }

  const handleUpdateQuantity = (productId: number, quantity: number) => {
    if (quantity < 1) return
    const cartService = CartService.getInstance(customerId)
    cartService.updateQuantity(productId, quantity)
    setCartItems(cartService.getItems())
    // Persister vers l'API
    void cartService.persistToAPI()
  }

  const calculateTotal = (): number =>
    cartItems.reduce((total, item) => total + item.product_price * item.quantity, 0)

  const handleCheckout = async () => {
    if (cartItems.length === 0) { setError('Panier vide'); return }
    if (selectedCarrierId === 0) { setError('Veuillez sélectionner un transporteur'); return }
    if (customerAddressId === 0) { setError('Adresse client non trouvée — vérifiez que ce client possède une adresse enregistrée'); return }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const total = calculateTotal()
      // Ajuster pour inclure la TVA (20%) : PrestaShop attend les totaux TTC
      const TAX_RATE = 1.2
      const totalTTC = parseFloat((total * TAX_RATE).toFixed(2))
      const api = new API()

      // ── Étape 1 : Créer un panier PrestaShop ──────────────────────────
      const psCart = new Cart(0, customerId)
      psCart.id_address_delivery = customerAddressId
      psCart.id_address_invoice = customerAddressId
      psCart.id_currency = 1
      psCart.id_lang = 1
      psCart.id_carrier = selectedCarrierId
      psCart.products = cartItems.map((item) => ({
        id: item.product_id,
        id_product_attribute: 0,
        quantity: item.quantity,
      }))

      console.log('[INFO] Creating PrestaShop cart...')
      console.log('[INFO] Cart XML:', psCart.getCreateXML())

      const cartApiService = new CartApiService(customerId)
      const psCartId = await cartApiService.getOrCreateCart()
      await cartApiService.saveCartItems(
        cartItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
        }))
      )

      if (psCartId <= 0) {
        throw new Error('Impossible de créer le panier PrestaShop')
      }

      console.log('[INFO] PrestaShop cart created with id:', psCartId)

      // ── Étape 2 : Créer la commande avec l'id_cart ────────────────────
      // Construire les lignes de commande en TTC pour rester cohérent
      const items: OrderItem[] = cartItems.map((item) => ({
        product_id: item.product_id,
        product_attribute_id: 0,
        product_quantity: item.quantity,
        product_price: item.product_price, // ✅ On envoie le prix HT à PrestaShop
        product_name: item.product_name,
        reference: item.reference,
      }))

      const order = new Order(
        0,
        customerId,
        customerEmail,
        customerEmail,
        new Date().toISOString().slice(0, 19).replace('T', ' '),
        'Paiement accepté',
        items,
        totalTTC, // TTC
        selectedCarrierId,
        customerAddressId,
        customerAddressId,
        psCartId,
        'ps_wirepayment', // module
        total // HT
      )

      console.log('[INFO] Creating order with cart id:', psCartId)

      const orderService = new OrderService()
      const result = await api.fetch<Order>({
        method: 'POST',
        mere: order,
        service: orderService,
        body: order.getCreateXML(),
      })

      if (result.length > 0) {
        const createdOrder = result[0]

        // Mettre à jour l'état de la commande dans PrestaShop à "Paiement accepté" (id_order_state 2)
        try {
          const wsKey = order.getWsKey()
          const baseUrl = (import.meta.env.VITE_PRESTASHOP_API_BASE_URL || '/prestashop/api').replace(/\/$/, '')
          const historyXml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <order_history>
    <id_order>${createdOrder.id}</id_order>
    <id_order_state>2</id_order_state>
  </order_history>
</prestashop>`

          await fetch(`${baseUrl}/order_histories`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/xml',
              Authorization: 'Basic ' + btoa(wsKey + ':'),
            },
            body: historyXml,
          })
          console.log(`[INFO] Order state history set to 2 for order #${createdOrder.id}`)
        } catch (historyErr) {
          console.warn('[WARN] Failed to set order state history:', historyErr)
        }

        setSuccess(`Commande créée avec succès ! Commande #${createdOrder.id}`)
        const cartService = CartService.getInstance(customerId)
        cartService.clear()
        setCartItems([])
        void new CartApiService(customerId).saveCartItems([])
        if (onCheckoutComplete) {
          setTimeout(() => onCheckoutComplete(createdOrder.id), 1500)
        }
      }
    } catch (err) {
      console.error('[ERROR] Checkout error:', err)
      setError(err instanceof Error ? err.message : 'Erreur lors de la création de la commande')
    } finally {
      setLoading(false)
    }
  }

  if (cartItems.length === 0 && !success) {
    return (
      <section className="front-product-detail">
        <button type="button" className="login-back" onClick={onBackClick}>
          Retour aux produits
        </button>
        <h2>Panier</h2>
        <div className="front-detail-card">
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ color: '#999', fontSize: '16px' }}>Votre panier est vide</p>
          </div>
        </div>
      </section>
    )
  }

  const totalItems = cartItems.reduce((t, i) => t + i.quantity, 0)

  return (
    <section className="front-product-detail">
      <button type="button" className="login-back" onClick={onBackClick}>
        Retour aux produits
      </button>

      <h2>Panier</h2>

      {error && (
        <div style={{
          padding: '12px 16px',
          marginBottom: '16px',
          borderRadius: '4px',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          border: '1px solid #f5c6cb',
          fontSize: '14px',
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: '12px 16px',
          marginBottom: '16px',
          borderRadius: '4px',
          backgroundColor: '#d4edda',
          color: '#155724',
          border: '1px solid #c3e6cb',
          fontSize: '14px',
        }}>
          {success}
        </div>
      )}

      <div className="front-detail-card">
        <div style={{ overflowX: 'auto' }}>
          <table className="front-products-table" style={{ width: '100%', marginBottom: '24px' }}>
            <thead>
              <tr>
                <th>Produit</th>
                <th>Référence</th>
                <th>Prix unitaire</th>
                <th>Quantité</th>
                <th>Sous-total</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {cartItems.map((item) => (
                <tr key={item.product_id}>
                  <td className="name-col">{item.product_name}</td>
                  <td style={{ color: '#666', fontSize: '13px' }}>{item.reference}</td>
                  <td className="price-col">{item.product_price.toFixed(2)} EUR</td>
                  <td className="quantity-col">
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) =>
                        handleUpdateQuantity(item.product_id, parseInt(e.target.value, 10))
                      }
                      style={{
                        width: '70px',
                        padding: '0.5rem',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        textAlign: 'center',
                        fontFamily: 'inherit',
                      }}
                    />
                  </td>
                  <td className="price-col" style={{ fontWeight: 600 }}>
                    {(item.product_price * item.quantity).toFixed(2)} EUR
                  </td>
                  <td>
                    <button
                      onClick={() => handleRemoveItem(item.product_id)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#e74c3c',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Résumé + paiement */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 300px',
          gap: '24px',
          marginTop: '24px',
          paddingTop: '24px',
          borderTop: '2px solid #ddd',
        }}>
          <div />

          <div>
            <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px' }}>Résumé</h3>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '12px',
              paddingBottom: '12px',
              borderBottom: '1px solid #ddd',
            }}>
              <span>Articles :</span>
              <span style={{ fontWeight: 600 }}>{totalItems}</span>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '12px',
              paddingBottom: '12px',
              borderBottom: '1px solid #ddd',
            }}>
              <span>Lignes :</span>
              <span style={{ fontWeight: 600 }}>{cartItems.length}</span>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '16px',
              paddingBottom: '16px',
              borderBottom: '2px solid #333',
              fontSize: '18px',
              fontWeight: 600,
            }}>
              <span>Total :</span>
              <span style={{ color: '#27ae60', fontSize: '20px' }}>
                {calculateTotal().toFixed(2)} EUR
              </span>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '16px',
              paddingBottom: '16px',
              borderBottom: '1px solid #ddd',
            }}>
              <span>Livraison :</span>
              <span style={{ fontWeight: 600 }}>0.00 EUR</span>
            </div>

            {/* Mode de paiement */}
            <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #ddd' }}>
              <h4 style={{ marginTop: 0, marginBottom: '12px', fontSize: '14px' }}>
                Mode de paiement
              </h4>
              <div style={{
                padding: '10px',
                backgroundColor: '#f5f5f5',
                borderRadius: '4px',
                border: '1px solid #ddd',
                color: '#333',
              }}>
                Paiement à la livraison
              </div>
            </div>

            <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #ddd' }}>
              <h4 style={{ marginTop: 0, marginBottom: '12px', fontSize: '14px' }}>
                Livraison
              </h4>
              <div style={{
                padding: '10px',
                backgroundColor: '#f5f5f5',
                borderRadius: '4px',
                border: '1px solid #ddd',
                color: '#333',
              }}>
                Livraison offerte
              </div>
            </div>

            {/* Avertissement adresse */}
            {customerAddressId === 0 && (
              <div style={{
                padding: '10px 12px',
                marginBottom: '12px',
                borderRadius: '4px',
                backgroundColor: '#fff3cd',
                color: '#856404',
                border: '1px solid #ffc107',
                fontSize: '12px',
              }}>
                ⚠️ Adresse en cours de chargement pour le client #{customerId}…
              </div>
            )}

            <button
              onClick={handleCheckout}
              disabled={loading || cartItems.length === 0}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: loading || cartItems.length === 0 ? '#bdc3c7' : '#27ae60',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading || cartItems.length === 0 ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              {loading ? 'Traitement...' : 'Valider la commande'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}