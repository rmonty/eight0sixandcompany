import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { getActiveCouponByCode, normalizeCouponCode } from '../services/couponsService'
import { getUserCart, mergeCartItems, saveUserCart } from '../services/cartService'
import { lookupGiftCard } from '../services/giftCardsService'
import { getCouponScheduleError } from '../utils/couponValidity'
import { normalizeGiftCardCode, normalizeMoney } from '../utils/giftCards'
import { useAuth } from './AuthContext'

const CartContext = createContext(null)

const CART_KEY = 'aubs-ends-cart'
const COUPON_KEY = 'aubs-ends-coupon'
const GIFT_CARD_KEY = 'aubs-ends-gift-card'

const readLocalItems = () => {
  try {
    const saved = localStorage.getItem(CART_KEY)
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

const readLocalCoupon = () => {
  try {
    const saved = localStorage.getItem(COUPON_KEY)
    if (!saved) return null
    const parsed = JSON.parse(saved)
    if (!parsed?.code || !parsed?.discountPercent) return null
    return {
      id: parsed.id || null,
      code: String(parsed.code || '').trim() || normalizeCouponCode(parsed.normalizedCode),
      normalizedCode: normalizeCouponCode(parsed.normalizedCode || parsed.code),
      discountPercent: Number(parsed.discountPercent),
    }
  } catch {
    return null
  }
}

const readLocalGiftCard = () => {
  try {
    const saved = localStorage.getItem(GIFT_CARD_KEY)
    if (!saved) return null
    const parsed = JSON.parse(saved)
    const remainingBalance = normalizeMoney(parsed.remainingBalance)
    if (!parsed?.code || remainingBalance <= 0) return null
    return {
      id: parsed.id || null,
      code: String(parsed.code || '').trim(),
      normalizedCode: normalizeGiftCardCode(parsed.normalizedCode || parsed.code),
      remainingBalance,
      initialAmount: normalizeMoney(parsed.initialAmount),
    }
  } catch {
    return null
  }
}

export function CartProvider({ children }) {
  const { user, loading: authLoading } = useAuth()
  const [items, setItems] = useState(readLocalItems)
  const [appliedCoupon, setAppliedCoupon] = useState(readLocalCoupon)
  const [appliedGiftCard, setAppliedGiftCard] = useState(readLocalGiftCard)
  const [cartReady, setCartReady] = useState(false)
  const skipNextCloudSave = useRef(false)
  const syncedUid = useRef(null)

  // Persist locally for guests and as a cache for signed-in users
  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(items))
  }, [items])

  useEffect(() => {
    if (appliedCoupon) {
      localStorage.setItem(COUPON_KEY, JSON.stringify(appliedCoupon))
      return
    }
    localStorage.removeItem(COUPON_KEY)
  }, [appliedCoupon])

  useEffect(() => {
    if (appliedGiftCard) {
      localStorage.setItem(GIFT_CARD_KEY, JSON.stringify(appliedGiftCard))
      return
    }
    localStorage.removeItem(GIFT_CARD_KEY)
  }, [appliedGiftCard])

  // On sign-in: load cloud cart, merge with this device, write back
  useEffect(() => {
    if (authLoading) return undefined

    if (!user?.uid) {
      syncedUid.current = null
      setCartReady(true)
      return undefined
    }

    if (syncedUid.current === user.uid) {
      setCartReady(true)
      return undefined
    }

    let cancelled = false
    setCartReady(false)

    ;(async () => {
      try {
        const remote = await getUserCart(user.uid)
        if (cancelled) return

        const localItems = readLocalItems()
        const localCoupon = readLocalCoupon()
        const localGiftCard = readLocalGiftCard()
        const mergedItems = mergeCartItems(localItems, remote.items)
        const mergedCoupon = localCoupon || remote.appliedCoupon || null
        const mergedGiftCard = localGiftCard || remote.appliedGiftCard || null

        skipNextCloudSave.current = true
        setItems(mergedItems)
        setAppliedCoupon(mergedCoupon)
        setAppliedGiftCard(mergedGiftCard)
        syncedUid.current = user.uid

        await saveUserCart(user.uid, {
          items: mergedItems,
          appliedCoupon: mergedCoupon,
          appliedGiftCard: mergedGiftCard,
        })
      } catch (err) {
        console.error('Failed to sync cart:', err)
        syncedUid.current = user.uid
      } finally {
        if (!cancelled) setCartReady(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user?.uid, authLoading])

  // Debounced cloud save while signed in
  useEffect(() => {
    if (!user?.uid || !cartReady || syncedUid.current !== user.uid) return undefined
    if (skipNextCloudSave.current) {
      skipNextCloudSave.current = false
      return undefined
    }

    const timer = setTimeout(() => {
      saveUserCart(user.uid, { items, appliedCoupon, appliedGiftCard }).catch((err) => {
        console.error('Failed to save cart:', err)
      })
    }, 400)

    return () => clearTimeout(timer)
  }, [items, appliedCoupon, appliedGiftCard, user?.uid, cartReady])

  // Re-check applied coupon schedule (local dates + live fetch)
  useEffect(() => {
    if (!appliedCoupon?.code && !appliedCoupon?.normalizedCode) return undefined

    // Immediate check if schedule was stored on the applied coupon
    if (getCouponScheduleError(appliedCoupon)) {
      setAppliedCoupon(null)
      return undefined
    }

    let cancelled = false
    const revalidate = async () => {
      try {
        const coupon = await getActiveCouponByCode(appliedCoupon.normalizedCode || appliedCoupon.code)
        if (cancelled) return
        if (!coupon || getCouponScheduleError(coupon)) {
          setAppliedCoupon(null)
        }
      } catch {
        // Keep current coupon if the network check fails
      }
    }

    revalidate()
    const timer = setInterval(revalidate, 60_000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [appliedCoupon?.code, appliedCoupon?.normalizedCode, appliedCoupon?.startDate, appliedCoupon?.endDate])

  // Re-check applied gift card balance
  useEffect(() => {
    if (!appliedGiftCard?.normalizedCode && !appliedGiftCard?.code) return undefined

    let cancelled = false
    const revalidate = async () => {
      try {
        const result = await lookupGiftCard(appliedGiftCard.normalizedCode || appliedGiftCard.code)
        if (cancelled) return
        if (!result?.ok || !result.giftCard) {
          setAppliedGiftCard(null)
          return
        }
        setAppliedGiftCard({
          id: result.giftCard.id,
          code: result.giftCard.code,
          normalizedCode: result.giftCard.normalizedCode,
          remainingBalance: normalizeMoney(result.giftCard.remainingBalance),
          initialAmount: normalizeMoney(result.giftCard.initialAmount),
        })
      } catch {
        // Keep current gift card if the network check fails
      }
    }

    revalidate()
    const timer = setInterval(revalidate, 60_000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [appliedGiftCard?.code, appliedGiftCard?.normalizedCode])

  const addItem = (product, quantity = 1) => {
    setItems((prev) => {
      const itemKey = product.cartKey || product.id
      const found = prev.find((item) => (item.cartKey || item.id) === itemKey)
      if (found) {
        return prev.map((item) =>
          (item.cartKey || item.id) === itemKey ? { ...item, quantity: item.quantity + quantity } : item,
        )
      }
      return [...prev, { ...product, cartKey: itemKey, quantity }]
    })
  }

  const updateItemQuantity = (itemKey, quantity) => {
    setItems((prev) => prev.map((item) => ((item.cartKey || item.id) === itemKey ? { ...item, quantity } : item)))
  }

  const updateItemNeedByDate = (itemKey, needByDate) => {
    setItems((prev) =>
      prev.map((item) => ((item.cartKey || item.id) === itemKey ? { ...item, needByDate } : item)),
    )
  }

  const removeItem = (itemKey) => {
    setItems((prev) => prev.filter((item) => (item.cartKey || item.id) !== itemKey))
  }

  const clearCart = () => {
    setItems([])
    setAppliedCoupon(null)
    setAppliedGiftCard(null)
  }

  const clearCouponCode = () => setAppliedCoupon(null)
  const clearGiftCardCode = () => setAppliedGiftCard(null)

  const applyCouponCode = async (code) => {
    const normalizedCode = normalizeCouponCode(code)
    if (!normalizedCode) {
      return { ok: false, message: 'Enter a coupon code.' }
    }

    const coupon = await getActiveCouponByCode(normalizedCode)
    if (!coupon) {
      setAppliedCoupon(null)
      return { ok: false, message: 'Invalid or inactive coupon code.' }
    }

    const discountPercent = Number(coupon.discountPercent || 0)
    if (!Number.isFinite(discountPercent) || discountPercent <= 0) {
      setAppliedCoupon(null)
      return { ok: false, message: 'This coupon is not valid.' }
    }

    const scheduleError = getCouponScheduleError(coupon)
    if (scheduleError) {
      setAppliedCoupon(null)
      return { ok: false, message: scheduleError }
    }

    const normalizedCoupon = {
      id: coupon.id,
      code: coupon.code || normalizedCode,
      normalizedCode: normalizeCouponCode(coupon.normalizedCode || coupon.code || normalizedCode),
      discountPercent: Math.min(100, Math.max(0, Number(discountPercent.toFixed(2)))),
      startDate: coupon.startDate || null,
      endDate: coupon.endDate || null,
    }

    setAppliedCoupon(normalizedCoupon)
    return {
      ok: true,
      message: `${normalizedCoupon.discountPercent}% discount applied.`,
      coupon: normalizedCoupon,
    }
  }

  const applyGiftCardCode = async (code) => {
    const result = await lookupGiftCard(code)
    if (!result?.ok || !result.giftCard) {
      setAppliedGiftCard(null)
      return { ok: false, message: result?.message || 'Invalid or unused gift card.' }
    }

    const next = {
      id: result.giftCard.id,
      code: result.giftCard.code,
      normalizedCode: result.giftCard.normalizedCode,
      remainingBalance: normalizeMoney(result.giftCard.remainingBalance),
      initialAmount: normalizeMoney(result.giftCard.initialAmount),
    }

    setAppliedGiftCard(next)
    return {
      ok: true,
      message: `Gift card applied (${next.remainingBalance.toFixed(2)} available).`,
      giftCard: next,
    }
  }

  const value = useMemo(() => {
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)
    const subtotal = Number(
      items.reduce((sum, item) => sum + item.quantity * Number(item.price || 0), 0).toFixed(2),
    )
    const discountPercent = Math.min(100, Math.max(0, Number(appliedCoupon?.discountPercent || 0)))
    const discountAmount = Number((subtotal * (discountPercent / 100)).toFixed(2))
    const total = Number(Math.max(0, subtotal - discountAmount).toFixed(2))

    return {
      items,
      itemCount,
      subtotal,
      discountAmount,
      appliedCoupon,
      appliedGiftCard,
      total,
      cartReady,
      addItem,
      updateItemQuantity,
      updateItemNeedByDate,
      removeItem,
      clearCart,
      applyCouponCode,
      clearCouponCode,
      applyGiftCardCode,
      clearGiftCardCode,
    }
  }, [items, appliedCoupon, appliedGiftCard, cartReady])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export const useCart = () => {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within CartProvider')
  }
  return context
}
