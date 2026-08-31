export const ORDER_NOTE_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const ORDER_NOTE_IMAGE_MAX_COUNT = 4
export const ORDER_NOTE_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'
export const ORDER_NOTE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export function formatOrderNoteImageMaxSize() {
  return `${ORDER_NOTE_IMAGE_MAX_BYTES / (1024 * 1024)} MB`
}

export function validateOrderNoteImage(file) {
  if (!file) return 'No file selected.'
  if (!ORDER_NOTE_IMAGE_TYPES.includes(file.type)) {
    return 'Only JPG, PNG, WebP, or GIF images can be attached.'
  }
  if (file.size > ORDER_NOTE_IMAGE_MAX_BYTES) {
    return `Each image must be ${formatOrderNoteImageMaxSize()} or smaller.`
  }
  return null
}

export function getStoragePathFromDownloadUrl(url) {
  try {
    const parsed = new URL(url)
    if (!parsed.hostname.includes('firebasestorage.googleapis.com')) return null
    const match = parsed.pathname.match(/\/o\/(.+)$/)
    if (!match?.[1]) return null
    return decodeURIComponent(match[1])
  } catch {
    return null
  }
}

export function collectOrderNoteImageUrls(order) {
  const urls = []
  if (order?.noteImage) urls.push(order.noteImage)
  if (Array.isArray(order?.noteImages)) urls.push(...order.noteImages)
  return [...new Set(urls.filter(Boolean))]
}
