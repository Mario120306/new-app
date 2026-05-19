import type { Product } from '../../entities/Product'

const TAX_RATE = 1.2

type FrontProductDetailSectionProps = {
  selectedProduct: Product
  onBack: () => void
  getCategoryNames: (product: Product) => string
}

export default function FrontProductDetailSection({ selectedProduct, onBack, getCategoryNames }: FrontProductDetailSectionProps) {
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
