type FrontView = 'products' | 'cart' | 'orders' | 'switch-user'

type FrontSidebarProps = {
  activeView: FrontView
  cartItemCount: number
  customerEmail?: string
  onViewChange: (view: FrontView) => void
  onLogout: () => void
}

export default function FrontSidebar({ activeView, cartItemCount, customerEmail, onViewChange, onLogout }: FrontSidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="prestashop-logo">FrontOffice</div>
      </div>

      <nav className="sidebar-nav" aria-label="Navigation front-office">
        <button
          onClick={() => { onViewChange('switch-user') }}
          className={`sidebar-link ${activeView === 'switch-user' ? 'active' : ''}`}
          style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}
          type="button"
        >
          Accueil
        </button>
        <button
          onClick={() => { onViewChange('products') }}
          className={`sidebar-link ${activeView === 'products' ? 'active' : ''}`}
          type="button"
        >
          Produits
        </button>
        <button
          onClick={() => { onViewChange('cart') }}
          className={`sidebar-link ${activeView === 'cart' ? 'active' : ''}`}
          type="button"
        >
          Panier {cartItemCount > 0 && `(${cartItemCount})`}
        </button>
        <button
          onClick={() => { onViewChange('orders') }}
          className={`sidebar-link ${activeView === 'orders' ? 'active' : ''}`}
          type="button"
        >
          Mes commandes
        </button>
      </nav>

      {customerEmail && (
        <div className="sidebar-customer-info">
          <p className="customer-email">{customerEmail}</p>
        </div>
      )}

      <button type="button" className="logout-button" onClick={onLogout}>
        Deconnexion
      </button>
    </aside>
  )
}
