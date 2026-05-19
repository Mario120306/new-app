import { useEffect, useState } from 'react'
import Login from './components/auth/Login'
import FrontLogin from './components/auth/FrontLogin'
import { type FrontSelectedUser } from './components/auth/FrontUserSelect'
import AuthSelect from './components/auth/AuthSelect'
import MainLayout from './components/layout/MainLayout'
import FrontOfficeLayout from './components/front-office/FrontOfficeLayout'
import './style/App.css'
import './style/index.css'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return window.localStorage.getItem('new-app-session') === 'true'
  })
  const [authMode, setAuthMode] = useState<'back' | 'front'>(() => {
    const value = window.localStorage.getItem('new-app-session-mode')
    return value === 'front' ? 'front' : 'back'
  })
  const [authView, setAuthView] = useState<'select' | 'back' | 'front'>('select')
  const [customerEmail, setCustomerEmail] = useState(() => {
    return window.localStorage.getItem('new-app-customer-email') || ''
  })
  const [customerId, setCustomerId] = useState<number>(() => {
    const id = window.localStorage.getItem('new-app-customer-id')
    return id ? parseInt(id, 10) : 0
  })

  useEffect(() => {
    window.localStorage.setItem('new-app-session', String(isAuthenticated))
    if (isAuthenticated) {
      window.localStorage.setItem('new-app-session-mode', authMode)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (isAuthenticated) {
      window.localStorage.setItem('new-app-session-mode', authMode)
    }
  }, [authMode, isAuthenticated])

  function handleCustomerChange(session: FrontSelectedUser) {
    setCustomerEmail(session.email)
    setCustomerId(session.id)
    window.localStorage.setItem('new-app-customer-email', session.email)
    window.localStorage.setItem('new-app-customer-id', String(session.id))
    setAuthMode('front')
    setIsAuthenticated(true)
  }

  function handleLogout() {
    window.localStorage.removeItem('new-app-session')
    window.localStorage.removeItem('new-app-session-mode')
    window.localStorage.removeItem('new-app-customer-email')
    window.localStorage.removeItem('new-app-customer-id')
    setIsAuthenticated(false)
    setAuthView('select')
    setAuthMode('back')
    setCustomerEmail('')
    setCustomerId(0)
  }

  if (!isAuthenticated) {
    if (authView === 'select') {
      return <AuthSelect onChoose={(m) => setAuthView(m === 'back' ? 'back' : 'front')} />
    }
    if (authView === 'back') {
      return (
        <Login
          onLoginSuccess={() => {
            setAuthMode('back')
            setIsAuthenticated(true)
          }}
          onBack={() => setAuthView('select')}
        />
      )
    }
    return (
      <FrontLogin
        onLoginSuccess={handleCustomerChange}
        onBack={() => setAuthView('select')}
      />
    )
  }

  if (authMode === 'front') {
    // âœ… Si customerId n'est pas encore prÃªt dans le state React,
    // on le lit depuis localStorage (toujours synchrone et fiable)
    const resolvedCustomerId = customerId > 0
      ? customerId
      : parseInt(window.localStorage.getItem('new-app-customer-id') || '0', 10)

    const resolvedEmail = customerEmail || window.localStorage.getItem('new-app-customer-email') || ''

    return (
      <FrontOfficeLayout
        onLogout={handleLogout}
        customerEmail={resolvedEmail}
        customerId={resolvedCustomerId}
        onCustomerChange={handleCustomerChange}
      />
    )
  }

  return <MainLayout onLogout={handleLogout} />
}

export default App
