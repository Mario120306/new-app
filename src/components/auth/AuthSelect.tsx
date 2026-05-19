type Props = {
  onChoose: (mode: 'back' | 'front') => void
}

export default function AuthSelect({ onChoose }: Props) {
  return (
    <div className="page-login page-select">
      <div className="login-shell">
        <section className="login-panel login-panel-brand">
          <div className="login-badge">NewAPP x PrestaShop</div>
          <h1>Choisir l'accès</h1>
          <p>Choisissez le type d'accès souhaité :</p>
        </section>

        <section className="login-panel login-panel-form">
          <div className="select-options">
            <button className="select-btn" onClick={() => onChoose('back')}>Back-office</button>
            <button className="select-btn" onClick={() => onChoose('front')}>Front-office</button>
          </div>
        </section>
      </div>
    </div>
  )
}
