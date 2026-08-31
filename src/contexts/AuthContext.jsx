import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, getIdTokenResult, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { auth, hasFirebaseConfig } from '../services/firebase'
import { setAdminOnline, setAdminOffline } from '../services/chatService'
import { claimGuestOrders } from '../services/accountService'

const AuthContext = createContext(null)
const googleProvider = new GoogleAuthProvider()

const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [adminClaim, setAdminClaim] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!hasFirebaseConfig) {
      setLoading(false)
      return undefined
    }

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser)

      if (nextUser) {
        let tokenResult = null
        try {
          tokenResult = await getIdTokenResult(nextUser)
          setAdminClaim(Boolean(tokenResult.claims?.admin))
        } catch {
          setAdminClaim(false)
        }

        // Write presence if admin
        const isAdminUser =
          Boolean(tokenResult?.claims?.admin) ||
          (nextUser.email && adminEmails.includes(nextUser.email.toLowerCase()))
        if (isAdminUser) {
          setAdminOnline(nextUser.uid, nextUser.email).catch(() => {})
        }
      } else {
        setAdminClaim(false)
      }

      setLoading(false)
    })

    return unsubscribe
  }, [])

  const login = useCallback((email, password) => {
    if (!hasFirebaseConfig) throw new Error('Firebase is not configured. Add env keys first.')
    const promise = signInWithEmailAndPassword(auth, email, password)
    promise.then(() => claimGuestOrders().catch(() => {}))
    return promise
  }, [])

  const loginWithGoogle = useCallback(() => {
    if (!hasFirebaseConfig) throw new Error('Firebase is not configured. Add env keys first.')
    const promise = signInWithPopup(auth, googleProvider)
    promise.then(() => claimGuestOrders().catch(() => {}))
    return promise
  }, [])

  const uid = user?.uid
  const logout = useCallback(() => {
    if (!hasFirebaseConfig) return Promise.resolve()
    if (uid) setAdminOffline(uid).catch(() => {})
    return signOut(auth)
  }, [uid])

  // Clean up presence on tab close / refresh
  useEffect(() => {
    if (!user?.uid) return

    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable cleanup during page unload
      // Fallback: the presence doc will be force-deleted on next login anyway
      setAdminOffline(user.uid).catch(() => {})
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [user?.uid])

  const createAccount = useCallback(async (email, password, displayName) => {
    if (!hasFirebaseConfig) throw new Error('Firebase is not configured.')
    const result = await createUserWithEmailAndPassword(auth, email, password)
    if (displayName?.trim()) {
      await updateProfile(result.user, { displayName: displayName.trim() })
    }
    claimGuestOrders().catch(() => {})
    return result
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      // `admin` custom claim is preferred; email allowlist remains as migration fallback.
      isAdmin: Boolean(adminClaim || (user?.email && adminEmails.includes(user.email.toLowerCase()))),
      login,
      loginWithGoogle,
      logout,
      createAccount,
      hasFirebaseConfig,
    }),
    [user, loading, adminClaim, login, loginWithGoogle, logout, createAccount],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return context
}
