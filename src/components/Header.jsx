import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useCart } from '../contexts/CartContext'
import { useAuth } from '../contexts/AuthContext'
import { LoginModal } from './LoginModal'

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/shop', label: 'Shop' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
]

export function Header() {
  const { itemCount } = useCart()
  const { user, isAdmin, logout } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleLogout = async () => {
    await logout()
    setIsProfileOpen(false)
    setMenuOpen(false)
  }

  const handleMyAccount = () => {
    setIsProfileOpen(false)
    setMenuOpen(false)
  }

  return (
    <>
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />

      <header className={`site-header${scrolled ? ' site-header--scrolled' : ''}`}>
        <Link to="/" className="brand-link" aria-label="806 and Company home">
          <span className="brand-script">806</span>
          <span className="brand-and">&amp;</span>
          <span className="brand-bold">CO.</span>
        </Link>

        <nav className="site-nav" aria-label="Primary">
          {navLinks.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`}
            >
              {label}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`}
            >
              Admin
            </NavLink>
          )}
        </nav>

        <div className="header-actions">
          <NavLink to="/cart" className="header-cart" aria-label={`Cart, ${itemCount} items`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
            {itemCount > 0 && <span className="cart-badge">{itemCount}</span>}
          </NavLink>

          {!user ? (
            <button type="button" className="header-signin" onClick={() => setIsLoginOpen(true)}>Sign In</button>
          ) : (
            <div className="profile-menu">
              <button
                type="button"
                className="profile-btn"
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                title={user.displayName || user.email}
                aria-expanded={isProfileOpen}
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || 'Profile'} className="profile-photo" />
                ) : (
                  <span className="profile-initials">{(user.displayName || user.email)[0].toUpperCase()}</span>
                )}
              </button>
              {isProfileOpen && (
                <div className="profile-dropdown">
                  <div className="profile-info">
                    <p className="profile-name">{user.displayName || 'User'}</p>
                    <p className="profile-email">{user.email}</p>
                  </div>
                  <hr />
                  <Link to="/account" className="dropdown-item" onClick={handleMyAccount}>My Orders</Link>
                  <button type="button" className="dropdown-item" onClick={handleLogout}>Sign Out</button>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          className={`menu-toggle${menuOpen ? ' menu-toggle--open' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          <span /><span /><span />
        </button>
      </header>

      {menuOpen && (
        <div className="mobile-menu">
          {navLinks.map(({ to, label }) => (
            <NavLink key={to} to={to} className="mobile-nav-item" onClick={() => setMenuOpen(false)}>{label}</NavLink>
          ))}
          {isAdmin && (
            <NavLink to="/admin" className="mobile-nav-item" onClick={() => setMenuOpen(false)}>Admin</NavLink>
          )}
          <NavLink to="/cart" className="mobile-nav-item" onClick={() => setMenuOpen(false)}>Cart ({itemCount})</NavLink>
          {!user ? (
            <button type="button" className="mobile-nav-item" onClick={() => { setIsLoginOpen(true); setMenuOpen(false) }}>Sign In</button>
          ) : (
            <>
              <NavLink to="/account" className="mobile-nav-item" onClick={() => setMenuOpen(false)}>My Orders</NavLink>
              <button type="button" className="mobile-nav-item" onClick={handleLogout}>Sign Out</button>
            </>
          )}
        </div>
      )}
    </>
  )
}
