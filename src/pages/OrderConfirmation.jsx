import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LoginModal } from '../components/LoginModal'

export function OrderConfirmation() {
  const location = useLocation()
  const orderId = location.state?.orderId
  const emailWarning = location.state?.emailWarning
  const customerEmail = location.state?.customerEmail || ''
  const isGuest = location.state?.isGuest !== false
  const [showSignUp, setShowSignUp] = useState(false)

  return (
    <section className="content-page">
      <LoginModal isOpen={showSignUp} onClose={() => setShowSignUp(false)} initialMode="signup" initialEmail={customerEmail} />
      <h1>Order Received! 🎉</h1>
      <p>Thank you for your order. We will follow up with you shortly.</p>
      {orderId && <p style={{ fontSize: '0.9rem', color: '#888' }}>Order #{orderId}</p>}
      {emailWarning && <p className="error-msg">{emailWarning}</p>}

      {isGuest && (
        <div className="order-confirm-signup-prompt">
          <p><strong>Want to track this order?</strong> Create a free account to see your order status and chat with us.</p>
          <button type="button" className="primary-btn" onClick={() => setShowSignUp(true)}>Create Account</button>
        </div>
      )}

      <Link className="primary-btn" to="/shop" style={{ marginTop: isGuest ? 0 : undefined }}>
        Continue Shopping
      </Link>
    </section>
  )
}
