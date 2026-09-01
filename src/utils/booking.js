export const BOOKING_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

export const DEFAULT_BOOKING = {
  enabled: false,
  displayName: '',
  slotDurationMinutes: 30,
  bufferMinutes: 0,
  bookingCloseHours: 24,
  advanceBookingDays: 60,
  timezone: 'America/Chicago',
  infoMessage: '',
  depositAmount: 0,
  weeklyHours: {
    sunday: [],
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
  },
  blockedDates: [],
}

const pad2 = (n) => String(n).padStart(2, '0')

export const normalizeBookingConfig = (booking = {}) => ({
  ...DEFAULT_BOOKING,
  ...booking,
  weeklyHours: {
    ...DEFAULT_BOOKING.weeklyHours,
    ...(booking.weeklyHours || {}),
  },
  blockedDates: Array.isArray(booking.blockedDates) ? booking.blockedDates.filter(Boolean) : [],
  slotDurationMinutes: Math.max(15, Math.min(240, Number(booking.slotDurationMinutes || 30))),
  bufferMinutes: Math.max(0, Math.min(120, Number(booking.bufferMinutes || 0))),
  bookingCloseHours: Math.max(0, Math.min(168, Number(booking.bookingCloseHours || 24))),
  advanceBookingDays: Math.max(1, Math.min(365, Number(booking.advanceBookingDays || 60))),
  depositAmount: Math.max(0, Number(booking.depositAmount || 0)),
})

export const isBookingEnabled = (product) => Boolean(product?.booking?.enabled)

export const getBookingDisplayName = (product) => {
  const booking = normalizeBookingConfig(product?.booking)
  return booking.displayName?.trim() || product?.name || 'Service'
}

/** Parse YYYY-MM-DD as local calendar date parts */
export const parseDateKey = (dateKey) => {
  const [y, m, d] = String(dateKey).split('-').map(Number)
  return { year: y, month: m, day: d }
}

export const toDateKey = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`

export const parseTimeToMinutes = (value) => {
  const [h, m] = String(value || '0:0').split(':').map(Number)
  return h * 60 + (m || 0)
}

export const minutesToTimeLabel = (minutes, locale = 'en-US') => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const date = new Date()
  date.setHours(h, m, 0, 0)
  return date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
}

export const formatScheduledLabel = (startAt, timezone = 'America/Chicago') => {
  if (!startAt) return ''
  const date = new Date(startAt)
  return date.toLocaleString('en-US', {
    timeZone: timezone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * Build slot start timestamps (ms) for a calendar day in the shop timezone.
 * Uses the browser/server local offset approximation via constructed Date — for
 * production accuracy the callable uses the same logic with explicit TZ parts.
 */
export const buildSlotsForDate = (dateKey, booking, bookedRanges = [], now = Date.now()) => {
  const config = normalizeBookingConfig(booking)
  if (config.blockedDates.includes(dateKey)) return []

  const { year, month, day } = parseDateKey(dateKey)
  const dayDate = new Date(year, month - 1, day)
  const dayName = BOOKING_DAYS[dayDate.getDay()]
  const windows = config.weeklyHours[dayName] || []
  if (!windows.length) return []

  const closeMs = config.bookingCloseHours * 60 * 60 * 1000
  const maxDate = new Date(now)
  maxDate.setDate(maxDate.getDate() + config.advanceBookingDays)
  if (dayDate > maxDate) return []

  const duration = config.slotDurationMinutes
  const buffer = config.bufferMinutes
  const slots = []

  for (const window of windows) {
    const startMin = parseTimeToMinutes(window.start)
    const endMin = parseTimeToMinutes(window.end)
    for (let cursor = startMin; cursor + duration <= endMin; cursor += duration + buffer) {
      const slotStart = new Date(year, month - 1, day, Math.floor(cursor / 60), cursor % 60, 0, 0)
      const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000)
      if (slotStart.getTime() - now < closeMs) continue

      const overlaps = bookedRanges.some(
        (range) => slotStart.getTime() < range.endAt && slotEnd.getTime() > range.startAt,
      )

      slots.push({
        startAt: slotStart.getTime(),
        endAt: slotEnd.getTime(),
        label: minutesToTimeLabel(cursor),
        available: !overlaps,
      })
    }
  }

  return slots
}

export const monthDateKeys = (year, monthIndex0) => {
  const first = new Date(year, monthIndex0, 1)
  const last = new Date(year, monthIndex0 + 1, 0)
  const keys = []
  for (let d = 1; d <= last.getDate(); d += 1) {
    keys.push(toDateKey(new Date(year, monthIndex0, d)))
  }
  return keys
}

export const summarizeMonthAvailability = (dateKeys, booking, bookedRanges = [], now = Date.now()) => {
  const days = {}
  const slots = {}
  for (const dateKey of dateKeys) {
    const daySlots = buildSlotsForDate(dateKey, booking, bookedRanges, now)
    slots[dateKey] = daySlots
    days[dateKey] = {
      hasSlots: daySlots.length > 0,
      hasAvailable: daySlots.some((slot) => slot.available),
    }
  }
  return { days, slots }
}
