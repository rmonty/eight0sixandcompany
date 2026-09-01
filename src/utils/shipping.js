export const DEFAULT_SHIPPING_SETTINGS = {
  defaultShippingRate: 8,
  freeShippingMinimum: 75,
  localDeliveryFee: 12,
  pickupFee: 0,
  mileageRate: 0.7,
  useMileageDelivery: false,
  deliveryOrigin: {
    street: '',
    city: '',
    state: '',
    zip: '',
  },
}

export function normalizeShippingSettings(settings = {}) {
  const shipping = settings.shipping || settings
  return {
    defaultShippingRate: Math.max(0, Number(shipping.defaultShippingRate ?? DEFAULT_SHIPPING_SETTINGS.defaultShippingRate)),
    freeShippingMinimum: Math.max(0, Number(shipping.freeShippingMinimum ?? DEFAULT_SHIPPING_SETTINGS.freeShippingMinimum)),
    localDeliveryFee: Math.max(0, Number(shipping.localDeliveryFee ?? DEFAULT_SHIPPING_SETTINGS.localDeliveryFee)),
    pickupFee: Math.max(0, Number(shipping.pickupFee ?? DEFAULT_SHIPPING_SETTINGS.pickupFee)),
    mileageRate: Math.max(0, Number(shipping.mileageRate ?? DEFAULT_SHIPPING_SETTINGS.mileageRate)),
    useMileageDelivery: Boolean(shipping.useMileageDelivery),
    deliveryOrigin: {
      street: String(shipping.deliveryOrigin?.street || '').trim(),
      city: String(shipping.deliveryOrigin?.city || '').trim(),
      state: String(shipping.deliveryOrigin?.state || '').trim(),
      zip: String(shipping.deliveryOrigin?.zip || '').trim(),
    },
  }
}

export function normalizeItemShipping(item = {}) {
  return {
    shippable: item.shippable !== false,
    localOnly: Boolean(item.localOnly),
    shippingSurcharge: Math.max(0, Number(item.shippingSurcharge || 0)),
    requiresNeedByDate: Boolean(item.requiresNeedByDate),
    quantity: Math.max(1, Number(item.quantity || 1)),
  }
}

export function canFulfillWithShipping(items, fulfillmentMethod) {
  if (fulfillmentMethod !== 'ship') return true
  return !items.some((item) => {
    const normalized = normalizeItemShipping(item)
    return normalized.localOnly || !normalized.shippable
  })
}

export function getFulfillmentValidationError(items, fulfillmentMethod) {
  if (fulfillmentMethod !== 'ship') return null

  const blocked = items.filter((item) => {
    const normalized = normalizeItemShipping(item)
    return normalized.localOnly || !normalized.shippable
  })

  if (blocked.length === 0) return null

  const names = blocked.map((item) => item.name).join(', ')
  return `These items cannot be shipped: ${names}. Choose Local Delivery or Pickup instead.`
}

export function getNeedByDateValidationError(items) {
  const missing = items.filter((item) => {
    if (item.scheduledAt) return false
    const normalized = normalizeItemShipping(item)
    return normalized.requiresNeedByDate && !String(item.needByDate || '').trim()
  })

  if (missing.length === 0) return null
  return `Please choose a need-by date for: ${missing.map((item) => item.name).join(', ')}.`
}

export function mergeItemShippingFields(item = {}, product = {}) {
  const bookingEnabled = Boolean(product.booking?.enabled)
  return {
    ...item,
    shippable: bookingEnabled ? false : product.shippable !== false,
    localOnly: bookingEnabled ? true : Boolean(product.localOnly),
    shippingSurcharge: Math.max(0, Number(product.shippingSurcharge || 0)),
    requiresNeedByDate: bookingEnabled ? false : Boolean(product.requiresNeedByDate),
    scheduledAt: item.scheduledAt || null,
    scheduledEndAt: item.scheduledEndAt || null,
    scheduledLabel: item.scheduledLabel || '',
  }
}

export function calculateShipping(
  items,
  fulfillmentMethod,
  settings,
  subtotalAfterDiscount = 0,
  deliveryQuote = null,
) {
  const shippingSettings = normalizeShippingSettings(settings)

  if (fulfillmentMethod === 'pickup') {
    return Number(shippingSettings.pickupFee.toFixed(2))
  }

  if (fulfillmentMethod === 'delivery') {
    if (deliveryQuote && Number.isFinite(Number(deliveryQuote.fee))) {
      return Number(Number(deliveryQuote.fee).toFixed(2))
    }
    return Number(shippingSettings.localDeliveryFee.toFixed(2))
  }

  const surcharges = items.reduce((sum, item) => {
    const normalized = normalizeItemShipping(item)
    if (normalized.localOnly || !normalized.shippable) return sum
    return sum + normalized.shippingSurcharge * normalized.quantity
  }, 0)

  let baseRate = shippingSettings.defaultShippingRate
  if (shippingSettings.freeShippingMinimum > 0 && subtotalAfterDiscount >= shippingSettings.freeShippingMinimum) {
    baseRate = 0
  }

  return Number((baseRate + surcharges).toFixed(2))
}

export function calculateOrderTotals({
  items,
  fulfillmentMethod,
  settings,
  discountPercent = 0,
  deliveryQuote = null,
  giftCardBalance = 0,
}) {
  const subtotal = Number(
    items.reduce((sum, item) => sum + Number(item.quantity || 1) * Number(item.price || 0), 0).toFixed(2),
  )
  const normalizedDiscount = Math.min(100, Math.max(0, Number(discountPercent || 0)))
  const discountAmount = Number((subtotal * (normalizedDiscount / 100)).toFixed(2))
  const subtotalAfterDiscount = Number(Math.max(0, subtotal - discountAmount).toFixed(2))
  const shipping = calculateShipping(
    items,
    fulfillmentMethod,
    settings,
    subtotalAfterDiscount,
    deliveryQuote,
  )
  const totalBeforeGiftCard = Number((subtotalAfterDiscount + shipping).toFixed(2))
  const availableGiftCard = Math.max(0, Number(giftCardBalance || 0))
  const giftCardAmount = Number(Math.min(availableGiftCard, totalBeforeGiftCard).toFixed(2))
  const total = Number(Math.max(0, totalBeforeGiftCard - giftCardAmount).toFixed(2))

  return {
    subtotal,
    discountAmount,
    subtotalAfterDiscount,
    shipping,
    totalBeforeGiftCard,
    giftCardAmount,
    total,
    fulfillmentError: getFulfillmentValidationError(items, fulfillmentMethod),
    needByDateError: getNeedByDateValidationError(items),
    canShip: canFulfillWithShipping(items, 'ship'),
  }
}
