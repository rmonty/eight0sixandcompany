import { useEffect, useRef, useState } from 'react'
import { getGalleryItems } from '../services/galleryService'

export function Gallery() {
  const [items, setItems] = useState([])
  const [activeImages, setActiveImages] = useState({})
  const swipeStartX = useRef({})

  useEffect(() => {
    getGalleryItems().then(setItems)
  }, [])

  const getImages = (item) => {
    if (Array.isArray(item.images) && item.images.length > 0) {
      return item.images
    }
    return item.image ? [item.image] : []
  }

  const shiftImage = (itemId, total, direction) => {
    if (total <= 1) return
    setActiveImages((prev) => {
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
      shiftImage(itemId, total, delta < 0 ? 1 : -1)
    }

    delete swipeStartX.current[itemId]
  }

  return (
    <section className="page-inner gallery-page">
      <div className="gallery-header">
        <p className="home-overline">gallery of ends</p>
        <h1>Past Creations</h1>
        <p>
          A lookbook of one-of-a-kind work: advanced cakes, 3D nails, and custom pieces made for real clients.
          Use this for inspiration when placing your own custom order.
        </p>
      </div>

      <div className="gallery-grid">
        {items.map((item) => {
          const images = getImages(item)
          const totalImages = images.length
          const activeIndex = Math.min(activeImages[item.id] || 0, Math.max(totalImages - 1, 0))
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
                        onClick={() => shiftImage(item.id, totalImages, -1)}
                        aria-label={`Previous image for ${item.title}`}
                      >
                        &#x2039;
                      </button>
                      <button
                        type="button"
                        className="gallery-nav-btn gallery-nav-btn--right"
                        onClick={() => shiftImage(item.id, totalImages, 1)}
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
    </section>
  )
}
