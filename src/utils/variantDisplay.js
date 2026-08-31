const VARIANT_KEY_SUFFIX = /^(.+?)__(\d+)$/

const getOptionValue = (option) => (option?.value ?? option?.label ?? '').toString().trim()

export function parseVariantStorageKey(key) {
  const raw = String(key || '')
  const match = raw.match(VARIANT_KEY_SUFFIX)
  if (match) {
    return { id: match[1], index: Number(match[2]) }
  }
  return { id: raw, index: null }
}

export function titleCaseFromId(id) {
  return String(id || '')
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function findVariantDefinition(storageKey, productVariants) {
  if (!Array.isArray(productVariants) || productVariants.length === 0) return null

  const { id, index } = parseVariantStorageKey(storageKey)
  const byIndex = index != null ? productVariants[index] : null
  if (byIndex && (!byIndex.id || byIndex.id === id)) return byIndex

  return productVariants.find((variant) => variant?.id === id) || byIndex
}

export function getVariantLabel(storageKey, productVariants) {
  const variant = findVariantDefinition(storageKey, productVariants)
  if (variant?.label?.trim()) return variant.label.trim()
  if (variant?.id) return titleCaseFromId(variant.id)

  const { id } = parseVariantStorageKey(storageKey)
  return titleCaseFromId(id)
}

export function formatVariantValue(rawValue, storageKey, productVariants) {
  const values = Array.isArray(rawValue) ? rawValue : [rawValue]
  const variant = findVariantDefinition(storageKey, productVariants)

  return values
    .filter((value) => value != null && value !== '')
    .map((value) => {
      const normalized = String(value).trim()
      if (variant?.options) {
        const option = variant.options.find((entry) => getOptionValue(entry) === normalized)
        if (option?.label?.trim()) return option.label.trim()
      }
      return normalized
    })
    .join(', ')
}

/** @returns {{ label: string, value: string }[]} */
export function formatSelectedVariants(selectedVariants, productVariants) {
  if (!selectedVariants || typeof selectedVariants !== 'object') return []

  return Object.entries(selectedVariants).map(([key, value]) => ({
    label: getVariantLabel(key, productVariants),
    value: formatVariantValue(value, key, productVariants),
  }))
}

export function formatSelectedVariantsText(selectedVariants, productVariants, separator = ' | ') {
  return formatSelectedVariants(selectedVariants, productVariants)
    .filter((row) => row.value)
    .map((row) => `${row.label}: ${row.value}`)
    .join(separator)
}
