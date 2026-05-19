import { useState, type FormEvent } from 'react'
import { API } from '../../api/API'
import { Customer } from '../../entities/Customer'
import { CustomerService } from '../../service/CustomerService'
import { ApiError } from '../../utils/ApiError'
import { simpleMD5 } from '../../utils/crypto'
import { compareSync } from 'bcryptjs'

type Props = {
  onLoginSuccess?: (session: { email: string; id: number }) => void
  onBack?: () => void
}

export default function FrontLogin({ onLoginSuccess, onBack }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const api = new API()
      const customerService = new CustomerService()
      const mere = new Customer()

      const params = new URLSearchParams()
      params.append('display', 'full')
      params.append('filter[email]', `[${email.trim()}]`)

      const customers = await api.fetch<Customer>({
        method: 'GET',
        mere,
        service: customerService,
        params,
      })

      if (customers.length === 0) {
        throw new Error('Customer non trouvé')
      }

      const customer = customers[0]
      const storedHash = (customer.password || customer.note || '').trim()
      if (!storedHash) {
        throw new Error('Le mot de passe client n\'est pas accessible via l\'API')
      }

      const isBcrypt = storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')
      const isValid = isBcrypt ? compareSync(password, storedHash) : storedHash === simpleMD5(password)
      if (!isValid) {
        throw new Error('Email ou mot de passe incorrect')
      }

      onLoginSuccess?.({ email: email.trim(), id: customer.id || 0 })
    } catch (err) {
      if (err instanceof ApiError) {
        setError('Customer non trouvé')
      } else {
        setError(err instanceof Error ? err.message : 'Erreur')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-login">
      <div className="login-shell">
        <section className="login-panel login-panel-brand">
          <div className="login-badge">NewAPP x PrestaShop</div>
          <h1>Client - Connexion</h1>
          <p>Connectez-vous avec votre email client.</p>
        </section>

        <section className="login-panel login-panel-form">
          <form className="login-form" onSubmit={handleSubmit}>
            <label className="login-field">
              <span>Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>

            <label className="login-field">
              <span>Mot de passe</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>

            {error && <div className="form-error">{error}</div>}

            <div className="login-actions">
              <button type="submit" className="login-submit" disabled={loading}>{loading ? 'Connexion...' : 'Se connecter'}</button>
              <button type="button" className="login-back" onClick={onBack}>Retour</button>
            </div>
          </form>
        </section>
      </div>
    </div>
  )
}
