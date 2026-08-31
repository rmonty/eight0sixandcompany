import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { mockProducts } from '../config/defaults'
import { db, hasFirebaseConfig } from './firebase'
import { isProductStoreVisible } from '../utils/productVisibility'

const productsCollection = () => collection(db, 'products')

const mapDoc = (snapshot) => ({
  id: snapshot.id,
  ...snapshot.data(),
})

export const getProducts = async ({ includeHidden = false } = {}) => {
  let products
  if (!hasFirebaseConfig) {
    products = mockProducts
  } else {
    const q = query(productsCollection(), orderBy('createdAt', 'desc'))
    const snapshot = await getDocs(q)
    products = snapshot.docs.map(mapDoc)
  }

  // Default excludes drafts / not-yet-live so callers like Home stay storefront-safe.
  if (includeHidden) return products
  return products.filter((product) => isProductStoreVisible(product))
}

/** Products visible on the storefront (excludes drafts and not-yet-live items). */
export const getStoreProducts = async () => getProducts({ includeHidden: false })

export const getProductById = async (productId) => {
  if (!hasFirebaseConfig) {
    return mockProducts.find((product) => product.id === productId) || null
  }

  const snapshot = await getDoc(doc(db, 'products', productId))
  if (!snapshot.exists()) {
    return null
  }

  return mapDoc(snapshot)
}

/** Product detail for storefront; returns null for drafts / scheduled items. */
export const getStoreProductById = async (productId) => {
  const product = await getProductById(productId)
  if (!product || !isProductStoreVisible(product)) return null
  return product
}

export const getProductsByIds = async (productIds = []) => {
  const uniqueIds = [...new Set(productIds.filter(Boolean))]
  if (!uniqueIds.length) return []

  if (!hasFirebaseConfig) {
    return uniqueIds
      .map((id) => mockProducts.find((product) => product.id === id))
      .filter(Boolean)
  }

  const snapshots = await Promise.all(uniqueIds.map((id) => getDoc(doc(db, 'products', id))))
  return snapshots.filter((snapshot) => snapshot.exists()).map(mapDoc)
}

export const createProduct = async (product) => {
  if (!hasFirebaseConfig) {
    return { id: `local-${Date.now()}`, ...product }
  }

  const payload = {
    ...product,
    createdAt: serverTimestamp(),
  }
  const result = await addDoc(productsCollection(), payload)
  return { id: result.id, ...payload }
}

export const updateProduct = async (productId, product) => {
  if (!hasFirebaseConfig) {
    return { id: productId, ...product }
  }

  await setDoc(doc(db, 'products', productId), product, { merge: true })
  return { id: productId, ...product }
}

export const removeProduct = async (productId) => {
  if (!hasFirebaseConfig) {
    return
  }

  await deleteDoc(doc(db, 'products', productId))
}
