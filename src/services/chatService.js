import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  where,
} from 'firebase/firestore'
import { db, hasFirebaseConfig } from './firebase'

// ── Helpers ──

const presenceDoc = (uid) => doc(db, 'presence', uid)
const chatsCollection = () => collection(db, 'chats')
const chatDoc = (chatId) => doc(db, 'chats', chatId)
const messagesCollection = (chatId) => collection(db, 'chats', chatId, 'messages')

// ── UUID generator ──

const uuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })

// ── Visitor session (localStorage) ──

const SESSION_KEY = 'aubs_chat_session'

export const getStoredSession = () => {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const storeSession = (session) => {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    /* quota exceeded — silent */
  }
}

export const clearStoredSession = () => {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}

// ── Chat operations ──

export const startChat = async ({ name, email }) => {
  if (!hasFirebaseConfig) return null

  const chatId = uuid()
  const visitorToken = uuid()
  const now = Date.now()

  await setDoc(chatDoc(chatId), {
    visitorName: name,
    visitorEmail: email,
    visitorToken,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    lastMessage: '',
    lastMessageAt: now,
    unreadAdmin: 0,
    unreadVisitor: 0,
  })

  const session = { chatId, visitorToken, name, email }
  storeSession(session)
  return session
}

export const sendMessage = async ({ chatId, text, sender, visitorToken }) => {
  if (!hasFirebaseConfig || !chatId || !text?.trim()) return null

  let resolvedVisitorToken = visitorToken
  if (!resolvedVisitorToken) {
    const chatSnap = await getDoc(chatDoc(chatId))
    resolvedVisitorToken = chatSnap.data()?.visitorToken || ''
  }
  if (!resolvedVisitorToken) {
    throw new Error('Missing visitor token for chat message.')
  }

  const msg = {
    sender,
    text: text.trim(),
    createdAt: Date.now(),
    visitorToken: resolvedVisitorToken,
  }

  const msgRef = await addDoc(messagesCollection(chatId), msg)

  // Update chat preview + unread count
  const unreadField = sender === 'visitor' ? 'unreadAdmin' : 'unreadVisitor'
  await setDoc(
    chatDoc(chatId),
    {
      lastMessage: text.trim().slice(0, 120),
      lastMessageAt: Date.now(),
      updatedAt: Date.now(),
      [unreadField]: increment(1),
    },
    { merge: true },
  )

  return { id: msgRef.id, ...msg }
}

// ── Real-time listeners ──

export const listenMessages = (chatId, callback) => {
  if (!hasFirebaseConfig || !chatId) {
    callback([])
    return () => {}
  }

  const q = query(messagesCollection(chatId), orderBy('createdAt', 'asc'))
  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    callback(messages)
  })
}

export const listenAdminPresence = (callback) => {
  if (!hasFirebaseConfig) {
    callback(false)
    return () => {}
  }

  const q = query(collection(db, 'presence'), where('online', '==', true))
  return onSnapshot(q, (snapshot) => {
    callback(!snapshot.empty)
  })
}

export const listenActiveChats = (callback) => {
  if (!hasFirebaseConfig) {
    callback([])
    return () => {}
  }

  const q = query(
    chatsCollection(),
    where('status', '==', 'active'),
    orderBy('lastMessageAt', 'desc'),
  )
  return onSnapshot(q, (snapshot) => {
    const chats = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    callback(chats)
  })
}

// ── Read tracking ──

export const markAdminRead = async (chatId) => {
  if (!hasFirebaseConfig || !chatId) return
  await setDoc(chatDoc(chatId), { unreadAdmin: 0 }, { merge: true })
}

export const markVisitorRead = async (chatId) => {
  if (!hasFirebaseConfig || !chatId) return
  await setDoc(chatDoc(chatId), { unreadVisitor: 0 }, { merge: true })
}

export const closeChat = async (chatId) => {
  if (!hasFirebaseConfig || !chatId) return
  await setDoc(chatDoc(chatId), { status: 'closed', updatedAt: Date.now() }, { merge: true })
  clearStoredSession()
}

// ── Admin presence ──

export const setAdminOnline = async (uid, email) => {
  if (!hasFirebaseConfig || !uid) return
  await setDoc(presenceDoc(uid), {
    online: true,
    email,
    lastSeen: Date.now(),
  })
}

export const setAdminOffline = async (uid) => {
  if (!hasFirebaseConfig || !uid) return
  try {
    await deleteDoc(presenceDoc(uid))
  } catch {
    /* already gone — ignore */
  }
}
