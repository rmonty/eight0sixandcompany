const updated = 'May 13, 2026'

export function Terms() {
  return (
    <section className="content-page legal-page">
      <h1>Terms & Conditions</h1>
      <p><strong>Last updated:</strong> {updated}</p>
      <p>
        By using this website and placing an order, you agree to these terms.
      </p>

      <h2>Use of Site</h2>
      <ul>
        <li>You agree to use the site only for lawful purposes.</li>
        <li>You may not attempt to disrupt, damage, or gain unauthorized access to the service.</li>
      </ul>

      <h2>Products and Availability</h2>
      <ul>
        <li>Many products are handmade and may vary slightly from photos.</li>
        <li>Availability, pricing, and descriptions may change without notice.</li>
      </ul>

      <h2>Orders and Payments</h2>
      <ul>
        <li>Order confirmation does not guarantee shipment until processing is complete.</li>
        <li>We may decline or cancel orders for errors, suspected fraud, or stock issues.</li>
      </ul>

      <h2>Intellectual Property</h2>
      <p>
        Site content, branding, images, and original materials are owned by 806 & CO. unless
        otherwise stated and may not be reused without permission.
      </p>

      <h2>Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, 806 & CO. is not liable for indirect,
        incidental, or consequential damages arising from site use or purchases.
      </p>

      <h2>Changes to Terms</h2>
      <p>
        We may update these terms periodically. Continued use of the site after changes means you
        accept the updated terms.
      </p>
    </section>
  )
}
