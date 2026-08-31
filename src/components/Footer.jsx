import { Link } from 'react-router-dom'
import { useSettings } from '../contexts/SettingsContext'

export function Footer() {
  const { settings } = useSettings()

  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <Link to="/" className="brand-link footer-brand-link">
            <span className="brand-script">806</span>
            <span className="brand-and">&amp;</span>
            <span className="brand-bold">CO.</span>
          </Link>
          <p className="footer-tagline">Your one stop shop for all things creative.</p>
        </div>

        <nav className="footer-nav" aria-label="Footer navigation">
          <h4>Explore</h4>
          <Link to="/shop">Shop</Link>
          <Link to="/about">About</Link>
          <Link to="/contact">Contact</Link>
        </nav>

        <nav className="footer-nav" aria-label="Legal">
          <h4>Legal</h4>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/refunds">Refunds</Link>
          <Link to="/shipping">Shipping</Link>
        </nav>

        <div className="footer-contact">
          <h4>Get in Touch</h4>
          {settings.contactEmail && (
            <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a>
          )}
          {settings.instagramUrl && (
            <a href={settings.instagramUrl} target="_blank" rel="noreferrer">Instagram</a>
          )}
        </div>
      </div>

      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} 806 &amp; CO. All rights reserved.</p>
      </div>
    </footer>
  )
}
