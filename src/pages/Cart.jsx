import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../contexts/CartContext'
import { useOrderTotals } from '../hooks/useOrderTotals'
import { toCurrency } from '../utils/currency'
import { formatSelectedVariantsText } from '../utils/variantDisplay'

export function Cart() {
  const {
    items,
    appliedCoupon,
    appliedGiftCard,
    updateItemQuantity,
    removeItem,
    applyCouponCode,
    clearCouponCode,
    applyGiftCardCode,
    clearGiftCardCode,
  } = useCart()
  const {
    subtotal,
    discountAmount,
    shipping,
    giftCardAmount,
    total,
    canShip,
    loading: totalsLoading,
  } = useOrderTotals('ship')
  const [couponDraft, setCouponDraft] = useState(appliedCoupon?.code || '')
  const [couponStatus, setCouponStatus] = useState('')
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false)
  const [giftCardDraft, setGiftCardDraft] = useState(appliedGiftCard?.code || '')
  const [giftCardStatus, setGiftCardStatus] = useState('')
  const [isApplyingGiftCard, setIsApplyingGiftCard] = useState(false)

  useEffect(() => {
    setCouponDraft(appliedCoupon?.code || '')
  }, [appliedCoupon?.code])

  useEffect(() => {
    setGiftCardDraft(appliedGiftCard?.code || '')
  }, [appliedGiftCard?.code])

  if (!items.length) {
    return (
      <section className="content-page">
        <h1>Your Cart</h1>
        <p>Your cart is empty. Start with the shop.</p>
        <Link className="primary-btn" to="/shop">
          Browse Products
        </Link>
      </section>
    )
  }

  return (
    <section className="content-page">
      <h1>Your Cart</h1>
      <div className="stack-list">
        {items.map((item) => (
          <article className="cart-row" key={item.cartKey || item.id}>
            <div>
              <h3>{item.name}</h3>
              {item.selectedVariants && Object.keys(item.selectedVariants).length > 0 && (
                <p style={{ marginTop: 4, fontSize: '0.88rem', color: '#666' }}>
                  {formatSelectedVariantsText(item.selectedVariants, item.variants)}
                </p>
              )}
              {item.scheduledLabel && (
                <p style={{ marginTop: 4, fontSize: '0.88rem', color: 'var(--brand-primary)', fontWeight: 600 }}>
                  {item.scheduledLabel}
                </p>
              )}
              <p>{toCurrency(item.price)}</p>
              {item.bookingDeposit > 0 && (
                <p style={{ marginTop: 4, fontSize: '0.85rem', color: '#5a3040' }}>
                  Deposit now · {toCurrency(item.balanceDue || 0)} due at appointment
                </p>
              )}
              {item.addOns?.length > 0 && (
                <p style={{ marginTop: 4, fontSize: '0.88rem', color: '#5a3040' }}>
                  {item.addOns.map((addOn) => `${addOn.label} (+${toCurrency(addOn.price)})`).join(', ')}
                </p>
              )}
            </div>
            <div className="qty-wrap">
              <input
                className="qty-input"
                min="1"
                type="number"
                value={item.quantity}
                onChange={(event) => updateItemQuantity(item.cartKey || item.id, Number(event.target.value || 1))}
              />
              <button type="button" className="ghost-btn" onClick={() => removeItem(item.cartKey || item.id)}>
                Remove
              </button>
            </div>
          </article>
        ))}
      </div>

      <form
        className="panel form-stack"
        onSubmit={async (event) => {
          event.preventDefault()
          setCouponStatus('')
          setIsApplyingCoupon(true)
          try {
            const result = await applyCouponCode(couponDraft)
            setCouponStatus(result.message)
          } catch (err) {
            setCouponStatus(err?.message || 'Unable to validate coupon right now.')
          } finally {
            setIsApplyingCoupon(false)
          }
        }}
      >
        <label className="form-field-label" htmlFor="coupon-code-input">
          Discount Code
          <div className="inline-form" style={{ alignItems: 'stretch' }}>
            <input
              id="coupon-code-input"
              className="text-input"
              type="text"
              placeholder="Enter coupon code"
              value={couponDraft}
              onChange={(event) => setCouponDraft(event.target.value)}
              style={{ flex: 1 }}
            />
            <button type="submit" className="primary-btn" disabled={isApplyingCoupon}>
              {isApplyingCoupon ? 'Applying...' : 'Apply'}
            </button>
            {appliedCoupon && (
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  clearCouponCode()
                  setCouponStatus('Coupon removed.')
                }}
              >
                Remove
              </button>
            )}
          </div>
        </label>
        {couponStatus && <p style={{ margin: 0, fontSize: '0.92rem' }}>{couponStatus}</p>}
      </form>

      <form
        className="panel form-stack"
        onSubmit={async (event) => {
          event.preventDefault()
          setGiftCardStatus('')
          setIsApplyingGiftCard(true)
          try {
            const result = await applyGiftCardCode(giftCardDraft)
            setGiftCardStatus(result.message)
          } catch (err) {
            setGiftCardStatus(err?.message || 'Unable to validate gift card right now.')
          } finally {
            setIsApplyingGiftCard(false)
          }
        }}
      >
        <label className="form-field-label" htmlFor="gift-card-code-input">
          Gift Card
          <div className="inline-form" style={{ alignItems: 'stretch' }}>
            <input
              id="gift-card-code-input"
              className="text-input"
              type="text"
              placeholder="Enter gift card code"
              value={giftCardDraft}
              onChange={(event) => setGiftCardDraft(event.target.value)}
              style={{ flex: 1 }}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
            />
            <button type="submit" className="primary-btn" disabled={isApplyingGiftCard}>
              {isApplyingGiftCard ? 'Applying...' : 'Apply'}
            </button>
            {appliedGiftCard && (
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  clearGiftCardCode()
                  setGiftCardStatus('Gift card removed.')
                }}
              >
                Remove
              </button>
            )}
          </div>
        </label>
        {giftCardStatus && <p style={{ margin: 0, fontSize: '0.92rem' }}>{giftCardStatus}</p>}
        {appliedGiftCard && (
          <p style={{ margin: 0, fontSize: '0.88rem', color: '#5a3040' }}>
            Available balance: {toCurrency(appliedGiftCard.remainingBalance)}
          </p>
        )}
      </form>

      <div className="panel form-stack">
        <h3 style={{ margin: 0 }}>Order Summary</h3>
        <p style={{ margin: 0 }}>Subtotal: {toCurrency(subtotal)}</p>
        {discountAmount > 0 && appliedCoupon && (
          <p style={{ margin: 0, color: 'var(--brand-primary)' }}>
            Coupon ({appliedCoupon.code}, {appliedCoupon.discountPercent}%): -{toCurrency(discountAmount)}
          </p>
        )}
        {canShip && !totalsLoading && (
          <p style={{ margin: 0 }}>
            Est. shipping: {toCurrency(shipping)}
            <span style={{ fontSize: '0.85rem', color: '#666' }}> (if shipped — pickup/delivery may differ)</span>
          </p>
        )}
        {totalsLoading && (
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>Calculating shipping estimate…</p>
        )}
        {!canShip && (
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#5a3040' }}>
            Some items are local pickup/delivery only. Shipping cost will be set at checkout.
          </p>
        )}
        {giftCardAmount > 0 && appliedGiftCard && (
          <p style={{ margin: 0, color: 'var(--brand-primary)' }}>
            Gift card ({appliedGiftCard.code}): -{toCurrency(giftCardAmount)}
          </p>
        )}
        <h2 style={{ margin: 0 }}>Total: {toCurrency(total)}</h2>
      </div>

      <Link className="primary-btn" to="/checkout">
        Proceed to Checkout
      </Link>
    </section>
  )
}
