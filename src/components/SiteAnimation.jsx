import { useEffect, useState } from 'react'
import { useSettings } from '../contexts/SettingsContext'

const ITEMS = [
  { x: 5,  delay: 0,   speed: 9,   size: 1.9 },
  { x: 14, delay: 2.8, speed: 11.5,size: 1.4 },
  { x: 23, delay: 1.2, speed: 8.5, size: 2.1 },
  { x: 34, delay: 4.5, speed: 10,  size: 1.6 },
  { x: 45, delay: 0.7, speed: 12,  size: 1.3 },
  { x: 56, delay: 3.2, speed: 8,   size: 2.0 },
  { x: 66, delay: 1.9, speed: 11,  size: 1.5 },
  { x: 74, delay: 5.5, speed: 9.5, size: 1.8 },
  { x: 82, delay: 2.3, speed: 10.5,size: 2.2 },
  { x: 91, delay: 3.8, speed: 8.5, size: 1.4 },
  { x: 29, delay: 6.5, speed: 13,  size: 1.7 },
  { x: 60, delay: 4.1, speed: 9,   size: 1.9 },
]

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

function isActiveThisMonth(activeMonth) {
  if (!activeMonth || Number(activeMonth) === 0) return true
  return new Date().getMonth() + 1 === Number(activeMonth)
}

export function SiteAnimation() {
  const { settings } = useSettings()
  const anim = settings.siteAnimation || {}
  const [visible, setVisible] = useState(false)

  const quantity = Math.max(1, Math.min(20, Number(anim.quantity) || 12))
  const speedMult = Math.max(0.25, Math.min(4, Number(anim.speed) || 1))

  // Build the active item list, cycling through the base set for counts > 12
  const activeItems = Array.from({ length: quantity }, (_, i) => {
    const base = ITEMS[i % ITEMS.length]
    return {
      x: i >= ITEMS.length ? (base.x + Math.round((i / ITEMS.length) * 43)) % 94 : base.x,
      delay: base.delay,
      speed: base.speed / speedMult,
      size: base.size,
    }
  })

  useEffect(() => {
    if (!anim.enabled || !isActiveThisMonth(anim.activeMonth)) {
      setVisible(false)
      return
    }
    setVisible(true)
    if (anim.loop === 'once') {
      const localSpeedMult = Math.max(0.25, Math.min(4, Number(anim.speed) || 1))
      const maxMs = Math.max(...ITEMS.slice(0, quantity).map((it) => it.delay + it.speed / localSpeedMult)) * 1000 + 600
      const t = setTimeout(() => setVisible(false), maxMs)
      return () => clearTimeout(t)
    }
    if (anim.loop === 'timed' && Number(anim.duration) > 0) {
      const t = setTimeout(() => setVisible(false), Number(anim.duration) * 1000)
      return () => clearTimeout(t)
    }
  }, [anim.enabled, anim.activeMonth, anim.loop, anim.duration, anim.speed, quantity])

  if (!visible) return null

  const emoji = anim.emoji || '🎈'
  const dir = anim.direction || 'up'
  const iterCount = anim.loop === 'once' ? '1' : 'infinite'
  const animName = dir === 'up' ? 'siteAnimUp' : 'siteAnimDown'

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999, overflow: 'hidden' }}>
      <style>{`
        @keyframes siteAnimUp {
          0%   { transform: translateY(110vh) translateX(0px);  opacity: 0; }
          6%   { opacity: 1; }
          35%  { transform: translateY(65vh)  translateX(22px); }
          55%  { transform: translateY(40vh)  translateX(-16px); }
          78%  { transform: translateY(18vh)  translateX(12px); }
          94%  { opacity: 1; }
          100% { transform: translateY(-18vh) translateX(0px);  opacity: 0; }
        }
        @keyframes siteAnimDown {
          0%   { transform: translateY(-18vh) translateX(0px);  opacity: 0; }
          6%   { opacity: 1; }
          35%  { transform: translateY(35vh)  translateX(22px); }
          55%  { transform: translateY(58vh)  translateX(-16px); }
          78%  { transform: translateY(80vh)  translateX(12px); }
          94%  { opacity: 1; }
          100% { transform: translateY(110vh) translateX(0px);  opacity: 0; }
        }
      `}</style>
      {activeItems.map((item, i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: `${item.x}%`,
            top: 0,
            fontSize: `${item.size}rem`,
            lineHeight: 1,
            animation: `${animName} ${item.speed}s ${item.delay}s ${iterCount} ease-in-out`,
            animationFillMode: 'both',
          }}
        >
          {emoji}
        </span>
      ))}
    </div>
  )
}

export { MONTHS }
