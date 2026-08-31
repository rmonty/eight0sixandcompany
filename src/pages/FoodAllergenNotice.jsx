const updated = 'May 13, 2026'

export function FoodAllergenNotice() {
  return (
    <section className="content-page legal-page">
      <h1>Food & Allergen Notice</h1>
      <p><strong>Last updated:</strong> {updated}</p>

      <h2>Important Safety Information</h2>
      <p>
        Baked goods may contain or come into contact with common allergens, including milk, eggs,
        wheat, soy, peanuts, tree nuts, and other ingredients.
      </p>

      <h2>Cross-Contact Risk</h2>
      <p>
        Products may be prepared in shared environments and cross-contact can occur, even when an
        ingredient is not intentionally added.
      </p>

      <h2>Customer Responsibility</h2>
      <p>
        If you or your recipient has food allergies or dietary restrictions, please contact us
        before ordering to discuss ingredients and preparation practices.
      </p>

      <h2>No Medical Guarantee</h2>
      <p>
        This notice is for informational purposes and does not replace professional medical advice.
      </p>
    </section>
  )
}
