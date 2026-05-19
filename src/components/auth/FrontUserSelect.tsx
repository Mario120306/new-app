import { useState, useEffect } from 'react'
import { API } from '../../api/API'
import { Customer } from '../../entities/Customer'
import { CustomerService } from '../../service/CustomerService'

export interface FrontSelectedUser {
  email: string
  id: number
}

type Props = {
  onLoginSuccess?: (session: FrontSelectedUser) => void
  onBack?: () => void
  title?: string
}

export default function FrontUserSelect({ onLoginSuccess, onBack, title = 'Choisir un utilisateur' }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchCustomers() {
      setLoading(true)
      try {
        const api = new API()
        const customerService = new CustomerService()
        const mere = new Customer()

        const results = await api.fetch<Customer>({
          method: 'GET',
          mere,
          service: customerService,
          params: new URLSearchParams({ display: 'full', limit: '100' }),
        })

        setCustomers(results)
      } catch (err) {
        console.error('[FrontUserSelect] Error fetching customers:', err)
        setError('Impossible de charger la liste des clients')
      } finally {
        setLoading(false)
      }
    }

    fetchCustomers()
  }, [])

  const handleSelect = (customer: Customer) => {
    onLoginSuccess?.({
      email: customer.email || 'Client sans email',
      id: customer.id || 0,
    })
  }

  const handleAnonymous = () => {
    onLoginSuccess?.({
      email: 'Anonyme',
      id: 0,
    })
  }

  return (
    <div className="page-login">
      <div className="login-shell" style={{ maxWidth: '900px' }}>
        <section className="login-panel login-panel-brand">
          <div className="login-badge">NewAPP x PrestaShop</div>
          <h1>{title}</h1>
          <p>Sélectionnez un profil pour accéder au Front-office.</p>
          
          <div style={{ marginTop: '30px' }}>
             <button 
              type="button" 
              className="login-submit" 
              onClick={handleAnonymous}
              style={{ backgroundColor: '#666' }}
            >
              Accès Anonyme
            </button>
            {onBack && (
              <button 
                type="button" 
                className="login-back" 
                onClick={onBack}
                style={{ marginLeft: '10px' }}
              >
                Retour
              </button>
            )}
          </div>
        </section>

        <section className="login-panel login-panel-form" style={{ padding: '20px' }}>
          {loading && <p>Chargement des clients...</p>}
          {error && <div className="form-error">{error}</div>}
          
          {!loading && !error && (
            <div className="front-user-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '15px',
              maxHeight: '500px',
              overflowY: 'auto',
              padding: '10px'
            }}>
              {customers.map((c, idx) => (
                <div 
                  key={`customer-${c.id}-${c.email}-${idx}`} 
                  className="front-stat-card" 
                  style={{ 
                    cursor: 'pointer', 
                    padding: '15px',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    textAlign: 'left'
                  }}
                  onClick={() => handleSelect(c)}
                >
                  <strong style={{ display: 'block', fontSize: '14px' }}>{c.firstname} {c.lastname}</strong>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>{c.email}</span>
                  <button 
                    type="button" 
                    className="action-btn view-btn" 
                    style={{ marginTop: '10px', width: '100%', fontSize: '11px' }}
                  >
                    Se connecter
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
