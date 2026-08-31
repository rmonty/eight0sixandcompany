/**
 * Notification when a local delivery order is delivered or picked up.
 */
export function FulfillmentCompleteEmail({
  orderId,
  customerName,
  status,
  message,
}) {
  const isDelivered = status === 'Delivered'
  const heading = isDelivered ? 'Your order has been delivered! 🎁' : 'Thanks for picking up! 🎉'
  const defaultMessage = isDelivered
    ? 'Your order was delivered today. I hope you love everything!'
    : 'Thanks for picking up your order. I hope you love everything!'

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>{isDelivered ? 'Order Delivered' : 'Order Picked Up'}</title>
      </head>
      <body style={body}>
        <div style={container}>
          <div style={headerRow}>
            <span style={brandScript}>806</span>
            <span style={brandAnd}>&amp;</span>
            <span style={brandBold}>Ends</span>
          </div>

          <h1 style={headingStyle}>{heading}</h1>
          <p style={intro}>
            Hi {customerName}! Your order #{orderId} has been {isDelivered ? 'delivered' : 'picked up'}.
          </p>

          <div style={messageBox}>
            <p style={messageText}>{message || defaultMessage}</p>
          </div>

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

const headingStyle = {
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
