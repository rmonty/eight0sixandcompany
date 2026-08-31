import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import { db, hasFirebaseConfig } from './firebase'
import { normalizeCouponEndDate, normalizeCouponStartDate } from '../utils/couponValidity'

const couponsCollection = () => collection(db, 'coupons')

const mapDoc = (snapshot) => ({
  id: snapshot.id,
  ...snapshot.data(),
})

export const formatCouponCode = (value) =>
  String(value || '')
    .trim()
    .replace(/[^A-Za-z0-9]/g, '')

/** Case-insensitive lookup key (letters + digits only). */
export const normalizeCouponCode = (value) => formatCouponCode(value).toUpperCase()

const normalizeDiscountPercent = (value) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.min(100, Math.max(0, Number(parsed.toFixed(2))))
}

export const getCoupons = async () => {
  if (!hasFirebaseConfig) {
    return []
  }

  const q = query(couponsCollection(), orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(mapDoc)
}

export const getActiveCouponByCode = async (code) => {
  if (!hasFirebaseConfig) {
    return null
  }

  const normalizedCode = normalizeCouponCode(code)
  if (!normalizedCode) {
    return null
  }

  const q = query(
    couponsCollection(),
    where('normalizedCode', '==', normalizedCode),
    where('active', '==', true),
    limit(1),
  )

  const snapshot = await getDocs(q)
  if (snapshot.empty) {
    return null
  }

  return mapDoc(snapshot.docs[0])
}

export const createCoupon = async (coupon) => {
  const code = formatCouponCode(coupon.code)
  const normalizedCode = normalizeCouponCode(code)
  const discountPercent = normalizeDiscountPercent(coupon.discountPercent)

  if (!normalizedCode) {
    throw new Error('Coupon code is required (letters and numbers only).')
  }

  if (discountPercent <= 0) {
    throw new Error('Discount percent must be greater than 0.')
  }

  const startDate = normalizeCouponStartDate(coupon.startDate)
  const endDate = normalizeCouponEndDate(coupon.endDate)

  if (!hasFirebaseConfig) {
    return {
      id: `local-coupon-${Date.now()}`,
      code,
      normalizedCode,
      discountPercent,
      active: coupon.active ?? true,
      startDate,
      endDate,
    }
  }

  const payload = {
    code,
    normalizedCode,
    discountPercent,
    active: coupon.active ?? true,
    startDate,
    endDate,
    createdAt: serverTimestamp(),
  }

  const result = await addDoc(couponsCollection(), payload)
  return { id: result.id, ...payload }
}

export const updateCoupon = async (couponId, updates) => {
  const next = {}

  if (Object.prototype.hasOwnProperty.call(updates, 'code')) {
    const code = formatCouponCode(updates.code)
    const normalizedCode = normalizeCouponCode(code)
    if (!normalizedCode) {
      throw new Error('Coupon code is required (letters and numbers only).')
    }
    next.code = code
    next.normalizedCode = normalizedCode
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'discountPercent')) {
    const discountPercent = normalizeDiscountPercent(updates.discountPercent)
    if (discountPercent <= 0) {
      throw new Error('Discount percent must be greater than 0.')
    }
    next.discountPercent = discountPercent
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'active')) {
    next.active = Boolean(updates.active)
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'startDate')) {
    next.startDate = normalizeCouponStartDate(updates.startDate)
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'endDate')) {
    next.endDate = normalizeCouponEndDate(updates.endDate)
  }

  if (!hasFirebaseConfig) {
    return { id: couponId, ...next }
  }

  await setDoc(doc(db, 'coupons', couponId), next, { merge: true })
  return { id: couponId, ...next }
}

export const removeCoupon = async (couponId) => {
  if (!hasFirebaseConfig) {
    return
  }

  await deleteDoc(doc(db, 'coupons', couponId))
}
