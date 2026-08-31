import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js'
import { useCart } from '../contexts/CartContext'
import { useAuth } from '../contexts/AuthContext'
import { useSettings } from '../contexts/SettingsContext'
import { useOrderTotals } from '../hooks/useOrderTotals'
import { createOrder } from '../services/ordersService'
import { uploadProductMedia } from '../services/mediaService'
import { toCurrency } from '../utils/currency'
import {
  ORDER_NOTE_IMAGE_ACCEPT,
  ORDER_NOTE_IMAGE_MAX_COUNT,
  formatOrderNoteImageMaxSize,
  validateOrderNoteImage,
} from '../utils/orderNoteImages'
import { calculateOrderTotals } from '../utils/shipping'
import { quoteDeliveryFee } from '../services/deliveryService'
import { LoginModal } from '../components/LoginModal'

const emptyCustomer = {
  name: '',
  email: '',
  phone: '',
  address: {
    street: '',
    city: '',
    state: '',
    zip: '',
  },
}

export function Checkout() {
  const { items, appliedCoupon, appliedGiftCard, clearCart, updateItemNeedByDate } = useCart()
  const { user } = useAuth()
  const { settings } = useSettings()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState(emptyCustomer)
  const [noteToSeller, setNoteToSeller] = useState('')
  const [noteImages, setNoteImages] = useState([])
  const [noteImageUploading, setNoteImageUploading] = useState(false)
  const [fulfillmentMethod, setFulfillmentMethod] = useState('ship')
  const [paymentMethod, setPaymentMethod] = useState('contact')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [checkoutStep, setCheckoutStep] = useState(() => (user ? 'form' : 'auth'))
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const [loginModalMode, setLoginModalMode] = useState('signin')
  const [photoLoginOpen, setPhotoLoginOpen] = useState(false)
  const [noteImageError, setNoteImageError] = useState('')
  const [deliveryDetails, setDeliveryDetails] = useState({ location: '', availability: '' })
  const [deliveryQuote, setDeliveryQuote] = useState(null)
  const [deliveryQuoteLoading, setDeliveryQuoteLoading] = useState(false)
  const minNeedByDate = useMemo(() => new Date().toISOString().split('T')[0], [])
  const {
    subtotal,
    discountAmount,
    shipping,
    giftCardAmount,
    total,
    fulfillmentError,
    needByDateError,
    canShip,
    enrichedItems,
    loading: totalsLoading,
  } = useOrderTotals(fulfillmentMethod, { deliveryQuote })

  const fulfillmentOptions = useMemo(
    () => [
      ...(canShip ? [{ id: 'ship', label: 'Shipping' }] : []),
      { id: 'delivery', label: 'Local Delivery' },
      { id: 'pickup', label: 'Local Pickup' },
    ],
    [canShip],
  )

  useEffect(() => {
    if (fulfillmentMethod === 'ship' && !canShip) {
      setFulfillmentMethod('delivery')
    }
  }, [fulfillmentMethod, canShip])

  const hasFullAddress = Boolean(
    customer.address.street && customer.address.city && customer.address.state && customer.address.zip,
  )
  const needsDeliveryDetails = fulfillmentMethod === 'delivery'
  const itemsNeedingDates = enrichedItems.filter((item) => item.requiresNeedByDate)

  useEffect(() => {
    if (fulfillmentMethod !== 'delivery' || !hasFullAddress) {
      setDeliveryQuote(null)
      setDeliveryQuoteLoading(false)
      return undefined
    }

    let cancelled = false
    setDeliveryQuoteLoading(true)

    quoteDeliveryFee(customer.address)
      .then((quote) => {
        if (!cancelled) setDeliveryQuote(quote)
      })
      .catch(() => {
        if (!cancelled) setDeliveryQuote(null)
      })
      .finally(() => {
        if (!cancelled) setDeliveryQuoteLoading(false)
      })

    return () => {
      cancelled = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- individual address fields already cover customer.address
  }, [fulfillmentMethod, hasFullAddress, customer.address.street, customer.address.city, customer.address.state, customer.address.zip])

  // Auto-advance to form when user signs in from the auth step
  useEffect(() => {
    if (user && checkoutStep === 'auth') setCheckoutStep('form')
  }, [user, checkoutStep])

  // Pre-fill name + email from account when entering form step
  useEffect(() => {
    if (user && checkoutStep === 'form') {
      setCustomer((prev) => ({
        ...prev,
        name: prev.name || user.displayName || '',
        email: prev.email || user.email || '',
      }))
    }
  }, [user, checkoutStep])

  const paymentChoices = useMemo(() => {
    const methods = [{ id: 'contact', label: 'Contact to Order', enabled: true }]

    if (settings.paypal?.enabled) methods.push({ id: 'paypal', label: 'PayPal', enabled: true })
    if (settings.venmo?.enabled) methods.push({ id: 'venmo', label: 'Venmo', enabled: true })
    if (settings.cashapp?.enabled) methods.push({ id: 'cashapp', label: 'Cash App', enabled: true })

    return methods
  }, [settings])

  const paypalCheckoutUrl = useMemo(() => {
    const raw = (settings.paypal?.paymentLink || '').trim()
    if (!raw) return ''

    let parsed
    try {
      parsed = new URL(raw)
    } catch {
      return raw
    }

    const host = parsed.hostname.toLowerCase()
    if (host === 'paypal.me' || host.endsWith('.paypal.me')) {
      const amount = total.toFixed(2)
      const path = parsed.pathname.replace(/\/+$/, '')
      return `${parsed.origin}${path}/${amount}`
    }

    return parsed.toString()
  }, [settings.paypal?.paymentLink, total])

  const setField = (field, value) => {
    setCustomer((prev) => ({ ...prev, [field]: value }))
  }

  const setAddress = (field, value) => {
    setCustomer((prev) => ({
      ...prev,
      address: {
        ...prev.address,
        [field]: value,
      },
    }))
  }

  const needsAddress = fulfillmentMethod !== 'pickup'

  const validate = () => {
    if (totalsLoading) return 'Order totals are still loading. Please wait a moment and try again.'
    if (!items.length) return 'Your cart is empty.'
    if (!customer.name || !customer.email || !customer.phone) return 'Name, email, and phone are required.'
    if (fulfillmentError) return fulfillmentError
    if (needByDateError) return needByDateError
    if (needsAddress && !hasFullAddress) {
      return 'Full address is required for shipping and local delivery.'
    }
    if (needsDeliveryDetails) {
      if (!deliveryDetails.location.trim()) return 'Please tell us where to deliver your order.'
      if (!deliveryDetails.availability.trim()) return 'Please share when you are available to receive delivery.'
      if (deliveryQuoteLoading) return 'Delivery fee is still being calculated. Please wait a moment.'
    }
    return ''
  }

  const submitOrder = async ({ paymentMethod: methodOverride, paypalOrderId } = {}) => {
    const resolvedPaymentMethod = methodOverride || paymentMethod
    const orderTotals = calculateOrderTotals({
      items: enrichedItems,
      fulfillmentMethod,
      settings,
      discountPercent: appliedCoupon?.discountPercent || 0,
      deliveryQuote: fulfillmentMethod === 'delivery' ? deliveryQuote : null,
      giftCardBalance: appliedGiftCard?.remainingBalance || 0,
    })

    if (noteImages.length > 0 && !user) {
      throw new Error('Sign in to attach reference photos.')
    }

    let noteImageUrls = []
    if (noteImages.length > 0) {
      setNoteImageUploading(true)
      try {
        noteImageUrls = await Promise.all(
          noteImages.map((file) => uploadProductMedia(file, 'order-notes')),
        )
      } finally {
        setNoteImageUploading(false)
      }
    }

    const dueTotal = Number(orderTotals.total || 0)
    const paymentForOrder =
      dueTotal <= 0.009 && appliedGiftCard
        ? 'giftcard'
        : resolvedPaymentMethod

    const order = await createOrder({
      customer,
      fulfillmentMethod,
      items: enrichedItems.map((item) => ({
        productId: item.id,
        cartKey: item.cartKey || item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        basePrice: item.basePrice ?? item.price,
        addOns: item.addOns || [],
        selectedVariants: item.selectedVariants || {},
        image: item.images?.[0] || '',
        needByDate: item.needByDate || '',
      })),
      subtotal: orderTotals.subtotal,
      shipping: orderTotals.shipping,
      discount: {
        code: appliedCoupon?.code || '',
        normalizedCode: appliedCoupon?.normalizedCode || '',
        percent: Number(appliedCoupon?.discountPercent || 0),
        amount: orderTotals.discountAmount,
      },
      giftCard: appliedGiftCard
        ? {
            code: appliedGiftCard.code || '',
            normalizedCode: appliedGiftCard.normalizedCode || '',
            amount: orderTotals.giftCardAmount,
          }
        : null,
      total: orderTotals.total,
      paymentMethod: paymentForOrder,
      paypalOrderId: paypalOrderId || '',
      notes: noteToSeller,
      noteImages: noteImageUrls,
      deliveryDetails: needsDeliveryDetails ? deliveryDetails : null,
      userId: user?.uid || '',
    })

    const emailWarning = order?.emailSent
      ? ''
      : 'Your order was placed, but we could not send confirmation email right now.'

    clearCart()
    navigate('/order-confirmation', {
      state: { orderId: order.id, emailWarning, customerEmail: customer.email, isGuest: !user },
    })
  }

  const handlePlaceOrder = async () => {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError('')

    try {
      await submitOrder()
    } catch (orderError) {
      setError(orderError.message || 'Unable to place order right now.')
    } finally {
      setSaving(false)
    }
  }

  const handlePayPalApprove = async (data, actions) => {
    setSaving(true)
    setError('')

    try {
      await actions.order.capture()
      await submitOrder({ paymentMethod: 'paypal', paypalOrderId: data.orderID })
    } catch (orderError) {
      setError(
        orderError.message ||
          'Payment was received but we could not place your order. Please contact us with your PayPal confirmation.',
      )
      setSaving(false)
    }
  }

  useEffect(() => {
    if (!user) {
      setNoteImages([])
      setNoteImageError('')
    }
  }, [user])

  const handleNoteImageSelect = (fileList) => {
    setNoteImageError('')
    const files = Array.from(fileList || [])
    if (!files.length) return

    if (!user) {
      setNoteImageError('Sign in to attach reference photos.')
      return
    }

    const accepted = []
    for (const file of files) {
      const validationError = validateOrderNoteImage(file)
      if (validationError) {
        setNoteImageError(validationError)
        continue
      }
      if (noteImages.length + accepted.length >= ORDER_NOTE_IMAGE_MAX_COUNT) {
        setNoteImageError(`You can attach up to ${ORDER_NOTE_IMAGE_MAX_COUNT} images per order.`)
        break
      }
      if (!noteImages.some((existing) => existing.name === file.name && existing.size === file.size)) {
        accepted.push(file)
      }
    }

    if (accepted.length > 0) {
      setNoteImages((prev) => [...prev, ...accepted])
    }
  }

  const giftCardCoversTotal = total <= 0.009 && giftCardAmount > 0
  const usesPayPalButtons = !giftCardCoversTotal && paymentMethod === 'paypal' && Boolean(settings.paypal?.clientId)

  if (!items.length) {
    return (
      <section className="content-page">
        <h1>Checkout</h1>
        <p>Your cart is empty.</p>
        <Link to="/shop" className="primary-btn">
          Browse Products
        </Link>
      </section>
    )
  }

  if (checkoutStep === 'auth') {
    return (
      <section className="content-page">
        <h1>Checkout</h1>
        <div className="panel checkout-auth-panel">
          <h2 style={{ margin: '0 0 6px' }}>Sign in to track your order</h2>
          <p style={{ margin: 0, color: '#666', fontSize: '0.95rem' }}>
            Create a free account to view order status and chat with us — or continue as a guest.
          </p>
          <div className="checkout-auth-actions">
            <button
              type="button"
              className="primary-btn"
              onClick={() => { setLoginModalMode('signin'); setIsLoginOpen(true) }}
            >
              Sign In
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => { setLoginModalMode('signup'); setIsLoginOpen(true) }}
            >
              Create Account
            </button>
          </div>
          <div className="checkout-auth-divider"><span>or</span></div>
          <button type="button" className="checkout-guest-btn" onClick={() => setCheckoutStep('form')}>
            Continue as Guest
          </button>
        </div>
        <LoginModal
          isOpen={isLoginOpen}
          onClose={() => setIsLoginOpen(false)}
          initialMode={loginModalMode}
        />
      </section>
    )
  }

  return (
    <section className="content-page">
      <h1>Checkout</h1>
      <div className="panel form-stack" style={{ marginBottom: 14 }}>
        <p style={{ margin: 0 }}>Subtotal: {toCurrency(subtotal)}</p>
        {discountAmount > 0 && appliedCoupon && (
          <p style={{ margin: 0, color: 'var(--brand-primary)' }}>
            Coupon ({appliedCoupon.code}, {appliedCoupon.discountPercent}%): -{toCurrency(discountAmount)}
          </p>
        )}
        <p style={{ margin: 0 }}>
          Shipping / delivery: {toCurrency(shipping)}
          {fulfillmentMethod === 'delivery' && deliveryQuote?.usedMileage && (
            <span style={{ fontSize: '0.85rem', color: '#666' }}>
              {' '}({deliveryQuote.miles} mi @ ${Number(settings.shipping?.mileageRate ?? 0.7).toFixed(2)}/mi)
            </span>
          )}
          {fulfillmentMethod === 'delivery' && deliveryQuoteLoading && (
            <span style={{ fontSize: '0.85rem', color: '#666' }}> (calculating…)</span>
          )}
        </p>
        {giftCardAmount > 0 && appliedGiftCard && (
          <p style={{ margin: 0, color: 'var(--brand-primary)' }}>
            Gift card ({appliedGiftCard.code}): -{toCurrency(giftCardAmount)}
            <span style={{ fontSize: '0.85rem', color: '#666' }}>
              {' '}({toCurrency(appliedGiftCard.remainingBalance)} available)
            </span>
          </p>
        )}
        <p style={{ margin: 0 }}>
          <strong>Order total: {toCurrency(total)}</strong>
        </p>
        {total <= 0.009 && giftCardAmount > 0 && (
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#5a3040' }}>
            Fully covered by gift card — no additional payment needed.
          </p>
        )}
      </div>

      <div className="checkout-grid">
        <div className="form-stack">
          <input className="text-input" placeholder="Full Name" value={customer.name} onChange={(e) => setField('name', e.target.value)} />
          <input className="text-input" placeholder="Email" value={customer.email} onChange={(e) => setField('email', e.target.value)} />
          <input className="text-input" placeholder="Phone" value={customer.phone} onChange={(e) => setField('phone', e.target.value)} />

          <div>
            <p className="form-field-label" style={{ marginBottom: '8px' }}>Fulfillment</p>
            <div className="chip-row">
              {fulfillmentOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={fulfillmentMethod === opt.id ? 'chip chip-active' : 'chip'}
                  onClick={() => setFulfillmentMethod(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {fulfillmentError && fulfillmentMethod === 'ship' && (
              <p style={{ margin: '8px 0 0', fontSize: '0.88rem', color: '#9A4A2C' }}>{fulfillmentError}</p>
            )}
          </div>

          {needsAddress && (
            <>
              <input className="text-input" placeholder="Street Address" value={customer.address.street} onChange={(e) => setAddress('street', e.target.value)} />
              <input className="text-input" placeholder="City" value={customer.address.city} onChange={(e) => setAddress('city', e.target.value)} />
              <input className="text-input" placeholder="State" value={customer.address.state} onChange={(e) => setAddress('state', e.target.value)} />
              <input className="text-input" placeholder="ZIP" value={customer.address.zip} onChange={(e) => setAddress('zip', e.target.value)} />
            </>
          )}

          {needsDeliveryDetails && (
            <>
              <label className="form-field-label">Delivery location
                <input
                  className="text-input"
                  placeholder="Where should we leave it or meet you?"
                  value={deliveryDetails.location}
                  onChange={(e) => setDeliveryDetails((prev) => ({ ...prev, location: e.target.value }))}
                />
              </label>
              <label className="form-field-label">Times available for delivery
                <textarea
                  className="text-input"
                  rows={3}
                  placeholder="e.g. Weekdays after 4pm, Saturday 10am-2pm"
                  value={deliveryDetails.availability}
                  onChange={(e) => setDeliveryDetails((prev) => ({ ...prev, availability: e.target.value }))}
                />
              </label>
            </>
          )}

          {itemsNeedingDates.length > 0 && (
            <div className="form-field-label" style={{ gap: 10 }}>
              Need-by dates
              <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>
                These items are made to order — let us know when you need them.
              </span>
              {itemsNeedingDates.map((item) => (
                <label key={item.cartKey || item.id} className="form-field-label" style={{ margin: 0 }}>
                  {item.name}
                  <input
                    className="text-input"
                    type="date"
                    min={minNeedByDate}
                    value={item.needByDate || ''}
                    onChange={(e) => updateItemNeedByDate(item.cartKey || item.id, e.target.value)}
                  />
                </label>
              ))}
            </div>
          )}

          <label className="form-field-label">Any special details for your order? (Preferred shade, event date, or sign details go here!)
            <textarea
              className="text-input"
              rows={4}
              value={noteToSeller}
              onChange={(e) => setNoteToSeller(e.target.value)}
              placeholder="Add any customization notes, sizing, names, flavors, timing, or delivery details."
            />
          </label>
          <label className="form-field-label">Attach photos (optional)
            <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>
              JPG, PNG, WebP, or GIF · {formatOrderNoteImageMaxSize()} max each · up to {ORDER_NOTE_IMAGE_MAX_COUNT} images · sign-in required
            </span>
            {!user ? (
              <div style={{ marginTop: 4, display: 'grid', gap: 8 }}>
                <p style={{ margin: 0, fontSize: '0.88rem', color: '#5a3040' }}>
                  Sign in to attach reference photos with your order.
                </p>
                <button
                  type="button"
                  className="secondary-btn"
                  style={{ width: 'fit-content' }}
                  onClick={() => {
                    setLoginModalMode('signin')
                    setPhotoLoginOpen(true)
                  }}
                >
                  Sign In to Attach Photos
                </button>
              </div>
            ) : (
              <input
                className="text-input"
                type="file"
                accept={ORDER_NOTE_IMAGE_ACCEPT}
                multiple
                onChange={(e) => {
                  handleNoteImageSelect(e.target.files)
                  e.target.value = ''
                }}
                disabled={noteImageUploading || noteImages.length >= ORDER_NOTE_IMAGE_MAX_COUNT}
                style={{ display: 'block', marginTop: 4 }}
              />
            )}
          </label>
          {noteImageError && (
            <p style={{ margin: 0, fontSize: '0.88rem', color: '#9A4A2C' }}>{noteImageError}</p>
          )}
          {noteImages.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              {noteImages.map((file, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f0f0f0', borderRadius: 4, padding: '4px 8px' }}>
                  <span style={{ fontSize: '0.85rem', color: '#444', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                  <button
                    type="button"
                    onClick={() => setNoteImages((prev) => prev.filter((_, i) => i !== idx))}
                    style={{ padding: '2px 6px', fontSize: '0.8rem', background: '#ccc', border: 'none', borderRadius: 4, cursor: 'pointer', lineHeight: 1 }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <h2>Payment Options</h2>
          {giftCardCoversTotal ? (
            <p style={{ margin: 0 }}>
              This order is fully covered by your gift card. Place the order to complete checkout.
            </p>
          ) : (
            <>
          <div className="chip-row">
            {paymentChoices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                className={paymentMethod === choice.id ? 'chip chip-active' : 'chip'}
                onClick={() => setPaymentMethod(choice.id)}
              >
                {choice.label}
              </button>
            ))}
          </div>

          {paymentMethod === 'contact' && (
            <p>
              Contact us to finalize payment. Email <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a> or message us on{' '}
              <a href={settings.instagramUrl} target="_blank" rel="noreferrer">Instagram</a>.
              {giftCardAmount > 0 && (
                <> Your gift card will reduce the amount you pay.</>
              )}
            </p>
          )}

          {paymentMethod === 'venmo' && settings.venmo?.handle && (
            <a className="primary-btn" target="_blank" rel="noreferrer" href={`https://venmo.com/u/${settings.venmo.handle}`}>
              Open Venmo
            </a>
          )}

          {paymentMethod === 'cashapp' && settings.cashapp?.cashtag && (
            <a className="primary-btn" target="_blank" rel="noreferrer" href={`https://cash.app/$${settings.cashapp.cashtag}/${Math.round(total)}`}>
              Open Cash App
            </a>
          )}

          {paymentMethod === 'paypal' && settings.paypal?.clientId && (
            <PayPalScriptProvider options={{ clientId: settings.paypal.clientId, currency: 'USD', intent: 'capture' }}>
              <p style={{ margin: '0 0 10px', fontSize: '0.9rem', color: '#5a3040' }}>
                Complete your details on the left, then pay with PayPal below. Your order is placed automatically after payment.
              </p>
              <PayPalButtons
                style={{ layout: 'vertical' }}
                disabled={saving || noteImageUploading || totalsLoading || deliveryQuoteLoading}
                createOrder={async (data, actions) => {
                  const validationError = validate()
                  if (validationError) {
                    setError(validationError)
                    throw new Error(validationError)
                  }
                  setError('')
                  return actions.order.create({
                    purchase_units: [{ amount: { value: total.toFixed(2) } }],
                  })
                }}
                onApprove={handlePayPalApprove}
                onCancel={() => {
                  setSaving(false)
                  setError('PayPal payment was cancelled.')
                }}
                onError={(err) => {
                  setSaving(false)
                  setError(err?.message || 'PayPal encountered an error. Please try again.')
                }}
              />
            </PayPalScriptProvider>
          )}

          {paymentMethod === 'paypal' && !settings.paypal?.clientId && paypalCheckoutUrl && (
            <div style={{ display: 'grid', gap: 10 }}>
              <p style={{ margin: 0 }}>
                Continue to PayPal to pay for this order amount.
              </p>
              <a className="primary-btn" target="_blank" rel="noreferrer" href={paypalCheckoutUrl}>
                Open PayPal Payment Link
              </a>
            </div>
          )}

          {paymentMethod === 'paypal' && !settings.paypal?.clientId && !paypalCheckoutUrl && (
            <p>
              PayPal is enabled, but no PayPal payment link is configured yet.
            </p>
          )}
            </>
          )}
        </div>
      </div>

      {error && <p className="error-msg">{error}</p>}
      {!usesPayPalButtons && (
        <button type="button" className="primary-btn" onClick={handlePlaceOrder} disabled={saving || noteImageUploading || totalsLoading || deliveryQuoteLoading}>
          {saving ? 'Placing Order...' : totalsLoading || deliveryQuoteLoading ? 'Calculating total...' : 'Place Order'}
        </button>
      )}
      {usesPayPalButtons && saving && (
        <p style={{ margin: 0, fontSize: '0.92rem', color: '#5a3040' }}>Placing your order after PayPal payment…</p>
      )}
      <LoginModal
        isOpen={photoLoginOpen}
        onClose={() => setPhotoLoginOpen(false)}
        initialMode="signin"
      />
    </section>
  )
}
