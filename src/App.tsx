import { useEffect, useState } from 'react'
import Login from './components/auth/Login'
import MainLayout from './components/layout/MainLayout'
import './style/App.css'
import './style/index.css'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return window.localStorage.getItem('new-app-session') === 'true'
  })

  useEffect(() => {
    window.localStorage.setItem('new-app-session', String(isAuthenticated))
  }, [isAuthenticated])

  function handleLogout() {
    window.localStorage.removeItem('new-app-session')
    setIsAuthenticated(false)
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => setIsAuthenticated(true)} />
  }

  return <MainLayout onLogout={handleLogout} />
}

export default App
