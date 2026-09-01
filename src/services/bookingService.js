import { httpsCallable } from 'firebase/functions'
import {
  DEFAULT_BOOKING,
  monthDateKeys,
  normalizeBookingConfig,
  summarizeMonthAvailability,
} from '../utils/booking'
import { functions, hasFirebaseConfig } from './firebase'

const MOCK_APPOINTMENTS_KEY = 'eight0six-appointments'

const readMockAppointments = () => {
  try {
    const raw = localStorage.getItem(MOCK_APPOINTMENTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const writeMockAppointments = (rows) => {
  localStorage.setItem(MOCK_APPOINTMENTS_KEY, JSON.stringify(rows))
}

export const getBookingAvailability = async (product, year, monthIndex0) => {
  const booking = normalizeBookingConfig(product?.booking)
  if (!booking.enabled) {
    return { booking, days: {}, slots: {} }
  }

  if (!hasFirebaseConfig || !functions) {
    const dateKeys = monthDateKeys(year, monthIndex0)
    const monthStart = new Date(year, monthIndex0, 1).getTime()
    const monthEnd = new Date(year, monthIndex0 + 1, 0, 23, 59, 59, 999).getTime()
    const bookedRanges = readMockAppointments()
      .filter((row) => row.productId === product.id && row.startAt >= monthStart && row.startAt <= monthEnd)
      .map((row) => ({ startAt: row.startAt, endAt: row.endAt }))
    const { days, slots } = summarizeMonthAvailability(dateKeys, booking, bookedRanges)
    return { booking, days, slots }
  }

  const callable = httpsCallable(functions, 'getBookingAvailability')
  const result = await callable({ productId: product.id, year, month: monthIndex0 + 1 })
  return result.data
}

export const reserveMockAppointment = ({ productId, startAt, endAt, orderId }) => {
  const rows = readMockAppointments()
  if (rows.some((row) => row.productId === productId && row.startAt === startAt)) {
    throw new Error('That time slot was just booked. Please choose another.')
  }
  rows.push({ productId, startAt, endAt, orderId, status: 'booked' })
  writeMockAppointments(rows)
}

export const getDefaultProductBooking = () => ({ ...DEFAULT_BOOKING, weeklyHours: { ...DEFAULT_BOOKING.weeklyHours } })
