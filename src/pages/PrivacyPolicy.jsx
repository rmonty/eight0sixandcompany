import { useSettings } from '../contexts/SettingsContext'

const updated = 'May 13, 2026'

export function PrivacyPolicy() {
  const { settings } = useSettings()
  const contactEmail = settings.contactEmail || 'orders@806andcompany.com'

  return (
    <section className="content-page legal-page">
      <h1>Privacy Policy</h1>
      <p><strong>Last updated:</strong> {updated}</p>
      <p>
        806 & CO. respects your privacy. This policy explains what information we collect,
        how we use it, and your options regarding that information.
      </p>

      <h2>Information We Collect</h2>
      <p>We may collect:</p>
      <ul>
        <li>Contact details you provide (name, email, phone, message).</li>
        <li>Order information (items, totals, shipping details, payment method choices).</li>
        <li>Account/authentication information when you sign in.</li>
        <li>Chat conversation details submitted through the site chat widget.</li>
        <li>Technical and usage data through analytics tools (including GA4).</li>
      </ul>

      <h2>How We Use Information</h2>
      <ul>
        <li>Process and fulfill orders.</li>
        <li>Respond to inquiries and customer support requests.</li>
        <li>Provide order updates and service communications.</li>
        <li>Improve site performance, user experience, and product offerings.</li>
        <li>Prevent fraud, abuse, or unauthorized use.</li>
      </ul>

      <h2>Analytics and Cookies</h2>
      <p>
        We use analytics tools to understand site traffic and performance. These tools may use
        cookies or similar technologies to collect aggregated usage information.
      </p>

      <h2>Third-Party Services</h2>
      <p>We use trusted providers to operate the store, including services such as:</p>
      <ul>
        <li>Google/Firebase (hosting, auth, database, storage, functions, analytics integration).</li>
        <li>Resend (transactional email delivery).</li>
        <li>Payment providers configured in checkout (e.g., PayPal, Venmo, Cash App).</li>
      </ul>
      <p>
        These providers process data under their own privacy terms and security controls.
      </p>

      <h2>Data Retention</h2>
      <p>
        We retain information only as long as needed for business, legal, accounting, and customer
        support purposes.
      </p>

      <h2>Your Choices</h2>
      <ul>
        <li>You can request updates or deletion of personal information where applicable.</li>
        <li>You can disable cookies in your browser, though some site features may be affected.</li>
      </ul>

      <h2>Contact</h2>
      <p>
        For privacy questions or requests, contact: <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
      </p>
    </section>
  )
}
