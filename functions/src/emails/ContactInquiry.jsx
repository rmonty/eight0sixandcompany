/**
 * Contact inquiry email sent to the store owner.
 * Rendered with @react-email/render using plain HTML JSX.
 * Reply-To is set to the customer's email so a simple reply reaches them directly.
 */
export function ContactInquiryEmail({
  fromName,
  fromEmail,
  inquiryType,
  dateNeeded,
  howFound,
  message,
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>New Inquiry from {fromName}</title>
      </head>
      <body style={body}>
        <div style={container}>
          <h1 style={heading}>New Inquiry ✉️</h1>
          <p style={subtext}>Someone reached out through 806andcompany.com</p>
          <hr style={hr} />

          <Field label="From">
            {fromName} &middot;{' '}
            <a href={`mailto:${fromEmail}`} style={link}>{fromEmail}</a>
          </Field>

          <Field label="What they're creating">{inquiryType}</Field>

          {dateNeeded && dateNeeded !== 'Not specified' && (
            <Field label="Date needed by">{dateNeeded}</Field>
          )}

          {howFound && howFound !== 'Not specified' && (
            <Field label="How they found 806 & CO.">{howFound}</Field>
          )}

          <div>
            <p style={fieldLabel}>Message</p>
            <p style={messageBox}>{message}</p>
          </div>

          <hr style={hr} />
          <p style={footer}>Hit Reply to respond directly to {fromName}.</p>
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
  color: '#BC628C',
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

const fieldLabel = {
  fontSize: '11px',
  fontWeight: '700',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#7b9463',
  margin: '0 0 4px',
}

const fieldValue = {
  fontSize: '15px',
  color: '#2c1f1f',
  margin: '0 0 20px',
  lineHeight: '1.5',
}

const messageBox = {
  ...fieldValue,
  backgroundColor: '#fdf8f4',
  padding: '16px',
  borderRadius: '6px',
  border: '1px solid #f0d9e3',
  whiteSpace: 'pre-wrap',
}

const link = { color: '#BC628C' }

const footer = {
  fontSize: '12px',
  color: '#aaa',
  textAlign: 'center',
  margin: '0',
}
