const updated = 'May 13, 2026'

export function ShippingPolicy() {
  return (
    <section className="content-page legal-page">
      <h1>Shipping Policy</h1>
      <p><strong>Last updated:</strong> {updated}</p>

      <h2>Processing Time</h2>
      <p>
        Because products are handmade, processing times vary by item and season. Estimated timelines
        shown at checkout are not guaranteed delivery dates.
      </p>

      <h2>Shipping Timeframes</h2>
      <p>
        Delivery speed depends on carrier operations and destination. Delays caused by carriers,
        weather, or holidays are outside our direct control.
      </p>

      <h2>Address Accuracy</h2>
      <p>
        Customers are responsible for providing correct shipping details. We are not responsible for
        delays or losses caused by incorrect addresses.
      </p>

      <h2>Lost or Delayed Packages</h2>
      <p>
        If a package appears lost or delayed, contact us and we will assist with claim/tracing steps
        when available.
      </p>
    </section>
  )
}
