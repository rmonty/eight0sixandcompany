import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  where,
} from 'firebase/firestore'
import { db, hasFirebaseConfig, functions } from './firebase'
import { httpsCallable } from 'firebase/functions'
import { deleteStorageFilesByUrl } from './mediaService'
import { collectOrderNoteImageUrls } from '../utils/orderNoteImages'
import { reserveMockAppointment } from './bookingService'

const ordersCollection = () => collection(db, 'orders')

const mapDoc = (snapshot) => ({
  id: snapshot.id,
  ...snapshot.data(),
})

export const createOrder = async (order) => {
  const payload = {
    ...order,
    status: order.status ?? 'Pending',
    notes: order.notes ?? '',
    noteImages: order.noteImages ?? [],
    internalNotes: order.internalNotes ?? '',
  }

  if (!hasFirebaseConfig) {
    const orderId = `local-order-${Date.now()}`
    for (const item of payload.items || []) {
      if (item.scheduledAt) {
        reserveMockAppointment({
          productId: item.productId,
          startAt: item.scheduledAt,
          endAt: item.scheduledEndAt,
          orderId,
        })
      }
    }
    return { id: orderId, ...payload }
  }

  if (!functions) {
    throw new Error('Checkout is unavailable because Firebase Functions is not configured.')
  }

  const createOrderSecure = httpsCallable(functions, 'createOrderSecure', { timeout: 45000 })

  try {
    const result = await createOrderSecure(payload)
    return result.data
  } catch (error) {
    if (error?.code === 'functions/deadline-exceeded') {
      throw new Error('Checkout timed out while placing the order. Please try again.', { cause: error })
    }

    const message = String(error?.message || '').trim()
    if (message) {
      throw new Error(message, { cause: error })
    }

    throw new Error('Unable to place order right now.', { cause: error })
  }
}

export const createManualOrder = async (order) => {
  if (!hasFirebaseConfig) {
    return { id: `manual-${Date.now()}`, ...order, isManual: true }
  }

  if (!functions) {
    throw new Error('Manual orders are unavailable because Firebase Functions is not configured.')
  }

  const createManualOrderSecure = httpsCallable(functions, 'createManualOrderSecure', { timeout: 45000 })

  try {
    const result = await createManualOrderSecure(order)
    return result.data
  } catch (error) {
    const message = String(error?.message || '').trim()
    throw new Error(message || 'Unable to save the manual order right now.', { cause: error })
  }
}

export const getOrdersByUserId = async (userId) => {
  if (!hasFirebaseConfig || !userId) return []

  try {
    const q = query(ordersCollection(), where('userId', '==', userId), orderBy('createdAt', 'desc'))
    const snapshot = await getDocs(q)
    return snapshot.docs.map(mapDoc)
  } catch (err) {
    // Fallback while the userId+createdAt composite index is building
    console.warn('Orders query with orderBy failed; falling back to unsorted fetch.', err)
    const q = query(ordersCollection(), where('userId', '==', userId))
    const snapshot = await getDocs(q)
    return snapshot.docs
      .map(mapDoc)
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
  }
}

export const getOrders = async () => {
  if (!hasFirebaseConfig) {
    return []
  }

  const q = query(ordersCollection(), orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(mapDoc)
}

export const updateOrder = async (orderId, updates) => {
  // Stamped on every update so the Notion sync loop guard (functions/src/index.jsx
  // syncOrderToNotion) can tell a genuine edit apart from its own inbound sync write.
  const payload = { ...updates, updatedAt: Date.now() }

  if (!hasFirebaseConfig) {
    return { id: orderId, ...payload }
  }

  await setDoc(doc(db, 'orders', orderId), payload, { merge: true })
  return { id: orderId, ...payload }
}

export const removeOrderNoteImages = async (order) => {
  const orderId = typeof order === 'string' ? order : order?.id
  if (!orderId) return { deleted: [], failed: [] }

  const imageUrls = typeof order === 'string' ? [] : collectOrderNoteImageUrls(order)
  const result = await deleteStorageFilesByUrl(imageUrls)

  if (hasFirebaseConfig) {
    await setDoc(
      doc(db, 'orders', orderId),
      { noteImages: [], noteImage: '' },
      { merge: true },
    )
  }

  return result
}

export const deleteOrder = async (order) => {
  const orderId = typeof order === 'string' ? order : order?.id
  if (!orderId) return { id: orderId }

  if (!hasFirebaseConfig) {
    return { id: orderId }
  }

  const imageUrls = typeof order === 'string' ? [] : collectOrderNoteImageUrls(order)
  if (imageUrls.length > 0) {
    await deleteStorageFilesByUrl(imageUrls)
  }

  await deleteDoc(doc(db, 'orders', orderId))
  return { id: orderId }
}
