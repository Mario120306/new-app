import type { Product } from '../../entities/Product'

const TAX_RATE = 1.2

type FrontProductDetailSectionProps = {
  selectedProduct: Product
  onBack: () => void
  getCategoryNames: (product: Product) => string
  getProductImageUrl: (product: Product) => string
}

export default function FrontProductDetailSection({ selectedProduct, onBack, getCategoryNames, getProductImageUrl }: FrontProductDetailSectionProps) {
  const productImageUrl = getProductImageUrl(selectedProduct)

  return (
    <section className="front-product-detail">
      <button
        type="button"
        className="login-back"
        onClick={onBack}
      >
        Retour a la liste
      </button>

      <h2>Detail du produit</h2>

      <div className="front-detail-card">
        <div
          style={{
            marginBottom: '18px',
            borderRadius: '18px',
            overflow: 'hidden',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {productImageUrl ? (
            <img
              src={productImageUrl}
              alt={selectedProduct.name || 'Produit'}
              style={{
                display: 'block',
                width: '100%',
                maxHeight: '360px',
                objectFit: 'contain',
                background: '#fff',
              }}
              onError={(event) => {
                event.currentTarget.style.display = 'none'
              }}
            />
          ) : (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>
              Aucune image disponible
            </div>
          )}
        </div>

        <div className="detail-grid">
          <div className="detail-item">
            <strong>ID:</strong> #{selectedProduct.id ?? '-'}
          </div>
          <div className="detail-item">
            <strong>Nom:</strong> {selectedProduct.name || 'Produit sans nom'}
          </div>
          <div className="detail-item">
            <strong>Reference:</strong> {selectedProduct.reference || '-'}
          </div>
          <div className="detail-item">
            <strong>Categories:</strong> {getCategoryNames(selectedProduct)}
          </div>
          <div className="detail-item">
            <strong>Prix HT:</strong> {(selectedProduct.price ?? 0).toFixed(2)} EUR
          </div>
          <div className="detail-item">
            <strong>Prix TTC:</strong> {((selectedProduct.price ?? 0) * TAX_RATE).toFixed(2)} EUR
          </div>
          <div className="detail-item">
            <strong>Quantite en stock:</strong> {selectedProduct.quantity ?? 0}
          </div>
          <div className="detail-item">
            <strong>Etat:</strong>{' '}
            <span className={`status-badge ${selectedProduct.active ? 'active' : 'inactive'}`}>
              {selectedProduct.active ? 'Actif' : 'Inactif'}
            </span>
          </div>
        </div>

        <div className="detail-section">
          <h3>Description courte</h3>
          <p>{selectedProduct.description_short || 'Aucune description courte'}</p>
        </div>

        <div className="detail-section">
          <h3>Description detaillee</h3>
          <p>{selectedProduct.description || 'Aucune description detaillee'}</p>
        </div>
      </div>
    </section>
  )
}
