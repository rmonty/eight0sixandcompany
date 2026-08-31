/**
 * Coupon schedule helpers for Cloud Functions (mirrors src/utils/couponValidity.js).
 */

export function parseCouponDate(value) {
  if (value == null || value === '') return null

  if (typeof value === 'object') {
    if (typeof value.toDate === 'function') {
      const d = value.toDate()
      return Number.isNaN(d.getTime()) ? null : d
    }
    if (Number.isFinite(value.seconds)) {
      const d = new Date(value.seconds * 1000)
      return Number.isNaN(d.getTime()) ? null : d
    }
    if (Number.isFinite(value._seconds)) {
      const d = new Date(value._seconds * 1000)
      return Number.isNaN(d.getTime()) ? null : d
    }
  }

  const raw = String(value).trim()
  if (!raw) return null

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (match) {
    const date = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6] || 0),
      0,
    )
    return Number.isNaN(date.getTime()) ? null : date
  }

  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

export function getCouponScheduleError(coupon, now = new Date()) {
  if (!coupon) return 'Invalid or inactive coupon code.'

  const start = parseCouponDate(coupon.startDate)
  if (start && now < start) {
    return 'This coupon is not yet valid.'
  }

  let end = parseCouponDate(coupon.endDate)
  if (end) {
    if (end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0 && end.getMilliseconds() === 0) {
      end = new Date(end)
      end.setHours(23, 59, 59, 999)
    }
    if (now > end) {
      return 'This coupon has expired.'
    }
  }

  return null
}
