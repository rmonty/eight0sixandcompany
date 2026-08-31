import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'

export const getAnalyticsSummary = async () => {
  if (!functions) return null
  const fn = httpsCallable(functions, 'getAnalyticsSummary')
  const result = await fn()
  return result.data
}
