import { doc, getDoc, setDoc } from 'firebase/firestore'
import { defaultSettings } from '../config/defaults'
import { db, hasFirebaseConfig } from './firebase'

const settingsRef = () => doc(db, 'settings', 'store')

export const getStoreSettings = async () => {
  if (!hasFirebaseConfig) {
    return defaultSettings
  }

  const snapshot = await getDoc(settingsRef())
  if (!snapshot.exists()) {
    try {
      await setDoc(settingsRef(), defaultSettings)
    } catch {
      // Public users may not have permission to bootstrap settings.
    }
    return defaultSettings
  }

  return {
    ...defaultSettings,
    ...snapshot.data(),
    shipping: {
      ...defaultSettings.shipping,
      ...(snapshot.data().shipping || {}),
      deliveryOrigin: {
        ...defaultSettings.shipping.deliveryOrigin,
        ...(snapshot.data().shipping?.deliveryOrigin || {}),
      },
    },
  }
}

export const updateStoreSettings = async (settings) => {
  if (!hasFirebaseConfig) {
    return settings
  }

  await setDoc(settingsRef(), settings, { merge: true })
  return settings
}

const notionSettingsRef = () => doc(db, 'settings', 'notion')

const defaultNotionSettings = { enabled: false, databaseId: '' }

// Admin-only (firestore.rules: settings/notion). Never store the Notion API
// key here — it lives in Secret Manager as NOTION_API_KEY.
export const getNotionSettings = async () => {
  if (!hasFirebaseConfig) {
    return defaultNotionSettings
  }

  const snapshot = await getDoc(notionSettingsRef())
  if (!snapshot.exists()) {
    return defaultNotionSettings
  }

  return { ...defaultNotionSettings, ...snapshot.data() }
}

export const updateNotionSettings = async (settings) => {
  if (!hasFirebaseConfig) {
    return settings
  }

  await setDoc(notionSettingsRef(), settings, { merge: true })
  return settings
}
