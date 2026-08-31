import { useState } from 'react'

const emptyItem = () => ({ name: '', quantity: 1, price: '' })

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? '').trim())

const paymentMethods = [
  { value: 'contact', label: 'Contact / Other' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'cashapp', label: 'Cash App' },
  { value: 'paypal', label: 'PayPal' },
]

export const ManualOrderModal = ({ onClose, onSave }) => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [fulfillmentMethod, setFulfillmentMethod] = useState('pickup')
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [items, setItems] = useState([emptyItem()])
  const [shipping, setShipping] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('contact')
  const [notes, setNotes] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const [sendEmail, setSendEmail] = useState(false)
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const updateItem = (idx, patch) => {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)))
  }

  const addItem = () => setItems((prev) => [...prev, emptyItem()])
  const removeItem = (idx) => setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev))

  const subtotal = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0)
  const total = subtotal + Number(shipping || 0)

  const handleSave = async () => {
    setError('')

    if (!name.trim()) {
      setError('Customer name is required.')
      return
    }
    if (email.trim() && !isValidEmail(email)) {
      setError('Customer email looks invalid.')
      return
    }
    if (sendEmail && !email.trim()) {
      setError('An email address is required to send a confirmation email.')
      return
    }
    const cleanItems = items
      .map((item) => ({ ...item, name: item.name.trim(), quantity: Number(item.quantity || 1), price: Number(item.price || 0) }))
      .filter((item) => item.name)
    if (cleanItems.length === 0) {
      setError('At least one item with a name is required.')
      return
    }
    if (cleanItems.some((item) => !Number.isFinite(item.price) || item.price < 0)) {
      setError('Item prices must be zero or greater.')
      return
    }

    setIsSaving(true)
    try {
      await onSave({
        customer: {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          address: { street, city, state, zip },
        },
        fulfillmentMethod,
        items: cleanItems,
        shipping: Number(shipping || 0),
        paymentMethod,
        notes,
        internalNotes,
        sendEmail,
      })
    } catch (err) {
      setError(err?.message || 'Unable to save the manual order.')
      setIsSaving(false)
    }
  }

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div className="login-modal">
        <div className="login-modal-content" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
          <div className="login-modal-header">
            <h2>New Manual Order</h2>
            <button type="button" className="close-btn" onClick={onClose} aria-label="Close">✕</button>
          </div>

          <p style={{ margin: '0 0 12px', fontSize: '0.85rem', color: '#888' }}>
            For orders taken outside the website (in person, phone, DM). No customer email is sent unless you check the box below.
          </p>

          <label className="form-field-label">Customer Name
            <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <div className="inline-form">
            <label className="form-field-label" style={{ flex: 1 }}>Email
              <input className="text-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="form-field-label" style={{ flex: 1 }}>Phone
              <input className="text-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
          </div>

          <label className="form-field-label">Fulfillment Method
            <select className="text-input" value={fulfillmentMethod} onChange={(e) => setFulfillmentMethod(e.target.value)}>
              <option value="pickup">Pickup</option>
              <option value="ship">Ship</option>
              <option value="delivery">Local Delivery</option>
            </select>
          </label>

          {fulfillmentMethod !== 'pickup' && (
            <>
              <label className="form-field-label">Street Address
                <input className="text-input" value={street} onChange={(e) => setStreet(e.target.value)} />
              </label>
              <div className="inline-form">
                <label className="form-field-label" style={{ flex: 1 }}>City
                  <input className="text-input" value={city} onChange={(e) => setCity(e.target.value)} />
                </label>
                <label className="form-field-label" style={{ flex: 1 }}>State
                  <input className="text-input" value={state} onChange={(e) => setState(e.target.value)} />
                </label>
                <label className="form-field-label" style={{ flex: 1 }}>Zip
                  <input className="text-input" value={zip} onChange={(e) => setZip(e.target.value)} />
                </label>
              </div>
            </>
          )}

          <div className="form-field-label">Items</div>
          {items.map((item, idx) => (
            <div className="inline-form" key={idx}>
              <input
                className="text-input"
                style={{ flex: 3 }}
                placeholder="Item name"
                value={item.name}
                onChange={(e) => updateItem(idx, { name: e.target.value })}
              />
              <input
                className="text-input"
                style={{ flex: 1 }}
                type="number"
                min="1"
                placeholder="Qty"
                value={item.quantity}
                onChange={(e) => updateItem(idx, { quantity: e.target.value })}
              />
              <input
                className="text-input"
                style={{ flex: 1 }}
                type="number"
                step="0.01"
                min="0"
                placeholder="Price"
                value={item.price}
                onChange={(e) => updateItem(idx, { price: e.target.value })}
              />
              <button type="button" className="ghost-btn" onClick={() => removeItem(idx)} disabled={items.length === 1}>✕</button>
            </div>
          ))}
          <button type="button" className="ghost-btn" onClick={addItem} style={{ marginBottom: 12 }}>+ Add Item</button>

          <div className="inline-form">
            <label className="form-field-label" style={{ flex: 1 }}>Shipping / Delivery Fee
              <input className="text-input" type="number" step="0.01" min="0" value={shipping} onChange={(e) => setShipping(e.target.value)} />
            </label>
            <label className="form-field-label" style={{ flex: 1 }}>Payment Method
              <select className="text-input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                {paymentMethods.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>

          <p style={{ margin: '0 0 12px', fontWeight: 700 }}>
            Subtotal: ${subtotal.toFixed(2)} — Total: ${total.toFixed(2)}
          </p>

          <label className="form-field-label">Customer Note
            <textarea className="text-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <label className="form-field-label">Internal Notes
            <textarea className="text-input" value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} />
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0 16px', fontSize: '0.85rem' }}>
            <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
            Send order confirmation email to customer
          </label>

          {error && <p style={{ color: '#b3261e', margin: '0 0 12px' }}>{error}</p>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="primary-btn" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save Order'}
            </button>
            <button type="button" className="ghost-btn" onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
