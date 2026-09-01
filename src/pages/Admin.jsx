import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSettings } from '../contexts/SettingsContext'
import { defaultSettings } from '../config/defaults'
import { createManualOrder, deleteOrder, getOrders, removeOrderNoteImages, updateOrder } from '../services/ordersService'
import { getNotionSettings, updateNotionSettings } from '../services/settingsService'
import { createProduct, getProducts, removeProduct, updateProduct } from '../services/productsService'
import { BookingAdminFields } from '../components/BookingAdminFields'
import { getDefaultProductBooking } from '../services/bookingService'
import { createGalleryItem, getGalleryItems, removeGalleryItem, updateGalleryItem } from '../services/galleryService'
import { uploadProductMedia, uploadProductBlob } from '../services/mediaService'
import { ImageEditor } from '../components/ImageEditor'
import { RichTextEditor } from '../components/RichTextEditor'
import { ManualOrderModal } from '../components/ManualOrderModal'
import { sendFulfillmentStatusEmail, sendOrderEmails, sendShippingEmail } from '../services/emailService'
import { listenActiveChats, listenMessages, sendMessage, markAdminRead, closeChat } from '../services/chatService'
import { getAnalyticsSummary } from '../services/analyticsService'
import { listenCurrentVisitors } from '../services/sitePresenceService'
import {
  createCoupon,
  formatCouponCode,
  getCoupons,
  normalizeCouponCode,
  removeCoupon,
  updateCoupon,
} from '../services/couponsService'
import {
  createGiftCard,
  formatGiftCardCode,
  generateGiftCardCode,
  getGiftCards,
  removeGiftCard,
  updateGiftCard,
} from '../services/giftCardsService'
import { toCurrency } from '../utils/currency'
import { formatSelectedVariants } from '../utils/variantDisplay'
import { collectOrderNoteImageUrls } from '../utils/orderNoteImages'
import {
  fromDatetimeLocalValue,
  formatProductLiveAt,
  getProductVisibilityLabel,
  toDatetimeLocalValue,
} from '../utils/productVisibility'

const tabs = ['Products', 'Gallery', 'Categories', 'Store', 'Payments', 'Coupons', 'Gift Cards', 'Orders', 'About', 'Chat', 'Analytics']

const emptyProduct = {
  name: '',
  description: '',
  pricingMode: 'standard',
  price: 0,
  minPrice: '',
  maxPrice: '',
  enableEmbroideryAddOn: false,
  embroideryAddOnPrice: 8,
  category: '',
  images: [],
  video: '',
  inStock: true,
  quantity: 1,
  featured: false,
  visible: true,
  liveAt: '',
  shippable: true,
  localOnly: false,
  shippingSurcharge: 0,
  requiresNeedByDate: false,
  variants: [],
  booking: getDefaultProductBooking(),
}

const emptyGalleryItem = {
  title: '',
  type: '',
  description: '',
  images: [],
  image: '',
  pinned: false,
}

const emptyCoupon = {
  code: '',
  discountPercent: 10,
  active: true,
  startDate: '',
  endDate: '',
}

const emptyGiftCard = {
  code: '',
  initialAmount: 25,
  remainingBalance: 25,
  active: true,
  notes: '',
}

export function Admin() {
  const { user, isAdmin, login, logout, hasFirebaseConfig } = useAuth()
  const { settings, saveSettings, updateShippingSettings } = useSettings()
  const [activeTab, setActiveTab] = useState('Products')
  const [products, setProducts] = useState([])
  const [galleryItems, setGalleryItems] = useState([])
  const [orders, setOrders] = useState([])
  const [coupons, setCoupons] = useState([])
  const [giftCards, setGiftCards] = useState([])
  const [ordersView, setOrdersView] = useState('active')
  const [draftProduct, setDraftProduct] = useState(emptyProduct)
  const [galleryDraft, setGalleryDraft] = useState(emptyGalleryItem)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [categoryDraft, setCategoryDraft] = useState('')
  const [status, setStatus] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isHeroUploading, setIsHeroUploading] = useState(false)
  const [isGalleryUploading, setIsGalleryUploading] = useState(false)
  const [swatchUploadingFor, setSwatchUploadingFor] = useState(null)
  const [editingProductId, setEditingProductId] = useState(null)
  const [editingGalleryId, setEditingGalleryId] = useState(null)
  const [editingCouponId, setEditingCouponId] = useState(null)
  const [editingGiftCardId, setEditingGiftCardId] = useState(null)
  const [categoryUploadingFor, setCategoryUploadingFor] = useState(null)
  const [craftCardUploadingFor, setCraftCardUploadingFor] = useState(null)
  const [editingImageIdx, setEditingImageIdx] = useState(null)
  const [editingGalleryImageIdx, setEditingGalleryImageIdx] = useState(null)
  const [editingHeroImageIdx, setEditingHeroImageIdx] = useState(null)
  const [editingOrderId, setEditingOrderId] = useState(null)
  const [orderDraft, setOrderDraft] = useState(null)
  const [aboutDraft, setAboutDraft] = useState(() => ({ ...defaultSettings.about }))
  const [couponDraft, setCouponDraft] = useState(emptyCoupon)
  const [giftCardDraft, setGiftCardDraft] = useState(emptyGiftCard)
  const [shippingModal, setShippingModal] = useState(null)
  const [showManualOrderForm, setShowManualOrderForm] = useState(false)
  const [notionSettings, setNotionSettings] = useState({ enabled: false, databaseId: '' })
  const [savingNotionSettings, setSavingNotionSettings] = useState(false)
  const [backfillingNotion, setBackfillingNotion] = useState(false)

  // ── Chat state ──
  const [activeChats, setActiveChats] = useState([])
  const [selectedChatId, setSelectedChatId] = useState(null)
  const [adminMessages, setAdminMessages] = useState([])
  const [adminText, setAdminText] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const knownChatIds = useRef(null)
  const [analytics, setAnalytics] = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsError, setAnalyticsError] = useState('')
  const [currentVisitors, setCurrentVisitors] = useState(0)

  const totalUnreadAdmin = activeChats.reduce((sum, c) => sum + (c.unreadAdmin || 0), 0)
  const heroImages = useMemo(() => {
    if (Array.isArray(settings.homeHeroPhotoUrls)) {
      const valid = settings.homeHeroPhotoUrls.filter(Boolean)
      if (valid.length > 0) return valid
    }
    const single = settings.homeHeroPhotoUrl?.trim()
    return single ? [single] : []
  }, [settings.homeHeroPhotoUrls, settings.homeHeroPhotoUrl])

  const saveHeroImages = async (urls) => {
    await saveSettings({ homeHeroPhotoUrls: urls, homeHeroPhotoUrl: urls[0] || '' })
  }

  // Sync aboutDraft once when settings first load from Firestore
  useEffect(() => {
    if (settings.about) {
      setAboutDraft({ ...defaultSettings.about, ...settings.about })
    }
  // Only run when settings.about reference changes (i.e. initial load)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!settings.about])

  // ── Chat: listen for active conversations ──
  useEffect(() => {
    if (!isAdmin) return
    return listenActiveChats(setActiveChats)
  }, [isAdmin])

  // ── Chat: browser notifications for new chats ──
  useEffect(() => {
    if (!isAdmin) return
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
    const currentIds = activeChats.map((c) => c.id)
    if (knownChatIds.current !== null) {
      const newChats = activeChats.filter((c) => !knownChatIds.current.includes(c.id))
      if (newChats.length > 0 && Notification.permission === 'granted') {
        newChats.forEach((c) => {
          new Notification('New Chat — 806 & CO.', {
            body: `${c.visitorName || 'A visitor'} started a conversation`,
            icon: '/smallicon.png',
          })
        })
      }
    }
    knownChatIds.current = currentIds
  }, [activeChats, isAdmin])

  // ── Chat: page title flash when unread and not on Chat tab ──
  useEffect(() => {
    if (!isAdmin) return
    const base = 'eight0sixandcompany'
    if (totalUnreadAdmin > 0 && activeTab !== 'Chat') {
      let toggle = false
      const interval = setInterval(() => {
        document.title = toggle
          ? base
          : `💬 ${totalUnreadAdmin} new message${totalUnreadAdmin > 1 ? 's' : ''} | Admin`
        toggle = !toggle
      }, 1500)
      return () => {
        clearInterval(interval)
        document.title = base
      }
    }
    document.title = base
  }, [totalUnreadAdmin, activeTab, isAdmin])

  // ── Chat: listen for messages in selected conversation ──
  useEffect(() => {
    if (!selectedChatId) {
      setAdminMessages([])
      return
    }
    // Mark as read when admin selects a chat
    markAdminRead(selectedChatId).catch(() => {})
    return listenMessages(selectedChatId, setAdminMessages)
  }, [selectedChatId])

  useEffect(() => {
    if (!isAdmin) return

    getProducts({ includeHidden: true }).then(setProducts)
    getGalleryItems().then(setGalleryItems)
    getOrders().then(setOrders)
    getCoupons().then(setCoupons)
    getGiftCards().then(setGiftCards)
    getNotionSettings().then(setNotionSettings)
  }, [isAdmin])

  // ── Analytics: fetch summary when Analytics tab is opened ──
  useEffect(() => {
    if (!isAdmin || activeTab !== 'Analytics') return
    let cancelled = false

    const load = async () => {
      setAnalyticsLoading(true)
      setAnalyticsError('')
      try {
        const data = await getAnalyticsSummary()
        if (!cancelled) {
          setAnalytics(data)
        }
      } catch (err) {
        if (!cancelled) {
          setAnalyticsError(err?.message || 'Failed to load analytics.')
        }
      } finally {
        if (!cancelled) {
          setAnalyticsLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [activeTab, isAdmin])

  useEffect(() => {
    if (!isAdmin || activeTab !== 'Analytics') return undefined
    return listenCurrentVisitors(setCurrentVisitors)
  }, [activeTab, isAdmin])

  const refreshProducts = async () => {
    setProducts(await getProducts({ includeHidden: true }))
  }

  const refreshOrders = async () => {
    setOrders(await getOrders())
  }

  const handleSaveNotionSettings = async () => {
    setSavingNotionSettings(true)
    try {
      await updateNotionSettings(notionSettings)
      setStatus('Notion sync settings saved.')
    } catch (err) {
      setStatus(`Failed to save Notion sync settings: ${err.message}`)
    } finally {
      setSavingNotionSettings(false)
    }
  }

  const handleBackfillNotion = async () => {
    const unsynced = orders.filter((o) => !o.notionPageId && !o.archived)
    if (unsynced.length === 0) {
      setStatus('All orders are already synced to Notion.')
      return
    }
    setBackfillingNotion(true)
    setStatus(`Queuing ${unsynced.length} order(s) for Notion sync…`)
    let done = 0
    for (const order of unsynced) {
      try {
        await updateOrder(order.id, { updatedAt: Date.now() })
        done++
      } catch {
        // continue on individual failures
      }
    }
    setStatus(`Triggered Notion sync for ${done} of ${unsynced.length} order(s). Check back in a minute.`)
    setBackfillingNotion(false)
  }

  const handleSaveManualOrder = async (draft) => {
    const { sendEmail, ...orderInput } = draft
    const saved = await createManualOrder(orderInput)
    await refreshOrders()
    setShowManualOrderForm(false)
    setStatus(`Manual order ${saved.id} created.`)

    if (sendEmail) {
      try {
        await sendOrderEmails({
          orderId: saved.id,
          customer: saved.customer,
          items: saved.items,
          subtotal: saved.subtotal != null ? `${Number(saved.subtotal).toFixed(2)}` : undefined,
          shipping: saved.shipping > 0 ? `${Number(saved.shipping).toFixed(2)}` : undefined,
          total: `${Number(saved.total || 0).toFixed(2)}`,
          paymentMethod: saved.paymentMethod,
          fulfillmentMethod: saved.fulfillmentMethod,
          noteToSeller: saved.notes,
        })
        setStatus(`Manual order ${saved.id} created and confirmation email sent.`)
      } catch (err) {
        setStatus(`Manual order ${saved.id} created, but confirmation email failed: ${err.message}`)
      }
    }
  }

  const guessProductLine = (name = '') => {
    const n = name.toLowerCase()
    if (/\bcake\b|\bcakes\b/.test(n)) return 'Custom Cakes'
    if (/cookie|brownie|snickerdoodle|shortbread/.test(n)) return 'Cookies'
    if (/embroi|monogram|stitch|hoodie|shirt|hat|tote/.test(n)) return 'Embroidery'
    if (/gift|basket|set/.test(n)) return 'Gift Sets'
    if (/bread|muffin|cupcake|baked|bake|pastry|roll|bun/.test(n)) return 'Baked Goods'
    return 'Other'
  }

  const toPaymentLabel = (method) => {
    const map = { venmo: 'Venmo', paypal: 'PayPal', cashapp: 'Other', contact: 'Other', giftcard: 'Gift Card' }
    return map[method] || 'Other'
  }

  const handleExportBudgetData = () => {
    const incomeRows = orders.map((order) => {
      let dateStr = ''
      let monthNum = ''
      if (order.createdAt) {
        const ts = order.createdAt.seconds
          ? new Date(order.createdAt.seconds * 1000)
          : new Date(order.createdAt)
        dateStr = ts.toISOString().slice(0, 10)
        monthNum = ts.getMonth() + 1
      }

      const itemNames = (order.items || []).map((i) => i.name || '')
      const guesses = itemNames.map(guessProductLine)
      const freq = {}
      guesses.forEach((g) => { freq[g] = (freq[g] || 0) + 1 })
      const productLine = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Other'

      const description = (order.items || [])
        .map((i) => `${i.quantity}x ${i.name}`)
        .join(', ')

      return {
        date: dateStr,
        month: monthNum,
        amount: order.total ?? 0,
        productLine,
        description,
        platform: 'Website',
        paymentMethod: toPaymentLabel(order.paymentMethod),
        orderNumber: order.id,
        notes: [
          order.discount?.code ? `Coupon: ${order.discount.code}` : '',
          order.giftCard?.code
            ? `Gift card: ${order.giftCard.code} (−$${Number(order.giftCard.amount || 0).toFixed(2)})`
            : '',
        ]
          .filter(Boolean)
          .join('; '),
      }
    })

    const payload = {
      exportedAt: new Date().toISOString().slice(0, 10),
      source: '806 & CO. Website Orders',
      exportedOrderCount: incomeRows.length,
      incomeRows,
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Eight0SixAndCompany_Orders_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const refreshCoupons = async () => {
    setCoupons(await getCoupons())
  }

  const refreshGiftCards = async () => {
    setGiftCards(await getGiftCards())
  }

  const refreshGallery = async () => {
    setGalleryItems(await getGalleryItems())
  }

  const handleOrderStatusChange = async (order, nextStatus, trackingNumber = '', { resendEmail = false } = {}) => {
    const updates = { status: nextStatus }
    const trimmedTracking = trackingNumber.trim()

    if (trimmedTracking) {
      updates.trackingNumber = trimmedTracking
    }

    await updateOrder(order.id, updates)

    const shouldSendShippingEmail =
      nextStatus === 'Shipped' && (resendEmail || !order.shippingNotifiedAt)

    if (shouldSendShippingEmail) {
      try {
        const result = await sendShippingEmail({
          orderId: order.id,
          customer: order.customer,
          trackingNumber: trimmedTracking || order.trackingNumber || '',
        })

        if (result?.sent) {
          await updateOrder(order.id, { shippingNotifiedAt: new Date().toISOString() })
          setStatus(
            resendEmail
              ? `Shipping notification resent for order ${order.id}`
              : `Shipping notification sent for order ${order.id}`,
          )
        } else if (result?.reason === 'missing-config') {
          setStatus(`Order ${order.id} marked Shipped, but shipping email is not configured yet.`)
        } else if (result?.reason === 'missing-customer-email') {
          setStatus(`Order ${order.id} marked Shipped, but customer email is missing.`)
        } else {
          setStatus(`Order ${order.id} marked Shipped, but shipping email was not sent.`)
        }
      } catch (err) {
        setStatus(`Shipping email failed for order ${order.id}: ${err.message}`)
      }
    }

    const fulfillmentStatusEmails = {
      Delivered: {
        notifiedField: 'deliveredNotifiedAt',
        sentLabel: 'Delivery notification sent',
        missingLabel: 'delivery email',
      },
      'Picked Up': {
        notifiedField: 'pickedUpNotifiedAt',
        sentLabel: 'Pickup notification sent',
        missingLabel: 'pickup email',
      },
    }

    const fulfillmentEmail = fulfillmentStatusEmails[nextStatus]
    if (fulfillmentEmail && !order[fulfillmentEmail.notifiedField]) {
      try {
        const result = await sendFulfillmentStatusEmail({
          orderId: order.id,
          customer: order.customer,
          status: nextStatus,
        })

        if (result?.sent) {
          await updateOrder(order.id, { [fulfillmentEmail.notifiedField]: new Date().toISOString() })
          setStatus(`${fulfillmentEmail.sentLabel} for order ${order.id}`)
        } else if (result?.reason === 'missing-config') {
          setStatus(`Order ${order.id} marked ${nextStatus}, but email is not configured yet.`)
        } else if (result?.reason === 'missing-customer-email') {
          setStatus(`Order ${order.id} marked ${nextStatus}, but customer email is missing.`)
        } else {
          setStatus(`Order ${order.id} marked ${nextStatus}, but ${fulfillmentEmail.missingLabel} was not sent.`)
        }
      } catch (err) {
        setStatus(`${fulfillmentEmail.missingLabel} failed for order ${order.id}: ${err.message}`)
      }
    }

    refreshOrders()
  }

  const startEditOrder = (order) => {
    setEditingOrderId(order.id)
    setOrderDraft({
      customer: {
        name: order.customer?.name || '',
        email: order.customer?.email || '',
        phone: order.customer?.phone || '',
        address: {
          street: order.customer?.address?.street || '',
          city: order.customer?.address?.city || '',
          state: order.customer?.address?.state || '',
          zip: order.customer?.address?.zip || '',
        },
      },
      items: (order.items || []).map((item) => ({ ...item })),
      paymentMethod: order.paymentMethod || '',
      fulfillmentMethod: order.fulfillmentMethod || 'ship',
      trackingNumber: order.trackingNumber || '',
      notes: order.notes || '',
      internalNotes: order.internalNotes || '',
      shipping: order.shipping != null ? Number(order.shipping) : 0,
      total: order.total != null ? Number(order.total) : 0,
      status: order.status || 'Pending',
    })
  }

  const cancelEditOrder = () => {
    setEditingOrderId(null)
    setOrderDraft(null)
  }

  const saveEditOrder = async () => {
    const subtotal = orderDraft.items.reduce(
      (s, item) => s + Number(item.price || 0) * Number(item.quantity || 1),
      0,
    )
    await updateOrder(editingOrderId, {
      ...orderDraft,
      subtotal: Number(subtotal.toFixed(2)),
    })
    setEditingOrderId(null)
    setOrderDraft(null)
    refreshOrders()
    setStatus(`Order ${editingOrderId} updated.`)
  }

  const handleOrderStatusSelect = async (order, nextStatus) => {
    if (nextStatus === 'Shipped' && order.status !== 'Shipped') {
      setShippingModal({
        order,
        trackingNumber: order.trackingNumber || '',
      })
      return
    }

    await handleOrderStatusChange(order, nextStatus)
  }

  const handleConfirmShipOrder = async () => {
    if (!shippingModal?.order) return
    const isResend = Boolean(shippingModal.resendOnly) || shippingModal.order.status === 'Shipped'
    await handleOrderStatusChange(
      shippingModal.order,
      'Shipped',
      shippingModal.trackingNumber || '',
      { resendEmail: isResend },
    )
    setShippingModal(null)
  }

  const handleResendShippingEmail = async (order) => {
    setShippingModal({
      order,
      trackingNumber: order.trackingNumber || '',
      resendOnly: true,
    })
  }

  const handleSaveProduct = async (event) => {
    event.preventDefault()
    const normalizedVariants = (draftProduct.variants || []).map((variant, variantIndex) => {
      const normalizedId = (variant.id || variant.label || `variant-${variantIndex + 1}`)
        .toString()
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')

      return {
        ...variant,
        id: normalizedId,
        options: (variant.options || []).map((option, optionIndex) => ({
          ...option,
          value: (option.value || option.label || `option-${optionIndex + 1}`).toString().trim(),
          price: option.price === '' || option.price == null ? null : Number(option.price),
        })),
      }
    })
    const payload = {
      ...draftProduct,
      variants: normalizedVariants,
      pricingMode: draftProduct.pricingMode || 'standard',
      minPrice: draftProduct.pricingMode === 'range' ? Number(draftProduct.minPrice || 0) : null,
      maxPrice: draftProduct.pricingMode === 'range' ? Number(draftProduct.maxPrice || 0) : null,
      price: draftProduct.pricingMode === 'standard' ? Number(draftProduct.price || 0) : 0,
      visible: draftProduct.visible !== false,
      liveAt: fromDatetimeLocalValue(draftProduct.liveAt),
      shippable: draftProduct.localOnly ? false : draftProduct.shippable !== false,
      localOnly: Boolean(draftProduct.localOnly),
      shippingSurcharge: Math.max(0, Number(draftProduct.shippingSurcharge || 0)),
      requiresNeedByDate: Boolean(draftProduct.requiresNeedByDate),
      booking: draftProduct.booking || getDefaultProductBooking(),
    }

    if (editingProductId) {
      await updateProduct(editingProductId, payload)
      setStatus(`Updated "${draftProduct.name}"`)
      setEditingProductId(null)
    } else {
      const created = await createProduct(payload)
      setStatus(`Created product "${created.name}"`)
    }
    setDraftProduct(emptyProduct)
    refreshProducts()
  }

  const handleEditProduct = (product) => {
    setDraftProduct({
      name: product.name || '',
      description: product.description || '',
      pricingMode: product.pricingMode || (product.requiresInquiry ? 'inquiry' : 'standard'),
      price: product.price || 0,
      minPrice: product.minPrice ?? '',
      maxPrice: product.maxPrice ?? '',
      enableEmbroideryAddOn: Boolean(product.enableEmbroideryAddOn),
      embroideryAddOnPrice: Number(product.embroideryAddOnPrice ?? 8),
      category: product.category || '',
      images: product.images || [],
      video: product.video || '',
      inStock: product.inStock ?? true,
      quantity: product.quantity || 0,
      featured: product.featured || false,
      visible: product.visible !== false,
      liveAt: toDatetimeLocalValue(product.liveAt),
      shippable: product.shippable !== false,
      localOnly: Boolean(product.localOnly),
      shippingSurcharge: Number(product.shippingSurcharge || 0),
      requiresNeedByDate: Boolean(product.requiresNeedByDate),
      booking: product.booking || getDefaultProductBooking(),
      variants: (product.variants || []).map((variant) => ({
        ...variant,
        options: (variant.options || []).map((option) => ({
          ...option,
          price: option.price ?? '',
        })),
      })),
    })
    setEditingProductId(product.id)
    setActiveTab('Products')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCancelEdit = () => {
    setDraftProduct(emptyProduct)
    setEditingProductId(null)
    setStatus('')
  }

  const handleSaveGalleryItem = async (event) => {
    event.preventDefault()
    const normalizedImages = (galleryDraft.images || []).filter(Boolean)
    const coverImage = normalizedImages[0] || galleryDraft.image || ''
    const payload = {
      title: galleryDraft.title,
      type: galleryDraft.type,
      description: galleryDraft.description,
      images: normalizedImages,
      image: coverImage,
      pinned: Boolean(galleryDraft.pinned),
    }

    if (editingGalleryId) {
      await updateGalleryItem(editingGalleryId, payload)
      setStatus(`Updated gallery item "${galleryDraft.title}"`)
      setEditingGalleryId(null)
    } else {
      const created = await createGalleryItem(payload)
      setStatus(`Added gallery item "${created.title}"`)
    }

    setGalleryDraft(emptyGalleryItem)
    refreshGallery()
  }

  const handleEditGalleryItem = (item) => {
    const images = Array.isArray(item.images) && item.images.length > 0
      ? item.images.filter(Boolean)
      : item.image
        ? [item.image]
        : []

    setGalleryDraft({
      title: item.title || '',
      type: item.type || '',
      description: item.description || '',
      images,
      image: images[0] || '',
      pinned: Boolean(item.pinned),
    })
    setEditingGalleryId(item.id)
    setActiveTab('Gallery')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCancelGalleryEdit = () => {
    setGalleryDraft(emptyGalleryItem)
    setEditingGalleryId(null)
    setEditingGalleryImageIdx(null)
  }

  const toggleGalleryPinned = async (item) => {
    await updateGalleryItem(item.id, { pinned: !item.pinned })
    setStatus(`${!item.pinned ? 'Pinned' : 'Unpinned'} "${item.title}"`)
    refreshGallery()
  }

  const handleGalleryImageUpload = async (event) => {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return
    setIsGalleryUploading(true)
    setStatus('Uploading gallery images...')

    try {
      const uploaded = []
      for (const file of files) {
        const url = await uploadProductMedia(file, 'gallery')
        if (url) {
          uploaded.push(url)
        }
      }

      if (uploaded.length > 0) {
        setGalleryDraft((prev) => {
          const nextImages = [...(prev.images || []), ...uploaded]
          return {
            ...prev,
            images: nextImages,
            image: nextImages[0] || '',
          }
        })
        setStatus(`${uploaded.length} gallery image${uploaded.length > 1 ? 's' : ''} uploaded.`)
      } else {
        setStatus('Gallery image upload failed. Check Firebase Storage permissions.')
      }
    } catch (err) {
      setStatus(`Upload error: ${err.message}`)
    } finally {
      setIsGalleryUploading(false)
      event.target.value = ''
    }
  }

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    setStatus('Uploading image...')
    try {
      const url = await uploadProductMedia(file)
      if (url) {
        setDraftProduct((prev) => ({ ...prev, images: [...prev.images, url] }))
        setStatus('Image uploaded — ready to save product.')
      } else {
        setStatus('Image upload failed. Check Firebase Storage permissions.')
      }
    } catch (err) {
      setStatus(`Upload error: ${err.message}`)
    } finally {
      setIsUploading(false)
    }
  }

  const handleHeroImageUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setIsHeroUploading(true)
    setStatus('Uploading hero image...')
    try {
      const url = await uploadProductMedia(file, 'store')
      if (url) {
        await saveHeroImages([...heroImages, url])
        setStatus('Hero image added.')
      } else {
        setStatus('Hero image upload failed. Check Firebase Storage permissions.')
      }
    } catch (err) {
      setStatus(`Upload error: ${err.message}`)
    } finally {
      setIsHeroUploading(false)
      event.target.value = ''
    }
  }

  const removeHeroImage = async (idx) => {
    await saveHeroImages(heroImages.filter((_, i) => i !== idx))
    setStatus('Hero image removed.')
  }

  const moveHeroImage = async (idx, dir) => {
    const next = [...heroImages]
    const swap = idx + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    await saveHeroImages(next)
  }

  const resetHeroImagesToDefault = async () => {
    await saveSettings({ homeHeroPhotoUrls: [], homeHeroPhotoUrl: '' })
    setStatus('Hero images cleared — site will use the default image.')
  }

  const handleCategoryAdd = async () => {
    const nextValue = categoryDraft.trim()
    if (!nextValue) return
    const nextCategories = Array.from(new Set([...(settings.categories || []), nextValue]))
    await saveSettings({ categories: nextCategories })
    setCategoryDraft('')
    setStatus('Category added')
  }

  const removeCategory = async (value) => {
    const nextCategories = (settings.categories || []).filter((item) => item !== value)
    const nextImages = { ...(settings.categoryImages || {}) }
    delete nextImages[value]
    await saveSettings({ categories: nextCategories, categoryImages: nextImages })
  }

  const handleCategoryImageUpload = async (category, file) => {
    if (!file) return
    setCategoryUploadingFor(category)
    setStatus(`Uploading image for "${category}"…`)
    try {
      const url = await uploadProductMedia(file, 'categories')
      if (url) {
        await saveSettings({
          categoryImages: { ...(settings.categoryImages || {}), [category]: url },
        })
        setStatus(`Image saved for "${category}"`)
      } else {
        setStatus('Image upload failed. Check Firebase Storage permissions.')
      }
    } catch (err) {
      setStatus(`Upload error: ${err.message}`)
    } finally {
      setCategoryUploadingFor(null)
    }
  }

  const removeCategoryImage = async (category) => {
    const nextImages = { ...(settings.categoryImages || {}) }
    delete nextImages[category]
    await saveSettings({ categoryImages: nextImages })
  }

  const updateCraftCard = (index, field, value) => {
    setAboutDraft((prev) => {
      const cards = [...(prev.craftCards || defaultSettings.about.craftCards)]
      cards[index] = { ...cards[index], [field]: value }
      return { ...prev, craftCards: cards }
    })
  }

  const handleCraftCardImageUpload = async (index, file) => {
    if (!file) return
    setCraftCardUploadingFor(index)
    setStatus('Uploading craft card image…')
    try {
      const url = await uploadProductMedia(file, 'about')
      if (url) {
        setAboutDraft((prev) => {
          const cards = [...(prev.craftCards || defaultSettings.about.craftCards)]
          cards[index] = { ...cards[index], image: url }
          return { ...prev, craftCards: cards }
        })
        setStatus('Image uploaded — click Save About Page to apply.')
      } else {
        setStatus('Image upload failed. Check Firebase Storage permissions.')
      }
    } catch (err) {
      setStatus(`Upload error: ${err.message}`)
    } finally {
      setCraftCardUploadingFor(null)
    }
  }

  const addCraftCard = () => {
    setAboutDraft((prev) => ({
      ...prev,
      craftCards: [...(prev.craftCards || defaultSettings.about.craftCards), { icon: '✦', image: '', title: 'New Card', description: '' }],
    }))
  }

  const removeCraftCard = (index) => {
    setAboutDraft((prev) => {
      const cards = [...(prev.craftCards || defaultSettings.about.craftCards)]
      cards.splice(index, 1)
      return { ...prev, craftCards: cards }
    })
  }

  const updatePayment = async (key, field, value) => {
    await saveSettings({
      [key]: {
        ...(settings[key] || {}),
        [field]: value,
      },
    })
    setStatus('Payment settings updated')
  }

  const handleSaveCoupon = async (event) => {
    event.preventDefault()
    const code = formatCouponCode(couponDraft.code)
    const normalizedCode = normalizeCouponCode(code)
    const discountPercent = Number(couponDraft.discountPercent || 0)

    if (!normalizedCode) {
      setStatus('Coupon code is required (letters and numbers only).')
      return
    }

    if (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > 100) {
      setStatus('Discount percent must be between 0.01 and 100.')
      return
    }

    if (editingCouponId) {
      await updateCoupon(editingCouponId, {
        code,
        discountPercent,
        active: couponDraft.active,
        startDate: couponDraft.startDate || null,
        endDate: couponDraft.endDate || null,
      })
      setStatus(`Updated coupon ${code}`)
      setEditingCouponId(null)
    } else {
      await createCoupon({
        code,
        discountPercent,
        active: couponDraft.active,
        startDate: couponDraft.startDate || null,
        endDate: couponDraft.endDate || null,
      })
      setStatus(`Created coupon ${code}`)
    }

    setCouponDraft(emptyCoupon)
    await refreshCoupons()
  }

  const toDatetimeLocal = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    // datetime-local requires "YYYY-MM-DDTHH:MM"
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const handleEditCoupon = (coupon) => {
    setCouponDraft({
      code: coupon.code || '',
      discountPercent: Number(coupon.discountPercent || 0),
      active: Boolean(coupon.active),
      startDate: toDatetimeLocal(coupon.startDate),
      endDate: toDatetimeLocal(coupon.endDate),
    })
    setEditingCouponId(coupon.id)
    setActiveTab('Coupons')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCancelCouponEdit = () => {
    setCouponDraft(emptyCoupon)
    setEditingCouponId(null)
  }

  const toggleCouponActive = async (coupon) => {
    await updateCoupon(coupon.id, { active: !coupon.active })
    setStatus(`${coupon.code} ${coupon.active ? 'disabled' : 'enabled'}`)
    await refreshCoupons()
  }

  const handleDeleteCoupon = async (coupon) => {
    await removeCoupon(coupon.id)
    if (editingCouponId === coupon.id) {
      handleCancelCouponEdit()
    }
    setStatus(`Deleted coupon ${coupon.code}`)
    await refreshCoupons()
  }

  const handleSaveGiftCard = async (event) => {
    event.preventDefault()
    const code = formatGiftCardCode(giftCardDraft.code)
    const initialAmount = Number(giftCardDraft.initialAmount || 0)
    const remainingBalance = Number(
      giftCardDraft.remainingBalance == null || giftCardDraft.remainingBalance === ''
        ? initialAmount
        : giftCardDraft.remainingBalance,
    )

    if (!editingGiftCardId && !code) {
      // Allow empty code on create — service will generate one
    }

    if (!Number.isFinite(initialAmount) || initialAmount <= 0) {
      setStatus('Gift card amount must be greater than 0.')
      return
    }

    if (!Number.isFinite(remainingBalance) || remainingBalance < 0) {
      setStatus('Remaining balance cannot be negative.')
      return
    }

    try {
      if (editingGiftCardId) {
        if (!code) {
          setStatus('Gift card code is required.')
          return
        }
        await updateGiftCard(editingGiftCardId, {
          code,
          initialAmount,
          remainingBalance: Math.min(remainingBalance, initialAmount),
          active: giftCardDraft.active,
          notes: giftCardDraft.notes,
        })
        setStatus(`Updated gift card ${code}`)
        setEditingGiftCardId(null)
      } else {
        const created = await createGiftCard({
          code: code || undefined,
          initialAmount,
          remainingBalance: Math.min(remainingBalance, initialAmount),
          active: giftCardDraft.active,
          notes: giftCardDraft.notes,
        })
        setStatus(`Created gift card ${created.code}`)
      }

      setGiftCardDraft(emptyGiftCard)
      await refreshGiftCards()
    } catch (err) {
      setStatus(err?.message || 'Unable to save gift card.')
    }
  }

  const handleEditGiftCard = (card) => {
    setGiftCardDraft({
      code: card.code || '',
      initialAmount: Number(card.initialAmount || 0),
      remainingBalance: Number(card.remainingBalance || 0),
      active: card.active !== false,
      notes: card.notes || '',
    })
    setEditingGiftCardId(card.id)
    setActiveTab('Gift Cards')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCancelGiftCardEdit = () => {
    setGiftCardDraft(emptyGiftCard)
    setEditingGiftCardId(null)
  }

  const toggleGiftCardActive = async (card) => {
    await updateGiftCard(card.id, { active: !card.active })
    setStatus(`${card.code} ${card.active ? 'disabled' : 'enabled'}`)
    await refreshGiftCards()
  }

  const handleDeleteGiftCard = async (card) => {
    await removeGiftCard(card.id)
    if (editingGiftCardId === card.id) {
      handleCancelGiftCardEdit()
    }
    setStatus(`Deleted gift card ${card.code}`)
    await refreshGiftCards()
  }

  const orderStatuses = useMemo(() => ['Pending', 'In Progress', 'Complete', 'Shipped', 'Delivered', 'Picked Up'], [])

  // ── Chat actions ──
  const handleSelectChat = (chatId) => {
    setSelectedChatId(chatId)
  }

  const handleAdminSend = async (e) => {
    e.preventDefault()
    if (!adminText.trim() || !selectedChatId || chatSending) return
    setChatSending(true)
    await sendMessage({
      chatId: selectedChatId,
      text: adminText.trim(),
      sender: 'admin',
      visitorToken: selectedChat?.visitorToken,
    })
    setAdminText('')
    setChatSending(false)
  }

  const handleCloseChat = async (chatId) => {
    await closeChat(chatId)
    if (selectedChatId === chatId) {
      setSelectedChatId(null)
      setAdminMessages([])
    }
  }

  const formatChatTime = (ts) => {
    if (!ts) return ''
    const d = new Date(ts)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    if (isToday) {
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
      d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }

  const formatDuration = (seconds) => {
    const safe = Number(seconds || 0)
    const mins = Math.floor(safe / 60)
    const secs = Math.round(safe % 60)
    return `${mins}m ${secs}s`
  }

  const selectedChat = activeChats.find((c) => c.id === selectedChatId)

  if (!hasFirebaseConfig) {
    return (
      <section className="content-page">
        <h1>Admin</h1>
        <p>Add Firebase env keys to enable admin access and live data.</p>
      </section>
    )
  }

  if (!user) {
    return (
      <section className="content-page">
        <h1>Admin Login</h1>
        <form
          className="form-stack"
          onSubmit={async (event) => {
            event.preventDefault()
            await login(email, password)
          }}
        >
          <input className="text-input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="text-input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" className="primary-btn">Sign In</button>
        </form>
      </section>
    )
  }

  if (!isAdmin) {
    return (
      <section className="content-page">
        <h1>Admin</h1>
        <p>You are signed in but not listed as an admin.</p>
        <button type="button" className="ghost-btn" onClick={logout}>Sign Out</button>
      </section>
    )
  }

  return (
    <section className="content-page">
      <div className="admin-head">
        <h1>Admin Dashboard</h1>
        <button type="button" className="ghost-btn" onClick={logout}>Sign Out</button>
      </div>

      <div className="chip-row">
        {tabs.map((tab) => (
          <button key={tab} type="button" className={tab === activeTab ? 'chip chip-active' : 'chip'} onClick={() => setActiveTab(tab)}>
            {tab}
            {tab === 'Chat' && totalUnreadAdmin > 0 && (
              <span className="tab-chat-badge">{totalUnreadAdmin}</span>
            )}
          </button>
        ))}
      </div>

      {status && <p>{status}</p>}

      {activeTab === 'Products' && (
        <div className="admin-grid">
          <form className={`form-stack panel${editingProductId ? ' panel-editing' : ''}`} onSubmit={handleSaveProduct}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <h2>{editingProductId ? 'Edit Product' : 'Add Product'}</h2>
              {editingProductId && (
                <button type="button" className="ghost-btn" onClick={handleCancelEdit}>Cancel</button>
              )}
            </div>
            <label className="form-field-label">Product Name
              <input className="text-input" placeholder="e.g. Hand-knit Chunky Scarf" value={draftProduct.name} onChange={(e) => setDraftProduct((prev) => ({ ...prev, name: e.target.value }))} />
            </label>
            <label className="form-field-label">Description
              <RichTextEditor
                value={draftProduct.description || ''}
                onChange={(content) => setDraftProduct((prev) => ({ ...prev, description: content }))}
                placeholder="Describe the product — materials, size, care instructions…"
              />
            </label>
            <label className="form-field-label">Pricing Mode
              <select
                className="text-input"
                value={draftProduct.pricingMode || 'standard'}
                onChange={(e) => setDraftProduct((prev) => ({ ...prev, pricingMode: e.target.value }))}
              >
                <option value="standard">Standard Price</option>
                <option value="range">Price Range + Inquiry</option>
                <option value="inquiry">Requires Inquiry</option>
              </select>
            </label>

            {draftProduct.pricingMode === 'standard' && (
              <label className="form-field-label">Price
                <div className="price-input-wrap">
                  <span className="price-prefix">$</span>
                  <input className="text-input" type="number" step="0.01" min="0" placeholder="0.00" value={draftProduct.price || ''} onChange={(e) => setDraftProduct((prev) => ({ ...prev, price: Number(e.target.value || 0) }))} />
                </div>
              </label>
            )}

            {draftProduct.pricingMode === 'range' && (
              <div className="inline-form">
                <label className="form-field-label" style={{ flex: 1 }}>Minimum Price
                  <div className="price-input-wrap">
                    <span className="price-prefix">$</span>
                    <input
                      className="text-input"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="25.00"
                      value={draftProduct.minPrice}
                      onChange={(e) => setDraftProduct((prev) => ({ ...prev, minPrice: e.target.value }))}
                    />
                  </div>
                </label>
                <label className="form-field-label" style={{ flex: 1 }}>Maximum Price
                  <div className="price-input-wrap">
                    <span className="price-prefix">$</span>
                    <input
                      className="text-input"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="80.00"
                      value={draftProduct.maxPrice}
                      onChange={(e) => setDraftProduct((prev) => ({ ...prev, maxPrice: e.target.value }))}
                    />
                  </div>
                </label>
              </div>
            )}

            {draftProduct.pricingMode === 'inquiry' && (
              <p style={{ margin: 0, color: '#5a3040', fontSize: '0.9rem' }}>
                This product will show “Requires Inquiry” instead of a numeric price.
              </p>
            )}
            <label className="form-field-label">Category
              <select className="text-input" value={draftProduct.category} onChange={(e) => setDraftProduct((prev) => ({ ...prev, category: e.target.value }))}>
                <option value="">Select a category</option>
                {(settings.categories || []).map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </label>
            <label className="form-field-label">Stock Quantity
              <input className="text-input" type="number" min="0" placeholder="How many are available?" value={draftProduct.quantity || ''} onChange={(e) => setDraftProduct((prev) => ({ ...prev, quantity: Number(e.target.value || 0) }))} />
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={draftProduct.featured} onChange={(e) => setDraftProduct((prev) => ({ ...prev, featured: e.target.checked }))} />
              Feature on home page
            </label>
            <div className="form-field-label" style={{ gap: 8 }}>
              Store visibility
              <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>
                Turn off to keep as draft. Set a go-live time to auto-show later.
              </span>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={draftProduct.visible !== false}
                  onChange={(e) => setDraftProduct((prev) => ({ ...prev, visible: e.target.checked }))}
                />
                Visible in store
              </label>
              <label className="form-field-label">
                Go live (optional)
                <input
                  className="text-input"
                  type="datetime-local"
                  value={draftProduct.liveAt || ''}
                  onChange={(e) => setDraftProduct((prev) => ({ ...prev, liveAt: e.target.value }))}
                />
                <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>
                  Leave empty to show immediately once visible.
                </span>
              </label>
            </div>
            <div className="form-field-label" style={{ gap: 8 }}>
              Shipping &amp; Fulfillment
              <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>
                Control whether this item can be mailed or is limited to local pickup/delivery.
              </span>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={draftProduct.shippable !== false && !draftProduct.localOnly}
                  disabled={Boolean(draftProduct.localOnly)}
                  onChange={(e) => setDraftProduct((prev) => ({ ...prev, shippable: e.target.checked }))}
                />
                Can be shipped (USPS / carrier)
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={Boolean(draftProduct.localOnly)}
                  onChange={(e) =>
                    setDraftProduct((prev) => ({
                      ...prev,
                      localOnly: e.target.checked,
                      shippable: e.target.checked ? false : prev.shippable,
                    }))
                  }
                />
                Local pickup / delivery only (e.g. baked goods)
              </label>
              {draftProduct.shippable !== false && !draftProduct.localOnly && (
                <label className="form-field-label">Extra shipping surcharge (optional)
                  <div className="price-input-wrap">
                    <span className="price-prefix">$</span>
                    <input
                      className="text-input"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={draftProduct.shippingSurcharge || ''}
                      onChange={(e) => setDraftProduct((prev) => ({ ...prev, shippingSurcharge: Number(e.target.value || 0) }))}
                    />
                  </div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>
                    Added per unit on top of the store&apos;s default shipping rate.
                  </span>
                </label>
              )}
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={Boolean(draftProduct.requiresNeedByDate)}
                onChange={(e) => setDraftProduct((prev) => ({ ...prev, requiresNeedByDate: e.target.checked }))}
              />
              Require need-by date at checkout
            </label>

            <BookingAdminFields
              booking={draftProduct.booking}
              onChange={(booking) => setDraftProduct((prev) => ({ ...prev, booking }))}
            />

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={Boolean(draftProduct.enableEmbroideryAddOn)}
                onChange={(e) => setDraftProduct((prev) => ({ ...prev, enableEmbroideryAddOn: e.target.checked }))}
              />
              Add Personalized Embroidery option
            </label>
            {draftProduct.enableEmbroideryAddOn && (
              <label className="form-field-label">Embroidery Add-on Price
                <div className="price-input-wrap">
                  <span className="price-prefix">$</span>
                  <input
                    className="text-input"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="8.00"
                    value={draftProduct.embroideryAddOnPrice || ''}
                    onChange={(e) => setDraftProduct((prev) => ({ ...prev, embroideryAddOnPrice: Number(e.target.value || 0) }))}
                  />
                </div>
              </label>
            )}
            <label className="form-field-label">Video URL <span style={{fontWeight:400,opacity:0.6}}>(optional)</span>
              <input className="text-input" type="url" placeholder="https://youtube.com/..." value={draftProduct.video} onChange={(e) => setDraftProduct((prev) => ({ ...prev, video: e.target.value }))} />
            </label>
            <label className="form-field-label">Product Photo{editingProductId && <span style={{ fontWeight: 400, opacity: 0.6, textTransform: 'none' }}> — upload to replace or add more</span>}
              <input className="text-input" type="file" accept="image/*,video/*" onChange={handleImageUpload} disabled={isUploading} />
            </label>
            {isUploading && <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--brand-sage)' }}>Uploading…</p>}
            {draftProduct.images.length > 0 && (
              <div style={{ display: 'grid', gap: 12 }}>
                {draftProduct.images.map((url, idx) => (
                  <div key={url} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 12px', border: '1px solid rgba(188,98,140,0.15)', borderRadius: 6, background: 'rgba(255,252,249,0.5)' }}>
                    <img src={url} alt={`photo ${idx + 1}`} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 4, border: '1px solid rgba(188,98,140,0.2)' }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>Photo {idx + 1} of {draftProduct.images.length}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setDraftProduct((prev) => {
                            const newImages = [...prev.images]
                            if (idx > 0) {
                              [newImages[idx], newImages[idx - 1]] = [newImages[idx - 1], newImages[idx]]
                            }
                            return { ...prev, images: newImages }
                          })
                        }}
                        disabled={idx === 0}
                        style={{ padding: '4px 8px', fontSize: '0.8rem', border: 'none', background: idx === 0 ? '#ddd' : 'var(--brand-sage)', color: '#fff', borderRadius: 4, cursor: idx === 0 ? 'not-allowed' : 'pointer' }}
                        title="Move photo up"
                      >↑</button>
                      <button
                        type="button"
                        onClick={() => {
                          setDraftProduct((prev) => {
                            const newImages = [...prev.images]
                            if (idx < newImages.length - 1) {
                              [newImages[idx], newImages[idx + 1]] = [newImages[idx + 1], newImages[idx]]
                            }
                            return { ...prev, images: newImages }
                          })
                        }}
                        disabled={idx === draftProduct.images.length - 1}
                        style={{ padding: '4px 8px', fontSize: '0.8rem', border: 'none', background: idx === draftProduct.images.length - 1 ? '#ddd' : 'var(--brand-sage)', color: '#fff', borderRadius: 4, cursor: idx === draftProduct.images.length - 1 ? 'not-allowed' : 'pointer' }}
                        title="Move photo down"
                      >↓</button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingImageIdx(idx)}
                      style={{ padding: '4px 8px', fontSize: '0.8rem', border: 'none', background: 'var(--brand-sage)', color: '#fff', borderRadius: 4, cursor: 'pointer' }}
                      title="Edit photo"
                    >✎ Edit</button>
                    <button
                      type="button"
                      onClick={() => setDraftProduct((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== idx) }))}
                      style={{ padding: '4px 8px', fontSize: '0.8rem', border: 'none', background: 'var(--brand-primary)', color: '#fff', borderRadius: 4, cursor: 'pointer' }}
                      title="Remove photo"
                    >Remove</button>
                  </div>
                ))}
              </div>
            )}

            {/* Variant Management */}
            <div style={{ paddingTop: 12, borderTop: '1px solid rgba(188,98,140,0.1)' }}>
              <label className="form-field-label">Product Variants (e.g., Size, Color, Fabric) — Optional
                <p style={{ marginTop: 6, marginBottom: 12, fontSize: '0.85rem', color: '#666', fontWeight: 400 }}>
                  Add selection options so customers can choose configurations without emailing you.
                </p>
              </label>
              {draftProduct.variants && draftProduct.variants.length > 0 && (
                <div style={{ display: 'grid', gap: 12, marginBottom: 12 }}>
                  {draftProduct.variants.map((variant, vIdx) => (
                    <div key={vIdx} style={{ border: '1px solid rgba(188,98,140,0.2)', borderRadius: 8, padding: 10, background: 'rgba(255,252,249,0.8)' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                        <label style={{ flex: 1 }}>Variant ID (e.g., "size", "color"): <input className="text-input" value={variant.id || ''} onChange={(e) => setDraftProduct((prev) => ({ ...prev, variants: prev.variants.map((v, i) => i === vIdx ? { ...v, id: e.target.value } : v) }))} /></label>
                        <label style={{ flex: 1 }}>Label (display name): <input className="text-input" value={variant.label || ''} onChange={(e) => setDraftProduct((prev) => ({ ...prev, variants: prev.variants.map((v, i) => i === vIdx ? { ...v, label: e.target.value } : v) }))} /></label>
                        <label style={{ flex: 0.8 }}>Type: <select className="text-input" value={variant.type || 'buttons'} onChange={(e) => setDraftProduct((prev) => ({ ...prev, variants: prev.variants.map((v, i) => i === vIdx ? { ...v, type: e.target.value } : v) }))}><option value="buttons">Buttons</option><option value="swatches">Swatches (Color)</option><option value="dropdown">Dropdown</option></select></label>
                        <button type="button" className="ghost-btn" style={{ padding: '6px 8px', fontSize: '0.8rem' }} onClick={() => setDraftProduct((prev) => ({ ...prev, variants: prev.variants.filter((_, i) => i !== vIdx) }))}>Remove</button>
                          <label style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: '0.9rem', whiteSpace: 'nowrap' }}><input type="checkbox" checked={variant.multiSelect || false} onChange={(e) => setDraftProduct((prev) => ({ ...prev, variants: prev.variants.map((v, i) => i === vIdx ? { ...v, multiSelect: e.target.checked } : v) }))} style={{ margin: 0 }} />Multi</label>
                      </div>
                      {/* Options for this variant */}
                      {variant.options && variant.options.length > 0 && (
                        <div style={{ display: 'grid', gap: 6, marginBottom: 8, paddingLeft: 8, borderLeft: '3px solid rgba(188,98,140,0.15)' }}>
                          {variant.options.map((option, oIdx) => (
                            <div key={oIdx} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                              <input className="text-input" placeholder="Value" value={option.value || ''} onChange={(e) => setDraftProduct((prev) => ({ ...prev, variants: prev.variants.map((v, i) => i === vIdx ? { ...v, options: v.options.map((o, j) => j === oIdx ? { ...o, value: e.target.value } : o) } : v) }))} style={{ flex: 1, minWidth: 80 }} />
                              <input className="text-input" placeholder="Label" value={option.label || ''} onChange={(e) => setDraftProduct((prev) => ({ ...prev, variants: prev.variants.map((v, i) => i === vIdx ? { ...v, options: v.options.map((o, j) => j === oIdx ? { ...o, label: e.target.value } : o) } : v) }))} style={{ flex: 1, minWidth: 80 }} />
                              <input
                                className="text-input"
                                placeholder="Optional price"
                                type="number"
                                step="0.01"
                                min="0"
                                value={option.price ?? ''}
                                onChange={(e) => setDraftProduct((prev) => ({ ...prev, variants: prev.variants.map((v, i) => i === vIdx ? { ...v, options: v.options.map((o, j) => j === oIdx ? { ...o, price: e.target.value } : o) } : v) }))}
                                style={{ flex: 0.9, minWidth: 110 }}
                              />
                              <label style={{ flex: 0.7, minWidth: 90 }}>Price Mode
                                <select className="text-input" value={option.pricingMode || 'none'} onChange={(e) => setDraftProduct((prev) => ({ ...prev, variants: prev.variants.map((v, i) => i === vIdx ? { ...v, options: v.options.map((o, j) => j === oIdx ? { ...o, pricingMode: e.target.value } : o) } : v) }))} style={{ fontSize: '0.8rem' }}>
                                  <option value="none">No charge</option>
                                  <option value="add">Add to price</option>
                                </select>
                              </label>
                              {variant.type === 'swatches' && (
                                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                  <input type="color" value={option.color || '#999999'} onChange={(e) => setDraftProduct((prev) => ({ ...prev, variants: prev.variants.map((v, i) => i === vIdx ? { ...v, options: v.options.map((o, j) => j === oIdx ? { ...o, color: e.target.value } : o) } : v) }))} style={{ width: 40, height: 32, borderRadius: 4, cursor: 'pointer', border: 'none' }} title="Solid color swatch" />
                                  <label style={{ fontSize: '0.75rem', cursor: 'pointer', padding: '6px 8px', border: '1px solid rgba(188,98,140,0.2)', borderRadius: 4, background: 'white' }}>
                                    Upload Swatch Image
                                    <input 
                                      type="file" 
                                      accept="image/*" 
                                      onChange={async (e) => {
                                        const file = e.target.files?.[0]
                                        if (!file) return
                                        setSwatchUploadingFor(`${vIdx}-${oIdx}`)
                                        try {
                                          const url = await uploadProductMedia(file, 'swatches')
                                          if (url) {
                                            setDraftProduct((prev) => ({
                                              ...prev,
                                              variants: prev.variants.map((v, i) =>
                                                i === vIdx ? {
                                                  ...v,
                                                  options: v.options.map((o, j) =>
                                                    j === oIdx ? { ...o, swatchImage: url } : o
                                                  ),
                                                } : v
                                              ),
                                            }))
                                          }
                                        } catch (err) {
                                          setStatus(`Swatch upload error: ${err.message}`)
                                        } finally {
                                          setSwatchUploadingFor(null)
                                        }
                                      }}
                                      style={{ display: 'none' }}
                                      disabled={swatchUploadingFor === `${vIdx}-${oIdx}`}
                                    />
                                  </label>
                                  {option.swatchImage && (
                                    <>
                                      <img src={option.swatchImage} alt="swatch preview" style={{ width: 32, height: 32, borderRadius: 4, border: '1px solid #ddd', objectFit: 'cover' }} />
                                      <button type="button" className="ghost-btn" style={{ padding: '2px 4px', fontSize: '0.7rem' }} onClick={() => setDraftProduct((prev) => ({ ...prev, variants: prev.variants.map((v, i) => i === vIdx ? { ...v, options: v.options.map((o, j) => j === oIdx ? { ...o, swatchImage: '' } : o) } : v) }))}>Clear</button>
                                    </>
                                  )}
                                </div>
                              )}
                              <button type="button" className="ghost-btn" style={{ padding: '4px 6px', fontSize: '0.75rem' }} onClick={() => setDraftProduct((prev) => ({ ...prev, variants: prev.variants.map((v, i) => i === vIdx ? { ...v, options: v.options.filter((_, j) => j !== oIdx) } : v) }))}>×</button>
                            </div>
                          ))}
                        </div>
                      )}
                      <button type="button" className="ghost-btn" style={{ padding: '4px 8px', fontSize: '0.8rem', marginTop: 4 }} onClick={() => setDraftProduct((prev) => ({ ...prev, variants: prev.variants.map((v, i) => i === vIdx ? { ...v, options: [...(v.options || []), { value: '', label: '', color: '#999999', swatchImage: '', price: '' }] } : v) }))}>
                        + Add Option
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" className="ghost-btn" style={{ padding: '6px 12px', fontSize: '0.9rem', marginTop: 8 }} onClick={() => setDraftProduct((prev) => ({ ...prev, variants: [...(prev.variants || []), { id: '', label: '', type: 'buttons', options: [] }] }))}>
                + Add Variant
              </button>
            </div>

            <button type="submit" className="primary-btn" disabled={isUploading}>
              {isUploading ? 'Uploading…' : editingProductId ? 'Update Product' : 'Create Product'}
            </button>
          </form>

          <div className="panel">
            <h2>Current Products</h2>
            {(() => {
              const grouped = {}
              for (const p of products) {
                const cat = p.category?.trim() || 'Uncategorized'
                if (!grouped[cat]) grouped[cat] = []
                grouped[cat].push(p)
              }
              return Object.entries(grouped).map(([cat, prods]) => (
                <details key={cat} open style={{ marginBottom: 4, borderBottom: '1px solid rgba(188,98,140,0.1)' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', padding: '8px 2px', userSelect: 'none' }}>
                    {cat} <span style={{ fontWeight: 400, color: '#999', fontSize: '0.82rem' }}>({prods.length})</span>
                  </summary>
                  <div className="stack-list" style={{ marginTop: 4, marginBottom: 8 }}>
                    {prods.map((product) => {
                      const visibilityLabel = getProductVisibilityLabel(product)
                      return (
                      <article key={product.id} className={`cart-row${editingProductId === product.id ? ' cart-row-editing' : ''}`}>
                        <div>
                          <strong>{product.name}</strong>
                          {product.featured && <span style={{ marginLeft: 8, fontSize: '0.75rem', color: '#BC628C', fontWeight: 600 }}>Featured</span>}
                          {visibilityLabel === 'Draft' && (
                            <span style={{ marginLeft: 8, fontSize: '0.75rem', color: '#888', fontWeight: 600 }}>Draft</span>
                          )}
                          {visibilityLabel === 'Scheduled' && (
                            <span style={{ marginLeft: 8, fontSize: '0.75rem', color: '#C9A6B6', fontWeight: 600 }}>
                              Scheduled{product.liveAt ? ` · ${formatProductLiveAt(product.liveAt)}` : ''}
                            </span>
                          )}
                        </div>
                        <div className="qty-wrap">
                          <button type="button" className="ghost-btn" onClick={() => handleEditProduct(product)}>Edit</button>
                          <button type="button" className="ghost-btn" onClick={async () => { await updateProduct(product.id, { featured: !product.featured }); refreshProducts() }}>{product.featured ? 'Unfeature' : 'Feature'}</button>
                          <button
                            type="button"
                            className="ghost-btn"
                            onClick={async () => {
                              await updateProduct(product.id, { visible: product.visible === false })
                              refreshProducts()
                            }}
                          >
                            {product.visible === false ? 'Make visible' : 'Hide'}
                          </button>
                          <button type="button" className="ghost-btn" onClick={async () => { await removeProduct(product.id); refreshProducts() }}>Delete</button>
                        </div>
                      </article>
                      )
                    })}
                  </div>
                </details>
              ))
            })()}
          </div>
        </div>
      )}

      {editingHeroImageIdx !== null && heroImages[editingHeroImageIdx] && (
        <ImageEditor
          imageUrl={heroImages[editingHeroImageIdx]}
          previewAspectRatio={4 / 3}
          previewLabel="Hero Preview"
          onSave={async (blob) => {
            setStatus('Uploading edited hero image…')
            try {
              const url = await uploadProductBlob(blob, 'store', 'hero-edited.jpg')
              if (url) {
                const next = heroImages.map((u, i) => i === editingHeroImageIdx ? url : u)
                await saveHeroImages(next)
                setStatus('Hero image updated.')
              } else {
                setStatus('Upload failed. Check Firebase Storage permissions.')
              }
            } catch (err) {
              setStatus(`Upload error: ${err.message}`)
            }
            setEditingHeroImageIdx(null)
          }}
          onCancel={() => setEditingHeroImageIdx(null)}
        />
      )}

      {editingImageIdx !== null && draftProduct.images[editingImageIdx] && (
        <ImageEditor
          imageUrl={draftProduct.images[editingImageIdx]}
          previewAspectRatio={22 / 19}
          previewLabel="Shop Card Preview"
          onSave={async (blob) => {
            setStatus('Uploading edited image…')
            try {
              const url = await uploadProductBlob(blob)
              if (url) {
                setDraftProduct((prev) => ({
                  ...prev,
                  images: prev.images.map((u, i) => i === editingImageIdx ? url : u),
                }))
                setStatus('Image edited and uploaded — ready to save product.')
              } else {
                setStatus('Upload failed. Check Firebase Storage permissions.')
              }
            } catch (err) {
              setStatus(`Upload error: ${err.message}`)
            }
            setEditingImageIdx(null)
          }}
          onCancel={() => setEditingImageIdx(null)}
        />
      )}

      {editingGalleryImageIdx !== null && galleryDraft.images?.[editingGalleryImageIdx] && (
        <ImageEditor
          imageUrl={galleryDraft.images[editingGalleryImageIdx]}
          previewAspectRatio={4 / 3}
          previewLabel="Gallery Card Preview"
          onSave={async (blob) => {
            setStatus('Uploading edited gallery image…')
            try {
              const url = await uploadProductBlob(blob, 'gallery', 'gallery-edited.jpg')
              if (url) {
                setGalleryDraft((prev) => {
                  const nextImages = [...(prev.images || [])]
                  nextImages[editingGalleryImageIdx] = url
                  return {
                    ...prev,
                    images: nextImages,
                    image: nextImages[0] || '',
                  }
                })
                setStatus('Gallery image edited and uploaded — ready to save gallery item.')
              } else {
                setStatus('Upload failed. Check Firebase Storage permissions.')
              }
            } catch (err) {
              setStatus(`Upload error: ${err.message}`)
            }
            setEditingGalleryImageIdx(null)
          }}
          onCancel={() => setEditingGalleryImageIdx(null)}
        />
      )}

      {activeTab === 'Gallery' && (
        <div className="admin-grid">
          <form className={`form-stack panel${editingGalleryId ? ' panel-editing' : ''}`} onSubmit={handleSaveGalleryItem}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <h2>{editingGalleryId ? 'Edit Gallery Item' : 'Add Gallery Item'}</h2>
              {editingGalleryId && (
                <button type="button" className="ghost-btn" onClick={handleCancelGalleryEdit}>Cancel</button>
              )}
            </div>

            <label className="form-field-label">Title
              <input className="text-input" value={galleryDraft.title} onChange={(e) => setGalleryDraft((prev) => ({ ...prev, title: e.target.value }))} placeholder="e.g. 3D Character Nail Set" />
            </label>

            <label className="form-field-label">Type
              <input className="text-input" value={galleryDraft.type} onChange={(e) => setGalleryDraft((prev) => ({ ...prev, type: e.target.value }))} placeholder="e.g. Advanced Cake / 3D Nails" />
            </label>

            <label className="form-field-label">Description
              <textarea className="text-input" rows={4} value={galleryDraft.description} onChange={(e) => setGalleryDraft((prev) => ({ ...prev, description: e.target.value }))} placeholder="Describe this past custom creation..." />
            </label>

            <label className="checkbox-row">
              <input type="checkbox" checked={Boolean(galleryDraft.pinned)} onChange={(e) => setGalleryDraft((prev) => ({ ...prev, pinned: e.target.checked }))} />
              Pin to top of Gallery page
            </label>

            <label className="form-field-label">Gallery Photos
              <input className="text-input" type="file" accept="image/*" multiple onChange={handleGalleryImageUpload} disabled={isGalleryUploading} />
            </label>

            {(galleryDraft.images || []).length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
                {(galleryDraft.images || []).map((url, idx) => (
                  <div key={`${url}-${idx}`} style={{ position: 'relative' }}>
                    <img src={url} alt={`gallery preview ${idx + 1}`} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 6, border: '1px solid rgba(188,98,140,0.2)' }} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button
                        type="button"
                        className="ghost-btn"
                        style={{ fontSize: '0.7rem', padding: '4px 8px' }}
                        onClick={() => setEditingGalleryImageIdx(idx)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="ghost-btn"
                        style={{ fontSize: '0.7rem', padding: '4px 8px' }}
                        onClick={() => {
                          setGalleryDraft((prev) => {
                            const nextImages = (prev.images || []).filter((_, imageIdx) => imageIdx !== idx)
                            return {
                              ...prev,
                              images: nextImages,
                              image: nextImages[0] || '',
                            }
                          })
                          if (editingGalleryImageIdx === idx) {
                            setEditingGalleryImageIdx(null)
                          }
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button type="submit" className="primary-btn" disabled={isGalleryUploading || !(galleryDraft.images || []).length || !galleryDraft.title}>
              {editingGalleryId ? 'Update Gallery Item' : 'Add to Gallery'}
            </button>
          </form>

          <div className="panel">
            <h2>Current Gallery</h2>
            <div className="stack-list">
              {galleryItems.map((item) => (
                <article key={item.id} className={`cart-row${editingGalleryId === item.id ? ' cart-row-editing' : ''}`}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {item.image && <img src={item.image} alt={item.title} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 4, border: '1px solid rgba(188,98,140,0.2)' }} />}
                    <div>
                      <strong>{item.title} {item.pinned && <span style={{ fontSize: '0.75rem', color: 'var(--brand-primary)' }}>(Pinned)</span>}</strong>
                      <p>{item.type}</p>
                    </div>
                  </div>
                  <div className="qty-wrap">
                    <button type="button" className="ghost-btn" onClick={() => handleEditGalleryItem(item)}>Edit</button>
                    <button type="button" className="ghost-btn" onClick={() => toggleGalleryPinned(item)}>{item.pinned ? 'Unpin' : 'Pin to Top'}</button>
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={async () => {
                        await removeGalleryItem(item.id)
                        refreshGallery()
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Categories' && (
        <div className="panel form-stack">
          <h2>Manage Categories</h2>
          <div className="inline-form">
            <input className="text-input" value={categoryDraft} onChange={(e) => setCategoryDraft(e.target.value)} placeholder="Add category" />
            <button type="button" className="primary-btn" onClick={handleCategoryAdd}>Add</button>
          </div>
          <div className="stack-list">
            {(settings.categories || []).map((category) => {
              const imgUrl = (settings.categoryImages || {})[category]
              return (
                <div key={category} className="category-admin-row">
                  <div className="category-admin-preview">
                    {imgUrl
                      ? <img src={imgUrl} alt={category} className="cat-thumb" />
                      : <div className="cat-thumb cat-thumb-empty">📷</div>
                    }
                  </div>
                  <span className="category-admin-name">{category}</span>
                  <div className="category-admin-actions">
                    <label className="ghost-btn" style={{ cursor: 'pointer', fontSize: '0.8rem' }}>
                      {categoryUploadingFor === category ? 'Uploading…' : imgUrl ? 'Change Image' : 'Upload Image'}
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        disabled={categoryUploadingFor === category}
                        onChange={(e) => handleCategoryImageUpload(category, e.target.files?.[0])}
                      />
                    </label>
                    {imgUrl && (
                      <button type="button" className="ghost-btn" style={{ fontSize: '0.8rem' }} onClick={() => removeCategoryImage(category)}>Remove Image</button>
                    )}
                    <button type="button" className="ghost-btn" onClick={() => removeCategory(category)}>Remove</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {activeTab === 'Store' && (
        <div className="panel form-stack">
          <h2>Store Settings</h2>
          <p style={{ margin: '0 0 8px', fontSize: '0.85rem', color: '#5a3040' }}>Changes save instantly — no deployment needed.</p>

          <label className="form-field-label">Store Name
            <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>Shown in the site header and page titles</span>
            <input className="text-input" value={settings.storeName || ''} onChange={(e) => saveSettings({ storeName: e.target.value })} placeholder="e.g. 806 & CO." />
          </label>

          <label className="form-field-label">Tagline
            <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>Short phrase shown on the home page hero</span>
            <input className="text-input" value={settings.tagline || ''} onChange={(e) => saveSettings({ tagline: e.target.value })} placeholder="e.g. handmade with love" />
          </label>

          <label className="form-field-label">Marquee Text
            <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>Scrolling strip shown below the hero — the phrase repeats automatically</span>
            <input className="text-input" value={settings.marqueeText || ''} onChange={(e) => saveSettings({ marqueeText: e.target.value })} placeholder="e.g. HANDMADE · CUSTOM · ONE-OF-A-KIND · MADE WITH LOVE ·" />
          </label>

          {/* ── Site Animation ── */}
          {(() => {
            const anim = settings.siteAnimation || {}
            const setAnim = (patch) => saveSettings({ siteAnimation: { ...anim, ...patch } })
            return (
              <div style={{ display: 'grid', gap: 10, padding: '14px 16px', border: '1px solid rgba(188,98,140,0.15)', borderRadius: 8, background: 'rgba(188,98,140,0.03)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '0.92rem' }}>Site Animation</p>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.88rem' }}>
                    <input type="checkbox" checked={Boolean(anim.enabled)} onChange={(e) => setAnim({ enabled: e.target.checked })} />
                    {anim.enabled ? 'Enabled' : 'Disabled'}
                  </label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label className="form-field-label" style={{ margin: 0 }}>Emoji
                    <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>Paste any emoji — it will float across the page</span>
                    <input className="text-input" value={anim.emoji || '🎈'} onChange={(e) => setAnim({ emoji: e.target.value })} placeholder="🎈" style={{ fontSize: '1.5rem', maxWidth: 72 }} />
                  </label>
                  <label className="form-field-label" style={{ margin: 0 }}>Direction
                    <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>Which way the emoji travels</span>
                    <select className="text-input" value={anim.direction || 'up'} onChange={(e) => setAnim({ direction: e.target.value })}>
                      <option value="up">Bottom → Top (float up)</option>
                      <option value="down">Top → Bottom (fall down)</option>
                    </select>
                  </label>
                  <label className="form-field-label" style={{ margin: 0 }}>Loop Mode
                    <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>How many times to animate</span>
                    <select className="text-input" value={anim.loop || 'infinite'} onChange={(e) => setAnim({ loop: e.target.value })}>
                      <option value="infinite">Infinite loop</option>
                      <option value="timed">Timed — auto-stop after duration</option>
                      <option value="once">Single pass (one trip, then done)</option>
                    </select>
                  </label>
                  {(anim.loop || 'infinite') === 'timed' && (
                    <label className="form-field-label" style={{ margin: 0 }}>Duration (seconds)
                      <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>Animation stops after this many seconds</span>
                      <input className="text-input" type="number" min="5" max="3600" value={anim.duration ?? 30} onChange={(e) => setAnim({ duration: Number(e.target.value) })} style={{ maxWidth: 110 }} />
                    </label>
                  )}
                  <label className="form-field-label" style={{ margin: 0 }}>Active Month
                    <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>Restrict to one month, or leave as Always</span>
                    <select className="text-input" value={anim.activeMonth ?? 0} onChange={(e) => setAnim({ activeMonth: Number(e.target.value) })}>
                      <option value={0}>Always (when enabled)</option>
                      {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
                        <option key={m} value={i + 1}>{m}</option>
                      ))}
                    </select>
                  </label>
                  <label className="form-field-label" style={{ margin: 0 }}>Quantity
                    <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>Number of emoji on screen at once (1–20)</span>
                    <input className="text-input" type="number" min="1" max="20" step="1" value={anim.quantity ?? 12} onChange={(e) => setAnim({ quantity: Math.max(1, Math.min(20, Number(e.target.value) || 12)) })} style={{ maxWidth: 90 }} />
                  </label>
                  <label className="form-field-label" style={{ margin: 0 }}>Speed
                    <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>0.25× = slowest · 1× = normal · 4× = fastest</span>
                    <input className="text-input" type="number" min="0.25" max="4" step="0.25" value={anim.speed ?? 1} onChange={(e) => setAnim({ speed: Math.max(0.25, Math.min(4, Number(e.target.value) || 1)) })} style={{ maxWidth: 90 }} />
                  </label>
                </div>
              </div>
            )
          })()}

          <div className="form-field-label" style={{ gap: 8 }}>
            Home Hero Images
            <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>
              Add one or more images. With multiple images the hero fades between them on the interval below. Drag to reorder, or use the arrows.
            </span>

            <div style={{ display: 'grid', gap: 10 }}>
              {heroImages.length === 0 ? (
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 12px', border: '1px dashed rgba(188,98,140,0.25)', borderRadius: 6, background: 'rgba(188,98,140,0.03)' }}>
                  <img src="/laney.jpg" alt="default hero" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 4, border: '1px solid rgba(188,98,140,0.15)', flexShrink: 0 }} />
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#888', flex: 1 }}>
                    Default photo — upload an image below to replace it
                  </p>
                </div>
              ) : (
                heroImages.map((url, idx) => (
                  <div key={url} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 12px', border: '1px solid rgba(188,98,140,0.15)', borderRadius: 6, background: 'rgba(255,252,249,0.5)' }}>
                    <img src={url} alt={`hero ${idx + 1}`} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 4, border: '1px solid rgba(188,98,140,0.2)', flexShrink: 0 }} />
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#666', flex: 1 }}>
                      Image {idx + 1} of {heroImages.length}
                      {heroImages.length > 1 && idx === 0 && <span style={{ marginLeft: 8, fontSize: '0.75rem', color: 'var(--brand-sage)' }}>shown first</span>}
                    </p>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button type="button" onClick={() => moveHeroImage(idx, -1)} disabled={idx === 0} style={{ padding: '4px 8px', fontSize: '0.8rem', border: 'none', background: idx === 0 ? '#ddd' : 'var(--brand-sage)', color: '#fff', borderRadius: 4, cursor: idx === 0 ? 'not-allowed' : 'pointer' }} title="Move up">↑</button>
                      <button type="button" onClick={() => moveHeroImage(idx, 1)} disabled={idx === heroImages.length - 1} style={{ padding: '4px 8px', fontSize: '0.8rem', border: 'none', background: idx === heroImages.length - 1 ? '#ddd' : 'var(--brand-sage)', color: '#fff', borderRadius: 4, cursor: idx === heroImages.length - 1 ? 'not-allowed' : 'pointer' }} title="Move down">↓</button>
                      <button type="button" onClick={() => setEditingHeroImageIdx(idx)} style={{ padding: '4px 8px', fontSize: '0.8rem', border: 'none', background: 'var(--brand-sage)', color: '#fff', borderRadius: 4, cursor: 'pointer' }}>✎ Edit</button>
                      <button type="button" onClick={() => removeHeroImage(idx)} style={{ padding: '4px 8px', fontSize: '0.8rem', border: 'none', background: 'var(--brand-primary)', color: '#fff', borderRadius: 4, cursor: 'pointer' }}>Remove</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <label className="form-field-label" style={{ fontWeight: 400, textTransform: 'none', marginTop: 4 }}>
              Add hero image
              <input
                className="text-input"
                type="file"
                accept="image/*"
                onChange={handleHeroImageUpload}
                disabled={isHeroUploading}
              />
            </label>
            {isHeroUploading && <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--brand-sage)' }}>Uploading…</p>}

            {heroImages.length > 1 && (
              <label className="form-field-label" style={{ fontWeight: 400, textTransform: 'none' }}>
                Slideshow interval (seconds)
                <input
                  className="text-input"
                  type="number"
                  min="2"
                  max="60"
                  step="1"
                  value={settings.heroSlideshowInterval ?? 5}
                  onChange={(e) => saveSettings({ heroSlideshowInterval: Math.max(2, Number(e.target.value || 5)) })}
                  style={{ maxWidth: 100 }}
                />
              </label>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="ghost-btn"
                onClick={resetHeroImagesToDefault}
                disabled={isHeroUploading || heroImages.length === 0}
              >
                Clear All Hero Images
              </button>
            </div>
          </div>

          <label className="form-field-label">Contact Email
            <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>Shown publicly on the Contact page and footer — use your customer-facing address</span>
            <input className="text-input" value={settings.contactEmail || import.meta.env.VITE_CONTACT_EMAIL || ''} onChange={(e) => saveSettings({ contactEmail: e.target.value })} placeholder="e.g. hello@806andcompany.com" />
          </label>

          <label className="form-field-label">Owner / Notification Email
            <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>Where new-order alert emails are sent — typically your personal inbox</span>
            <input className="text-input" value={settings.ownerEmail || import.meta.env.VITE_CONTACT_EMAIL || ''} onChange={(e) => saveSettings({ ownerEmail: e.target.value })} placeholder="e.g. hello@806andcompany.com" />
          </label>

          <label className="form-field-label">Orders Email
            <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>The "From" address on order confirmation emails sent to customers (must be verified in Resend)</span>
            <input className="text-input" value={settings.ordersEmail || import.meta.env.VITE_ORDERS_EMAIL || ''} onChange={(e) => saveSettings({ ordersEmail: e.target.value })} placeholder="e.g. orders@806andcompany.com" />
          </label>

          <label className="form-field-label">Support Email
            <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>Shown on shipping notifications and order receipts for customer questions</span>
            <input className="text-input" value={settings.supportEmail || import.meta.env.VITE_SUPPORT_EMAIL || ''} onChange={(e) => saveSettings({ supportEmail: e.target.value })} placeholder="e.g. support@806andcompany.com" />
          </label>

          <label className="form-field-label">Instagram URL
            <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>Full URL to your Instagram profile — used for the embed on the home page</span>
            <input className="text-input" value={settings.instagramUrl || ''} onChange={(e) => saveSettings({ instagramUrl: e.target.value })} placeholder="e.g. " />
          </label>

          <label className="form-field-label">Instagram Feed Embed URL
            <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>Optional — paste an embed URL from SnapWidget, LightWidget, or similar to show a photo grid</span>
            <input className="text-input" value={settings.instagramEmbedUrl || ''} onChange={(e) => saveSettings({ instagramEmbedUrl: e.target.value })} placeholder="https://snapwidget.com/embed/..." />
          </label>

          <label className="form-field-label">Facebook Page URL
            <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>Full URL to your Facebook page — used for the live feed embed on the home page</span>
            <input className="text-input" value={settings.facebookUrl || ''} onChange={(e) => saveSettings({ facebookUrl: e.target.value })} placeholder="e.g. https://www.facebook.com/YourPageName" />
          </label>

          <label className="form-field-label">Facebook Feed Embed URL
            <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>Enter your Facebook vanity URL to show a live timeline feed instead of a follow card</span>
            <input className="text-input" value={settings.facebookEmbedUrl || ''} onChange={(e) => saveSettings({ facebookEmbedUrl: e.target.value })} placeholder="https://www.facebook.com/Eight0SixAndCompany" />
          </label>

          <h3 style={{ margin: '16px 0 0' }}>Shipping &amp; Delivery</h3>
          <p style={{ margin: '0 0 8px', fontSize: '0.85rem', color: '#5a3040' }}>
            Flat rates used at checkout. Per-product surcharges can be set on each product.
          </p>

          <label className="form-field-label">Default shipping rate
            <div className="price-input-wrap">
              <span className="price-prefix">$</span>
              <input
                className="text-input"
                type="number"
                step="0.01"
                min="0"
                value={settings.shipping?.defaultShippingRate ?? 8}
                onChange={(e) => updateShippingSettings({ defaultShippingRate: Number(e.target.value || 0) })}
              />
            </div>
          </label>

          <label className="form-field-label">Free shipping minimum (subtotal after coupon)
            <div className="price-input-wrap">
              <span className="price-prefix">$</span>
              <input
                className="text-input"
                type="number"
                step="0.01"
                min="0"
                value={settings.shipping?.freeShippingMinimum ?? 75}
                onChange={(e) => updateShippingSettings({ freeShippingMinimum: Number(e.target.value || 0) })}
              />
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>Set to 0 to disable free shipping.</span>
          </label>

          <label className="form-field-label">Local delivery minimum fee
            <div className="price-input-wrap">
              <span className="price-prefix">$</span>
              <input
                className="text-input"
                type="number"
                step="0.01"
                min="0"
                value={settings.shipping?.localDeliveryFee ?? 12}
                onChange={(e) => updateShippingSettings({ localDeliveryFee: Number(e.target.value || 0) })}
              />
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>
              Used as the flat delivery fee, or as the minimum when mileage delivery is enabled.
            </span>
          </label>

          <label className="form-field-label">Local pickup fee
            <div className="price-input-wrap">
              <span className="price-prefix">$</span>
              <input
                className="text-input"
                type="number"
                step="0.01"
                min="0"
                value={settings.shipping?.pickupFee ?? 0}
                onChange={(e) => updateShippingSettings({ pickupFee: Number(e.target.value || 0) })}
              />
            </div>
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={Boolean(settings.shipping?.useMileageDelivery)}
              onChange={(e) => updateShippingSettings({ useMileageDelivery: e.target.checked })}
            />
            Use IRS mileage rate for local delivery when a customer address is provided
          </label>

          <label className="form-field-label">IRS mileage rate (per mile)
            <div className="price-input-wrap">
              <span className="price-prefix">$</span>
              <input
                className="text-input"
                type="number"
                step="0.01"
                min="0"
                value={settings.shipping?.mileageRate ?? 0.7}
                onChange={(e) => updateShippingSettings({ mileageRate: Number(e.target.value || 0) })}
              />
            </div>
          </label>

          <div className="form-field-label" style={{ gap: 8 }}>
            Deliver-from address
            <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>
              Used to calculate local delivery mileage from your shop to the customer.
            </span>
            <input
              className="text-input"
              placeholder="Street"
              value={settings.shipping?.deliveryOrigin?.street || ''}
              onChange={(e) =>
                updateShippingSettings({
                  deliveryOrigin: { ...(settings.shipping?.deliveryOrigin || {}), street: e.target.value },
                })
              }
            />
            <div className="inline-form">
              <input
                className="text-input"
                placeholder="City"
                value={settings.shipping?.deliveryOrigin?.city || ''}
                onChange={(e) =>
                  updateShippingSettings({
                    deliveryOrigin: { ...(settings.shipping?.deliveryOrigin || {}), city: e.target.value },
                  })
                }
              />
              <input
                className="text-input"
                placeholder="State"
                value={settings.shipping?.deliveryOrigin?.state || ''}
                onChange={(e) =>
                  updateShippingSettings({
                    deliveryOrigin: { ...(settings.shipping?.deliveryOrigin || {}), state: e.target.value },
                  })
                }
              />
              <input
                className="text-input"
                placeholder="ZIP"
                value={settings.shipping?.deliveryOrigin?.zip || ''}
                onChange={(e) =>
                  updateShippingSettings({
                    deliveryOrigin: { ...(settings.shipping?.deliveryOrigin || {}), zip: e.target.value },
                  })
                }
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Payments' && (
        <div className="panel form-stack">
          <h2>Payment Settings</h2>

          <label className="checkbox-row">
            <input type="checkbox" checked={Boolean(settings.paypal?.enabled)} onChange={(e) => updatePayment('paypal', 'enabled', e.target.checked)} />
            Enable PayPal
          </label>
          <label className="form-field-label">PayPal Client ID
            <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>Optional. Only needed for in-page PayPal buttons (business integration).</span>
            <input className="text-input" value={settings.paypal?.clientId || ''} onChange={(e) => updatePayment('paypal', 'clientId', e.target.value)} placeholder="PayPal Client ID" />
          </label>

          <label className="form-field-label">PayPal Payment Link
            <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>Use this for no-business-account fallback. Paste a full payment link or PayPal.Me URL.</span>
            <input className="text-input" value={settings.paypal?.paymentLink || ''} onChange={(e) => updatePayment('paypal', 'paymentLink', e.target.value)} placeholder="https://paypal.me/yourname" />
          </label>

          <label className="checkbox-row">
            <input type="checkbox" checked={Boolean(settings.venmo?.enabled)} onChange={(e) => updatePayment('venmo', 'enabled', e.target.checked)} />
            Enable Venmo
          </label>
          <input className="text-input" value={settings.venmo?.handle || ''} onChange={(e) => updatePayment('venmo', 'handle', e.target.value)} placeholder="Venmo Handle" />

          <label className="checkbox-row">
            <input type="checkbox" checked={Boolean(settings.cashapp?.enabled)} onChange={(e) => updatePayment('cashapp', 'enabled', e.target.checked)} />
            Enable Cash App
          </label>
          <input className="text-input" value={settings.cashapp?.cashtag || ''} onChange={(e) => updatePayment('cashapp', 'cashtag', e.target.value)} placeholder="Cash App Cashtag" />
        </div>
      )}

      {activeTab === 'Coupons' && (
        <div className="admin-grid">
          <form className={`form-stack panel${editingCouponId ? ' panel-editing' : ''}`} onSubmit={handleSaveCoupon}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <h2>{editingCouponId ? 'Edit Coupon' : 'Add Coupon'}</h2>
              {editingCouponId && (
                <button type="button" className="ghost-btn" onClick={handleCancelCouponEdit}>Cancel</button>
              )}
            </div>
            <label className="form-field-label">
              Coupon Code
              <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>
                Letters and numbers (upper or lowercase). Matching is case-insensitive.
              </span>
              <input
                className="text-input"
                value={couponDraft.code}
                placeholder="e.g. Spring15"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                onChange={(e) =>
                  setCouponDraft((prev) => ({
                    ...prev,
                    code: e.target.value.replace(/[^A-Za-z0-9]/g, ''),
                  }))
                }
              />
            </label>
            <label className="form-field-label">
              Discount Percent
              <input
                className="text-input"
                type="number"
                step="0.01"
                min="0.01"
                max="100"
                value={couponDraft.discountPercent}
                onChange={(e) => setCouponDraft((prev) => ({ ...prev, discountPercent: e.target.value }))}
              />
            </label>
            <label className="form-field-label">
              Start Date / Time
              <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>Optional — coupon cannot be used before this time</span>
              <input
                className="text-input"
                type="datetime-local"
                value={couponDraft.startDate}
                onChange={(e) => setCouponDraft((prev) => ({ ...prev, startDate: e.target.value }))}
              />
            </label>
            <label className="form-field-label">
              End Date / Time
              <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>
                Optional — coupon cannot be used after this time. Midnight (12:00 AM) counts as the end of that day.
              </span>
              <input
                className="text-input"
                type="datetime-local"
                value={couponDraft.endDate}
                onChange={(e) => setCouponDraft((prev) => ({ ...prev, endDate: e.target.value }))}
              />
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={Boolean(couponDraft.active)}
                onChange={(e) => setCouponDraft((prev) => ({ ...prev, active: e.target.checked }))}
              />
              Coupon is active
            </label>
            <button type="submit" className="primary-btn">
              {editingCouponId ? 'Update Coupon' : 'Create Coupon'}
            </button>
          </form>

          <div className="panel">
            <h2>Existing Coupons</h2>
            <div className="stack-list">
              {coupons.map((coupon) => (
                <article key={coupon.id} className={`cart-row${editingCouponId === coupon.id ? ' cart-row-editing' : ''}`}>
                  <div>
                    <strong>{coupon.code}</strong>
                    <p style={{ margin: '4px 0 0' }}>
                      {Number(coupon.discountPercent || 0)}% off | {coupon.active ? 'Active' : 'Disabled'}
                    </p>
                    {(coupon.startDate || coupon.endDate) && (
                      <p style={{ margin: '2px 0 0', fontSize: '0.78rem', opacity: 0.7 }}>
                        {coupon.startDate && !coupon.endDate && `Starts ${new Date(coupon.startDate).toLocaleString()}`}
                        {coupon.endDate && !coupon.startDate && `Expires ${new Date(coupon.endDate).toLocaleString()}`}
                        {coupon.startDate && coupon.endDate && `${new Date(coupon.startDate).toLocaleString()} – ${new Date(coupon.endDate).toLocaleString()}`}
                      </p>
                    )}
                  </div>
                  <div className="qty-wrap">
                    <button type="button" className="ghost-btn" onClick={() => handleEditCoupon(coupon)}>
                      Edit
                    </button>
                    <button type="button" className="ghost-btn" onClick={() => toggleCouponActive(coupon)}>
                      {coupon.active ? 'Disable' : 'Enable'}
                    </button>
                    <button type="button" className="ghost-btn" onClick={() => handleDeleteCoupon(coupon)}>
                      Delete
                    </button>
                  </div>
                </article>
              ))}
              {coupons.length === 0 && <p>No coupons yet.</p>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Gift Cards' && (
        <div className="admin-grid">
          <form className={`form-stack panel${editingGiftCardId ? ' panel-editing' : ''}`} onSubmit={handleSaveGiftCard}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <h2>{editingGiftCardId ? 'Edit Gift Card' : 'Add Gift Card'}</h2>
              {editingGiftCardId && (
                <button type="button" className="ghost-btn" onClick={handleCancelGiftCardEdit}>Cancel</button>
              )}
            </div>
            <label className="form-field-label">
              Gift Card Code
              <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>
                Leave blank to generate a code. Hyphens allowed; matching is case-insensitive.
              </span>
              <div className="inline-form" style={{ alignItems: 'stretch' }}>
                <input
                  className="text-input"
                  value={giftCardDraft.code}
                  placeholder="e.g. GC-AB12-CD34-EF56"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  onChange={(e) =>
                    setGiftCardDraft((prev) => ({
                      ...prev,
                      code: formatGiftCardCode(e.target.value),
                    }))
                  }
                  style={{ flex: 1 }}
                />
                {!editingGiftCardId && (
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() =>
                      setGiftCardDraft((prev) => ({
                        ...prev,
                        code: generateGiftCardCode(),
                      }))
                    }
                  >
                    Generate
                  </button>
                )}
              </div>
            </label>
            <label className="form-field-label">
              Amount
              <input
                className="text-input"
                type="number"
                step="0.01"
                min="0.01"
                value={giftCardDraft.initialAmount}
                onChange={(e) => {
                  const value = e.target.value
                  setGiftCardDraft((prev) => ({
                    ...prev,
                    initialAmount: value,
                    remainingBalance: editingGiftCardId ? prev.remainingBalance : value,
                  }))
                }}
              />
            </label>
            {editingGiftCardId && (
              <label className="form-field-label">
                Remaining Balance
                <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>
                  Adjust if needed (e.g. after a refund). Cannot exceed amount.
                </span>
                <input
                  className="text-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={giftCardDraft.remainingBalance}
                  onChange={(e) => setGiftCardDraft((prev) => ({ ...prev, remainingBalance: e.target.value }))}
                />
              </label>
            )}
            <label className="form-field-label">
              Notes (optional)
              <input
                className="text-input"
                value={giftCardDraft.notes}
                placeholder="e.g. Birthday gift for Jane"
                onChange={(e) => setGiftCardDraft((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={Boolean(giftCardDraft.active)}
                onChange={(e) => setGiftCardDraft((prev) => ({ ...prev, active: e.target.checked }))}
              />
              Gift card is active
            </label>
            <button type="submit" className="primary-btn">
              {editingGiftCardId ? 'Update Gift Card' : 'Create Gift Card'}
            </button>
          </form>

          <div className="panel">
            <h2>Existing Gift Cards</h2>
            <div className="stack-list">
              {giftCards.map((card) => {
                const initial = Number(card.initialAmount || 0)
                const remaining = Number(card.remainingBalance || 0)
                const used = Math.max(0, Number((initial - remaining).toFixed(2)))
                return (
                  <article key={card.id} className={`cart-row${editingGiftCardId === card.id ? ' cart-row-editing' : ''}`}>
                    <div>
                      <strong>{card.code}</strong>
                      <p style={{ margin: '4px 0 0' }}>
                        {toCurrency(remaining)} remaining of {toCurrency(initial)}
                        {' | '}
                        Used {toCurrency(used)}
                        {' | '}
                        {card.active !== false ? 'Active' : 'Disabled'}
                      </p>
                      {card.notes && (
                        <p style={{ margin: '2px 0 0', fontSize: '0.78rem', opacity: 0.7 }}>{card.notes}</p>
                      )}
                    </div>
                    <div className="qty-wrap">
                      <button type="button" className="ghost-btn" onClick={() => handleEditGiftCard(card)}>
                        Edit
                      </button>
                      <button type="button" className="ghost-btn" onClick={() => toggleGiftCardActive(card)}>
                        {card.active !== false ? 'Disable' : 'Enable'}
                      </button>
                      <button type="button" className="ghost-btn" onClick={() => handleDeleteGiftCard(card)}>
                        Delete
                      </button>
                    </div>
                  </article>
                )
              })}
              {giftCards.length === 0 && <p>No gift cards yet.</p>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'About' && (
        <div className="panel form-stack">
          <h2>About Page</h2>
          <p style={{ margin: '0 0 8px', fontSize: '0.85rem', color: '#5a3040' }}>Changes save directly to the live site — no deployment needed.</p>

          <label className="form-field-label">Page Eyebrow
            <input className="text-input" value={aboutDraft.heroEyebrow} onChange={(e) => setAboutDraft((p) => ({ ...p, heroEyebrow: e.target.value }))} placeholder="e.g. handmade with intention" />
          </label>

          <label className="form-field-label">Hero Title
            <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>Use a new line to create line breaks</span>
            <textarea className="text-input" rows={2} value={aboutDraft.heroTitle} onChange={(e) => setAboutDraft((p) => ({ ...p, heroTitle: e.target.value }))} placeholder="e.g. Made with Love.&#10;Finished by Hand." />
          </label>

          <label className="form-field-label">Your Name / Intro Heading
            <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>Use a new line to create line breaks</span>
            <textarea className="text-input" rows={3} value={aboutDraft.storyHeading} onChange={(e) => setAboutDraft((p) => ({ ...p, storyHeading: e.target.value }))} />
          </label>

          <label className="form-field-label">Bio — Paragraph 1
            <textarea className="text-input" rows={4} value={aboutDraft.storyP1} onChange={(e) => setAboutDraft((p) => ({ ...p, storyP1: e.target.value }))} />
          </label>

          <label className="form-field-label">Bio — Paragraph 2
            <textarea className="text-input" rows={4} value={aboutDraft.storyP2} onChange={(e) => setAboutDraft((p) => ({ ...p, storyP2: e.target.value }))} />
          </label>

          <label className="form-field-label">Bio — Paragraph 3
            <textarea className="text-input" rows={4} value={aboutDraft.storyP3} onChange={(e) => setAboutDraft((p) => ({ ...p, storyP3: e.target.value }))} />
          </label>

          <label className="form-field-label">Pull Quote
            <input className="text-input" value={aboutDraft.pullQuote} onChange={(e) => setAboutDraft((p) => ({ ...p, pullQuote: e.target.value }))} placeholder='"Every piece is made for one person..."' />
          </label>

          <label className="form-field-label">What I Make — Section Heading
            <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>Use a new line to create line breaks</span>
            <textarea className="text-input" rows={2} value={aboutDraft.craftHeading} onChange={(e) => setAboutDraft((p) => ({ ...p, craftHeading: e.target.value }))} />
          </label>

          {/* Craft cards */}
          <div className="form-field-label" style={{ gap: 12 }}>
            <span>What I Make — Cards</span>
            {(aboutDraft.craftCards || defaultSettings.about.craftCards).map((card, i) => (
              <div key={i} className="craft-card-editor">
                <div className="craft-card-editor-preview">
                  {card.image
                    ? <img src={card.image} alt={card.title} className="craft-card-thumb" />
                    : <div className="craft-card-thumb craft-card-thumb-empty">{card.icon || '✦'}</div>
                  }
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label className="ghost-btn" style={{ cursor: 'pointer', fontSize: '0.8rem' }}>
                      {craftCardUploadingFor === i ? 'Uploading…' : card.image ? 'Change Image' : 'Upload Image'}
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        disabled={craftCardUploadingFor === i}
                        onChange={(e) => handleCraftCardImageUpload(i, e.target.files?.[0])}
                      />
                    </label>
                    {card.image && (
                      <button type="button" className="ghost-btn" style={{ fontSize: '0.8rem' }} onClick={() => updateCraftCard(i, 'image', '')}>Remove Image</button>
                    )}
                  </div>
                </div>
                <input className="text-input" value={card.title} onChange={(e) => updateCraftCard(i, 'title', e.target.value)} placeholder="Card title" />
                <input className="text-input" value={card.icon} onChange={(e) => updateCraftCard(i, 'icon', e.target.value)} placeholder="Fallback emoji (shown if no image)" />
                <textarea className="text-input" rows={3} value={card.description} onChange={(e) => updateCraftCard(i, 'description', e.target.value)} placeholder="Card description" />
                <button type="button" className="ghost-btn" style={{ fontSize: '0.8rem', alignSelf: 'flex-start' }} onClick={() => removeCraftCard(i)}>Remove Card</button>
              </div>
            ))}
            <button type="button" className="ghost-btn" style={{ alignSelf: 'flex-start' }} onClick={addCraftCard}>+ Add Card</button>
          </div>

          <label className="form-field-label">Call-to-action Text
            <input className="text-input" value={aboutDraft.ctaText} onChange={(e) => setAboutDraft((p) => ({ ...p, ctaText: e.target.value }))} placeholder="e.g. Ready to find something made just for you?" />
          </label>

          <button
            type="button"
            className="primary-btn"
            onClick={async () => {
              await saveSettings({ about: aboutDraft })
              setStatus('About page updated!')
            }}
          >
            Save About Page
          </button>
        </div>
      )}

      {activeTab === 'Orders' && (
        <div className="panel">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Orders</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                className="primary-btn"
                style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}
                onClick={() => setShowManualOrderForm(true)}
              >
                + New Manual Order
              </button>
              <button
                type="button"
                className="ghost-btn"
                style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}
                onClick={handleExportBudgetData}
                title="Download order data as JSON for importing into the budget spreadsheet"
              >
                ↓ Export for Budget
              </button>
              <div className="orders-view-tabs">
              <button
                type="button"
                className={ordersView === 'active' ? 'orders-view-tab orders-view-tab--active' : 'orders-view-tab'}
                onClick={() => setOrdersView('active')}
              >
                Active ({orders.filter((o) => !o.archived).length})
              </button>
              <button
                type="button"
                className={ordersView === 'archive' ? 'orders-view-tab orders-view-tab--active' : 'orders-view-tab'}
                onClick={() => setOrdersView('archive')}
              >
                Archive ({orders.filter((o) => o.archived).length})
              </button>
            </div>
            </div>
          </div>

          <details style={{ margin: '0 0 12px', fontSize: '0.85rem' }}>
            <summary style={{ cursor: 'pointer', color: '#888' }}>
              Notion sync {notionSettings.enabled ? '(enabled)' : '(disabled)'}
            </summary>
            <div className="inline-form" style={{ marginTop: 8, alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={notionSettings.enabled}
                  onChange={(e) => setNotionSettings((prev) => ({ ...prev, enabled: e.target.checked }))}
                />
                Sync orders to Notion
              </label>
              <input
                className="text-input"
                style={{ flex: 1 }}
                placeholder="Notion database ID"
                value={notionSettings.databaseId}
                onChange={(e) => setNotionSettings((prev) => ({ ...prev, databaseId: e.target.value }))}
              />
              <button type="button" className="ghost-btn" onClick={handleSaveNotionSettings} disabled={savingNotionSettings}>
                {savingNotionSettings ? 'Saving…' : 'Save'}
              </button>
            </div>
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                className="ghost-btn"
                onClick={handleBackfillNotion}
                disabled={backfillingNotion || !notionSettings.enabled}
                title={!notionSettings.enabled ? 'Enable Notion sync first' : undefined}
              >
                {backfillingNotion ? 'Syncing…' : 'Sync existing orders to Notion'}
              </button>
              <span style={{ marginLeft: 8, fontSize: '0.75rem', opacity: 0.6 }}>
                Queues all unsynced orders — only needed once for existing data.
              </span>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: '0.75rem', opacity: 0.7 }}>
              The Notion API key and webhook secret are configured separately via Firebase Secret Manager, not here.
            </p>
          </details>

          {ordersView === 'archive' && (
            <p style={{ margin: '0 0 12px', fontSize: '0.85rem', color: '#888' }}>
              Archived orders are hidden from the active view. You can restore them at any time.
            </p>
          )}

          <div className="stack-list">
            {orders
              .filter((o) => ordersView === 'archive' ? o.archived : !o.archived)
              .map((order) => (
              <article key={order.id} className="panel">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px' }}>
                      Order {order.id}
                      {order.isManual && (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: 'rgba(188,98,140,0.12)',
                            color: '#BC628C',
                            verticalAlign: 'middle',
                          }}
                        >
                          🖊️ Manual
                        </span>
                      )}
                    </h3>
                    <p style={{ margin: 0 }}>{order.customer?.name} | {order.customer?.email}</p>
                    <p style={{ margin: 0 }}>{order.customer?.address?.street}, {order.customer?.address?.city}, {order.customer?.address?.state} {order.customer?.address?.zip}</p>
                    <p style={{ margin: 0 }}>Payment: {order.paymentMethod}</p>
                  </div>
                  {ordersView === 'archive' ? (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {collectOrderNoteImageUrls(order).length > 0 && (
                        <button
                          type="button"
                          className="ghost-btn"
                          style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}
                          onClick={async () => {
                            const imageCount = collectOrderNoteImageUrls(order).length
                            const confirmed = window.confirm(
                              `Delete ${imageCount} photo${imageCount === 1 ? '' : 's'} from storage for order ${order.id}? The order record will be kept.`,
                            )
                            if (!confirmed) return
                            const result = await removeOrderNoteImages(order)
                            refreshOrders()
                            if (result.failed.length > 0) {
                              setStatus(`Removed ${result.deleted.length} photo(s) from order ${order.id}. ${result.failed.length} could not be deleted.`)
                            } else {
                              setStatus(`Removed ${result.deleted.length} photo(s) from order ${order.id}. Order history kept.`)
                            }
                          }}
                        >
                          Delete photos
                        </button>
                      )}
                      <button
                        type="button"
                        className="ghost-btn"
                        style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}
                        onClick={async () => {
                          await updateOrder(order.id, { archived: false })
                          refreshOrders()
                          setStatus(`Order ${order.id} restored to Active.`)
                        }}
                      >
                        ↩ Restore
                      </button>
                      <button
                        type="button"
                        className="ghost-btn"
                        style={{ fontSize: '0.82rem', whiteSpace: 'nowrap', borderColor: 'rgba(188,98,140,0.55)', color: '#BC628C' }}
                        onClick={async () => {
                          const hasPhotos = collectOrderNoteImageUrls(order).length > 0
                          const confirmed = window.confirm(
                            hasPhotos
                              ? `Permanently delete order ${order.id} and its uploaded photos? This cannot be undone.`
                              : `Permanently delete order ${order.id}? This cannot be undone.`,
                          )
                          if (!confirmed) return
                          await deleteOrder(order)
                          refreshOrders()
                          setStatus(`Order ${order.id} deleted.`)
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {editingOrderId === order.id ? (
                        <>
                          <button type="button" className="primary-btn" style={{ fontSize: '0.82rem' }} onClick={saveEditOrder}>Save Changes</button>
                          <button type="button" className="ghost-btn" style={{ fontSize: '0.82rem' }} onClick={cancelEditOrder}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="ghost-btn" style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }} onClick={() => startEditOrder(order)}>Edit Order</button>
                          {['Complete', 'Delivered', 'Picked Up'].includes(order.status) && (
                            <button
                              type="button"
                              className="ghost-btn"
                              style={{ fontSize: '0.82rem', whiteSpace: 'nowrap', borderColor: 'rgba(188,98,140,0.4)' }}
                              onClick={async () => {
                                await updateOrder(order.id, { archived: true })
                                refreshOrders()
                                setStatus(`Order ${order.id} moved to Archive.`)
                              }}
                            >
                              Archive ›
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
                {editingOrderId === order.id ? (
                  <div style={{ display: 'grid', gap: 16, marginTop: 14 }}>
                    {/* Customer */}
                    <div>
                      <p style={{ margin: '0 0 8px', fontWeight: 600, fontSize: '0.88rem' }}>Customer</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.82rem', color: '#666' }}>
                          Name
                          <input className="text-input" value={orderDraft.customer.name} onChange={(e) => setOrderDraft((p) => ({ ...p, customer: { ...p.customer, name: e.target.value } }))} />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.82rem', color: '#666' }}>
                          Email
                          <input className="text-input" type="email" value={orderDraft.customer.email} onChange={(e) => setOrderDraft((p) => ({ ...p, customer: { ...p.customer, email: e.target.value } }))} />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.82rem', color: '#666' }}>
                          Phone
                          <input className="text-input" type="tel" value={orderDraft.customer.phone} onChange={(e) => setOrderDraft((p) => ({ ...p, customer: { ...p.customer, phone: e.target.value } }))} />
                        </label>
                      </div>
                    </div>
                    {/* Address */}
                    <div>
                      <p style={{ margin: '0 0 8px', fontWeight: 600, fontSize: '0.88rem' }}>Shipping Address</p>
                      <div style={{ display: 'grid', gap: 8 }}>
                        <input className="text-input" placeholder="Street" value={orderDraft.customer.address.street} onChange={(e) => setOrderDraft((p) => ({ ...p, customer: { ...p.customer, address: { ...p.customer.address, street: e.target.value } } }))} />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 80px', gap: 8 }}>
                          <input className="text-input" placeholder="City" value={orderDraft.customer.address.city} onChange={(e) => setOrderDraft((p) => ({ ...p, customer: { ...p.customer, address: { ...p.customer.address, city: e.target.value } } }))} />
                          <input className="text-input" placeholder="ST" value={orderDraft.customer.address.state} onChange={(e) => setOrderDraft((p) => ({ ...p, customer: { ...p.customer, address: { ...p.customer.address, state: e.target.value } } }))} />
                          <input className="text-input" placeholder="ZIP" value={orderDraft.customer.address.zip} onChange={(e) => setOrderDraft((p) => ({ ...p, customer: { ...p.customer, address: { ...p.customer.address, zip: e.target.value } } }))} />
                        </div>
                      </div>
                    </div>
                    {/* Items */}
                    <div>
                      <p style={{ margin: '0 0 8px', fontWeight: 600, fontSize: '0.88rem' }}>Items</p>
                      <div style={{ display: 'grid', gap: 6 }}>
                        {orderDraft.items.map((item, idx) => (
                          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 72px 90px auto', gap: 8, alignItems: 'center', padding: '6px 8px', background: 'rgba(188,98,140,0.04)', borderRadius: 4 }}>
                            <input className="text-input" placeholder="Item name" value={item.name || ''} onChange={(e) => setOrderDraft((p) => ({ ...p, items: p.items.map((it, i) => i === idx ? { ...it, name: e.target.value } : it) }))} />
                            <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.75rem', color: '#888' }}>
                              Qty
                              <input className="text-input" type="number" min="1" value={item.quantity || 1} onChange={(e) => setOrderDraft((p) => ({ ...p, items: p.items.map((it, i) => i === idx ? { ...it, quantity: Number(e.target.value) } : it) }))} />
                            </label>
                            <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.75rem', color: '#888' }}>
                              Price ($)
                              <input className="text-input" type="number" step="0.01" min="0" value={item.price || ''} onChange={(e) => setOrderDraft((p) => ({ ...p, items: p.items.map((it, i) => i === idx ? { ...it, price: e.target.value } : it) }))} />
                            </label>
                            <button type="button" onClick={() => setOrderDraft((p) => ({ ...p, items: p.items.filter((_, i) => i !== idx) }))} style={{ padding: '0 10px', height: 34, border: 'none', background: 'var(--brand-primary)', color: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: '1rem', alignSelf: 'end' }}>×</button>
                          </div>
                        ))}
                        <button type="button" className="ghost-btn" style={{ justifySelf: 'start', fontSize: '0.82rem' }} onClick={() => setOrderDraft((p) => ({ ...p, items: [...p.items, { name: '', quantity: 1, price: '' }] }))}>+ Add Item</button>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: '0.85rem', color: '#666', marginTop: 6 }}>
                        Subtotal: <strong>${orderDraft.items.reduce((s, it) => s + Number(it.price || 0) * Number(it.quantity || 1), 0).toFixed(2)}</strong>
                      </div>
                    </div>
                    {/* Order details */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.82rem', color: '#666' }}>
                        Status
                        <select className="text-input" value={orderDraft.status} onChange={(e) => setOrderDraft((p) => ({ ...p, status: e.target.value }))}>
                          {orderStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </label>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.82rem', color: '#666' }}>
                        Payment Method
                        <select className="text-input" value={orderDraft.paymentMethod} onChange={(e) => setOrderDraft((p) => ({ ...p, paymentMethod: e.target.value }))}>
                          <option value="venmo">Venmo</option>
                          <option value="paypal">PayPal</option>
                          <option value="cashapp">Cash App</option>
                          <option value="cash">Cash</option>
                          <option value="stripe">Card (Stripe)</option>
                          <option value="contact">Other / Contact</option>
                        </select>
                      </label>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.82rem', color: '#666' }}>
                        Fulfillment
                        <select className="text-input" value={orderDraft.fulfillmentMethod} onChange={(e) => setOrderDraft((p) => ({ ...p, fulfillmentMethod: e.target.value }))}>
                          <option value="ship">Shipping</option>
                          <option value="delivery">Local Delivery</option>
                          <option value="pickup">Local Pickup</option>
                        </select>
                      </label>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.82rem', color: '#666' }}>
                        Tracking Number
                        <input className="text-input" value={orderDraft.trackingNumber} placeholder="optional" onChange={(e) => setOrderDraft((p) => ({ ...p, trackingNumber: e.target.value }))} />
                      </label>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.82rem', color: '#666' }}>
                        Shipping / Delivery Fee ($)
                        <input className="text-input" type="number" step="0.01" min="0" value={orderDraft.shipping} onChange={(e) => setOrderDraft((p) => ({ ...p, shipping: Number(e.target.value || 0) }))} />
                      </label>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.82rem', color: '#666' }}>
                        Order Total ($)
                        <input className="text-input" type="number" step="0.01" min="0" value={orderDraft.total} onChange={(e) => setOrderDraft((p) => ({ ...p, total: Number(e.target.value || 0) }))} />
                      </label>
                    </div>
                    {/* Notes */}
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.82rem', color: '#666' }}>
                      Customer Note
                      <textarea className="text-input" rows={2} value={orderDraft.notes} placeholder="Visible to customer" onChange={(e) => setOrderDraft((p) => ({ ...p, notes: e.target.value }))} />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.82rem', color: '#666' }}>
                      Internal Notes
                      <textarea className="text-input" rows={2} value={orderDraft.internalNotes} placeholder="Admin-only" onChange={(e) => setOrderDraft((p) => ({ ...p, internalNotes: e.target.value }))} />
                    </label>
                  </div>
                ) : (
                  <>
                  {/* ── Order items ── */}
                {order.items?.length > 0 && (
                  <div style={{ margin: '8px 0 4px' }}>
                    <p style={{ margin: '0 0 6px', fontWeight: 600, fontSize: '0.9rem' }}>Items</p>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ background: 'rgba(188,98,140,0.08)' }}>
                          <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 600 }}>Item</th>
                          <th style={{ textAlign: 'center', padding: '4px 8px', fontWeight: 600, whiteSpace: 'nowrap' }}>Qty</th>
                          <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 600, whiteSpace: 'nowrap' }}>Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((item, idx) => {
                          const variants = formatSelectedVariants(item.selectedVariants, item.variants)
                          const addOns = item.addOns || []
                          return (
                            <tr key={idx} style={{ borderTop: '1px solid rgba(188,98,140,0.1)' }}>
                              <td style={{ padding: '5px 8px', verticalAlign: 'top' }}>
                                <span style={{ fontWeight: 500 }}>{item.name}</span>
                                {variants.length > 0 && (
                                  <ul style={{ margin: '3px 0 0 0', padding: '0 0 0 16px', color: '#666', fontSize: '0.8rem' }}>
                                    {variants.map((variant, variantIdx) => (
                                      <li key={`${variant.label}-${variantIdx}`}><span style={{ fontWeight: 600 }}>{variant.label}:</span> {variant.value}</li>
                                    ))}
                                  </ul>
                                )}
                                {addOns.length > 0 && (
                                  <div style={{ color: '#888', fontSize: '0.8rem', marginTop: 2 }}>
                                    Add-ons: {addOns.map((a) => a.label || a).join(', ')}
                                  </div>
                                )}
                                {item.scheduledLabel && (
                                  <div style={{ color: 'var(--brand-primary)', fontSize: '0.8rem', marginTop: 2, fontWeight: 600 }}>
                                    Appointment: {item.scheduledLabel}
                                  </div>
                                )}
                                {item.needByDate && (
                                  <div style={{ color: '#888', fontSize: '0.8rem', marginTop: 2 }}>
                                    Need by: {item.needByDate}
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '5px 8px', textAlign: 'center', verticalAlign: 'top' }}>{item.quantity}</td>
                              <td style={{ padding: '5px 8px', textAlign: 'right', verticalAlign: 'top', whiteSpace: 'nowrap' }}>${Number(item.price || 0).toFixed(2)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    {/* Totals */}
                    <div style={{ textAlign: 'right', fontSize: '0.85rem', marginTop: 6, lineHeight: 1.8 }}>
                      {order.subtotal != null && order.subtotal !== order.total && (
                        <div style={{ color: '#666' }}>Subtotal: ${Number(order.subtotal).toFixed(2)}</div>
                      )}
                      {order.discount?.amount > 0 && (
                        <div style={{ color: '#BC628C' }}>
                          Coupon ({order.discount.code}): −${Number(order.discount.amount).toFixed(2)}
                        </div>
                      )}
                      {(order.giftCard?.amount > 0 || order.giftCardAmount > 0) && (
                        <div style={{ color: '#BC628C' }}>
                          Gift card ({order.giftCard?.code || 'applied'}): −$
                          {Number(order.giftCard?.amount ?? order.giftCardAmount).toFixed(2)}
                          {order.giftCard?.remainingAfter != null && (
                            <span style={{ color: '#666' }}>
                              {' '}({Number(order.giftCard.remainingAfter).toFixed(2)} left)
                            </span>
                          )}
                        </div>
                      )}
                      {Number(order.shipping) > 0 && (
                        <div style={{ color: '#666' }}>Shipping / delivery: ${Number(order.shipping).toFixed(2)}</div>
                      )}
                      <div style={{ fontWeight: 700 }}>Total: ${Number(order.total ?? 0).toFixed(2)}</div>
                    </div>
                    {/* Fulfillment */}
                    {order.fulfillmentMethod && (
                      <div style={{ fontSize: '0.83rem', color: '#666', marginTop: 4 }}>
                        Fulfillment: <strong>{order.fulfillmentMethod === 'ship' ? 'Shipping' : order.fulfillmentMethod === 'delivery' ? 'Local Delivery' : 'Local Pickup'}</strong>
                      </div>
                    )}
                    {order.trackingNumber && (
                      <div style={{ fontSize: '0.83rem', color: '#666', marginTop: 4 }}>
                        Tracking: <strong>{order.trackingNumber}</strong>
                      </div>
                    )}
                    {order.status === 'Shipped' && order.customer?.email && (
                      <button
                        type="button"
                        className="ghost-btn"
                        style={{ marginTop: 8, fontSize: '0.82rem' }}
                        onClick={() => handleResendShippingEmail(order)}
                      >
                        Resend shipping email
                      </button>
                    )}
                  </div>
                )}
                <p>
                  <strong>Customer Note:</strong> {order.notes || 'None provided'}
                </p>
                {order.deliveryDetails && (order.deliveryDetails.location || order.deliveryDetails.availability) && (
                  <div style={{ marginTop: 8, fontSize: '0.88rem', color: '#5a3040' }}>
                    <p style={{ margin: '0 0 4px' }}><strong>Delivery location:</strong> {order.deliveryDetails.location || '—'}</p>
                    <p style={{ margin: 0 }}><strong>Available times:</strong> {order.deliveryDetails.availability || '—'}</p>
                  </div>
                )}
                {order.noteImage && (
                  <div style={{ marginTop: 12, marginBottom: 12 }}>
                    <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem', fontWeight: 600 }}>Customer Photo:</p>
                    <img src={order.noteImage} alt="Customer note" style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 4, border: '1px solid rgba(188,98,140,0.2)' }} />
                  </div>
                )}
                {order.noteImages?.length > 0 && (
                  <div style={{ marginTop: 12, marginBottom: 12 }}>
                    <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem', fontWeight: 600 }}>Customer Photos:</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {order.noteImages.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noreferrer">
                          <img src={url} alt={`Customer photo ${i + 1}`} style={{ maxWidth: 200, maxHeight: 200, borderRadius: 4, border: '1px solid rgba(188,98,140,0.2)', objectFit: 'cover' }} />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                <div className="inline-form">
                  <select
                    className="text-input"
                    value={order.status || 'Pending'}
                    disabled={ordersView === 'archive'}
                    onChange={async (e) => {
                      await handleOrderStatusSelect(order, e.target.value)
                    }}
                  >
                    {orderStatuses.map((statusOption) => (
                      <option key={statusOption} value={statusOption}>{statusOption}</option>
                    ))}
                  </select>
                  <textarea
                    className="text-input"
                    placeholder="Internal notes"
                    defaultValue={order.internalNotes || ''}
                    disabled={ordersView === 'archive'}
                    onBlur={async (e) => {
                      await updateOrder(order.id, { internalNotes: e.target.value })
                      refreshOrders()
                    }}
                  />
                </div>
                  </>
                )}
              </article>
            ))}
            {orders.filter((o) => ordersView === 'archive' ? o.archived : !o.archived).length === 0 && (
              <p style={{ color: '#aaa', fontSize: '0.9rem', padding: '12px 0' }}>
                {ordersView === 'archive' ? 'No archived orders yet.' : 'No active orders.'}
              </p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'Chat' && (
        <div className="admin-chat-layout">
          {/* Left sidebar: conversation list */}
          <div className="admin-chat-sidebar">
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Active Chats</h2>
            {activeChats.length === 0 && (
              <p className="admin-chat-empty">No active conversations right now.</p>
            )}
            {activeChats.map((chat) => (
              <button
                key={chat.id}
                type="button"
                className={`admin-chat-row${selectedChatId === chat.id ? ' admin-chat-row--active' : ''}`}
                onClick={() => handleSelectChat(chat.id)}
              >
                <div className="admin-chat-row-top">
                  <span className="admin-chat-row-name">{chat.visitorName || 'Anonymous'}</span>
                  <span className="admin-chat-row-time">{formatChatTime(chat.lastMessageAt)}</span>
                </div>
                <div className="admin-chat-row-bottom">
                  <span className="admin-chat-row-preview">
                    {chat.lastMessage || 'New conversation'}
                  </span>
                  {chat.unreadAdmin > 0 && (
                    <span className="admin-chat-unread">{chat.unreadAdmin}</span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Right panel: message view */}
          <div className="admin-chat-main">
            {!selectedChat ? (
              <div className="admin-chat-placeholder">
                <p>Select a conversation to view messages.</p>
              </div>
            ) : (
              <>
                {/* Chat header */}
                <div className="admin-chat-detail-header">
                  <div>
                    <strong>{selectedChat.visitorName || 'Anonymous'}</strong>
                    <span style={{ opacity: 0.6, marginLeft: 8, fontSize: '0.82rem' }}>
                      {selectedChat.visitorEmail}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => handleCloseChat(selectedChat.id)}
                    style={{ fontSize: '0.78rem' }}
                  >
                    Close Chat
                  </button>
                </div>

                {/* Messages */}
                <div className="admin-chat-messages">
                  {adminMessages.length === 0 && (
                    <p className="admin-chat-empty">No messages yet.</p>
                  )}
                  {adminMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`chat-message ${msg.sender === 'admin' ? 'chat-message--admin' : 'chat-message--visitor'}`}
                    >
                      <div className="chat-message-bubble">
                        <p className="chat-message-text">{msg.text}</p>
                        <span className="chat-message-time">{formatChatTime(msg.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Input */}
                <form className="chat-input-row" onSubmit={handleAdminSend}>
                  <input
                    className="text-input chat-text-input"
                    type="text"
                    value={adminText}
                    onChange={(e) => setAdminText(e.target.value)}
                    placeholder="Type a reply…"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="chat-send-btn"
                    disabled={!adminText.trim() || chatSending}
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
      )}

      {activeTab === 'Analytics' && (
        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <h2>Analytics (Last 30 Days)</h2>
            <button
              type="button"
              className="ghost-btn"
              onClick={async () => {
                try {
                  setAnalyticsLoading(true)
                  setAnalyticsError('')
                  setAnalytics(await getAnalyticsSummary())
                } catch (err) {
                  setAnalyticsError(err?.message || 'Failed to refresh analytics.')
                } finally {
                  setAnalyticsLoading(false)
                }
              }}
            >
              Refresh
            </button>
          </div>

          {analyticsLoading && <p>Loading analytics...</p>}
          {analyticsError && <p>{analyticsError}</p>}

          {!analyticsLoading && !analyticsError && analytics && (
            <>
              <div className="admin-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
                <article className="panel">
                  <h3>Current Visitors</h3>
                  <p>{currentVisitors}</p>
                </article>
                <article className="panel">
                  <h3>Active Users</h3>
                  <p>{analytics.activeUsers30d}</p>
                </article>
                <article className="panel">
                  <h3>New Users</h3>
                  <p>{analytics.newUsers30d}</p>
                </article>
                <article className="panel">
                  <h3>Returning Users</h3>
                  <p>{analytics.returningUsers30d}</p>
                </article>
                <article className="panel">
                  <h3>Page Views</h3>
                  <p>{analytics.pageViews30d}</p>
                </article>
                <article className="panel">
                  <h3>Avg Session</h3>
                  <p>{formatDuration(analytics.avgSessionDurationSeconds)}</p>
                </article>
              </div>

              <div className="panel" style={{ marginTop: 12 }}>
                <h3>Top Countries</h3>
                {analytics.topCountries?.length ? (
                  <ul>
                    {analytics.topCountries.map((entry) => (
                      <li key={entry.country}>{entry.country}: {entry.users}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No country data yet.</p>
                )}
              </div>

              {analytics.fetchedAt && (
                <p style={{ marginTop: 10, opacity: 0.7, fontSize: '0.82rem' }}>
                  Last refreshed: {new Date(analytics.fetchedAt).toLocaleString()}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {showManualOrderForm && (
        <ManualOrderModal
          onClose={() => setShowManualOrderForm(false)}
          onSave={handleSaveManualOrder}
        />
      )}

      {shippingModal && (
        <>
          <div className="modal-overlay" onClick={() => setShippingModal(null)} />
          <div className="login-modal">
            <div className="login-modal-content">
              <div className="login-modal-header">
                <h2>{shippingModal.resendOnly ? 'Resend Shipping Email' : 'Mark Order Shipped'}</h2>
                <button type="button" className="close-btn" onClick={() => setShippingModal(null)} aria-label="Close">✕</button>
              </div>
              <p style={{ margin: '0 0 12px', fontSize: '0.92rem', color: '#5a3040' }}>
                {shippingModal.resendOnly ? (
                  <>Resend the shipping notification for order <strong>{shippingModal.order.id}</strong>.</>
                ) : (
                  <>Order <strong>{shippingModal.order.id}</strong> will be marked shipped and the customer will receive an email notification.</>
                )}
              </p>
              <label className="form-field-label">
                Tracking number
                <input
                  className="text-input"
                  type="text"
                  placeholder="e.g. 9400 1000 0000 0000 0000 00"
                  value={shippingModal.trackingNumber}
                  onChange={(e) =>
                    setShippingModal((prev) => ({
                      ...prev,
                      trackingNumber: e.target.value,
                    }))
                  }
                  autoFocus
                />
                <span style={{ fontSize: '0.72rem', fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>
                  Included in the shipping email when provided.
                </span>
              </label>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button type="button" className="primary-btn" onClick={handleConfirmShipOrder}>
                  {shippingModal.resendOnly ? 'Resend Email' : 'Mark Shipped & Notify Customer'}
                </button>
                <button type="button" className="ghost-btn" onClick={() => setShippingModal(null)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}

    </section>
  )
}
