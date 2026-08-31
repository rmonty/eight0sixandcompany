import { useEffect, useMemo, useState } from 'react'
import { useCart } from '../contexts/CartContext'
import { useSettings } from '../contexts/SettingsContext'
import { getProductsByIds } from '../services/productsService'
import { calculateOrderTotals, mergeItemShippingFields } from '../utils/shipping'

export function useOrderTotals(fulfillmentMethod = 'ship', { deliveryQuote = null } = {}) {
  const { items, appliedCoupon, appliedGiftCard } = useCart()
  const { settings, loading: settingsLoading } = useSettings()
  const [productsById, setProductsById] = useState({})
  const [productsLoading, setProductsLoading] = useState(false)

  const productIds = useMemo(
    () => [...new Set(items.map((item) => item.id).filter(Boolean))],
    [items],
  )

  useEffect(() => {
    let cancelled = false

    if (!productIds.length) {
      setProductsById({})
      setProductsLoading(false)
      return undefined
    }

    setProductsLoading(true)
    getProductsByIds(productIds)
      .then((products) => {
        if (cancelled) return
        const next = {}
        products.forEach((product) => {
          next[product.id] = product
        })
        setProductsById(next)
      })
      .catch(() => {
        if (!cancelled) setProductsById({})
      })
      .finally(() => {
        if (!cancelled) setProductsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [productIds])

  const enrichedItems = useMemo(
    () => items.map((item) => mergeItemShippingFields(item, productsById[item.id] || {})),
    [items, productsById],
  )

  const totals = useMemo(
    () =>
      calculateOrderTotals({
        items: enrichedItems,
        fulfillmentMethod,
        settings,
        discountPercent: appliedCoupon?.discountPercent || 0,
        deliveryQuote,
        giftCardBalance: appliedGiftCard?.remainingBalance || 0,
      }),
    [
      enrichedItems,
      fulfillmentMethod,
      settings,
      appliedCoupon?.discountPercent,
      deliveryQuote,
      appliedGiftCard?.remainingBalance,
    ],
  )

  return {
    ...totals,
    enrichedItems,
    loading: settingsLoading || productsLoading,
  }
}
