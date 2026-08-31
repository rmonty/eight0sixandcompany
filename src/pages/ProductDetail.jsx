import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useCart } from '../contexts/CartContext'
import { useSettings } from '../contexts/SettingsContext'
import { getStoreProductById } from '../services/productsService'
import { toCurrency } from '../utils/currency'
import DOMPurify from 'dompurify'

export function ProductDetail() {
  const { productId } = useParams()
  const [product, setProduct] = useState(null)
  const [embroiderySelected, setEmbroiderySelected] = useState(false)
  const [selectedImage, setSelectedImage] = useState(0)
  const [selectedVariants, setSelectedVariants] = useState({})
  const [hoveredSwatch, setHoveredSwatch] = useState(null)
  const { addItem } = useCart()
  const { settings } = useSettings()

  const pricingMode = product?.pricingMode || (product?.requiresInquiry ? 'inquiry' : 'standard')
  const hasRange = pricingMode === 'range' && Number(product?.minPrice) > 0 && Number(product?.maxPrice) > 0
  const displayPrice =
    pricingMode === 'inquiry'
      ? 'Requires Inquiry'
      : hasRange
        ? `${toCurrency(Number(product.minPrice))} - ${toCurrency(Number(product.maxPrice))}`
        : toCurrency(Number(product?.price || 0))

  const inquirySubject = encodeURIComponent(`Inquiry: ${product?.name || 'Product'}`)
  const inquiryBody = encodeURIComponent(`Hi 806 & CO.! I am interested in ${product?.name || 'this product'} and would like a quote.`)
  const inquiryLink = settings.contactEmail
    ? `mailto:${settings.contactEmail}?subject=${inquirySubject}&body=${inquiryBody}`
    : settings.instagramUrl || '#'
  const embroideryPrice = Number(product?.embroideryAddOnPrice || 8)
  const basePrice = Number(product?.price || 0)
  
  const getVariantKey = (variant, index) => {
    const base = (variant?.id || variant?.label || `variant-${index}`).toString().trim()
    return `${base}__${index}`
  }
  const getOptionValue = (option) => (option?.value || option?.label || '').toString().trim()

  // Collect all selected options (handles both single and multi-select)
  const selectedVariantOptions = (product?.variants || []).map((variant, variantIndex) => {
    const variantKey = getVariantKey(variant, variantIndex)
    const selectedValue = selectedVariants[variantKey]
    
    if (variant.multiSelect) {
      // Multi-select: selectedValue is an array
      const selectedArray = Array.isArray(selectedValue) ? selectedValue : []
      return selectedArray.map(val => variant.options?.find(opt => getOptionValue(opt) === val)).filter(Boolean)
    } else {
      // Single-select: selectedValue is a string
      const found = variant.options?.find((option) => getOptionValue(option) === selectedValue)
      return found ? [found] : []
    }
  }).flat()

  // Sum all prices from selected options, respecting pricing mode (default: 'add' for backward compat)
  const selectedVariantPriceTotal = selectedVariantOptions.reduce((sum, option) => {
    const pricingMode = option?.pricingMode || 'add'
    if (pricingMode === 'none' || !Number.isFinite(Number(option?.price)) || option.price === null || option.price === '') {
      return sum
    }
    return sum + Number(option.price)
  }, 0)
  
  const configuredBasePrice = selectedVariantPriceTotal > 0 ? basePrice + selectedVariantPriceTotal : basePrice
  const unitPrice = configuredBasePrice + (embroiderySelected && product?.enableEmbroideryAddOn ? embroideryPrice : 0)

  useEffect(() => {
    getStoreProductById(productId).then((p) => {
      setProduct(p)
      // Initialize selectedVariants: arrays for multi-select, strings for single-select
      if (p?.variants && Array.isArray(p.variants)) {
        const initial = {}
        p.variants.forEach((variant, variantIndex) => {
          if (variant.options && variant.options.length > 0) {
            const variantKey = getVariantKey(variant, variantIndex)
            if (variantKey) {
              if (variant.multiSelect) {
                // Multi-select: initialize with first option in array
                initial[variantKey] = [getOptionValue(variant.options[0])]
              } else {
                // Single-select: initialize with first option as string
                initial[variantKey] = getOptionValue(variant.options[0])
              }
            }
          }
        })
        setSelectedVariants(initial)
      }
    })
  }, [productId])

  if (!product) {
    return <p>Product not found.</p>
  }

  // Validate that all required variants have selections
  const variantSelectionValid = !product.variants || product.variants.length === 0 || 
    product.variants.every((v, variantIndex) => {
      const key = getVariantKey(v, variantIndex)
      const selected = selectedVariants[key]
      if (v.multiSelect) {
        return Array.isArray(selected) && selected.length > 0
      } else {
        return !!selected
      }
    })

  const handleAddToCart = () => {
    const addOns = []
    if (product.enableEmbroideryAddOn && embroiderySelected) {
      addOns.push({
        id: 'personalized-embroidery',
        label: 'Add Personalized Embroidery',
        price: embroideryPrice,
      })
    }

    // Build cartKey with variant info
    const variantKey = Object.keys(selectedVariants).length > 0
      ? '-' + Object.values(selectedVariants).map(v => Array.isArray(v) ? v.join('_') : v).join('-')
      : ''
    const cartKey = `${product.id}${variantKey}${embroiderySelected ? '-embroidery' : ''}`

    addItem(
      {
        ...product,
        basePrice: Number(product.price || 0),
        price: unitPrice,
        addOns,
        selectedVariants,
        cartKey,
      },
      1,
    )
  }

  return (
    <section className="detail-wrap">
      <div className="detail-gallery">
        {/* Main Image */}
        <div className="detail-main-image">
          {product.images?.[selectedImage] ? (
            <img src={product.images[selectedImage]} alt={product.name} className="detail-image" />
          ) : (
            <div style={{ width: '100%', backgroundColor: '#f0f0f0', aspectRatio: '1' }} />
          )}
        </div>

        {/* Thumbnail Gallery */}
        {product.images && product.images.length > 1 && (
          <div className="detail-thumbnails">
            {product.images.map((img, idx) => (
              <button
                key={idx}
                type="button"
                className={`detail-thumb${idx === selectedImage ? ' detail-thumb--active' : ''}`}
                onClick={() => setSelectedImage(idx)}
                aria-label={`View image ${idx + 1}`}
              >
                <img src={img} alt={`${product.name} view ${idx + 1}`} />
              </button>
            ))}
          </div>
        )}

        {/* Video if present */}
        {product.video && (
          <video controls className="detail-video" style={{ marginTop: '12px' }}>
            <source src={product.video} />
          </video>
        )}
      </div>

      <div className="detail-info">
        {product.category && <p className="eyebrow" style={{ margin: 0 }}>{product.category}</p>}
        <h1 style={{ margin: '4px 0 0' }}>{product.name}</h1>
        <strong className="detail-price">{pricingMode === 'standard' ? toCurrency(unitPrice) : displayPrice}</strong>

        {/* Variant Options */}
        {product.variants && product.variants.length > 0 && (
          <div className="variant-section">
            {product.variants.map((variant, variantIndex) => {
              const variantKey = getVariantKey(variant, variantIndex)
              const currentSelection = selectedVariants[variantKey]
              const selectionLabel = variant.multiSelect
                ? (Array.isArray(currentSelection) && currentSelection.length > 0 ? currentSelection.join(', ') : '')
                : (currentSelection || '')
              return (
                <div key={`${variantKey || 'variant'}-${variantIndex}`} className="variant-group">
                  <label className="variant-label">
                    {variant.label}
                    {selectionLabel && <span className="variant-label-selected">: {selectionLabel}</span>}
                  </label>
                  
                  {/* Buttons variant - supports both single and multi-select */}
                  {variant.type === 'buttons' && (
                    <div className="variant-buttons">
                      {variant.options.map((option, optionIndex) => {
                        const optionValue = getOptionValue(option)
                        const isSelected = variant.multiSelect
                          ? (Array.isArray(selectedVariants[variantKey]) && selectedVariants[variantKey].includes(optionValue))
                          : (selectedVariants[variantKey] === optionValue)
                        
                        return (
                          <button
                            key={`${optionValue || 'option'}-${optionIndex}`}
                            type="button"
                            className={`variant-btn${isSelected ? ' variant-btn--selected' : ''}`}
                            onClick={() => {
                              if (variant.multiSelect) {
                                setSelectedVariants((prev) => {
                                  const arr = Array.isArray(prev[variantKey]) ? [...prev[variantKey]] : []
                                  if (arr.includes(optionValue)) {
                                    return { ...prev, [variantKey]: arr.filter(v => v !== optionValue) }
                                  } else {
                                    return { ...prev, [variantKey]: [...arr, optionValue] }
                                  }
                                })
                              } else {
                                setSelectedVariants((prev) => ({ ...prev, [variantKey]: optionValue }))
                              }
                            }}
                          >
                            {option.label}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* Swatches variant - supports both single and multi-select */}
                  {variant.type === 'swatches' && (
                    <>
                      <div className="variant-swatches">
                        {variant.options.map((option, optionIndex) => {
                          const optionValue = getOptionValue(option)
                          const isSelected = variant.multiSelect
                            ? (Array.isArray(selectedVariants[variantKey]) && selectedVariants[variantKey].includes(optionValue))
                            : (selectedVariants[variantKey] === optionValue)
                          
                          return (
                            <div key={`${optionValue || 'swatch'}-${optionIndex}`} style={{ position: 'relative' }}>
                              <button
                                type="button"
                                className={`variant-swatch${isSelected ? ' variant-swatch--selected' : ''}`}
                                onClick={() => {
                                  if (variant.multiSelect) {
                                    setSelectedVariants((prev) => {
                                      const arr = Array.isArray(prev[variantKey]) ? [...prev[variantKey]] : []
                                      if (arr.includes(optionValue)) {
                                        return { ...prev, [variantKey]: arr.filter(v => v !== optionValue) }
                                      } else {
                                        return { ...prev, [variantKey]: [...arr, optionValue] }
                                      }
                                    })
                                  } else {
                                    setSelectedVariants((prev) => ({ ...prev, [variantKey]: optionValue }))
                                  }
                                }}
                                onMouseEnter={() => setHoveredSwatch(`${variantKey}-${optionValue}`)}
                                onMouseLeave={() => setHoveredSwatch(null)}
                                title={option.label}
                                aria-label={`${variant.label}: ${option.label}`}
                                style={
                                  option.swatchImage
                                    ? {
                                        background: `url(${option.swatchImage}) center / cover`,
                                        borderColor: isSelected ? '#000' : '#ccc',
                                      }
                                    : {
                                        backgroundColor: option.color || '#999',
                                        borderColor: isSelected ? '#000' : '#ccc',
                                      }
                                }
                              />
                              {/* Zoom overlay on hover */}
                              {hoveredSwatch === `${variantKey}-${optionValue}` && (option.swatchImage || option.color) && (
                                <div className="swatch-zoom-overlay">
                                  {option.swatchImage ? (
                                    <img src={option.swatchImage} alt={`${option.label} close-up`} className="swatch-zoom-image" />
                                  ) : (
                                    <div className="swatch-zoom-color" style={{ backgroundColor: option.color || '#999' }} />
                                  )}
                                  <p className="swatch-zoom-label">{option.label}</p>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}

                  {/* Dropdown variant - renders as select for single, checkboxes for multi-select */}
                  {variant.type === 'dropdown' && !variant.multiSelect && (
                    <select
                      className="variant-select"
                      value={selectedVariants[variantKey] || ''}
                      onChange={(e) => setSelectedVariants((prev) => ({ ...prev, [variantKey]: e.target.value }))}
                    >
                      <option value="">Select an option...</option>
                      {variant.options.map((option, optionIndex) => {
                        const optionValue = getOptionValue(option)
                        return (
                          <option key={`${optionValue || 'option'}-${optionIndex}`} value={optionValue}>
                            {option.label}
                          </option>
                        )
                      })}
                    </select>
                  )}
                  {variant.type === 'dropdown' && variant.multiSelect && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {variant.options.map((option, optionIndex) => {
                        const optionValue = getOptionValue(option)
                        const isSelected = Array.isArray(selectedVariants[variantKey]) && selectedVariants[variantKey].includes(optionValue)
                        return (
                          <label key={`${optionValue || 'option'}-${optionIndex}`} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.95rem' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedVariants((prev) => {
                                    const arr = Array.isArray(prev[variantKey]) ? [...prev[variantKey]] : []
                                    return { ...prev, [variantKey]: [...arr, optionValue] }
                                  })
                                } else {
                                  setSelectedVariants((prev) => {
                                    const arr = Array.isArray(prev[variantKey]) ? [...prev[variantKey]] : []
                                    return { ...prev, [variantKey]: arr.filter(v => v !== optionValue) }
                                  })
                                }
                              }}
                            />
                            {option.label}
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Embroidery Add-on */}
        {product.enableEmbroideryAddOn && (
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
            <input type="checkbox" checked={embroiderySelected} onChange={(e) => setEmbroiderySelected(e.target.checked)} />
            <span>Add Personalized Embroidery (+{toCurrency(embroideryPrice)})</span>
          </label>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          {pricingMode === 'standard' || pricingMode === 'range' ? (
            <button
              type="button"
              className="primary-btn"
              onClick={handleAddToCart}
              disabled={!variantSelectionValid}
            >
              Add to Cart
            </button>
          ) : (
            <a className="primary-btn" href={inquiryLink} target={inquiryLink.startsWith('mailto:') ? undefined : '_blank'} rel={inquiryLink.startsWith('mailto:') ? undefined : 'noreferrer'}>
              Request a Quote
            </a>
          )}
        </div>

        {/* Description — below CTA so the action area stays compact */}
        {product.description && (
          <div className="detail-description" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description) }} />
        )}

        <p className="detail-craft-note">
          Each item is hand-crafted by 806 & CO.. Please allow 3–5 days for your order to be made with love before it ships.
        </p>
      </div>
    </section>
  )
}
