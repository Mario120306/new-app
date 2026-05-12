import { useState } from 'react'
import Sidebar from './Sidebar'
import RestBase from '../back-office/ResetBase'

type MainLayoutProps = {
  onLogout: () => void
}

export default function MainLayout({ onLogout }: MainLayoutProps) {
  const [active, setActive] = useState('Dashboard')

  return (
    <div className="app-layout">
      <Sidebar active={active} onNavigate={setActive} onLogout={onLogout} />

      <main className="content">
        {active === 'Dashboard' && (
          <section className="dashboard-card">
            <div className="dashboard-kicker">Session active</div>
            <h1>Bienvenue dans NewApp</h1>
            <p>
              Vous êtes connecté et avez accès aux modules internes.
            </p>
          </section>
        )}
        {active === 'Base' && <RestBase />}
      </main>
    </div>
  )
}
