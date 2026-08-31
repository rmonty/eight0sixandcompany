import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  where,
} from 'firebase/firestore'
import { db, hasFirebaseConfig } from './firebase'

const SESSION_KEY = 'aubs_site_presence_session'
const HEARTBEAT_MS = 25000
const DEFAULT_STALE_MS = 90000

const uuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })

const getSessionId = () => {
  try {
    const existing = localStorage.getItem(SESSION_KEY)
    if (existing) return existing
    const created = uuid()
    localStorage.setItem(SESSION_KEY, created)
    return created
  } catch {
    return uuid()
  }
}

const presenceDoc = (sessionId) => doc(db, 'sitePresence', sessionId)

const writePresence = async (sessionId, online) => {
  if (!hasFirebaseConfig || !sessionId) return
  await setDoc(
    presenceDoc(sessionId),
    {
      online,
      lastSeen: Date.now(),
      path: window.location.pathname || '/',
      ua: navigator.userAgent?.slice(0, 180) || '',
    },
    { merge: true },
  )
}

export const startVisitorPresenceTracking = () => {
  if (!hasFirebaseConfig) return () => {}

  const sessionId = getSessionId()
  let disposed = false

  const ping = () => {
    if (disposed) return
    writePresence(sessionId, true).catch(() => {})
  }

  const markOffline = () => {
    writePresence(sessionId, false).catch(() => {})
  }

  ping()
  const intervalId = window.setInterval(ping, HEARTBEAT_MS)

  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      ping()
    }
  }

  window.addEventListener('visibilitychange', handleVisibility)
  window.addEventListener('beforeunload', markOffline)
  window.addEventListener('pagehide', markOffline)

  return () => {
    disposed = true
    window.clearInterval(intervalId)
    window.removeEventListener('visibilitychange', handleVisibility)
    window.removeEventListener('beforeunload', markOffline)
    window.removeEventListener('pagehide', markOffline)
    markOffline()
  }
}

export const listenCurrentVisitors = (callback, staleMs = DEFAULT_STALE_MS) => {
  if (!hasFirebaseConfig) {
    callback(0)
    return () => {}
  }

  const q = query(collection(db, 'sitePresence'), where('online', '==', true))
  let docs = []

  const emit = () => {
    const now = Date.now()
    const count = docs.filter((d) => {
      const lastSeen = Number(d.lastSeen || 0)
      return now - lastSeen <= staleMs
    }).length
    callback(count)
  }

  const unsub = onSnapshot(q, (snapshot) => {
    docs = snapshot.docs.map((d) => d.data())
    emit()
  })

  const timerId = window.setInterval(emit, 10000)

  return () => {
    window.clearInterval(timerId)
    unsub()
  }
}
