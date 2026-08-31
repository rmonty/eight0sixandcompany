import { useSettings } from '../contexts/SettingsContext'
import { defaultSettings } from '../config/defaults'

const founderPhoto = '/laney.jpg'

export function About() {
  const { settings } = useSettings()
  const a = { ...defaultSettings.about, ...settings.about }

  const multiLine = (text) =>
    text.split('\n').map((line, i, arr) => (
      <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
    ))

  return (
    <div className="about-page">

      {/* ── Hero headline ── */}
      <section className="about-hero">
        <p className="about-hero-eyebrow">{a.heroEyebrow}</p>
        <h1 className="about-hero-title">{multiLine(a.heroTitle)}</h1>
        <div className="about-hero-rule" />
      </section>

      {/* ── Portrait + Story ── */}
      <section className="about-story">
        <div className="about-portrait-wrap">
          <img src={founderPhoto} alt="Laney Whitefield, founder of 806 & CO." className="about-portrait" />
        </div>
        <div className="about-story-text">
          <span className="about-overline">meet the founder</span>
          <h2 className="about-story-heading">{multiLine(a.storyHeading)}</h2>
          {a.storyP1 && <p>{a.storyP1}</p>}
          {a.storyP2 && <p>{a.storyP2}</p>}
          {a.storyP3 && <p>{a.storyP3}</p>}
        </div>
      </section>

      {/* ── Pull quote ── */}
      <section className="about-quote-section">
        <blockquote className="about-quote">{a.pullQuote}</blockquote>
      </section>

      {/* ── What I make ── */}
      <section className="about-craft-section">
        <span className="about-overline" style={{ textAlign: 'center', display: 'block' }}>what I make</span>
        <h2 className="about-craft-heading">{multiLine(a.craftHeading)}</h2>
        <div className="about-craft-grid">
          {(a.craftCards || []).map((card, i) => (
            <div key={i} className="about-craft-card">
              {card.image
                ? <img src={card.image} alt={card.title} className="about-craft-img" />
                : <div className="about-craft-icon">{card.icon || '✦'}</div>
              }
              <h3>{card.title}</h3>
              <p>{card.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="about-cta-section">
        <p className="about-cta-sub">{a.ctaText}</p>
        <a href="#/shop" className="about-cta-btn">Shop the Collection</a>
      </section>

    </div>
  )
}
