/** Shared gift card code helpers for Cloud Functions. */

export const formatGiftCardCode = (value) =>
  String(value || '')
    .trim()
    .replace(/[^A-Za-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

export const normalizeGiftCardCode = (value) =>
  formatGiftCardCode(value)
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()

export const normalizeMoney = (value) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Number(parsed.toFixed(2)))
}

export function getGiftCardAvailabilityError(card) {
  if (!card) return 'Gift card not found.'
  if (card.active === false) return 'This gift card is inactive.'
  const remaining = normalizeMoney(card.remainingBalance)
  if (remaining <= 0) return 'This gift card has no remaining balance.'
  return null
}
