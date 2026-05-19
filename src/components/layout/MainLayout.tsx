import { useState } from 'react'
import Sidebar from './Sidebar'
import RestBase from '../back-office/ResetBase'
import ImportPage from '../back-office/ImportPage'
import OrdersPage from '../back-office/OrdersPage'
import ProductsPage from '../back-office/ProductsPage'
import DashboardPage from '../back-office/DashboardPage'
import StatisticsPage from '../back-office/StatisticsPage'

type MainLayoutProps = {
  onLogout: () => void
}

export default function MainLayout({ onLogout }: MainLayoutProps) {
  const [active, setActive] = useState('Dashboard')

  return (
    <div className="app-layout">
      <Sidebar active={active} onNavigate={setActive} onLogout={onLogout} />

      <main className="content">
        {active === 'Dashboard' && <DashboardPage />}
        {active === 'Base' && <RestBase />}
        {active === 'Imports' && <ImportPage />}
        {active === 'Products' && <ProductsPage />}
        {active === 'Orders' && <OrdersPage />}
        {active === 'Statistics' && <StatisticsPage />}
      </main>
    </div>
  )
}
