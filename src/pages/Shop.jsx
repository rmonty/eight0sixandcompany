import { useEffect, useMemo, useState } from 'react'
import { ProductCard } from '../components/ProductCard'
import { useSettings } from '../contexts/SettingsContext'
import { getStoreProducts } from '../services/productsService'

export function Shop() {
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const { settings } = useSettings()

  useEffect(() => {
    getStoreProducts().then(setProducts)
  }, [])

  const categories = ['All', ...(settings.categories || [])]
  const categoryImages = settings.categoryImages || {}

  const visibleProducts = useMemo(() => {
    return products.filter((product) => {
      const categoryMatch = activeCategory === 'All' || product.category === activeCategory
      const searchValue = search.trim().toLowerCase()
      const searchMatch =
        !searchValue ||
        product.name.toLowerCase().includes(searchValue) ||
        product.description.toLowerCase().includes(searchValue)
      return categoryMatch && searchMatch
    })
  }, [products, activeCategory, search])

  return (
    <section className="page-inner">
      <h1>Shop</h1>
      <div className="shop-toolbar">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search products"
          className="text-input"
        />
        <div className="chip-row">
          {categories.map((category) => (
            <button
              type="button"
              key={category}
              onClick={() => setActiveCategory(category)}
              className={category === activeCategory ? 'chip chip-active' : 'chip'}
            >
              {categoryImages[category] && (
                <img src={categoryImages[category]} alt={`${category} category`} className="chip-img" />
              )}
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className="product-grid">
        {visibleProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  )
}
