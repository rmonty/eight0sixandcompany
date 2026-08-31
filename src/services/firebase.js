import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getFunctions } from 'firebase/functions'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const hasFirebaseConfig = Object.values(firebaseConfig).every(Boolean)

let app
let db
let auth
let storage
let functions

if (hasFirebaseConfig) {
  app = initializeApp(firebaseConfig)

  // App Check — initialise with reCAPTCHA v3 if a site key is configured.
  // Register your app in Firebase Console → App Check and add the site key
  // as VITE_RECAPTCHA_SITE_KEY in your .env file.
  const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY
  if (recaptchaSiteKey) {
    // self.FIREBASE_APPCHECK_DEBUG_TOKEN must be set for local dev.
    // In production the token is resolved automatically via reCAPTCHA.
    try {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(recaptchaSiteKey),
        isTokenAutoRefreshEnabled: true,
      })
    } catch (err) {
      console.warn('App Check init skipped (may already be initialised):', err?.message)
    }
  }

  db = getFirestore(app)
  auth = getAuth(app)
  storage = getStorage(app)
  functions = getFunctions(app)
}

export { app, db, auth, storage, functions, hasFirebaseConfig }
