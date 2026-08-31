import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Footer } from './Footer'
import { Header } from './Header'
import { ChatWidget } from './ChatWidget'
import { SiteAnimation } from './SiteAnimation'
import { startVisitorPresenceTracking } from '../services/sitePresenceService'

export function Layout() {
  const { isAdmin, loading } = useAuth()

  useEffect(() => {
    if (loading || isAdmin) return undefined
    return startVisitorPresenceTracking()
  }, [loading, isAdmin])

  return (
    <div className="site-shell">
      <div className="page-bg-layer" aria-hidden="true">
        <div className="page-bg-section page-bg-stripes" />
      </div>
      <Header />
      <main className="site-main">
        <Outlet />
      </main>
      <Footer />
      <ChatWidget />
      <SiteAnimation />
    </div>
  )
}
