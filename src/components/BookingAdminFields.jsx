import { BOOKING_DAYS, DEFAULT_BOOKING } from '../utils/booking'

const DAY_LABELS = {
  sunday: 'Sunday',
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
}

const emptyWindow = () => ({ start: '09:00', end: '17:00' })

export function BookingAdminFields({ booking, onChange }) {
  const config = {
    ...DEFAULT_BOOKING,
    ...booking,
    weeklyHours: { ...DEFAULT_BOOKING.weeklyHours, ...(booking?.weeklyHours || {}) },
  }

  const update = (patch) => onChange({ ...config, ...patch })

  const updateWeekly = (day, windows) => {
    update({
      weeklyHours: {
        ...config.weeklyHours,
        [day]: windows,
      },
    })
  }

  const addBlockedDate = () => {
    const value = prompt('Block date (YYYY-MM-DD)')
    if (!value) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return
    if (config.blockedDates.includes(value)) return
    update({ blockedDates: [...config.blockedDates, value].sort() })
  }

  return (
    <div className="panel form-stack" style={{ marginTop: 16, background: 'rgba(253,192,220,0.15)' }}>
      <h3 style={{ margin: 0 }}>Appointment Booking</h3>
      <p style={{ margin: 0, fontSize: '0.88rem', color: '#5a3040' }}>
        Enable calendar scheduling for services like spray tans. Customers pick a date/time, then go straight to cart.
      </p>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={Boolean(config.enabled)}
          onChange={(e) => update({ enabled: e.target.checked })}
        />
        Enable appointment booking for this product
      </label>

      {config.enabled && (
        <>
          <label className="form-field-label">
            Booking display name
            <input
              className="text-input"
              value={config.displayName}
              onChange={(e) => update({ displayName: e.target.value })}
              placeholder="e.g. Mobile Tans — Amarillo"
            />
            <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>
              Shown on the schedule page and in the cart. Leave blank to use the product name.
            </span>
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <label className="form-field-label">
              Slot length (minutes)
              <input
                className="text-input"
                type="number"
                min="15"
                max="240"
                step="15"
                value={config.slotDurationMinutes}
                onChange={(e) => update({ slotDurationMinutes: Number(e.target.value || 30) })}
              />
            </label>
            <label className="form-field-label">
              Buffer between slots (min)
              <input
                className="text-input"
                type="number"
                min="0"
                max="120"
                step="5"
                value={config.bufferMinutes}
                onChange={(e) => update({ bufferMinutes: Number(e.target.value || 0) })}
              />
            </label>
            <label className="form-field-label">
              Close bookings (hours before)
              <input
                className="text-input"
                type="number"
                min="0"
                max="168"
                value={config.bookingCloseHours}
                onChange={(e) => update({ bookingCloseHours: Number(e.target.value || 24) })}
              />
            </label>
            <label className="form-field-label">
              Book up to (days ahead)
              <input
                className="text-input"
                type="number"
                min="1"
                max="365"
                value={config.advanceBookingDays}
                onChange={(e) => update({ advanceBookingDays: Number(e.target.value || 60) })}
              />
            </label>
            <label className="form-field-label">
              Deposit amount (optional)
              <div className="price-input-wrap">
                <span className="price-prefix">$</span>
                <input
                  className="text-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={config.depositAmount || ''}
                  onChange={(e) => update({ depositAmount: Number(e.target.value || 0) })}
                />
              </div>
              <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>
                Leave at 0 to charge the full product price at checkout.
              </span>
            </label>
            <label className="form-field-label">
              Time zone
              <select
                className="text-input"
                value={config.timezone}
                onChange={(e) => update({ timezone: e.target.value })}
              >
                <option value="America/Chicago">Central (America/Chicago)</option>
                <option value="America/Denver">Mountain (America/Denver)</option>
                <option value="America/Los_Angeles">Pacific (America/Los_Angeles)</option>
                <option value="America/New_York">Eastern (America/New_York)</option>
              </select>
            </label>
          </div>

          <label className="form-field-label">
            Info message (optional)
            <textarea
              className="text-input"
              rows={2}
              value={config.infoMessage}
              onChange={(e) => update({ infoMessage: e.target.value })}
              placeholder="e.g. Only some sessions are still available. Bookings close 1 day before."
            />
          </label>

          <div className="form-field-label" style={{ gap: 12 }}>
            Weekly availability
            <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>
              Add one or more time windows per day. Slots are generated using the slot length above.
            </span>
            {BOOKING_DAYS.map((day) => {
              const windows = config.weeklyHours[day] || []
              return (
                <div key={day} className="panel" style={{ padding: 12, background: 'rgba(255,255,255,0.7)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <strong>{DAY_LABELS[day]}</strong>
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() => updateWeekly(day, [...windows, emptyWindow()])}
                    >
                      + Add window
                    </button>
                  </div>
                  {windows.length === 0 ? (
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#777' }}>Closed</p>
                  ) : (
                    windows.map((window, idx) => (
                      <div key={`${day}-${idx}`} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                        <input
                          className="text-input"
                          type="time"
                          value={window.start}
                          onChange={(e) => {
                            const next = [...windows]
                            next[idx] = { ...next[idx], start: e.target.value }
                            updateWeekly(day, next)
                          }}
                        />
                        <span>to</span>
                        <input
                          className="text-input"
                          type="time"
                          value={window.end}
                          onChange={(e) => {
                            const next = [...windows]
                            next[idx] = { ...next[idx], end: e.target.value }
                            updateWeekly(day, next)
                          }}
                        />
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() => updateWeekly(day, windows.filter((_, i) => i !== idx))}
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )
            })}
          </div>

          <div className="form-field-label">
            Blocked dates
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {config.blockedDates.map((date) => (
                <span key={date} className="admin-chip">
                  {date}
                  <button
                    type="button"
                    onClick={() => update({ blockedDates: config.blockedDates.filter((d) => d !== date) })}
                    aria-label={`Remove ${date}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              <button type="button" className="ghost-btn" onClick={addBlockedDate}>
                + Block a date
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
