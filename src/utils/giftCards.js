import { normalizeCouponCode } from '../services/couponsService'

/** Display code: letters, numbers, and hyphens. */
export const formatGiftCardCode = (value) =>
  String(value || '')
    .trim()
    .replace(/[^A-Za-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

/** Case-insensitive lookup key (hyphens stripped). */
export const normalizeGiftCardCode = (value) => normalizeCouponCode(formatGiftCardCode(value))

export const generateGiftCardCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I/O/0/1 to avoid confusion
  const chunk = () =>
    Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
  return `GC-${chunk()}-${chunk()}-${chunk()}`
}

export const normalizeMoney = (value) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Number(parsed.toFixed(2)))
}

/**
 * @returns {string|null} Error if gift card cannot be used
 */
export function getGiftCardAvailabilityError(card) {
  if (!card) return 'Gift card not found.'
  if (card.active === false) return 'This gift card is inactive.'
  const remaining = normalizeMoney(card.remainingBalance)
  if (remaining <= 0) return 'This gift card has no remaining balance.'
  return null
}

export function computeGiftCardApplyAmount(remainingBalance, orderTotalBeforeGiftCard) {
  const remaining = normalizeMoney(remainingBalance)
  const due = normalizeMoney(orderTotalBeforeGiftCard)
  return Number(Math.min(remaining, due).toFixed(2))
}
