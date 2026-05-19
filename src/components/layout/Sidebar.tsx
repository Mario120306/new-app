type SidebarProps = {
  active: string
  onNavigate: (page: string) => void
  onLogout: () => void
}

export default function Sidebar({ active, onNavigate, onLogout }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="prestashop-logo">NewApp</div>
      </div>

      <nav className="sidebar-nav" aria-label="Navigation">
        <a
          href="#"
          className={active === 'Dashboard' ? 'sidebar-link active' : 'sidebar-link'}
          onClick={(evt) => {
            evt.preventDefault()
            onNavigate('Dashboard')
          }}
        >
          Dashboard
        </a>
        <a
          href="#"
          className={active === 'Base' ? 'sidebar-link active' : 'sidebar-link'}
          onClick={(evt) => {
            evt.preventDefault()
            onNavigate('Base')
          }}
        >
          Base
        </a>
        <a
          href="#"
          className={active === 'Imports' ? 'sidebar-link active' : 'sidebar-link'}
          onClick={(evt) => {
            evt.preventDefault()
            onNavigate('Imports')
          }}
        >
          Imports
        </a>
        <a
          href="#"
          className={active === 'Products' ? 'sidebar-link active' : 'sidebar-link'}
          onClick={(evt) => {
            evt.preventDefault()
            onNavigate('Products')
          }}
        >
          Produits
        </a>
        <a
          href="#"
          className={active === 'Orders' ? 'sidebar-link active' : 'sidebar-link'}
          onClick={(evt) => {
            evt.preventDefault()
            onNavigate('Orders')
          }}
        >
          Commandes
        </a>
        <a
          href="#"
          className={active === 'Statistics' ? 'sidebar-link active' : 'sidebar-link'}
          onClick={(evt) => {
            evt.preventDefault()
            onNavigate('Statistics')
          }}
        >
          Statistiques
        </a>
      </nav>
      <button type="button" className="logout-button" onClick={onLogout}>
        Déconnexion
      </button>
    </aside>
  )
}