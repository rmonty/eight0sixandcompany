/**
 * Order confirmation email sent to the customer after placing an order.
 */
import { formatSelectedVariants } from '../variantDisplay.js'
const FULFILLMENT_LABELS = {
  ship: 'Shipping',
  delivery: 'Local Delivery',
  pickup: 'Local Pickup',
}

export function OrderConfirmationEmail({
  orderId,
  customerName,
  items,
  subtotal,
  discount,
  giftCard,
  shipping,
  total,
  paymentMethod,
  fulfillmentMethod = 'ship',
  noteToSeller,
  deliveryDetails,
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Order Confirmed — 806 & CO.</title>
      </head>
      <body style={body}>
        <div style={container}>
          {/* Header */}
          <div style={header}>
            <p style={brandScript}>806</p>
            <p style={brandAnd}>&amp;</p>
            <p style={brandBold}>Ends</p>
          </div>

          <h1 style={heading}>Order Confirmed 🎉</h1>
          <p style={intro}>
            Hi {customerName}, thank you so much for your order! Everything here is made
            just for you, so I'll be in touch soon with any questions.
          </p>

          <hr style={hr} />

          {/* Order details */}
          <p style={sectionLabel}>Order #{orderId}</p>

          <table style={itemsTable} cellPadding={0} cellSpacing={0}>
            <tbody>
              {items.map((item, i) => {
                const variants = formatSelectedVariants(item.selectedVariants, item.variants)
                const addOns = item.addOns || []
                return (
                  <tr key={i}>
                    <td style={itemName}>
                      {item.name}
                      {variants.length > 0 && (
                        <ul style={variantList}>
                          {variants.map((variant, variantIdx) => (
                            <li key={`${variant.label}-${variantIdx}`}><span style={variantKey}>{variant.label}:</span> {variant.value}</li>
                          ))}
                        </ul>
                      )}
                      {addOns.length > 0 && (
                        <span style={itemAddOn}>
                          {' '}({addOns.map((a) => a.label || a).join(', ')})
                        </span>
                      )}
                      {item.scheduledLabel && (
                        <span style={itemAddOn}>
                          {' '}Appointment: {item.scheduledLabel}
                        </span>
                      )}
                      {item.needByDate && (
                        <span style={itemAddOn}>
                          {' '}Need by: {item.needByDate}
                        </span>
                      )}
                    </td>
                    <td style={itemQty}>x{item.quantity}</td>
                    <td style={itemPrice}>${Number(item.price || 0).toFixed(2)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {subtotal != null && discount?.amount > 0 && (
            <p style={subtotalLine}>Subtotal: <strong>{subtotal}</strong></p>
          )}
          {discount?.amount > 0 && (
            <p style={discountLine}>Coupon ({discount.code}): <strong>−${Number(discount.amount).toFixed(2)}</strong></p>
          )}
          {giftCard?.amount > 0 && (
            <p style={discountLine}>Gift card ({giftCard.code}): <strong>−${Number(giftCard.amount).toFixed(2)}</strong></p>
          )}
          {shipping != null && (
            <p style={subtotalLine}>Shipping / delivery: <strong>{shipping}</strong></p>
          )}
          <p style={totalLine}>
            Total: <strong>{total}</strong>
          </p>

          <p style={paymentLine}>
            Payment: <strong>{paymentMethod}</strong>
          </p>

          <p style={paymentLine}>
            Fulfillment: <strong>{FULFILLMENT_LABELS[fulfillmentMethod] ?? fulfillmentMethod}</strong>
          </p>

          {noteToSeller && (
            <div style={notesBox}>
              <p style={notesLabel}>Your note to me</p>
              <p style={notesText}>{noteToSeller}</p>
            </div>
          )}

          {deliveryDetails && (deliveryDetails.location || deliveryDetails.availability) && (
            <div style={notesBox}>
              <p style={notesLabel}>Local delivery details</p>
              {deliveryDetails.location && <p style={notesText}>Location: {deliveryDetails.location}</p>}
              {deliveryDetails.availability && <p style={notesText}>Available: {deliveryDetails.availability}</p>}
            </div>
          )}

          <hr style={hr} />

          <p style={footer}>
            Questions? Just reply to this email or reach me at{' '}
            <a href="mailto:orders@806andcompany.com" style={link}>
              orders@806andcompany.com
            </a>
          </p>
          <p style={footerSmall}>
            806 &amp; CO. &middot; 806andcompany.com
          </p>
        </div>
      </body>
    </html>
  )
}

/* ── Styles ── */
const body = {
  backgroundColor: '#fdf8f4',
  fontFamily: 'Georgia, "Times New Roman", serif',
  padding: '40px 0',
  margin: 0,
}

const container = {
  maxWidth: '600px',
  margin: '0 auto',
  backgroundColor: '#ffffff',
  borderRadius: '10px',
  border: '1px solid #f0d9e3',
  padding: '40px 32px',
}

const header = {
  display: 'flex',
  alignItems: 'baseline',
  gap: '6px',
  marginBottom: '24px',
}

const brandScript = {
  fontFamily: '"Nunito Sans", Helvetica, Arial, sans-serif',
  fontSize: '28px',
  color: '#BC628C',
  margin: 0,
  lineHeight: 1,
}

const brandAnd = {
  fontFamily: 'Georgia, serif',
  fontSize: '20px',
  color: '#7b9463',
  margin: 0,
  lineHeight: 1,
}

const brandBold = {
  fontFamily: 'Georgia, serif',
  fontSize: '22px',
  fontWeight: '700',
  color: '#2c1f1f',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  margin: 0,
  lineHeight: 1,
}

const heading = {
  color: '#BC628C',
  fontSize: '26px',
  fontWeight: '700',
  margin: '0 0 12px',
}

const intro = {
  fontSize: '15px',
  color: '#2c1f1f',
  lineHeight: '1.6',
  margin: '0',
}

const hr = { borderColor: '#f0d9e3', margin: '24px 0', border: '1px solid #f0d9e3' }

const sectionLabel = {
  fontSize: '11px',
  fontWeight: '700',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#7b9463',
  margin: '0 0 12px',
}

const itemsTable = {
  width: '100%',
  borderCollapse: 'collapse',
  marginBottom: '16px',
}

const itemName = {
  fontSize: '14px',
  color: '#2c1f1f',
  padding: '6px 0',
  verticalAlign: 'top',
}

const itemAddOn = {
  color: '#888',
  fontSize: '13px',
}

const variantList = {
  margin: '4px 0 0 0',
  padding: '0 0 0 16px',
  color: '#555',
  fontSize: '12px',
  lineHeight: '1.7',
}

const variantKey = {
  fontWeight: '700',
}

const itemQty = {
  fontSize: '14px',
  color: '#888',
  padding: '6px 12px',
  whiteSpace: 'nowrap',
  verticalAlign: 'top',
}

const itemPrice = {
  fontSize: '14px',
  color: '#2c1f1f',
  padding: '6px 0',
  textAlign: 'right',
  whiteSpace: 'nowrap',
  verticalAlign: 'top',
}

const subtotalLine = {
  fontSize: '14px',
  color: '#888',
  margin: '0 0 4px',
  textAlign: 'right',
}

const discountLine = {
  fontSize: '14px',
  color: '#BC628C',
  margin: '0 0 4px',
  textAlign: 'right',
}

const totalLine = {
  fontSize: '16px',
  color: '#2c1f1f',
  margin: '0 0 6px',
  textAlign: 'right',
}

const paymentLine = {
  fontSize: '14px',
  color: '#888',
  margin: '0',
  textAlign: 'right',
}

const notesBox = {
  backgroundColor: '#fdf8f4',
  padding: '14px 16px',
  borderRadius: '6px',
  border: '1px solid #f0d9e3',
  marginTop: '20px',
}

const notesLabel = {
  fontSize: '11px',
  fontWeight: '700',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#7b9463',
  margin: '0 0 6px',
}

const notesText = {
  fontSize: '14px',
  color: '#2c1f1f',
  margin: 0,
  whiteSpace: 'pre-wrap',
}

const link = { color: '#BC628C' }

const footer = {
  fontSize: '13px',
  color: '#555',
  lineHeight: '1.5',
  margin: '0 0 8px',
}

const footerSmall = {
  fontSize: '11px',
  color: '#aaa',
  margin: 0,
}
