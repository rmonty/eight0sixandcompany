import { toCurrency } from './currency'

export function getOptionAddPrice(option) {
  const mode = option?.pricingMode ?? 'add'
  if (mode === 'none') return 0
  const price = Number(option?.price)
  return Number.isFinite(price) && option.price !== null && option.price !== '' ? price : 0
}

export function getLowestVariantPrice(product) {
  const base = Number(product?.price || 0)
  const variants = product?.variants || []
  if (!variants.length) return base

  let minAddOns = 0
  for (const variant of variants) {
    const optionPrices = (variant.options || []).map(getOptionAddPrice).filter((price) => Number.isFinite(price))
    if (!optionPrices.length) continue
    minAddOns += Math.min(...optionPrices)
  }

  return Number((base + minAddOns).toFixed(2))
}

export function productHasPricedVariants(product) {
  return (product?.variants || []).some((variant) =>
    (variant.options || []).some((option) => getOptionAddPrice(option) > 0),
  )
}

export function getProductDisplayPrice(product) {
  const pricingMode = product?.pricingMode || (product?.requiresInquiry ? 'inquiry' : 'standard')

  if (pricingMode === 'inquiry') {
    return 'Requires Inquiry'
  }

  if (
    pricingMode === 'range' &&
    Number(product?.minPrice) > 0 &&
    Number(product?.maxPrice) > 0
  ) {
    return `${toCurrency(Number(product.minPrice))} - ${toCurrency(Number(product.maxPrice))}`
  }

  const lowest = getLowestVariantPrice(product)
  const hasVariants = (product?.variants || []).length > 0

  if (pricingMode === 'standard' && hasVariants && (productHasPricedVariants(product) || lowest > Number(product?.price || 0))) {
    return `From ${toCurrency(lowest)}`
  }

  if (pricingMode === 'standard' && hasVariants && lowest <= 0 && Number(product?.price || 0) <= 0) {
    return `From ${toCurrency(lowest)}`
  }

  return toCurrency(lowest)
}
