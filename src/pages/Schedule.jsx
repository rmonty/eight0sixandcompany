import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCart } from '../contexts/CartContext'
import { getBookingAvailability } from '../services/bookingService'
import { getStoreProductById } from '../services/productsService'
import { toCurrency } from '../utils/currency'
import {
  formatScheduledLabel,
  getBookingDisplayName,
  isBookingEnabled,
  normalizeBookingConfig,
  toDateKey,
} from '../utils/booking'

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function Schedule() {
  const { productId } = useParams()
  const navigate = useNavigate()
  const { addItem } = useCart()
  const [product, setProduct] = useState(null)
  const [viewDate, setViewDate] = useState(() => new Date())
  const [selectedDateKey, setSelectedDateKey] = useState('')
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [availability, setAvailability] = useState({ days: {}, slots: {} })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const booking = useMemo(() => normalizeBookingConfig(product?.booking), [product])

  useEffect(() => {
    getStoreProductById(productId).then((item) => setProduct(item))
  }, [productId])

  useEffect(() => {
    if (!product || !isBookingEnabled(product)) return undefined
    let cancelled = false
    setLoading(true)
    setError('')
    getBookingAvailability(product, viewDate.getFullYear(), viewDate.getMonth())
      .then((data) => {
        if (cancelled) return
        setAvailability({ days: data.days || {}, slots: data.slots || {} })
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Unable to load availability.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [product, viewDate])

  const calendarCells = useMemo(() => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < firstDay; i += 1) cells.push(null)
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(toDateKey(new Date(year, month, day)))
    }
    return cells
  }, [viewDate])

  const selectedSlots = selectedDateKey ? availability.slots[selectedDateKey] || [] : []
  const displayName = product ? getBookingDisplayName(product) : ''
  const chargeAmount =
    booking.depositAmount > 0 ? booking.depositAmount : Number(product?.price || 0)

  const handleNext = () => {
    if (!product || !selectedSlot?.available) return
    const cartKey = `${product.id}-booking-${selectedSlot.startAt}`
    addItem(
      {
        ...product,
        name: displayName,
        basePrice: Number(product.price || 0),
        price: chargeAmount,
        bookingDeposit: booking.depositAmount > 0 ? booking.depositAmount : 0,
        balanceDue:
          booking.depositAmount > 0
            ? Math.max(0, Number(product.price || 0) - booking.depositAmount)
            : 0,
        scheduledAt: selectedSlot.startAt,
        scheduledEndAt: selectedSlot.endAt,
        scheduledLabel: formatScheduledLabel(selectedSlot.startAt, booking.timezone),
        bookingTimezone: booking.timezone,
        localOnly: true,
        shippable: false,
        requiresNeedByDate: false,
        cartKey,
        quantity: 1,
      },
      1,
    )
    navigate('/cart')
  }

  if (!product) {
    return (
      <section className="content-page schedule-page">
        <p>Loading service…</p>
      </section>
    )
  }

  if (!isBookingEnabled(product)) {
    return (
      <section className="content-page schedule-page">
        <p>This product does not offer online scheduling.</p>
        <Link to={`/shop/${product.id}`}>Back to product</Link>
      </section>
    )
  }

  const monthLabel = viewDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })

  return (
    <section className="schedule-page">
      <Link to={`/shop/${product.id}`} className="schedule-back">
        ← Back
      </Link>

      <header className="schedule-header">
        <h1>Schedule your service</h1>
        <p>Check our availability and book the date and time that works for you.</p>
      </header>

      <div className="schedule-panel">
        <div className="schedule-panel-head">
          <h2>Select a Date and Time</h2>
          <span className="schedule-timezone">{booking.timezone.replace('_', ' ')}</span>
        </div>

        <div className="schedule-grid">
          <div className="schedule-calendar">
            <div className="schedule-calendar-nav">
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                aria-label="Previous month"
              >
                ‹
              </button>
              <strong>{monthLabel}</strong>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                aria-label="Next month"
              >
                ›
              </button>
            </div>

            <div className="schedule-weekdays">
              {WEEKDAY_LABELS.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>

            <div className="schedule-days">
              {calendarCells.map((dateKey, idx) => {
                if (!dateKey) return <span key={`empty-${idx}`} className="schedule-day schedule-day--empty" />
                const meta = availability.days[dateKey]
                const isSelected = selectedDateKey === dateKey
                const isDisabled = !meta?.hasAvailable
                return (
                  <button
                    key={dateKey}
                    type="button"
                    className={`schedule-day${isSelected ? ' schedule-day--selected' : ''}${isDisabled ? ' schedule-day--disabled' : ''}`}
                    disabled={!meta?.hasSlots}
                    onClick={() => {
                      setSelectedDateKey(dateKey)
                      setSelectedSlot(null)
                    }}
                  >
                    {Number(dateKey.split('-')[2])}
                    {meta?.hasAvailable && <span className="schedule-day-dot" aria-hidden="true" />}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="schedule-times">
            {selectedDateKey ? (
              <>
                <h3>
                  Availability for{' '}
                  {new Date(`${selectedDateKey}T12:00:00`).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                </h3>
                {booking.infoMessage && <p className="schedule-info">{booking.infoMessage}</p>}
                {loading ? (
                  <p>Loading times…</p>
                ) : selectedSlots.length === 0 ? (
                  <p>No sessions available this day.</p>
                ) : (
                  <div className="schedule-slot-grid">
                    {selectedSlots.map((slot) => (
                      <button
                        key={slot.startAt}
                        type="button"
                        className={`schedule-slot${selectedSlot?.startAt === slot.startAt ? ' schedule-slot--selected' : ''}${!slot.available ? ' schedule-slot--unavailable' : ''}`}
                        disabled={!slot.available}
                        onClick={() => setSelectedSlot(slot)}
                      >
                        {slot.label}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="schedule-placeholder">Select a date to see available times.</p>
            )}
          </div>
        </div>
      </div>

      <div className="schedule-details">
        <h2>Service Details</h2>
        <p className="schedule-service-name">{displayName}</p>
        <p className="schedule-service-price">
          {booking.depositAmount > 0
            ? `${toCurrency(booking.depositAmount)} deposit now · ${toCurrency(Number(product.price || 0))} total`
            : toCurrency(Number(product.price || 0))}
        </p>
      </div>

      {error && <p className="error-msg">{error}</p>}

      <button
        type="button"
        className="schedule-next-btn"
        disabled={!selectedSlot?.available}
        onClick={handleNext}
      >
        Next
      </button>
    </section>
  )
}
