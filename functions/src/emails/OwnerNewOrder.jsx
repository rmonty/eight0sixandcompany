/**
 * New order notification sent to the store owner.
 * Reply-To is set to the customer's email.
 */
import { formatSelectedVariants } from '../variantDisplay.js'
const FULFILLMENT_LABELS = {
  ship: 'Shipping',
  delivery: 'Local Delivery',
  pickup: 'Local Pickup',
}

export function OwnerNewOrderEmail({
  orderId,
  customerName,
  customerEmail,
  customerPhone,
  customerAddress,
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
        <title>New Order #{orderId}</title>
      </head>
      <body style={body}>
        <div style={container}>
          <h1 style={heading}>New Order 🛍️</h1>
          <p style={subtext}>A new order was placed on 806andcompany.com</p>
          <hr style={hr} />

          <Field label="Order ID">#{orderId}</Field>
          <Field label="Fulfillment">{FULFILLMENT_LABELS[fulfillmentMethod] ?? fulfillmentMethod}</Field>
          <Field label="Customer">
            {customerName} &middot;{' '}
            <a href={`mailto:${customerEmail}`} style={link}>{customerEmail}</a>
          </Field>
          {customerPhone && <Field label="Phone">{customerPhone}</Field>}
          {customerAddress && <Field label="Ship To">{customerAddress}</Field>}

          <hr style={hr} />

          <p style={sectionLabel}>Items</p>
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
          <p style={totalLine}>Total: <strong>{total}</strong></p>
          <p style={paymentLine}>Payment: <strong>{paymentMethod}</strong></p>

          {noteToSeller && (
            <div style={notesBox}>
              <p style={notesLabel}>Note from customer</p>
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
          <p style={footer}>Hit Reply to respond directly to {customerName}.</p>
        </div>
      </body>
    </html>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <p style={fieldLabel}>{label}</p>
      <p style={fieldValue}>{children}</p>
    </div>
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

const heading = {
  color: '#9A4A2C',
  fontSize: '26px',
  fontWeight: '700',
  margin: '0 0 8px',
}

const subtext = {
  color: '#888',
  fontSize: '14px',
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

const fieldLabel = {
  ...sectionLabel,
  margin: '0 0 4px',
}

const fieldValue = {
  fontSize: '15px',
  color: '#2c1f1f',
  margin: '0 0 20px',
  lineHeight: '1.5',
}

const itemsTable = { width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }

const itemName = {
  fontSize: '14px',
  color: '#2c1f1f',
  padding: '6px 0',
  verticalAlign: 'top',
}

const itemAddOn = { color: '#888', fontSize: '13px' }

const variantList = {
  margin: '4px 0 0 0',
  padding: '0 0 0 16px',
  color: '#555',
  fontSize: '12px',
  lineHeight: '1.7',
}

const variantKey = { fontWeight: '700' }

const subtotalLine = {
  fontSize: '14px',
  color: '#888',
  margin: '0 0 4px',
  textAlign: 'right',
}

const discountLine = {
  fontSize: '14px',
  color: '#9A4A2C',
  margin: '0 0 4px',
  textAlign: 'right',
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

const link = { color: '#9A4A2C' }

const footer = {
  fontSize: '12px',
  color: '#aaa',
  textAlign: 'center',
  margin: '0',
}
