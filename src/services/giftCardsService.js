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
import { httpsCallable } from 'firebase/functions'
import { db, functions, hasFirebaseConfig } from './firebase'
import {
  formatGiftCardCode,
  generateGiftCardCode,
  normalizeGiftCardCode,
  normalizeMoney,
} from '../utils/giftCards'

const giftCardsCollection = () => collection(db, 'giftCards')

const mapDoc = (snapshot) => ({
  id: snapshot.id,
  ...snapshot.data(),
})

export { formatGiftCardCode, generateGiftCardCode, normalizeGiftCardCode }

const assertCodeAvailable = async (normalizedCode, excludeId = null) => {
  if (!hasFirebaseConfig) return
  const snapshot = await getDocs(
    query(giftCardsCollection(), where('normalizedCode', '==', normalizedCode), limit(5)),
  )
  const conflict = snapshot.docs.find((d) => d.id !== excludeId)
  if (conflict) {
    throw new Error('A gift card with this code already exists.')
  }
}

export const getGiftCards = async () => {
  if (!hasFirebaseConfig) return []
  const q = query(giftCardsCollection(), orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(mapDoc)
}

export const createGiftCard = async (giftCard) => {
  const code = formatGiftCardCode(giftCard.code || generateGiftCardCode())
  const normalizedCode = normalizeGiftCardCode(code)
  const initialAmount = normalizeMoney(giftCard.initialAmount)
  const remainingBalance = normalizeMoney(
    giftCard.remainingBalance == null ? initialAmount : giftCard.remainingBalance,
  )

  if (!normalizedCode) {
    throw new Error('Gift card code is required (letters and numbers).')
  }
  if (initialAmount <= 0) {
    throw new Error('Gift card amount must be greater than 0.')
  }

  await assertCodeAvailable(normalizedCode)

  const payload = {
    code,
    normalizedCode,
    initialAmount,
    remainingBalance: Math.min(remainingBalance, initialAmount),
    active: giftCard.active !== false,
    notes: String(giftCard.notes || '').trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  if (!hasFirebaseConfig) {
    return { id: `local-gc-${Date.now()}`, ...payload, createdAt: Date.now(), updatedAt: Date.now() }
  }

  const result = await addDoc(giftCardsCollection(), payload)
  return { id: result.id, ...payload }
}

export const updateGiftCard = async (giftCardId, updates) => {
  const next = { updatedAt: serverTimestamp() }

  if (Object.prototype.hasOwnProperty.call(updates, 'code')) {
    const code = formatGiftCardCode(updates.code)
    const normalizedCode = normalizeGiftCardCode(code)
    if (!normalizedCode) throw new Error('Gift card code is required (letters and numbers).')
    await assertCodeAvailable(normalizedCode, giftCardId)
    next.code = code
    next.normalizedCode = normalizedCode
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'initialAmount')) {
    const initialAmount = normalizeMoney(updates.initialAmount)
    if (initialAmount <= 0) throw new Error('Gift card amount must be greater than 0.')
    next.initialAmount = initialAmount
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'remainingBalance')) {
    next.remainingBalance = normalizeMoney(updates.remainingBalance)
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'active')) {
    next.active = Boolean(updates.active)
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'notes')) {
    next.notes = String(updates.notes || '').trim()
  }

  if (
    Object.prototype.hasOwnProperty.call(next, 'initialAmount') &&
    Object.prototype.hasOwnProperty.call(next, 'remainingBalance')
  ) {
    next.remainingBalance = Math.min(next.remainingBalance, next.initialAmount)
  }

  if (!hasFirebaseConfig) {
    return { id: giftCardId, ...next, updatedAt: Date.now() }
  }

  await setDoc(doc(db, 'giftCards', giftCardId), next, { merge: true })
  return { id: giftCardId, ...next }
}

export const removeGiftCard = async (giftCardId) => {
  if (!hasFirebaseConfig) return
  await deleteDoc(doc(db, 'giftCards', giftCardId))
}

/** Public lookup for cart apply — does not expose inactive/empty cards as usable. */
export const lookupGiftCard = async (code) => {
  const normalizedCode = normalizeGiftCardCode(code)
  if (!normalizedCode) {
    return { ok: false, message: 'Enter a gift card code.' }
  }

  if (!hasFirebaseConfig || !functions) {
    return { ok: false, message: 'Gift cards are unavailable right now.' }
  }

  const fn = httpsCallable(functions, 'lookupGiftCard')
  const result = await fn({ code: normalizedCode })
  return result.data
}
