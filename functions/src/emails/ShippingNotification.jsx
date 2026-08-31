/**
 * Shipping notification email sent to the customer when their order ships.
 */
export function ShippingNotificationEmail({
  orderId,
  customerName,
  shippingMessage,
  trackingNumber = '',
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Your Order is On Its Way!</title>
      </head>
      <body style={body}>
        <div style={container}>
          {/* Header */}
          <div style={headerRow}>
            <span style={brandScript}>806</span>
            <span style={brandAnd}>&amp;</span>
            <span style={brandBold}>Ends</span>
          </div>

          <h1 style={heading}>It's on its way! 📦</h1>
          <p style={intro}>
            Hi {customerName}! Your order #{orderId} has been shipped. Can't wait for you to get it!
            {trackingNumber ? (
              <>
                {' '}
                Your tracking number is <strong>{trackingNumber}</strong>.
              </>
            ) : null}
          </p>

          <div style={messageBox}>
            <p style={messageText}>{shippingMessage}</p>
          </div>

          {trackingNumber && (
            <div style={trackingBox}>
              <p style={trackingLabel}>Tracking number</p>
              <p style={trackingNumberStyle}>{trackingNumber}</p>
            </div>
          )}

          <hr style={hr} />

          <p style={footer}>
            Questions? Reply to this email or reach us at{' '}
            <a href="mailto:orders@806andcompany.com" style={link}>
              orders@806andcompany.com
            </a>
          </p>
          <p style={footerSmall}>806 &amp; CO. &middot; 806andcompany.com</p>
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

const headerRow = {
  display: 'flex',
  alignItems: 'baseline',
  gap: '6px',
  marginBottom: '24px',
}

const brandScript = {
  fontFamily: '"Cormorant Garamond", Georgia, serif',
  fontSize: '28px',
  color: '#9A4A2C',
  lineHeight: 1,
}

const brandAnd = {
  fontFamily: 'Georgia, serif',
  fontSize: '20px',
  color: '#7b9463',
  lineHeight: 1,
}

const brandBold = {
  fontFamily: 'Georgia, serif',
  fontSize: '22px',
  fontWeight: '700',
  color: '#2c1f1f',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  lineHeight: 1,
}

const heading = {
  color: '#9A4A2C',
  fontSize: '26px',
  fontWeight: '700',
  margin: '0 0 12px',
}

const intro = {
  fontSize: '15px',
  color: '#2c1f1f',
  lineHeight: '1.6',
  margin: '0 0 20px',
}

const messageBox = {
  backgroundColor: '#fdf8f4',
  padding: '20px',
  borderRadius: '8px',
  border: '1px solid #f0d9e3',
}

const messageText = {
  fontSize: '15px',
  color: '#2c1f1f',
  lineHeight: '1.6',
  margin: 0,
  whiteSpace: 'pre-wrap',
}

const trackingBox = {
  backgroundColor: '#ffffff',
  padding: '16px 20px',
  borderRadius: '8px',
  border: '1px solid #f0d9e3',
  marginTop: '16px',
}

const trackingLabel = {
  fontSize: '11px',
  fontWeight: '700',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#7b9463',
  margin: '0 0 6px',
}

const trackingNumberStyle = {
  fontSize: '16px',
  fontWeight: '700',
  color: '#2c1f1f',
  margin: 0,
  letterSpacing: '0.04em',
  fontFamily: 'Consolas, "Courier New", monospace',
}

const hr = { borderColor: '#f0d9e3', margin: '28px 0', border: '1px solid #f0d9e3' }

const link = { color: '#9A4A2C' }

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
