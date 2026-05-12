import { useState, type FormEvent } from 'react'
import LoginApi from '../../api/LoginApi'

type LoginProps = {
  onLoginSuccess?: (session: { email: string }) => void
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      await LoginApi.login(email.trim(), password)
      onLoginSuccess?.({ email: email.trim() })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion impossible')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-login">
      <div className="login-shell">
        <section className="login-panel login-panel-brand">
          <div className="login-badge">NewAPP x PrestaShop</div>
          <h1>Accès sécurisé à votre espace de travail</h1>
          <p>
            Connectez-vous avec vos identifiants pour entrer dans NewApp et accéder aux modules internes.
          </p>

          <div className="login-features">
            <div>
              <strong>Accès rapide</strong>
              <span>Interface claire, sans détour.</span>
            </div>
            <div>
              <strong>Connexion contrôlée</strong>
              <span>Vérification sécurisée des employés.</span>
            </div>
          </div>
        </section>

        <section className="login-panel login-panel-form">
          <form className="login-form" onSubmit={handleSubmit}>
            <h2>Connexion</h2>
            <p className="login-subtitle">Entrez votre email et votre mot de passe.</p>

            <label className="login-field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                placeholder="vous@exemple.com"
              />
            </label>

            <label className="login-field">
              <span>Mot de passe</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="current-password"
                placeholder="Votre mot de passe"
              />
            </label>

            {error && <div className="form-error">{error}</div>}

            <button className="login-submit" type="submit" disabled={loading}>
              {loading ? 'Connexion...' : 'Entrer dans NewApp'}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
