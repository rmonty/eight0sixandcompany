/**
 * Storefront visibility for products.
 * Existing products without these fields stay visible (backward compatible).
 */
export function parseProductLiveAt(liveAt) {
  if (liveAt == null || liveAt === '') return null
  const ms = new Date(liveAt).getTime()
  return Number.isFinite(ms) ? ms : null
}

export function isProductStoreVisible(product, now = Date.now()) {
  if (!product) return false
  if (product.visible === false) return false

  const liveAtMs = parseProductLiveAt(product.liveAt)
  if (liveAtMs != null && liveAtMs > now) return false

  return true
}

/**
 * @returns {'Visible' | 'Draft' | 'Scheduled'}
 */
export function getProductVisibilityLabel(product, now = Date.now()) {
  if (!product || product.visible === false) return 'Draft'

  const liveAtMs = parseProductLiveAt(product.liveAt)
  if (liveAtMs != null && liveAtMs > now) return 'Scheduled'

  return 'Visible'
}

/** Convert stored ISO/datetime to a value suitable for <input type="datetime-local"> */
export function toDatetimeLocalValue(liveAt) {
  const ms = parseProductLiveAt(liveAt)
  if (ms == null) return ''
  const d = new Date(ms)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Convert datetime-local input value to ISO string (or null if empty) */
export function fromDatetimeLocalValue(value) {
  if (!value || !String(value).trim()) return null
  const ms = new Date(value).getTime()
  if (!Number.isFinite(ms)) return null
  return new Date(ms).toISOString()
}

export function formatProductLiveAt(liveAt) {
  const ms = parseProductLiveAt(liveAt)
  if (ms == null) return ''
  return new Date(ms).toLocaleString()
}
