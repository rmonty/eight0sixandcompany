import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { hasFirebaseConfig, storage } from './firebase'
import { getStoragePathFromDownloadUrl, validateOrderNoteImage } from '../utils/orderNoteImages'

export const uploadProductMedia = async (file, folder = 'products') => {
  if (!hasFirebaseConfig || !file) {
    return ''
  }

  if (folder === 'order-notes') {
    const validationError = validateOrderNoteImage(file)
    if (validationError) {
      throw new Error(validationError)
    }
  }

  const safeName = `${Date.now()}-${file.name}`
  const mediaRef = ref(storage, `${folder}/${safeName}`)
  await uploadBytes(mediaRef, file)
  return getDownloadURL(mediaRef)
}

export const uploadProductBlob = async (blob, folder = 'products', fileName = 'edited.jpg') => {
  if (!hasFirebaseConfig || !blob) {
    return ''
  }

  const safeName = `${Date.now()}-${fileName}`
  const mediaRef = ref(storage, `${folder}/${safeName}`)
  await uploadBytes(mediaRef, blob)
  return getDownloadURL(mediaRef)
}

export const deleteStorageFilesByUrl = async (urls = []) => {
  if (!hasFirebaseConfig || !storage) {
    return { deleted: [], failed: [] }
  }

  const unique = [...new Set(urls.filter(Boolean))]
  const deleted = []
  const failed = []

  for (const url of unique) {
    const path = getStoragePathFromDownloadUrl(url)
    if (!path || !path.startsWith('order-notes/')) {
      failed.push(url)
      continue
    }

    try {
      await deleteObject(ref(storage, path))
      deleted.push(url)
    } catch {
      failed.push(url)
    }
  }

  return { deleted, failed }
}
