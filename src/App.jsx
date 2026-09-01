import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}
import { Layout } from './components/Layout'
import { About } from './pages/About'
import { Account } from './pages/Account'
import { Admin } from './pages/Admin'
import { Cart } from './pages/Cart'
import { Checkout } from './pages/Checkout'
import { Contact } from './pages/Contact'
import { FoodAllergenNotice } from './pages/FoodAllergenNotice'
import { Home } from './pages/Home'
import { Gallery } from './pages/Gallery'
import { OrderConfirmation } from './pages/OrderConfirmation'
import { ProductDetail } from './pages/ProductDetail'
import { Schedule } from './pages/Schedule'
import { PrivacyPolicy } from './pages/PrivacyPolicy'
import { RefundPolicy } from './pages/RefundPolicy'
import { Shop } from './pages/Shop'
import { ShippingPolicy } from './pages/ShippingPolicy'
import { Terms } from './pages/Terms'

function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="shop" element={<Shop />} />
        <Route path="shop/:productId" element={<ProductDetail />} />
        <Route path="shop/:productId/schedule" element={<Schedule />} />
        <Route path="gallery" element={<Gallery />} />
        <Route path="cart" element={<Cart />} />
        <Route path="checkout" element={<Checkout />} />
        <Route path="order-confirmation" element={<OrderConfirmation />} />
        <Route path="account" element={<Account />} />
        <Route path="about" element={<About />} />
        <Route path="contact" element={<Contact />} />
        <Route path="privacy" element={<PrivacyPolicy />} />
        <Route path="terms" element={<Terms />} />
        <Route path="refunds" element={<RefundPolicy />} />
        <Route path="shipping" element={<ShippingPolicy />} />
        <Route path="allergens" element={<FoodAllergenNotice />} />
        <Route path="admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    </>
  )
}

export default App
