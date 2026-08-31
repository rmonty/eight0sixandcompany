/**
 * Coupon schedule helpers — parse admin datetime-local values and validate windows.
 */

export function parseCouponDate(value) {
  if (value == null || value === '') return null

  // Firestore Timestamp
  if (typeof value === 'object') {
    if (typeof value.toDate === 'function') {
      const d = value.toDate()
      return Number.isNaN(d.getTime()) ? null : d
    }
    if (Number.isFinite(value.seconds)) {
      const d = new Date(value.seconds * 1000)
      return Number.isNaN(d.getTime()) ? null : d
    }
  }

  const raw = String(value).trim()
  if (!raw) return null

  // datetime-local: "YYYY-MM-DDTHH:MM" or with seconds — parse as local time
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

  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateOnly) {
    const date = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 0, 0, 0, 0)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Store start time as ISO (local datetime-local → UTC). */
export function normalizeCouponStartDate(value) {
  const d = parseCouponDate(value)
  return d ? d.toISOString() : null
}

/**
 * Store end time as ISO. If the chosen time is midnight (00:00), treat it as
 * end-of-day so "expires on Aug 21" covers all of Aug 21 locally.
 */
export function normalizeCouponEndDate(value) {
  const d = parseCouponDate(value)
  if (!d) return null
  if (d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0) {
    d.setHours(23, 59, 59, 999)
  }
  return d.toISOString()
}

/**
 * @returns {string|null} Error message if coupon is outside its schedule, else null
 */
export function getCouponScheduleError(coupon, now = new Date()) {
  if (!coupon) return 'Invalid or inactive coupon code.'

  const start = parseCouponDate(coupon.startDate)
  if (start && now < start) {
    return `This coupon is not valid until ${start.toLocaleString()}.`
  }

  let end = parseCouponDate(coupon.endDate)
  if (end) {
    // Midnight end times are treated as end-of-day (covers the whole calendar day).
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

export function isCouponWithinSchedule(coupon, now = new Date()) {
  return getCouponScheduleError(coupon, now) == null
}
