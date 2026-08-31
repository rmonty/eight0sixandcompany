import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useChat } from '../contexts/ChatContext'
import { claimGuestOrders } from '../services/accountService'
import { getOrdersByUserId } from '../services/ordersService'
import { toCurrency } from '../utils/currency'
import { formatSelectedVariantsText } from '../utils/variantDisplay'

const STATUS_CLASSES = {
  Pending: 'order-status--pending',
  'In Progress': 'order-status--progress',
  Shipped: 'order-status--shipped',
  Complete: 'order-status--complete',
  Delivered: 'order-status--complete',
  'Picked Up': 'order-status--complete',
  Cancelled: 'order-status--cancelled',
}

function formatDate(ts) {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function OrderCard({ order }) {
  const [expanded, setExpanded] = useState(false)
  const statusClass = STATUS_CLASSES[order.status] || 'order-status--pending'

  return (
    <div className="order-card">
      <div className="order-card-header">
        <div className="order-card-meta">
          <span className="order-card-id">#{order.id.slice(-8).toUpperCase()}</span>
          <span className="order-card-date">{formatDate(order.createdAt)}</span>
        </div>
        <div className="order-card-right">
          <span className={`order-status ${statusClass}`}>{order.status || 'Pending'}</span>
          <strong className="order-card-total">{toCurrency(order.total || 0)}</strong>
          <button
            type="button"
            className="order-card-toggle"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            {expanded ? '▲ Less' : '▼ Details'}
          </button>
        </div>
      </div>

      {/* Compact items summary always visible */}
      <p className="order-card-summary">
        {(order.items || []).map((item) => `${item.quantity}× ${item.name}`).join(', ')}
      </p>

      {expanded && (
        <div className="order-card-detail">
          <table className="order-items-table">
            <tbody>
              {(order.items || []).map((item, i) => (
                <tr key={i}>
                  <td>{item.quantity}×</td>
                  <td>
                    {item.name}
                    {item.selectedVariants && Object.keys(item.selectedVariants).length > 0 && (
                      <span className="order-item-variants">
                        {' — '}
                        {formatSelectedVariantsText(item.selectedVariants, item.variants, ' · ')}
                      </span>
                    )}
                    {(item.addOns || []).length > 0 && (
                      <span className="order-item-variants">
                        {' + '}{item.addOns.map((a) => a.label).join(', ')}
                      </span>
                    )}
                  </td>
                  <td className="order-item-price">{toCurrency(item.price * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {(order.discount?.amount > 0 || order.giftCard?.amount > 0 || Number(order.shipping) > 0) && (
            <div className="order-detail-row" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 4, marginTop: 8 }}>
              {order.subtotal != null && (
                <span>Subtotal: {toCurrency(order.subtotal)}</span>
              )}
              {order.discount?.amount > 0 && (
                <span style={{ color: 'var(--brand-primary)' }}>
                  Coupon: -{toCurrency(order.discount.amount)}
                </span>
              )}
              {(order.giftCard?.amount > 0 || order.giftCardAmount > 0) && (
                <span style={{ color: 'var(--brand-primary)' }}>
                  Gift card: -{toCurrency(order.giftCard?.amount ?? order.giftCardAmount)}
                </span>
              )}
              {Number(order.shipping) > 0 && (
                <span>Shipping / delivery: {toCurrency(order.shipping)}</span>
              )}
            </div>
          )}

          {order.fulfillmentMethod && (
            <p className="order-detail-row">
              <span>Fulfillment:</span>
              <span style={{ textTransform: 'capitalize' }}>{order.fulfillmentMethod}</span>
            </p>
          )}
          {order.trackingNumber && (
            <p className="order-detail-row">
              <span>Tracking:</span>
              <span style={{ fontFamily: 'Consolas, "Courier New", monospace' }}>{order.trackingNumber}</span>
            </p>
          )}
          {order.paymentMethod && (
            <p className="order-detail-row">
              <span>Payment:</span>
              <span style={{ textTransform: 'capitalize' }}>{order.paymentMethod}</span>
            </p>
          )}
          {order.notes && (
            <p className="order-detail-row">
              <span>Your note:</span>
              <span>{order.notes}</span>
            </p>
          )}
          {order.noteImages?.length > 0 && (
            <div className="order-detail-photos">
              {order.noteImages.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer">
                  <img src={url} alt={`Reference photo ${i + 1}`} className="order-detail-photo" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function Account() {
  const { user, logout, loading } = useAuth()
  const { openWidget: openChat } = useChat()
  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    let cancelled = false
    setOrdersLoading(true)

    ;(async () => {
      try {
        // Link any guest checkout orders for this email before loading history
        await claimGuestOrders()
        const nextOrders = await getOrdersByUserId(user.uid)
        if (!cancelled) setOrders(nextOrders)
      } catch (err) {
        console.error('Failed to load orders:', err)
        if (!cancelled) setOrders([])
      } finally {
        if (!cancelled) setOrdersLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user])

  if (loading) return null
  if (!user) return <Navigate to="/" replace />

  return (
    <section className="content-page account-page">
      <div className="account-header">
        <div>
          <p className="eyebrow" style={{ margin: 0 }}>My Account</p>
          <h1 style={{ margin: '4px 0 0' }}>{user.displayName || user.email}</h1>
          {user.displayName && <p style={{ margin: '2px 0 0', fontSize: '0.9rem', color: '#888' }}>{user.email}</p>}
        </div>
        <button type="button" className="secondary-btn" onClick={logout}>Sign Out</button>
      </div>

      <div className="account-body">
        {/* ── Orders ── */}
        <div>
          <h2 className="account-section-title">My Orders</h2>

          {ordersLoading ? (
            <p style={{ color: '#888' }}>Loading your orders…</p>
          ) : orders.length === 0 ? (
            <div className="account-empty">
              <p>You haven&rsquo;t placed any orders yet.</p>
              <Link to="/shop" className="primary-btn">Browse the Shop</Link>
            </div>
          ) : (
            <div className="order-list">
              {orders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          )}
        </div>

        {/* ── Quick links ── */}
        <div className="account-sidebar">
          <div className="panel" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 12px' }}>Need Help?</h3>
            <p style={{ margin: '0 0 14px', fontSize: '0.9rem', color: '#666' }}>
              Have a question about an order or a custom request? Chat with us.
            </p>
            <button
              type="button"
              className="primary-btn"
              style={{ width: '100%' }}
              onClick={() => openChat(true)}
            >
              Chat with 806 & CO.
            </button>
            <Link to="/contact" className="secondary-btn" style={{ display: 'block', textAlign: 'center', marginTop: 8 }}>
              Send a Message
            </Link>
          </div>

          <div className="panel" style={{ padding: 20, marginTop: 12 }}>
            <h3 style={{ margin: '0 0 8px' }}>Keep Shopping</h3>
            <Link to="/shop" className="secondary-btn" style={{ display: 'block', textAlign: 'center' }}>Browse the Shop</Link>
          </div>
        </div>
      </div>
    </section>
  )
}
