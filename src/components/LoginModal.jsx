import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { PasswordInput } from './PasswordInput'

export function LoginModal({ isOpen, onClose, initialMode = 'signin', initialEmail = '' }) {
  const { login, loginWithGoogle, createAccount } = useAuth()
  const [mode, setMode] = useState(initialMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const switchMode = (next) => {
    setMode(next)
    setError('')
    setPassword('')
    setConfirm('')
  }

  const handleEmailSubmit = async (event) => {
    event.preventDefault()
    setError('')
    if (mode === 'signup' && password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      if (mode === 'signup') {
        await createAccount(email, password, name)
      } else {
        await login(email, password)
      }
      onClose()
    } catch (err) {
      setError(err.message || (mode === 'signup' ? 'Could not create account.' : 'Login failed. Check email and password.'))
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setError('')
    setLoading(true)
    try {
      await loginWithGoogle()
      onClose()
    } catch (err) {
      setError(err.message || 'Google login failed.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const isSignUp = mode === 'signup'

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div className="login-modal">
        <div className="login-modal-content">
          <div className="login-modal-header">
            <h2>{isSignUp ? 'Create Account' : 'Sign In'}</h2>
            <button type="button" className="close-btn" onClick={onClose} aria-label="Close">✕</button>
          </div>

          <div className="login-mode-tabs">
            <button type="button" className={`login-mode-tab${!isSignUp ? ' login-mode-tab--active' : ''}`} onClick={() => switchMode('signin')}>Sign In</button>
            <button type="button" className={`login-mode-tab${isSignUp ? ' login-mode-tab--active' : ''}`} onClick={() => switchMode('signup')}>Create Account</button>
          </div>

          {error && <p className="error-msg">{error}</p>}

          <form onSubmit={handleEmailSubmit} className="form-stack">
            {isSignUp && (
              <input
                type="text"
                className="text-input"
                placeholder="Your Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                required
                autoComplete="name"
              />
            )}
            <input
              type="email"
              className="text-input"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
              autoComplete="email"
            />
            <PasswordInput
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
            />
            {isSignUp && (
              <PasswordInput
                placeholder="Confirm Password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={loading}
                required
                autoComplete="new-password"
              />
            )}
            <button type="submit" className="primary-btn" disabled={loading}>
              {loading ? (isSignUp ? 'Creating…' : 'Signing in…') : (isSignUp ? 'Create Account' : 'Sign In')}
            </button>
          </form>

          <div className="login-divider">or</div>

          <button type="button" className="google-btn" onClick={handleGoogleLogin} disabled={loading}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v12M6 12h12" />
            </svg>
            {isSignUp ? 'Sign up with Google' : 'Sign in with Google'}
          </button>
        </div>
      </div>
    </>
  )
}
