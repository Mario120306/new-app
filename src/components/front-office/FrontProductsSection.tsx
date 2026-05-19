import type { Category } from '../../entities/Category'
import type { Product } from '../../entities/Product'

const TAX_RATE = 1.2

type FrontProductsSectionProps = {
  loading: boolean
  error: string
  searchName: string
  onSearchNameChange: (value: string) => void
  selectedCategoryId: number | 'all'
  onCategoryChange: (value: number | 'all') => void
  minPrice: string
  maxPrice: string
  onMinPriceChange: (value: string) => void
  onMaxPriceChange: (value: string) => void
  categories: Category[]
  filteredProducts: Product[]
  getProductImageUrl: (product: Product) => string
  getProductBadge: (product: Product) => 'HOT' | 'NEW' | ''
  getBadgeStyle: (variant: 'hot' | 'new' | 'active' | 'inactive') => React.CSSProperties
  getProductLaunchDate: (product: Product) => Date | undefined
  formatProductDate: (value?: Date) => string
  getCategoryNames: (product: Product) => string
  onSelectProduct: (product: Product) => void
  onAddToCart: (product: Product) => void
}

export default function FrontProductsSection({
  loading,
  error,
  searchName,
  onSearchNameChange,
  selectedCategoryId,
  onCategoryChange,
  minPrice,
  maxPrice,
  onMinPriceChange,
  onMaxPriceChange,
  categories,
  filteredProducts,
  getProductImageUrl,
  getProductBadge,
  getBadgeStyle,
  getProductLaunchDate,
  formatProductDate,
  getCategoryNames,
  onSelectProduct,
  onAddToCart,
}: FrontProductsSectionProps) {
  return (
    <section className="front-products-section">
      <h2>Nos produits</h2>

      {loading && <p>Chargement des produits...</p>}
      {!loading && error && <div className="form-error">{error}</div>}

      {!loading && !error && (
        <>
          <div className="front-filters-container">
            <div className="filters-row">
              <div className="filter-group">
                <label htmlFor="search-name">Chercher un nom</label>
                <input
                  id="search-name"
                  type="text"
                  placeholder="Chercher un nom..."
                  value={searchName}
                  onChange={(e) => onSearchNameChange(e.target.value)}
                  className="filter-input"
                />
              </div>

              <div className="filter-group">
                <label htmlFor="search-cat">Categorie</label>
                <select
                  id="search-cat"
                  value={selectedCategoryId}
                  onChange={(e) => onCategoryChange(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  className="filter-input"
                >
                  <option value="all">Toutes les categories</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name || `Categorie ${category.id}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="filters-row">
              <div className="filter-group price-filter">
                <label>Intervalle de prix</label>
                <div className="price-inputs">
                  <input
                    type="number"
                    placeholder="Min."
                    value={minPrice}
                    onChange={(e) => onMinPriceChange(e.target.value)}
                    className="filter-input"
                  />
                  <input
                    type="number"
                    placeholder="Max."
                    value={maxPrice}
                    onChange={(e) => onMaxPriceChange(e.target.value)}
                    className="filter-input"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="front-products-grid">
            {filteredProducts.map((product) => {
              const ttcPrice = (product.price ?? 0) * TAX_RATE
              const productImageUrl = getProductImageUrl(product)
              const stockQuantity = product.quantity ?? 0
              const badge = getProductBadge(product)
              const launchDate = getProductLaunchDate(product)

              return (
                <article key={`${product.id ?? 'product'}-${product.name ?? 'item'}`} className="front-product-card">
                  <button
                    type="button"
                    className="front-product-media"
                    onClick={() => onSelectProduct(product)}
                    aria-label={`Voir la fiche de ${product.name || 'produit'}`}
                  >
                    {productImageUrl ? (
                      <img
                        src={productImageUrl}
                        alt={product.name || 'Produit'}
                        className="front-product-image"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                          const fallback = e.currentTarget.nextElementSibling as HTMLElement | null
                          if (fallback) fallback.style.display = 'flex'
                        }}
                      />
                    ) : null}
                    <div className="front-product-image-fallback" style={{ display: productImageUrl ? 'none' : 'flex' }}>
                      <span>Aucune image</span>
                    </div>
                    <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', flexWrap: 'wrap', gap: 8, zIndex: 2 }}>
                      {badge && (
                        <span
                          className="front-product-badge"
                          style={{
                            ...getBadgeStyle(badge === 'HOT' ? 'hot' : 'new'),
                            position: 'static',
                            padding: '4px 10px',
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 800,
                            letterSpacing: '0.08em',
                            display: 'inline-flex',
                            alignItems: 'center',
                          }}
                        >
                          {badge}
                        </span>
                      )}
                      <span
                        className="front-product-badge"
                        style={{
                          ...getBadgeStyle(product.active ? 'active' : 'inactive'),
                          position: 'static',
                          padding: '4px 10px',
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                        }}
                      >
                        {product.active ? 'Disponible' : 'Indisponible'}
                      </span>
                    </div>
                  </button>

                  <div className="front-product-body">
                    <div className="front-product-meta">
                      <span className="front-product-reference">{product.reference || 'Sans reference'}</span>
                      <span className="front-product-category">{getCategoryNames(product)}</span>
                    </div>

                    {launchDate && (
                      <p className="front-product-excerpt" style={{ marginTop: 0, marginBottom: 8, color: 'rgba(255,255,255,0.62)' }}>
                        Sorti le {formatProductDate(launchDate)}
                      </p>
                    )}

                    <h3 className="front-product-title">{product.name || 'Produit sans nom'}</h3>

                    <p className="front-product-excerpt">
                      {product.description_short
                        ? product.description_short.replace(/<[^>]+>/g, '').slice(0, 120)
                        : 'Decouvrez ce produit dans votre boutique.'}
                    </p>

                    <div className="front-product-pricing">
                      <div>
                        <span className="front-price-label">Prix HT</span>
                        <strong>{(product.price ?? 0).toFixed(2)}£</strong>
                      </div>
                      <div>
                        <span className="front-price-label">Prix TTC</span>
                        <strong>{ttcPrice.toFixed(2)}£</strong>
                      </div>
                    </div>

                    <div className="front-product-stock">
                      <span>Stock</span>
                      <strong>{stockQuantity}</strong>
                    </div>

                    <div className="front-product-actions">
                      <button
                        type="button"
                        className="action-btn view-btn"
                        onClick={() => onSelectProduct(product)}
                        title="Voir les details"
                      >
                        Voir la fiche
                      </button>
                      <button
                        type="button"
                        className="action-btn add-cart-btn"
                        onClick={() => onAddToCart(product)}
                        title="Ajouter au panier"
                      >
                        Ajouter au panier
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>

          {filteredProducts.length === 0 && (
            <p className="no-results">Aucun produit ne correspond a vos criteres de recherche.</p>
          )}
        </>
      )}
    </section>
  )
}
