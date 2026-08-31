import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'

const callable = (name) => {
  if (!functions) return null
  return httpsCallable(functions, name)
}

/**
 * Send order confirmation (to customer) + new-order alert (to owner).
 * Called from Checkout.jsx after the order document is created.
 */
export const sendOrderEmails = async ({ orderId, customer, items, total, paymentMethod, fulfillmentMethod = 'ship', noteToSeller = '' }) => {
  const fn = callable('sendOrderEmails')
  if (!fn) return { sent: false, reason: 'missing-config' }

  await fn({ orderId, customer, items, total, paymentMethod, fulfillmentMethod, noteToSeller })
  return { sent: true }
}

/**
 * Send shipping notification to the customer.
 * Called from Admin.jsx when an order status changes to "Shipped".
 */
export const sendShippingEmail = async ({ orderId, customer, shippingMessage, trackingNumber = '' }) => {
  if (!customer?.email) return { sent: false, reason: 'missing-customer-email' }

  const fn = callable('sendShippingEmail')
  if (!fn) return { sent: false, reason: 'missing-config' }

  await fn({ orderId, customer, shippingMessage, trackingNumber })
  return { sent: true }
}

/**
 * Send delivered or picked-up notification to the customer.
 */
export const sendFulfillmentStatusEmail = async ({ orderId, customer, status, message = '' }) => {
  if (!customer?.email) return { sent: false, reason: 'missing-customer-email' }

  const fn = callable('sendFulfillmentStatusEmail')
  if (!fn) return { sent: false, reason: 'missing-config' }

  await fn({ orderId, customer, status, message })
  return { sent: true }
}

// Legacy exports — kept so existing import checks don't break
export const hasEmailConfig = Boolean(functions)
export const hasShippingEmailConfig = Boolean(functions)

