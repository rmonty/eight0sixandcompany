import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { db, hasFirebaseConfig } from './firebase'
import { mockGalleryItems } from '../config/defaults'

const galleryCollection = () => collection(db, 'gallery')

const mapDoc = (snapshot) => ({
  id: snapshot.id,
  ...snapshot.data(),
})

const normalizeGalleryItem = (item) => {
  const images = Array.isArray(item.images)
    ? item.images.filter(Boolean)
    : item.image
      ? [item.image]
      : []

  return {
    ...item,
    images,
    image: images[0] || '',
  }
}

const toMillis = (value) => {
  if (!value) return 0
  if (typeof value === 'number') return value
  if (typeof value.toMillis === 'function') return value.toMillis()
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

const sortGalleryItems = (items) => {
  return [...items].sort((a, b) => {
    const pinDiff = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))
    if (pinDiff !== 0) return pinDiff
    return toMillis(b.createdAt) - toMillis(a.createdAt)
  })
}

export const getGalleryItems = async () => {
  if (!hasFirebaseConfig) {
    return sortGalleryItems(mockGalleryItems.map(normalizeGalleryItem))
  }

  const snapshot = await getDocs(galleryCollection())
  return sortGalleryItems(snapshot.docs.map(mapDoc).map(normalizeGalleryItem))
}

export const createGalleryItem = async (item) => {
  const normalized = normalizeGalleryItem(item)

  if (!hasFirebaseConfig) {
    return { id: `local-gallery-${Date.now()}`, ...normalized }
  }

  const payload = {
    ...normalized,
    createdAt: serverTimestamp(),
  }
  const result = await addDoc(galleryCollection(), payload)
  return { id: result.id, ...payload }
}

export const updateGalleryItem = async (itemId, item) => {
  if (!hasFirebaseConfig) {
    return { id: itemId, ...item }
  }

  await setDoc(doc(db, 'gallery', itemId), item, { merge: true })
  return { id: itemId, ...item }
}

export const removeGalleryItem = async (itemId) => {
  if (!hasFirebaseConfig) {
    return
  }

  await deleteDoc(doc(db, 'gallery', itemId))
}
