import { useState, useRef, useEffect } from 'react'
import { httpsCallable } from 'firebase/functions'
import { useSettings } from '../contexts/SettingsContext'
import { functions } from '../services/firebase'

const INQUIRY_OPTIONS = [
  { value: '', label: 'What are we creating?' },
  { value: 'bakery', label: 'Something from The Bakery (Cakes / Cookies)' },
  { value: 'studio', label: 'Something from The Studio (Bags / Bandanas)' },
  { value: 'nail-bar', label: 'Something from The Nail Bar (Press-ons)' },
  { value: 'custom', label: 'A Custom Request' },
]

const today = new Date().toISOString().split('T')[0]
const SUBMIT_COOLDOWN_MS = 5000 // 5-second minimum between submissions

export function Contact() {
  const { settings } = useSettings()

  const [form, setForm] = useState({
    name: '',
    email: '',
    inquiryType: '',
    dateNeeded: '',
    howFound: '',
    message: '',
  })
  const [status, setStatus] = useState('idle') // idle | submitting | success | error
  const [cooldown, setCooldown] = useState(0) // seconds remaining before re-submit
  const lastSubmitRef = useRef(0)

  // Cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => {
      setCooldown((prev) => {
        const next = prev - 1
        return next > 0 ? next : 0
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Client-side cooldown
    const elapsed = Date.now() - lastSubmitRef.current
    if (elapsed < SUBMIT_COOLDOWN_MS) {
      setCooldown(Math.ceil((SUBMIT_COOLDOWN_MS - elapsed) / 1000))
      return
    }

    setStatus('submitting')
    lastSubmitRef.current = Date.now()

    try {
      if (!functions) throw new Error('Firebase not configured')
      const sendContactInquiry = httpsCallable(functions, 'sendContactInquiry')
      await sendContactInquiry({
        fromName: form.name,
        fromEmail: form.email,
        inquiryType: INQUIRY_OPTIONS.find((o) => o.value === form.inquiryType)?.label || form.inquiryType,
        dateNeeded: form.dateNeeded || 'Not specified',
        howFound: form.howFound || 'Not specified',
        message: form.message,
      })
      setStatus('success')
    } catch {
      setStatus('error')
      setCooldown(SUBMIT_COOLDOWN_MS / 1000)
    }
  }

  const scrollToForm = () => window.scrollTo({ top: 0, behavior: 'smooth' })

  return (
    <div className="contact-page content-page">

      {/* ── Header ── */}
      <div className="contact-header">
        <span className="home-overline">let&rsquo;s make something</span>
        <h1 className="contact-heading">Get in Touch</h1>
        <p className="contact-subhead">
          Whether you have a custom order in mind or just want to say hi, I&rsquo;d love to hear from you.
        </p>
        <p className="contact-response-note">
          <span className="contact-response-clock">⏱</span>
          I typically respond within <strong>1–2 business days</strong>.
          For time-sensitive orders, please include your date needed in the form.
        </p>
      </div>

      {/* ── Form ── */}
      <div className="contact-form-wrap">
        {status === 'success' ? (
          <div className="contact-success">
            <p className="contact-success-emoji">✉️</p>
            <h2 className="contact-success-heading">Message sent!</h2>
            <p className="contact-success-body">
              Thanks for reaching out, <strong>{form.name}</strong>.
              I&rsquo;ll get back to you within 1–2 business days.
            </p>
          </div>
        ) : (
          <form className="contact-form" onSubmit={handleSubmit} noValidate>

            {/* Row 1 — Name + Email */}
            <div className="contact-form-row contact-form-row--half">
              <label className="contact-label">
                Your Name *
                <input
                  className="text-input"
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  placeholder="First &amp; Last Name"
                  autoComplete="name"
                />
              </label>
              <label className="contact-label">
                Your Email *
                <input
                  className="text-input"
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </label>
            </div>

            {/* Row 2 — What are we creating + Date needed */}
            <div className="contact-form-row contact-form-row--half">
              <label className="contact-label">
                What are we creating? *
                <select
                  className="text-input contact-select"
                  name="inquiryType"
                  value={form.inquiryType}
                  onChange={handleChange}
                  required
                >
                  {INQUIRY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value} disabled={o.value === ''}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="contact-label">
                Date Needed By
                <input
                  className="text-input"
                  type="date"
                  name="dateNeeded"
                  value={form.dateNeeded}
                  onChange={handleChange}
                  min={today}
                />
              </label>
            </div>

            {/* Row 3 — How did you find me */}
            <label className="contact-label">
              How did you find me?
              <input
                className="text-input"
                type="text"
                name="howFound"
                value={form.howFound}
                onChange={handleChange}
                placeholder="Instagram, a friend, local pop-up…"
              />
            </label>

            {/* Row 4 — Message */}
            <label className="contact-label">
              Tell me more *
              <textarea
                className="text-input contact-textarea"
                name="message"
                value={form.message}
                onChange={handleChange}
                required
                placeholder="Describe what you have in mind — details, colors, occasion, quantity…"
                rows={5}
              />
            </label>

            {status === 'error' && (
              <p className="contact-error">
                Something went wrong — please try again or email me directly at{' '}
                <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a>.
              </p>
            )}

            <button
              type="submit"
              className="contact-submit-btn"
              disabled={status === 'submitting' || cooldown > 0}
            >
              {status === 'submitting'
                ? 'Sending…'
                : cooldown > 0
                  ? `Wait ${cooldown}s…`
                  : 'Send Message'}
            </button>
          </form>
        )}
      </div>

      {/* ── Three-column info strip ── */}
      <div className="contact-info-strip">

        <div className="contact-info-col">
          <span className="contact-info-icon" aria-hidden="true">✉</span>
          <h3 className="contact-info-heading">General Questions</h3>
          <p className="contact-info-body">
            Have a quick question? Send a direct email.
          </p>
          <a href={`mailto:${settings.contactEmail}`} className="contact-info-link">
            {settings.contactEmail}
          </a>
        </div>

        <div className="contact-info-col">
          <span className="contact-info-icon" aria-hidden="true">📋</span>
          <h3 className="contact-info-heading">Order Inquiries</h3>
          <p className="contact-info-body">
            Ready to start a custom order? Use the form above and I&rsquo;ll get back to you with details.
          </p>
          <button onClick={scrollToForm} className="contact-info-link contact-info-link--btn">
            Fill Out the Form ↑
          </button>
        </div>

        <div className="contact-info-col">
          <span className="contact-info-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor" className="contact-ig-svg" aria-label="Instagram">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
          </span>
          <h3 className="contact-info-heading">Stay Social</h3>
          <p className="contact-info-body">
            Follow along for glow tips, birthday signs, and behind-the-scenes.
          </p>
          <a href={settings.instagramUrl || '#'} target="_blank" rel="noreferrer" className="contact-info-link">
            Instagram
          </a>
        </div>

      </div>
    </div>
  )
}

