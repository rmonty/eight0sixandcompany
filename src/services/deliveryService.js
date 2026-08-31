import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'

export const quoteDeliveryFee = async (destinationAddress) => {
  if (!functions) {
    return { fee: 0, miles: 0, usedMileage: false }
  }

  const fn = httpsCallable(functions, 'quoteDeliveryFee')
  const result = await fn({ destinationAddress })
  return result.data
}
