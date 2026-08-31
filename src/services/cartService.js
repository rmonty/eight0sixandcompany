import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db, hasFirebaseConfig } from './firebase'

const cartDoc = (uid) => doc(db, 'userCarts', uid)

export const getUserCart = async (uid) => {
  if (!hasFirebaseConfig || !uid) {
    return { items: [], appliedCoupon: null, appliedGiftCard: null }
  }

  const snap = await getDoc(cartDoc(uid))
  if (!snap.exists()) {
    return { items: [], appliedCoupon: null, appliedGiftCard: null }
  }

  const data = snap.data() || {}
  return {
    items: Array.isArray(data.items) ? data.items : [],
    appliedCoupon: data.appliedCoupon || null,
    appliedGiftCard: data.appliedGiftCard || null,
  }
}

export const saveUserCart = async (uid, { items, appliedCoupon, appliedGiftCard }) => {
  if (!hasFirebaseConfig || !uid) return

  await setDoc(
    cartDoc(uid),
    {
      items: Array.isArray(items) ? items : [],
      appliedCoupon: appliedCoupon || null,
      appliedGiftCard: appliedGiftCard || null,
      updatedAt: Date.now(),
    },
    { merge: true },
  )
}

/** Merge two carts by cartKey; prefer higher quantity and newer local fields. */
export const mergeCartItems = (localItems = [], remoteItems = []) => {
  const map = new Map()

  for (const item of remoteItems) {
    const key = item.cartKey || item.id
    if (!key) continue
    map.set(key, item)
  }

  for (const item of localItems) {
    const key = item.cartKey || item.id
    if (!key) continue
    const existing = map.get(key)
    if (!existing) {
      map.set(key, item)
      continue
    }
    map.set(key, {
      ...existing,
      ...item,
      quantity: Math.max(Number(existing.quantity || 0), Number(item.quantity || 0)),
    })
  }

  return [...map.values()]
}
