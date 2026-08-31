import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'

/**
 * Links any past guest orders (placed with the user's email while not logged in)
 * to the authenticated user's account. Safe to fire-and-forget after sign-in.
 */
export const claimGuestOrders = async () => {
  if (!functions) return { claimed: 0 }
  const fn = httpsCallable(functions, 'claimGuestOrders')
  const result = await fn({})
  return result.data
}
