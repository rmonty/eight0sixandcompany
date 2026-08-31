import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useChat } from '../contexts/ChatContext'

export function ChatWidget() {
  const { isAdmin } = useAuth()
  const {
    visitorSession,
    isAdminOnline,
    messages,
    isOpen,
    unreadCount,
    startChat,
    sendMessage,
    closeChat,
    toggleWidget,
  } = useChat()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)

  // Auto-scroll to bottom when messages change or widget opens
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen])

  // Don't show widget to admin users
  if (!isAdminOnline || isAdmin) return null

  const handleStartChat = async (e) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return
    await startChat(name.trim(), email.trim())
  }

  const handleSend = async (e) => {
    e.preventDefault()
    if (!text.trim() || sending) return
    setSending(true)
    await sendMessage(text.trim())
    setText('')
    setSending(false)
  }

  const handleClose = async () => {
    await closeChat()
  }

  const formatTime = (ts) => {
    if (!ts) return ''
    const d = new Date(ts)
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }

  // ── Minimized bubble ──
  if (!isOpen) {
    return (
      <div className="chat-widget">
        <button
          type="button"
          className="chat-bubble"
          onClick={toggleWidget}
          aria-label="Open chat"
        >
          <svg className="chat-bubble-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {unreadCount > 0 && (
            <span className="chat-unread-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
          )}
        </button>
      </div>
    )
  }

  // ── Expanded window ──
  return (
    <div className="chat-widget">
      <div className="chat-window">
        {/* Header */}
        <div className="chat-header">
          <div className="chat-header-info">
            <span className="chat-header-dot" />
            <span className="chat-header-title">Chat with 806 &amp; CO.</span>
          </div>
          <div className="chat-header-actions">
            <button
              type="button"
              className="chat-header-btn"
              onClick={toggleWidget}
              aria-label="Minimize chat"
              title="Minimize"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            <button
              type="button"
              className="chat-header-btn"
              onClick={handleClose}
              aria-label="Close chat"
              title="Close"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        {!visitorSession ? (
          /* ── Pre-chat form ── */
          <form className="chat-body chat-form" onSubmit={handleStartChat}>
            <p className="chat-form-intro">
              Hi! Someone from 806 &amp; CO. is online right now. Enter your info to start chatting.
            </p>
            <label className="chat-label">
              Your name *
              <input
                className="text-input chat-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane"
                required
                autoFocus
              />
            </label>
            <label className="chat-label">
              Your email *
              <input
                className="text-input chat-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
                required
              />
            </label>
            <button type="submit" className="chat-send-btn chat-start-btn">
              Start Chat
            </button>
          </form>
        ) : (
          /* ── Messages ── */
          <>
            <div className="chat-body chat-messages">
              {messages.length === 0 && (
                <p className="chat-empty">Send a message to start the conversation!</p>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`chat-message ${msg.sender === 'visitor' ? 'chat-message--visitor' : 'chat-message--admin'}`}
                >
                  <div className="chat-message-bubble">
                    <p className="chat-message-text">{msg.text}</p>
                    <span className="chat-message-time">{formatTime(msg.createdAt)}</span>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form className="chat-input-row" onSubmit={handleSend}>
              <input
                className="text-input chat-text-input"
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type a message…"
                autoFocus
              />
              <button
                type="submit"
                className="chat-send-btn"
                disabled={!text.trim() || sending}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
