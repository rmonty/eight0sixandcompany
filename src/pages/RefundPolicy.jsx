const updated = 'May 13, 2026'

export function RefundPolicy() {
  return (
    <section className="content-page legal-page">
      <h1>Refund, Return & Cancellation Policy</h1>
      <p><strong>Last updated:</strong> {updated}</p>

      <h2>Custom and Personalized Items</h2>
      <p>
        Custom, personalized, and made-to-order items are generally final sale and not eligible for
        return unless they arrive damaged or incorrect.
      </p>

      <h2>Damaged or Incorrect Orders</h2>
      <ul>
        <li>Contact us promptly with your order number and clear photos of the issue.</li>
        <li>We will review and, where appropriate, offer a replacement, store credit, or refund.</li>
      </ul>

      <h2>Cancellation Requests</h2>
      <p>
        Cancellation requests are considered only if production has not started. Once work begins,
        cancellation may not be available.
      </p>

      <h2>Non-Returnable Items</h2>
      <ul>
        <li>Perishable baked goods.</li>
        <li>Custom and personalized products after production starts.</li>
        <li>Items marked as final sale.</li>
      </ul>
    </section>
  )
}
