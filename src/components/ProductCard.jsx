import { Link } from 'react-router-dom'
import { getProductDisplayPrice } from '../utils/pricing'

export function ProductCard({ product }) {
  const image = product.images?.[0]
  const pricingMode = product.pricingMode || (product.requiresInquiry ? 'inquiry' : 'standard')
  const displayPrice = getProductDisplayPrice(product)

  const hasVariants = product.variants && product.variants.length > 0
  const ctaLabel = pricingMode === 'inquiry' ? 'Request a Quote' : hasVariants ? 'Choose options' : 'View'

  return (
    <article className="product-card">
      <Link to={`/shop/${product.id}`} className="product-link">
        {image && <img src={image} alt={product.name} className="product-image" loading="lazy" />}
        <div className="product-copy">
          <h3>{product.name}</h3>
          <p>{product.category}</p>
          <strong>{displayPrice}</strong>
        </div>
      </Link>
      <div className="product-card-footer">
        <Link to={`/shop/${product.id}`} className="product-cta-btn">{ctaLabel}</Link>
      </div>
    </article>
  )
}
