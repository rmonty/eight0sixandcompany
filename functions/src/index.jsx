import { onCall, HttpsError, onRequest } from 'firebase-functions/v2/https'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { defineSecret, defineString } from 'firebase-functions/params'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAppCheck } from 'firebase-admin/app-check'
import { render } from '@react-email/render'
import { Resend } from 'resend'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { ContactInquiryEmail } from './emails/ContactInquiry.jsx'
import { OrderConfirmationEmail } from './emails/OrderConfirmation.jsx'
import { OwnerNewOrderEmail } from './emails/OwnerNewOrder.jsx'
import { ShippingNotificationEmail } from './emails/ShippingNotification.jsx'
import { FulfillmentCompleteEmail } from './emails/FulfillmentCompleteEmail.jsx'
import { calculateOrderTotals, DEFAULT_SHIPPING_SETTINGS, getFulfillmentValidationError, getNeedByDateValidationError, mergeItemShippingFields, normalizeShippingSettings } from './shipping.js'
import { calculateMileageDeliveryFee, quoteDeliveryMiles } from './delivery.js'
import { getCouponScheduleError } from './couponValidity.js'
import { getGiftCardAvailabilityError, normalizeGiftCardCode, normalizeMoney } from './giftCards.js'
import { archiveNotionPage, getNotionPage, pushOrderToNotion, readRichTextProperty, readSelectProperty, updateNotionPage } from './notion.js'

const resendApiKey = defineSecret('RESEND_API_KEY')
const ga4ClientId = defineSecret('GA4_CLIENT_ID')
const ga4ClientSecret = defineSecret('GA4_CLIENT_SECRET')
const ga4RefreshToken = defineSecret('GA4_REFRESH_TOKEN')
const ga4PropertyId = defineSecret('GA4_PROPERTY_ID')
const notionApiKey = defineSecret('NOTION_API_KEY')
const notionWebhookSecret = defineSecret('NOTION_WEBHOOK_SECRET')
const ownerEmailParam = defineString('OWNER_EMAIL', {
  default: 'orders@806andcompany.com',
  description: 'Primary owner email used for contact and order notifications.',
})
const adminEmailsParam = defineString('ADMIN_EMAILS', {
  default: '',
  description: 'Comma-separated admin allowlist (lowercase emails).',
})
const resendFromEmail = defineString('RESEND_FROM_EMAIL', {
  default: 'orders@806andcompany.com',
  description:
    'Verified sender address in Resend. Must be an @806andcompany.com address once ' +
    'the domain is verified. Use onboarding@resend.dev only for initial testing.',
})

// Initialize Firebase Admin SDK once
if (!getApps().length) initializeApp()

const MAX_TEXT = {
  short: 120,
  medium: 400,
  long: 3000,
}

const sanitizeText = (value, maxLength = MAX_TEXT.medium) =>
  String(value ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, maxLength)

const normalizeCouponCode = (value) =>
  String(value ?? '')
    .trim()
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()

const withTimeout = async (promise, ms, message) => {
  let timer
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? '').trim())

const getAdminEmails = () =>
  adminEmailsParam
    .value()
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)

const isAdminRequest = (request) => {
  const auth = request.auth
  if (!auth) return false
  if (auth.token?.admin === true) return true
  const email = String(auth.token?.email || '').toLowerCase()
  return Boolean(email && getAdminEmails().includes(email))
}

const getClientIp = (request) => {
  const raw = request?.rawRequest?.headers?.['x-forwarded-for'] || request?.rawRequest?.ip || ''
  const first = Array.isArray(raw) ? raw[0] : String(raw).split(',')[0]
  return String(first || 'unknown').trim().slice(0, 64)
}

/**
 * Verify App Check token if present.
 * Set ENFORCE_APP_CHECK=true in Firebase params to reject unverified requests.
 * Currently in logging-only mode — uncomment the throw below to enable enforcement.
 */
const ENFORCE_APP_CHECK = false // Change to true once App Check is registered in Firebase console

const verifyAppCheck = async (request) => {
  try {
    const appCheckToken = request?.app
    if (appCheckToken) {
      await getAppCheck().verifyToken(appCheckToken)
    } else if (ENFORCE_APP_CHECK) {
      throw new HttpsError('failed-precondition', 'Missing App Check token. Verify you are using the official app.')
    }
  } catch (err) {
    if (err instanceof HttpsError) throw err
    console.warn('App Check verification failed:', err?.message || err)
    if (ENFORCE_APP_CHECK) {
      throw new HttpsError('failed-precondition', 'App Check verification failed.')
    }
  }
}

const incrementRateCounter = async ({ db, key, scope, ip, limit, windowStart, now, ttlMs }) => {
  const ref = db.collection('securityRateLimits').doc(key)

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const count = Number(snap.data()?.count || 0)
    if (count >= limit) {
      throw new HttpsError('resource-exhausted', 'Too many requests. Please try again shortly.')
    }
    tx.set(
      ref,
      {
        scope,
        ip,
        count: count + 1,
        windowStart,
        updatedAt: now,
        expireAt: now + ttlMs,
      },
      { merge: true },
    )
  })
}

const enforceRateLimit = async ({ request, scope, hourlyLimit, dailyLimit }) => {
  const db = getFirestore()
  const ip = getClientIp(request)
  const now = Date.now()
  const HOUR_MS = 60 * 60 * 1000
  const DAY_MS = 24 * 60 * 60 * 1000

  // Hourly window
  if (hourlyLimit) {
    const hourlyWindowStart = now - (now % HOUR_MS)
    const key = `${scope}:${ip}:hourly:${hourlyWindowStart}`
    await incrementRateCounter({
      db,
      key,
      scope,
      ip,
      limit: hourlyLimit,
      windowStart: hourlyWindowStart,
      now,
      ttlMs: 2 * HOUR_MS,
    })
  }

  // Daily window
  if (dailyLimit) {
    const dailyWindowStart = now - (now % DAY_MS)
    const key = `${scope}:${ip}:daily:${dailyWindowStart}`
    await incrementRateCounter({
      db,
      key,
      scope,
      ip,
      limit: dailyLimit,
      windowStart: dailyWindowStart,
      now,
      ttlMs: 26 * HOUR_MS,
    })
  }
}

const buildOrderEmailHtml = async ({
  orderId,
  customer,
  items,
  subtotal,
  discount,
  giftCard,
  shipping,
  total,
  paymentMethod,
  fulfillmentMethod,
  noteToSeller,
  deliveryDetails,
}) => {
  return Promise.all([
    render(
      <OrderConfirmationEmail
        orderId={orderId}
        customerName={customer.name}
        items={items}
        subtotal={subtotal}
        discount={discount}
        giftCard={giftCard}
        shipping={shipping}
        total={total}
        paymentMethod={paymentMethod}
        fulfillmentMethod={fulfillmentMethod}
        noteToSeller={noteToSeller}
        deliveryDetails={deliveryDetails}
      />,
    ),
    render(
      <OwnerNewOrderEmail
        orderId={orderId}
        customerName={customer.name}
        customerEmail={customer.email}
        customerPhone={customer.phone ?? ''}
        customerAddress={
          customer.address
            ? `${customer.address.street}, ${customer.address.city}, ${customer.address.state} ${customer.address.zip}`
            : ''
        }
        items={items}
        subtotal={subtotal}
        discount={discount}
        giftCard={giftCard}
        shipping={shipping}
        total={total}
        paymentMethod={paymentMethod}
        fulfillmentMethod={fulfillmentMethod}
        noteToSeller={noteToSeller}
        deliveryDetails={deliveryDetails}
      />,
    ),
  ])
}

const buildDeliveryQuote = async (storeSettings, destinationAddress) => {
  const shippingSettings = normalizeShippingSettings(storeSettings)

  if (!shippingSettings.useMileageDelivery) {
    return {
      fee: shippingSettings.localDeliveryFee,
      miles: 0,
      usedMileage: false,
    }
  }

  const origin = shippingSettings.deliveryOrigin
  const hasOrigin = origin.street && origin.city && origin.state && origin.zip
  if (!hasOrigin) {
    return {
      fee: shippingSettings.localDeliveryFee,
      miles: 0,
      usedMileage: false,
    }
  }

  try {
    const miles = await quoteDeliveryMiles(origin, destinationAddress)
    if (!miles) {
      return {
        fee: shippingSettings.localDeliveryFee,
        miles: 0,
        usedMileage: false,
      }
    }

    const fee = calculateMileageDeliveryFee({
      miles,
      mileageRate: shippingSettings.mileageRate,
      minimumFee: shippingSettings.localDeliveryFee,
    })

    return {
      fee,
      miles,
      usedMileage: true,
    }
  } catch (error) {
    console.warn('Delivery quote failed; using minimum fee.', error)
    return {
      fee: shippingSettings.localDeliveryFee,
      miles: 0,
      usedMileage: false,
    }
  }
}

export const sendContactInquiry = onCall(
  { secrets: ['RESEND_API_KEY'], invoker: 'public' },
  async (request) => {
    await enforceRateLimit({ request, scope: 'contact', hourlyLimit: 8, dailyLimit: 20 })
    await verifyAppCheck(request)

    const { fromName, fromEmail, inquiryType, dateNeeded, howFound, message } = request.data ?? {}
    const safeFromName = sanitizeText(fromName, MAX_TEXT.short)
    const safeFromEmail = sanitizeText(fromEmail, MAX_TEXT.short).toLowerCase()
    const safeMessage = sanitizeText(message, MAX_TEXT.long)
    const safeInquiryType = sanitizeText(inquiryType || 'General', MAX_TEXT.short)
    const safeDateNeeded = sanitizeText(dateNeeded || 'Not specified', MAX_TEXT.short)
    const safeHowFound = sanitizeText(howFound || 'Not specified', MAX_TEXT.short)

    // Validate required fields
    if (!safeFromName || !safeFromEmail || !safeMessage) {
      throw new HttpsError(
        'invalid-argument',
        'Name, email, and message are required.',
      )
    }

    // Basic email format check (defence-in-depth; client already validates)
    if (!isValidEmail(safeFromEmail)) {
      throw new HttpsError('invalid-argument', 'Invalid email address.')
    }

    const resend = new Resend(resendApiKey.value())

    const html = await render(
      <ContactInquiryEmail
        fromName={safeFromName}
        fromEmail={safeFromEmail}
        inquiryType={safeInquiryType}
        dateNeeded={safeDateNeeded}
        howFound={safeHowFound}
        message={safeMessage}
      />,
    )

    const { error } = await resend.emails.send({
      from: `806 & CO. <${resendFromEmail.value()}>`,
      to: [ownerEmailParam.value()],
      replyTo: safeFromEmail,
      subject: `New inquiry from ${safeFromName} — ${safeInquiryType}`,
      html,
    })

    if (error) {
      console.error('Resend error:', error)
      throw new HttpsError('internal', 'Failed to send email.')
    }

    return { sent: true }
  },
)

/* ────────────────────────────────────────────────────────────────
   sendOrderEmails — called at checkout
   Sends order confirmation to customer + new-order alert to owner.
   ──────────────────────────────────────────────────────────────── */
export const sendOrderEmails = onCall(
  { secrets: ['RESEND_API_KEY'], invoker: 'public' },
  async (request) => {
    if (!isAdminRequest(request)) {
      throw new HttpsError('permission-denied', 'Admin access required.')
    }

    const {
      orderId,
      customer,
      items,
      subtotal,
      discount,
      shipping,
      total,
      paymentMethod,
      fulfillmentMethod = 'ship',
      noteToSeller = '',
    } = request.data ?? {}

    if (!orderId || !customer?.email || !items?.length) {
      throw new HttpsError('invalid-argument', 'orderId, customer.email, and items are required.')
    }

    const resend = new Resend(resendApiKey.value())
    const fromAddr = `806 & CO. <${resendFromEmail.value()}>`
    const [confirmationHtml, ownerHtml] = await buildOrderEmailHtml({
      orderId,
      customer,
      items,
      subtotal,
      discount,
      shipping,
      total,
      paymentMethod,
      fulfillmentMethod,
      noteToSeller,
    })

    const results = await Promise.allSettled([
      resend.emails.send({
        from: fromAddr,
        to: [customer.email],
        subject: `Your 806 & CO. order is confirmed! (#${orderId})`,
        html: confirmationHtml,
      }),
      resend.emails.send({
        from: fromAddr,
        to: [ownerEmailParam.value()],
        replyTo: customer.email,
        subject: `New order from ${customer.name} (#${orderId})`,
        html: ownerHtml,
      }),
    ])

    const failed = results.filter((r) => r.status === 'rejected' || r.value?.error)
    if (failed.length === results.length) {
      throw new HttpsError('internal', 'Failed to send order emails.')
    }

    return { sent: true }
  },
)

/* ────────────────────────────────────────────────────────────────
   sendShippingEmail — called from Admin when order → Shipped
   ──────────────────────────────────────────────────────────────── */
export const sendShippingEmail = onCall(
  { secrets: ['RESEND_API_KEY'], invoker: 'public' },
  async (request) => {
    if (!isAdminRequest(request)) {
      throw new HttpsError('permission-denied', 'Admin access required.')
    }

    const {
      orderId,
      customer,
      shippingMessage = "Your order is on its way! I'll be in touch if you need anything.",
      trackingNumber = '',
    } = request.data ?? {}

    if (!orderId || !customer?.email) {
      throw new HttpsError('invalid-argument', 'orderId and customer.email are required.')
    }

    const db = getFirestore()
    const orderSnap = await db.collection('orders').doc(orderId).get()
    const orderData = orderSnap.exists ? orderSnap.data() || {} : {}
    const trackingFromOrder = String(orderData.trackingNumber || '').trim()
    const trackingFromRequest = String(trackingNumber || '').trim()
    const safeTrackingNumber = sanitizeText(trackingFromRequest || trackingFromOrder, MAX_TEXT.medium)

    const resend = new Resend(resendApiKey.value())

    const html = await render(
      <ShippingNotificationEmail
        orderId={orderId}
        customerName={customer.name ?? 'there'}
        shippingMessage={shippingMessage}
        trackingNumber={safeTrackingNumber}
      />,
    )

    const subject = safeTrackingNumber
      ? `Your 806 & CO. order is on its way! Tracking: ${safeTrackingNumber} (#${orderId})`
      : `Your 806 & CO. order is on its way! (#${orderId})`

    const { error } = await resend.emails.send({
      from: `806 & CO. <${resendFromEmail.value()}>`,
      to: [customer.email],
      subject,
      html,
    })

    if (error) {
      console.error('Resend shipping error:', error)
      throw new HttpsError('internal', 'Failed to send shipping email.')
    }

    return { sent: true }
  },
)

/* ────────────────────────────────────────────────────────────────
   sendFulfillmentStatusEmail — Delivered / Picked Up notifications
   ──────────────────────────────────────────────────────────────── */
export const sendFulfillmentStatusEmail = onCall(
  { secrets: ['RESEND_API_KEY'], invoker: 'public' },
  async (request) => {
    if (!isAdminRequest(request)) {
      throw new HttpsError('permission-denied', 'Admin access required.')
    }

    const {
      orderId,
      customer,
      status,
      message = '',
    } = request.data ?? {}

    if (!orderId || !customer?.email) {
      throw new HttpsError('invalid-argument', 'orderId and customer.email are required.')
    }

    if (status !== 'Delivered' && status !== 'Picked Up') {
      throw new HttpsError('invalid-argument', 'status must be Delivered or Picked Up.')
    }

    const safeMessage = sanitizeText(message, MAX_TEXT.long)
    const isDelivered = status === 'Delivered'
    const resend = new Resend(resendApiKey.value())

    const html = await render(
      <FulfillmentCompleteEmail
        orderId={orderId}
        customerName={customer.name ?? 'there'}
        status={status}
        message={safeMessage}
      />,
    )

    const subject = isDelivered
      ? `Your 806 & CO. order has been delivered! (#${orderId})`
      : `Your 806 & CO. order has been picked up! (#${orderId})`

    const { error } = await resend.emails.send({
      from: `806 & CO. <${resendFromEmail.value()}>`,
      to: [customer.email],
      subject,
      html,
    })

    if (error) {
      console.error('Resend fulfillment status error:', error)
      throw new HttpsError('internal', 'Failed to send fulfillment status email.')
    }

    return { sent: true }
  },
)

export const quoteDeliveryFee = onCall({ invoker: 'public' }, async (request) => {
  const destinationAddress = request.data?.destinationAddress ?? {}
  const db = getFirestore()
  const settingsSnap = await db.collection('settings').doc('store').get()
  const rawSettings = settingsSnap.exists ? settingsSnap.data() || {} : {}
  const storeSettings = {
    ...rawSettings,
    shipping: {
      ...DEFAULT_SHIPPING_SETTINGS,
      ...(rawSettings.shipping || {}),
      deliveryOrigin: {
        ...DEFAULT_SHIPPING_SETTINGS.deliveryOrigin,
        ...(rawSettings.shipping?.deliveryOrigin || {}),
      },
    },
  }

  const quote = await buildDeliveryQuote(storeSettings, {
    street: sanitizeText(destinationAddress.street, MAX_TEXT.medium),
    city: sanitizeText(destinationAddress.city, MAX_TEXT.short),
    state: sanitizeText(destinationAddress.state, MAX_TEXT.short),
    zip: sanitizeText(destinationAddress.zip, MAX_TEXT.short),
  })

  return quote
})

/* ────────────────────────────────────────────────────────────────
   getAnalyticsSummary — returns lightweight GA4 summary for Admin
   ──────────────────────────────────────────────────────────────── */
export const getAnalyticsSummary = onCall(
  {
    secrets: ['GA4_CLIENT_ID', 'GA4_CLIENT_SECRET', 'GA4_REFRESH_TOKEN', 'GA4_PROPERTY_ID'],
    invoker: 'public',
  },
  async (request) => {
    if (!request.auth || !isAdminRequest(request)) {
      throw new HttpsError('permission-denied', 'Admin access required.')
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: ga4ClientId.value(),
        client_secret: ga4ClientSecret.value(),
        refresh_token: ga4RefreshToken.value(),
        grant_type: 'refresh_token',
      }),
    })

    if (!tokenRes.ok) {
      const detail = await tokenRes.text()
      console.error('GA token exchange failed:', detail)
      throw new HttpsError('internal', 'Unable to authenticate with Google Analytics.')
    }

    const { access_token: accessToken } = await tokenRes.json()
    const propertyPath = `properties/${ga4PropertyId.value()}`

    const summaryRes = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/${propertyPath}:runReport`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
          metrics: [
            { name: 'activeUsers' },
            { name: 'newUsers' },
            { name: 'averageSessionDuration' },
            { name: 'screenPageViews' },
          ],
        }),
      },
    )

    if (!summaryRes.ok) {
      const detail = await summaryRes.text()
      console.error('GA summary report failed:', detail)
      throw new HttpsError('internal', 'Unable to fetch analytics summary.')
    }

    const summaryJson = await summaryRes.json()
    const metricValues = summaryJson?.rows?.[0]?.metricValues || []
    const activeUsers = Number(metricValues[0]?.value || 0)
    const newUsers = Number(metricValues[1]?.value || 0)
    const avgSessionDurationSeconds = Number(metricValues[2]?.value || 0)
    const pageViews = Number(metricValues[3]?.value || 0)

    const countriesRes = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/${propertyPath}:runReport`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
          dimensions: [{ name: 'country' }],
          metrics: [{ name: 'activeUsers' }],
          orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
          limit: 5,
        }),
      },
    )

    if (!countriesRes.ok) {
      const detail = await countriesRes.text()
      console.error('GA countries report failed:', detail)
      throw new HttpsError('internal', 'Unable to fetch country analytics.')
    }

    const countriesJson = await countriesRes.json()
    const topCountries = (countriesJson?.rows || []).map((row) => ({
      country: row.dimensionValues?.[0]?.value || 'Unknown',
      users: Number(row.metricValues?.[0]?.value || 0),
    }))

    return {
      activeUsers30d: activeUsers,
      newUsers30d: newUsers,
      returningUsers30d: Math.max(activeUsers - newUsers, 0),
      pageViews30d: pageViews,
      avgSessionDurationSeconds,
      topCountries,
      fetchedAt: new Date().toISOString(),
    }
  },
)

/* ────────────────────────────────────────────────────────────────
   claimGuestOrders — links past guest orders to a user account.
   Called after sign-in or account creation. Finds all orders
   placed with the user's email while userId was empty, and stamps
   them with the authenticated user's UID so they appear on the
   Account dashboard.
   ──────────────────────────────────────────────────────────────── */
export const claimGuestOrders = onCall(
  { invoker: 'public' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.')
    }

    const { uid, token } = request.auth
    const email = String(token.email || '').trim().toLowerCase()

    if (!email) {
      throw new HttpsError('invalid-argument', 'Authenticated user must have a verified email.')
    }

    const db = getFirestore()
    // Match by email only, then claim any order not already linked to an account.
    // (Avoids missing docs where userId is missing vs empty string.)
    const snapshot = await db
      .collection('orders')
      .where('customer.email', '==', email)
      .get()

    const toClaim = snapshot.docs.filter((docSnap) => {
      const existingUid = docSnap.data()?.userId
      return !existingUid
    })

    if (toClaim.length === 0) return { claimed: 0 }

    const batch = db.batch()
    toClaim.forEach((docSnap) => {
      batch.update(docSnap.ref, { userId: uid })
    })
    await batch.commit()

    return { claimed: toClaim.length }
  },
)

export const createOrderSecure = onCall(
  { secrets: ['RESEND_API_KEY'], invoker: 'public' },
  async (request) => {
    await verifyAppCheck(request)
    await enforceRateLimit({ request, scope: 'checkout', hourlyLimit: 10, dailyLimit: 30 })

    const data = request.data ?? {}
    const customer = data.customer ?? {}
    const address = customer.address ?? {}
    const rawItems = Array.isArray(data.items) ? data.items : []

    if (rawItems.length === 0 || rawItems.length > 50) {
      throw new HttpsError('invalid-argument', 'Order must include at least one item.')
    }

    const fulfillmentMethod = sanitizeText(data.fulfillmentMethod || 'ship', MAX_TEXT.short)
    if (!['ship', 'delivery', 'pickup'].includes(fulfillmentMethod)) {
      throw new HttpsError('invalid-argument', 'Invalid fulfillment method.')
    }

    const safeCustomer = {
      name: sanitizeText(customer.name, MAX_TEXT.short),
      email: sanitizeText(customer.email, MAX_TEXT.short).toLowerCase(),
      phone: sanitizeText(customer.phone, MAX_TEXT.short),
      address: {
        street: sanitizeText(address.street, MAX_TEXT.medium),
        city: sanitizeText(address.city, MAX_TEXT.short),
        state: sanitizeText(address.state, MAX_TEXT.short),
        zip: sanitizeText(address.zip, MAX_TEXT.short),
      },
    }

    if (!safeCustomer.name || !safeCustomer.phone || !isValidEmail(safeCustomer.email)) {
      throw new HttpsError('invalid-argument', 'Valid customer name, email, and phone are required.')
    }

    if (
      fulfillmentMethod !== 'pickup' &&
      (!safeCustomer.address.street || !safeCustomer.address.city || !safeCustomer.address.state || !safeCustomer.address.zip)
    ) {
      throw new HttpsError('invalid-argument', 'A full shipping address is required for this fulfillment method.')
    }

    const safeItems = rawItems.map((item) => ({
      productId: sanitizeText(item.productId, MAX_TEXT.short),
      cartKey: sanitizeText(item.cartKey || item.productId, MAX_TEXT.medium),
      name: sanitizeText(item.name, MAX_TEXT.medium),
      quantity: Math.max(1, Math.min(99, Number(item.quantity || 1))),
      price: Number(item.price || 0),
      basePrice: Number(item.basePrice || 0),
      addOns: Array.isArray(item.addOns) ? item.addOns.slice(0, 20) : [],
      selectedVariants: item.selectedVariants && typeof item.selectedVariants === 'object' ? item.selectedVariants : {},
      image: sanitizeText(item.image || '', MAX_TEXT.long),
      needByDate: sanitizeText(item.needByDate || '', MAX_TEXT.short),
    }))

    if (safeItems.some((item) => !item.productId || !item.name || !Number.isFinite(item.price) || item.price < 0)) {
      throw new HttpsError('invalid-argument', 'Order items are invalid.')
    }

    const db = getFirestore()
    const productIds = [...new Set(safeItems.map((item) => item.productId).filter(Boolean))]
    const productSnaps = productIds.length
      ? await db.getAll(...productIds.map((id) => db.collection('products').doc(id)))
      : []
    const productById = new Map(
      productSnaps.filter((snap) => snap.exists).map((snap) => [snap.id, snap.data() || {}]),
    )

    const itemsForShipping = safeItems.map((item) =>
      mergeItemShippingFields(item, productById.get(item.productId) || {}),
    )

    const fulfillmentError = getFulfillmentValidationError(itemsForShipping, fulfillmentMethod)
    if (fulfillmentError) {
      throw new HttpsError('invalid-argument', fulfillmentError)
    }

    const needByDateError = getNeedByDateValidationError(itemsForShipping)
    if (needByDateError) {
      throw new HttpsError('invalid-argument', needByDateError)
    }

    if (fulfillmentMethod === 'delivery') {
      const deliveryDetails = data.deliveryDetails ?? {}
      if (!sanitizeText(deliveryDetails.location, MAX_TEXT.medium) || !sanitizeText(deliveryDetails.availability, MAX_TEXT.medium)) {
        throw new HttpsError('invalid-argument', 'Delivery location and availability are required for local delivery.')
      }
    }

    const settingsSnap = await db.collection('settings').doc('store').get()
    const rawSettings = settingsSnap.exists ? settingsSnap.data() || {} : {}
    const storeSettings = {
      ...rawSettings,
      shipping: {
        ...DEFAULT_SHIPPING_SETTINGS,
        ...(rawSettings.shipping || {}),
        deliveryOrigin: {
          ...DEFAULT_SHIPPING_SETTINGS.deliveryOrigin,
          ...(rawSettings.shipping?.deliveryOrigin || {}),
        },
      },
    }

    const requestedCouponCode = normalizeCouponCode(data.discount?.code || data.couponCode || '')
    let discountCode = ''
    let discountPercent = 0

    if (requestedCouponCode) {
      const couponSnapshot = await db
        .collection('coupons')
        .where('normalizedCode', '==', requestedCouponCode)
        .where('active', '==', true)
        .limit(1)
        .get()

      if (couponSnapshot.empty) {
        throw new HttpsError('invalid-argument', 'Coupon code is invalid or inactive.')
      }

      const couponData = couponSnapshot.docs[0].data() || {}
      const parsedPercent = Number(couponData.discountPercent || 0)
      discountPercent = Math.min(100, Math.max(0, Number(parsedPercent.toFixed(2))))
      if (!Number.isFinite(discountPercent) || discountPercent <= 0) {
        throw new HttpsError('invalid-argument', 'Coupon code is invalid or inactive.')
      }

      const now = new Date()
      const scheduleError = getCouponScheduleError(couponData, now)
      if (scheduleError) {
        throw new HttpsError('invalid-argument', scheduleError)
      }

      discountCode = requestedCouponCode
    }

    const deliveryQuote = fulfillmentMethod === 'delivery'
      ? await buildDeliveryQuote(storeSettings, safeCustomer.address)
      : null

    const requestedGiftCardCode = normalizeGiftCardCode(
      data.giftCard?.code || data.giftCard?.normalizedCode || data.giftCardCode || '',
    )
    let giftCardRef = null
    let giftCardPreview = null

    if (requestedGiftCardCode) {
      const giftCardSnapshot = await db
        .collection('giftCards')
        .where('normalizedCode', '==', requestedGiftCardCode)
        .limit(1)
        .get()

      if (giftCardSnapshot.empty) {
        throw new HttpsError('invalid-argument', 'Gift card code is invalid.')
      }

      giftCardRef = giftCardSnapshot.docs[0].ref
      giftCardPreview = giftCardSnapshot.docs[0].data() || {}
      const availabilityError = getGiftCardAvailabilityError(giftCardPreview)
      if (availabilityError) {
        throw new HttpsError('invalid-argument', availabilityError)
      }
    }

    const orderTotals = calculateOrderTotals({
      items: itemsForShipping,
      fulfillmentMethod,
      settings: storeSettings,
      discountPercent,
      deliveryQuote,
      giftCardBalance: giftCardPreview ? normalizeMoney(giftCardPreview.remainingBalance) : 0,
    })
    const computedSubtotalFromTotals = orderTotals.subtotal
    const computedDiscountAmount = orderTotals.discountAmount
    const computedShipping = orderTotals.shipping
    let computedGiftCardAmount = orderTotals.giftCardAmount
    let computedTotal = orderTotals.total
    const totalBeforeGiftCard = orderTotals.totalBeforeGiftCard

    const providedShipping = Number(data.shipping)
    const providedTotal = Number(data.total)
    const shippingMismatch = Number.isFinite(providedShipping) && Math.abs(providedShipping - computedShipping) > 0.01
    const totalMismatch = Number.isFinite(providedTotal) && Math.abs(providedTotal - computedTotal) > 0.01

    if (shippingMismatch || totalMismatch) {
      console.warn('Client order totals differed from server quote; using server values.', {
        providedShipping,
        computedShipping,
        providedTotal,
        computedTotal,
        fulfillmentMethod,
      })
    }

    const noteImages = Array.isArray(data.noteImages)
      ? data.noteImages
          .map((url) => sanitizeText(url, MAX_TEXT.long))
          .filter(Boolean)
          .slice(0, 8)
      : []

    const safeDeliveryDetails =
      fulfillmentMethod === 'delivery'
        ? {
            location: sanitizeText(data.deliveryDetails?.location, MAX_TEXT.medium),
            availability: sanitizeText(data.deliveryDetails?.availability, MAX_TEXT.medium),
          }
        : null

    let resolvedPaymentMethod = sanitizeText(data.paymentMethod || 'contact', MAX_TEXT.short)
    if (computedTotal <= 0.009 && computedGiftCardAmount > 0) {
      resolvedPaymentMethod = 'giftcard'
    }

    const orderRef = db.collection('orders').doc()
    let giftCardOnOrder = null

    await db.runTransaction(async (tx) => {
      let giftCardAmount = 0
      let giftCardPayload = null

      if (giftCardRef) {
        const liveSnap = await tx.get(giftCardRef)
        if (!liveSnap.exists) {
          throw new HttpsError('invalid-argument', 'Gift card code is invalid.')
        }
        const liveData = liveSnap.data() || {}
        const availabilityError = getGiftCardAvailabilityError(liveData)
        if (availabilityError) {
          throw new HttpsError('invalid-argument', availabilityError)
        }

        const remaining = normalizeMoney(liveData.remainingBalance)
        giftCardAmount = Number(Math.min(remaining, totalBeforeGiftCard).toFixed(2))

        if (giftCardAmount > 0) {
          const remainingAfter = normalizeMoney(remaining - giftCardAmount)
          tx.update(giftCardRef, {
            remainingBalance: remainingAfter,
            updatedAt: Date.now(),
          })

          giftCardPayload = {
            id: liveSnap.id,
            code: sanitizeText(liveData.code || requestedGiftCardCode, MAX_TEXT.short),
            normalizedCode: requestedGiftCardCode,
            amount: giftCardAmount,
            remainingAfter,
            initialAmount: normalizeMoney(liveData.initialAmount),
          }
        }
      }

      computedGiftCardAmount = giftCardAmount
      computedTotal = Number(Math.max(0, totalBeforeGiftCard - giftCardAmount).toFixed(2))
      giftCardOnOrder = giftCardPayload

      if (computedTotal <= 0.009 && giftCardAmount > 0) {
        resolvedPaymentMethod = 'giftcard'
      }

      const payload = {
        customer: safeCustomer,
        fulfillmentMethod,
        items: itemsForShipping,
        subtotal: computedSubtotalFromTotals,
        discount: {
          code: discountCode,
          percent: discountPercent,
          amount: computedDiscountAmount,
        },
        giftCard: giftCardPayload,
        giftCardAmount,
        shipping: computedShipping,
        total: computedTotal,
        paymentMethod: resolvedPaymentMethod,
        paypalOrderId: sanitizeText(data.paypalOrderId || '', MAX_TEXT.short),
        notes: sanitizeText(data.notes || '', MAX_TEXT.long),
        noteImages,
        deliveryDetails: safeDeliveryDetails,
        deliveryQuote: fulfillmentMethod === 'delivery' ? deliveryQuote : null,
        userId: request.auth?.uid || '',
        status: 'Pending',
        internalNotes: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      tx.set(orderRef, payload)
    })

    const payload = {
      customer: safeCustomer,
      fulfillmentMethod,
      items: itemsForShipping,
      subtotal: computedSubtotalFromTotals,
      discount: {
        code: discountCode,
        percent: discountPercent,
        amount: computedDiscountAmount,
      },
      giftCard: giftCardOnOrder,
      giftCardAmount: computedGiftCardAmount,
      shipping: computedShipping,
      total: computedTotal,
      paymentMethod: resolvedPaymentMethod,
      paypalOrderId: sanitizeText(data.paypalOrderId || '', MAX_TEXT.short),
      notes: sanitizeText(data.notes || '', MAX_TEXT.long),
      noteImages,
      deliveryDetails: safeDeliveryDetails,
      deliveryQuote: fulfillmentMethod === 'delivery' ? deliveryQuote : null,
      userId: request.auth?.uid || '',
      status: 'Pending',
      internalNotes: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    let emailSent = false
    try {
      const resend = new Resend(resendApiKey.value())
      const fromAddr = `806 & CO. <${resendFromEmail.value()}>`
      const [confirmationHtml, ownerHtml] = await buildOrderEmailHtml({
        orderId: orderRef.id,
        customer: safeCustomer,
        items: itemsForShipping,
        subtotal: `$${computedSubtotalFromTotals.toFixed(2)}`,
        discount: discountCode ? { code: discountCode, amount: computedDiscountAmount } : null,
        giftCard: giftCardOnOrder
          ? { code: giftCardOnOrder.code, amount: giftCardOnOrder.amount }
          : null,
        shipping: `$${computedShipping.toFixed(2)}`,
        total: `$${computedTotal.toFixed(2)}`,
        paymentMethod: resolvedPaymentMethod,
        fulfillmentMethod,
        noteToSeller: payload.notes,
        deliveryDetails: safeDeliveryDetails,
      })

      const results = await withTimeout(
        Promise.allSettled([
          resend.emails.send({
            from: fromAddr,
            to: [safeCustomer.email],
            subject: `Your 806 & CO. order is confirmed! (#${orderRef.id})`,
            html: confirmationHtml,
          }),
          resend.emails.send({
            from: fromAddr,
            to: [ownerEmailParam.value()],
            replyTo: safeCustomer.email,
            subject: `New order from ${safeCustomer.name} (#${orderRef.id})`,
            html: ownerHtml,
          }),
        ]),
        10000,
        'Order email send timed out.',
      )

      emailSent = results.some((result) => result.status === 'fulfilled' && !result.value?.error)
    } catch (err) {
      console.error('Order email send failed:', err)
    }

    return { id: orderRef.id, ...payload, emailSent }
  },
)

export const lookupGiftCard = onCall({ invoker: 'public' }, async (request) => {
  await verifyAppCheck(request)
  await enforceRateLimit({ request, scope: 'giftcard-lookup', hourlyLimit: 40, dailyLimit: 120 })

  const code = normalizeGiftCardCode(request.data?.code || '')
  if (!code) {
    return { ok: false, message: 'Enter a gift card code.' }
  }

  const db = getFirestore()
  const snapshot = await db
    .collection('giftCards')
    .where('normalizedCode', '==', code)
    .limit(1)
    .get()

  if (snapshot.empty) {
    return { ok: false, message: 'Gift card not found.' }
  }

  const docSnap = snapshot.docs[0]
  const data = docSnap.data() || {}
  const availabilityError = getGiftCardAvailabilityError(data)
  if (availabilityError) {
    return { ok: false, message: availabilityError }
  }

  return {
    ok: true,
    giftCard: {
      id: docSnap.id,
      code: String(data.code || code),
      normalizedCode: String(data.normalizedCode || code),
      remainingBalance: normalizeMoney(data.remainingBalance),
      initialAmount: normalizeMoney(data.initialAmount),
    },
  }
})

/* ────────────────────────────────────────────────────────────────
   createManualOrderSecure — admin enters an order taken outside the
   website (in person, phone, DM). Skips catalog validation, rate
   limiting, and server-computed totals from createOrderSecure since
   the admin is the authoritative source for this data; still runs
   through sanitizeText/MAX_TEXT since it round-trips into the Admin
   UI and (optionally) the Notion sync.
   ──────────────────────────────────────────────────────────────── */
export const createManualOrderSecure = onCall({ invoker: 'public' }, async (request) => {
  if (!request.auth || !isAdminRequest(request)) {
    throw new HttpsError('permission-denied', 'Admin access required.')
  }

  const data = request.data ?? {}
  const customer = data.customer ?? {}
  const address = customer.address ?? {}
  const rawItems = Array.isArray(data.items) ? data.items : []

  if (rawItems.length === 0 || rawItems.length > 50) {
    throw new HttpsError('invalid-argument', 'Order must include at least one item.')
  }

  const fulfillmentMethod = sanitizeText(data.fulfillmentMethod || 'pickup', MAX_TEXT.short)
  if (!['ship', 'delivery', 'pickup'].includes(fulfillmentMethod)) {
    throw new HttpsError('invalid-argument', 'Invalid fulfillment method.')
  }

  const safeCustomer = {
    name: sanitizeText(customer.name, MAX_TEXT.short),
    email: sanitizeText(customer.email, MAX_TEXT.short).toLowerCase(),
    phone: sanitizeText(customer.phone, MAX_TEXT.short),
    address: {
      street: sanitizeText(address.street, MAX_TEXT.medium),
      city: sanitizeText(address.city, MAX_TEXT.short),
      state: sanitizeText(address.state, MAX_TEXT.short),
      zip: sanitizeText(address.zip, MAX_TEXT.short),
    },
  }

  if (!safeCustomer.name) {
    throw new HttpsError('invalid-argument', 'Customer name is required.')
  }
  if (safeCustomer.email && !isValidEmail(safeCustomer.email)) {
    throw new HttpsError('invalid-argument', 'Customer email is invalid.')
  }

  const safeItems = rawItems.map((item) => ({
    name: sanitizeText(item.name, MAX_TEXT.medium),
    quantity: Math.max(1, Math.min(99, Number(item.quantity || 1))),
    price: Math.max(0, Number(item.price || 0)),
  }))

  if (safeItems.some((item) => !item.name || !Number.isFinite(item.price))) {
    throw new HttpsError('invalid-argument', 'Order items are invalid — each item needs a name and a non-negative price.')
  }

  const subtotal = safeItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const shipping = Math.max(0, Number(data.shipping || 0))
  const paymentMethod = sanitizeText(data.paymentMethod || 'contact', MAX_TEXT.short)

  const payload = {
    customer: safeCustomer,
    fulfillmentMethod,
    items: safeItems,
    subtotal,
    shipping,
    total: subtotal + shipping,
    paymentMethod,
    notes: sanitizeText(data.notes || '', MAX_TEXT.long),
    internalNotes: sanitizeText(data.internalNotes || '', MAX_TEXT.long),
    userId: '',
    isManual: true,
    status: 'Pending',
    archived: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  const db = getFirestore()
  const orderRef = await db.collection('orders').add(payload)

  return { id: orderRef.id, ...payload }
})

const verifyNotionSignature = (rawBody, signatureHeader, secret) => {
  if (!rawBody || !signatureHeader) return false
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`
  const expectedBuf = Buffer.from(expected)
  const actualBuf = Buffer.from(signatureHeader)
  if (expectedBuf.length !== actualBuf.length) return false
  return timingSafeEqual(expectedBuf, actualBuf)
}

/* ────────────────────────────────────────────────────────────────
   syncOrderToNotion — outbound sync of order data into a Notion
   database. Gated by the settings/notion Firestore doc (enabled +
   databaseId), set from the Admin panel. Includes a loop guard for
   when notionWebhook (below) is also enabled: if lastNotionSyncAt is
   already >= updatedAt, this write originated from Notion itself, so
   skip pushing it right back out. See ARCHITECTURE-PLAN.md §3.6/§3.8.
   ──────────────────────────────────────────────────────────────── */
export const syncOrderToNotion = onDocumentWritten(
  { document: 'orders/{orderId}', secrets: ['NOTION_API_KEY'] },
  async (event) => {
    const db = getFirestore()
    const settingsSnap = await db.collection('settings').doc('notion').get()
    const notionSettings = settingsSnap.exists ? settingsSnap.data() || {} : {}
    if (!notionSettings.enabled || !notionSettings.databaseId) return

    const apiKey = notionApiKey.value()
    const orderId = event.params.orderId
    const after = event.data?.after?.exists ? event.data.after.data() : null

    if (!after) {
      const before = event.data?.before?.data()
      if (before?.notionPageId) {
        try {
          await archiveNotionPage(before.notionPageId, apiKey)
        } catch (err) {
          console.error('Notion archive failed for deleted order', orderId, err)
        }
      }
      return
    }

    if (after.lastNotionSyncAt && after.updatedAt && after.lastNotionSyncAt >= after.updatedAt) {
      return
    }

    const order = { id: orderId, ...after }

    try {
      let pageId = after.notionPageId
      if (pageId) {
        await updateNotionPage(pageId, order, apiKey)
      } else {
        const page = await pushOrderToNotion(order, notionSettings.databaseId, apiKey)
        pageId = page.id
      }
      await event.data.after.ref.update({ notionPageId: pageId, lastNotionSyncAt: Date.now() })
    } catch (err) {
      console.error('Notion sync failed for order', orderId, err)
    }
  },
)

/* ────────────────────────────────────────────────────────────────
   notionWebhook — inbound half of two-way sync. Deliberately narrow
   scope: only Status and Internal Notes flow from Notion back into
   Firestore. Firestore stays the source of truth for everything
   else (customer info, items, totals). See ARCHITECTURE-PLAN.md §3.8
   for the verification handshake and signature details.
   ──────────────────────────────────────────────────────────────── */
export const notionWebhook = onRequest(
  { secrets: ['NOTION_WEBHOOK_SECRET', 'NOTION_API_KEY'], invoker: 'public' },
  async (req, res) => {
    // One-time subscription handshake. Notion POSTs this once when the
    // subscription is created; log it so it can be copied into the Notion
    // UI's "Verify subscription" dialog, then store it as NOTION_WEBHOOK_SECRET.
    if (req.body?.verification_token) {
      console.log('Notion webhook verification_token (copy into Notion UI):', req.body.verification_token)
      res.status(200).send('ok')
      return
    }

    const signature = req.get('X-Notion-Signature')
    if (!verifyNotionSignature(req.rawBody, signature, notionWebhookSecret.value())) {
      res.status(401).send('invalid signature')
      return
    }

    const payload = req.body ?? {}
    const pageId = payload.data?.page_id || payload.entity?.id
    if (!pageId) {
      res.status(200).send('ignored')
      return
    }

    try {
      const db = getFirestore()
      const orderSnap = await db.collection('orders').where('notionPageId', '==', pageId).limit(1).get()
      if (orderSnap.empty) {
        res.status(200).send('no matching order')
        return
      }

      const page = await getNotionPage(pageId, notionApiKey.value())
      const status = readSelectProperty(page, 'Status')
      const now = Date.now()

      const updates = {
        internalNotes: readRichTextProperty(page, 'Internal Notes'),
        lastNotionSyncAt: now,
        updatedAt: now,
      }
      if (status) updates.status = status

      await orderSnap.docs[0].ref.update(updates)
      res.status(200).send('ok')
    } catch (err) {
      console.error('Notion webhook processing failed:', err)
      res.status(500).send('error')
    }
  },
)
