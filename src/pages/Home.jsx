import { useEffect, useRef, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ProductCard } from '../components/ProductCard'
import { getProducts } from '../services/productsService'
import { getGalleryItems } from '../services/galleryService'
import { useSettings } from '../contexts/SettingsContext'

export function Home() {
  const [featured, setFeatured] = useState([])
  const [pastCreations, setPastCreations] = useState([])
  const [activeGalleryImages, setActiveGalleryImages] = useState({})
  const swipeStartX = useRef({})
  const { settings } = useSettings()
  const heroImages = useMemo(() => {
    if (Array.isArray(settings.homeHeroPhotoUrls)) {
      const valid = settings.homeHeroPhotoUrls.filter(Boolean)
      if (valid.length > 0) return valid
    }
    const single = settings.homeHeroPhotoUrl?.trim()
    return single ? [single] : ['/laney.jpg']
  }, [settings.homeHeroPhotoUrls, settings.homeHeroPhotoUrl])

  const slideshowMs = Math.max(2, Number(settings.heroSlideshowInterval || 5)) * 1000
  const [heroIdx, setHeroIdx] = useState(0)
  const instagramUrl = settings.instagramUrl?.trim() || ''
  const instagramPermalink = instagramUrl
    ? `${instagramUrl}${instagramUrl.includes('?') ? '&' : '?'}utm_source=ig_embed&utm_campaign=loading`
    : ''
  const facebookPageUrl = settings.facebookUrl?.trim() || ''
  const facebookEmbedUrl = settings.facebookEmbedUrl?.trim() || ''

  useEffect(() => {
    if (heroImages.length <= 1) return
    const timer = setInterval(() => setHeroIdx((i) => (i + 1) % heroImages.length), slideshowMs)
    return () => clearInterval(timer)
  }, [heroImages.length, slideshowMs])

  useEffect(() => {
    getProducts().then((items) => {
      setFeatured(items.filter((item) => item.featured).slice(0, 3))
    })
    getGalleryItems().then((items) => {
      setPastCreations(items.slice(0, 3))
    })
  }, [])

  useEffect(() => {
    const processEmbed = () => {
      if (window?.instgrm?.Embeds?.process) {
        window.instgrm.Embeds.process()
      }
    }

    const existing = document.getElementById('instagram-embed-script')
    if (existing) {
      processEmbed()
      return
    }

    const script = document.createElement('script')
    script.id = 'instagram-embed-script'
    script.async = true
    script.src = 'https://www.instagram.com/embed.js'
    script.onload = processEmbed
    document.body.appendChild(script)
  }, [instagramPermalink])

  const getGalleryImages = (item) => {
    if (Array.isArray(item.images) && item.images.length > 0) {
      return item.images
    }
    return item.image ? [item.image] : []
  }

  const shiftGalleryImage = (itemId, total, direction) => {
    if (total <= 1) return
    setActiveGalleryImages((prev) => {
      const current = prev[itemId] || 0
      const next = (current + direction + total) % total
      return {
        ...prev,
        [itemId]: next,
      }
    })
  }

  const handleSwipeStart = (itemId, touchX) => {
    swipeStartX.current[itemId] = touchX
  }

  const handleSwipeEnd = (itemId, total, touchX) => {
    const startX = swipeStartX.current[itemId]
    if (typeof startX !== 'number' || total <= 1) return

    const delta = touchX - startX
    if (Math.abs(delta) >= 40) {
      shiftGalleryImage(itemId, total, delta < 0 ? 1 : -1)
    }

    delete swipeStartX.current[itemId]
  }



  return (
    <div className="home-page">

      {/* Full-bleed hero */}
      <section className="home-hero">
        <div className="home-hero-photo" style={heroImages.length > 1 ? { position: 'relative', overflow: 'hidden' } : undefined}>
          {heroImages.map((url, i) => (
            <img
              key={url}
              src={url}
              alt="Laney Whitefield, founder of 806 &amp; CO."
              style={heroImages.length > 1 ? {
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                opacity: i === heroIdx ? 1 : 0,
                transition: 'opacity 1.2s ease-in-out',
              } : undefined}
            />
          ))}
        </div>
      </section>

      {/* Marquee strip */}
      <div className="home-marquee" aria-hidden="true">
        <div className="home-marquee-track">
          {Array.from({ length: 8 }).map((_, i) => (
            <span>{settings.marqueeText || 'SPRAY TANS · BIRTHDAY SIGNS · CUSTOM GLOW · AMARILLO ·'} </span>
          ))}
        </div>
      </div>

      {/* What we offer */}
      <section className="home-intro">
        <div className="home-intro-inner">
          <div className="home-intro-left">
            <span className="home-overline">what we offer</span>
            <h2 className="home-intro-heading">Glow, create,<br />and celebrate.</h2>
            <p>Custom spray tans tailored to your skin tone, birthday signs made for the moment, and creative extras that help you look and feel your best. Serving the Amarillo area since 2022.</p>
            <Link to="/about" className="home-text-link">Meet Laney &rarr;</Link>
          </div>
          <div className="home-intro-cards">
            <div className="home-craft-item">
              <span className="home-craft-num">01</span>
              <h3>Spray Tans</h3>
              <p>Custom airbrush tans — including weddings, groups, and mobile.</p>
            </div>
            <div className="home-craft-item">
              <span className="home-craft-num">02</span>
              <h3>Birthday Signs</h3>
              <p>Bold, personalized signs ready for photos and parties.</p>
            </div>
            <div className="home-craft-item">
              <span className="home-craft-num">03</span>
              <h3>Kirby &amp; More</h3>
              <p>Creative extras and custom self-tanners for glow on the go.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured products */}
      {featured.length > 0 && (
        <section className="home-featured">
          <div className="home-featured-inner">
            <div className="home-featured-header">
              <span className="home-overline">featured</span>
              <h2 className="home-section-heading">Current Favorites</h2>
            </div>
            <div className="product-grid">
              {featured.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            <div className="home-featured-footer">
              <Link to="/shop" className="home-hero-btn">View All Products</Link>
            </div>
          </div>
        </section>
      )}

      {pastCreations.length > 0 && (
        <section className="home-past-creations">
          <div className="home-featured-inner">
            <div className="home-featured-header">
              <span className="home-overline">gallery of ends</span>
              <h2 className="home-section-heading">Past Creations</h2>
              <p className="home-gallery-sub">Advanced cakes, 3D nails, and one-of-a-kind custom work to inspire your next order.</p>
            </div>
            <div className="gallery-grid">
              {pastCreations.map((item) => {
                const images = getGalleryImages(item)
                const totalImages = images.length
                const activeIndex = Math.min(activeGalleryImages[item.id] || 0, Math.max(totalImages - 1, 0))
                const activeImage = images[activeIndex]

                return (
                  <article key={item.id} className="gallery-card">
                    {activeImage && (
                      <div
                        className="gallery-media-wrap"
                        onTouchStart={(event) => handleSwipeStart(item.id, event.changedTouches[0].clientX)}
                        onTouchEnd={(event) => handleSwipeEnd(item.id, totalImages, event.changedTouches[0].clientX)}
                      >
                        <img src={activeImage} alt={item.title} className="gallery-image" loading="lazy" />
                        {totalImages > 1 && (
                          <>
                            <button
                              type="button"
                              className="gallery-nav-btn gallery-nav-btn--left"
                              onClick={() => shiftGalleryImage(item.id, totalImages, -1)}
                              aria-label={`Previous image for ${item.title}`}
                            >
                              &#x2039;
                            </button>
                            <button
                              type="button"
                              className="gallery-nav-btn gallery-nav-btn--right"
                              onClick={() => shiftGalleryImage(item.id, totalImages, 1)}
                              aria-label={`Next image for ${item.title}`}
                            >
                              &#x203A;
                            </button>
                          </>
                        )}
                      </div>
                    )}
                    <div className="gallery-copy">
                      <p className="gallery-type">{item.type || 'Custom Creation'}</p>
                      <h3>{item.title}</h3>
                      {item.description && <p>{item.description}</p>}
                    </div>
                  </article>
                )
              })}
            </div>
            <div className="home-featured-footer">
              <Link to="/gallery" className="home-hero-btn">View Full Gallery</Link>
            </div>
          </div>
        </section>
      )}

      {(instagramUrl || facebookPageUrl) && (
      <section className="home-social-proof">
        <div className="home-social-proof-inner">
          <div className="home-featured-header">
            <span className="home-overline">follow along</span>
            <h2 className="home-section-heading">Follow 806 &amp; CO. on Instagram and Facebook</h2>
          </div>
          <div className="home-social-embeds">
            {instagramUrl && (
            <div className="home-social-embed-card">
              <div className="home-social-embed-head">
                <p className="home-social-widget-handle">Instagram</p>
                <a href={instagramUrl} target="_blank" rel="noreferrer" className="home-social-mini-link">Open</a>
              </div>
              <div className="home-instagram-embed-wrap">
                <blockquote className="instagram-media" data-instgrm-permalink={instagramPermalink} data-instgrm-version="14">
                  <a href={instagramPermalink} target="_blank" rel="noreferrer">View this profile on Instagram</a>
                </blockquote>
              </div>
            </div>
            )}

            {facebookPageUrl && (
            <div className="home-social-embed-card">
              <div className="home-social-embed-head">
                <p className="home-social-widget-handle">Facebook</p>
                <a href={facebookPageUrl} target="_blank" rel="noreferrer" className="home-social-mini-link">Open</a>
              </div>
              {facebookEmbedUrl ? (
                <div className="home-facebook-embed-wrap">
                  <iframe
                    src={`https://www.facebook.com/plugins/page.php?href=${encodeURIComponent(facebookEmbedUrl)}&tabs=timeline&width=340&height=500&small_header=true&adapt_container_width=true&hide_cover=false&show_facepile=true`}
                    width="340"
                    height="500"
                    style={{ border: 'none', overflow: 'hidden', width: '100%', maxWidth: 500 }}
                    scrolling="no"
                    frameBorder="0"
                    allowFullScreen={true}
                    allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                    title="806 & CO. on Facebook"
                  />
                </div>
              ) : (
                <a href={facebookPageUrl} target="_blank" rel="noreferrer" className="home-facebook-follow-card">
                  <div className="home-facebook-follow-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </div>
                  <div className="home-facebook-follow-body">
                    <p className="home-facebook-follow-name">806 &amp; CO.</p>
                    <p className="home-facebook-follow-cta">Follow us on Facebook</p>
                  </div>
                  <span className="home-facebook-follow-btn">Follow</span>
                </a>
              )}
            </div>
            )}
          </div>
        </div>
      </section>
      )}

      {/* CTA band */}
      <section className="home-cta-band">
        <p className="home-cta-band-eyebrow">flawless glow · friendly service</p>
        <h2 className="home-cta-band-heading">Ready for your custom glow?</h2>
        <Link to="/shop" className="home-cta-band-btn">Shop Services</Link>
      </section>

    </div>
  )
}
