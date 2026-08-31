import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import {
  getStoredSession,
  startChat as startChatService,
  sendMessage as sendMessageService,
  listenMessages,
  listenAdminPresence,
  markVisitorRead,
  closeChat as closeChatService,
} from '../services/chatService'

const ChatContext = createContext(null)

export function ChatProvider({ children }) {
  const { isAdmin, loading: authLoading } = useAuth()

  // ── State ──
  const [visitorSession, setVisitorSession] = useState(() => getStoredSession())
  const [isAdminOnline, setIsAdminOnline] = useState(false)
  const [messages, setMessages] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  // ── Admin presence listener ──
  // Wait for auth to resolve so we don't start the listener while isAdmin is still indeterminate
  useEffect(() => {
    if (authLoading) return
    if (isAdmin) {
      setIsAdminOnline(false) // don't show widget to admin
      return () => {}
    }

    return listenAdminPresence((online) => {
      setIsAdminOnline(online)
      // If admin goes offline, auto-minimize
      if (!online) {
        setIsOpen(false)
      }
    })
  }, [isAdmin, authLoading])

  // ── Message listener (when session exists) ──
  const messagesUnsubRef = useRef(null)

  useEffect(() => {
    if (!visitorSession?.chatId) {
      setMessages([])
      return
    }

    const unsub = listenMessages(visitorSession.chatId, (msgs) => {
      setMessages(msgs)
    })

    messagesUnsubRef.current = unsub
    return () => {
      if (messagesUnsubRef.current) {
        messagesUnsubRef.current()
        messagesUnsubRef.current = null
      }
    }
  }, [visitorSession?.chatId])

  // ── Track unread count ──
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0)
      if (visitorSession?.chatId) {
        markVisitorRead(visitorSession.chatId).catch(() => {})
      }
    } else if (visitorSession?.chatId) {
      // When minimized, show count of admin messages (simple approach)
      const adminCount = messages.filter((m) => m.sender === 'admin').length
      setUnreadCount(adminCount)
    }
  }, [messages, isOpen, visitorSession?.chatId])

  // ── Actions ──

  const chatId = visitorSession?.chatId
  const visitorToken = visitorSession?.visitorToken

  const startChat = useCallback(async (name, email) => {
    const session = await startChatService({ name, email })
    if (session) {
      setVisitorSession(session)
      setUnreadCount(0)
    }
    return session
  }, [])

  const sendMessage = useCallback(async (text) => {
    if (!chatId) return
    await sendMessageService({ chatId, text, sender: 'visitor', visitorToken })
  }, [chatId, visitorToken])

  const closeChat = useCallback(async () => {
    if (chatId) {
      await closeChatService(chatId)
    }
    setVisitorSession(null)
    setIsOpen(false)
    setMessages([])
    setUnreadCount(0)
  }, [chatId])

  const toggleWidget = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev
      if (next && chatId) {
        markVisitorRead(chatId).catch(() => {})
        setUnreadCount(0)
      }
      return next
    })
  }, [chatId])

  const openWidget = useCallback(() => {
    if (chatId) {
      markVisitorRead(chatId).catch(() => {})
      setUnreadCount(0)
    }
    setIsOpen(true)
  }, [chatId])

  const value = useMemo(
    () => ({
      visitorSession,
      isAdminOnline,
      messages,
      isOpen,
      unreadCount,
      startChat,
      sendMessage,
      closeChat,
      toggleWidget,
      openWidget,
    }),
    [visitorSession, isAdminOnline, messages, isOpen, unreadCount, startChat, sendMessage, closeChat, toggleWidget, openWidget],
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export const useChat = () => {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChat must be used within ChatProvider')
  }
  return context
}
