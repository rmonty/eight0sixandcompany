import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const MIN_CROP = 20

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image — the image URL may be invalid or the storage bucket may need CORS configured.'))
    // Append cache-bust so browsers don't reuse a cached response that lacks CORS headers
    const url = new URL(src, window.location.href)
    url.searchParams.set('_cb', Date.now())
    img.src = url.toString()
  })
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

export function ImageEditor({ imageUrl, onSave, onCancel, previewAspectRatio = 1, previewLabel = 'Preview' }) {
  const canvasRef = useRef(null)
  const [img, setImg] = useState(null)
  const [rotation, setRotation] = useState(0)
  const [flipH, setFlipH] = useState(false)
  const [flipV, setFlipV] = useState(false)
  const [crop, setCrop] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [dragCorner, setDragCorner] = useState(null)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [processing, setProcessing] = useState(false)
  const [status, setStatus] = useState('')
  const [previewUrl, setPreviewUrl] = useState(null)

  useEffect(() => {
    loadImage(imageUrl).then(setImg).catch((err) => setStatus(err.message))
  }, [imageUrl])

  const displayWidth = img ? img.width : 0
  const displayHeight = img ? img.height : 0

  const effectiveCrop = useMemo(
    () => crop || {
      x: Math.round(displayWidth * 0.1),
      y: Math.round(displayHeight * 0.1),
      w: Math.round(displayWidth * 0.8),
      h: Math.round(displayHeight * 0.8),
    },
    [crop, displayWidth, displayHeight],
  )

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const scale = Math.min(w / img.width, h / img.height)
    const dw = img.width * scale
    const dh = img.height * scale
    const dx = (w - dw) / 2
    const dy = (h - dh) / 2

    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, w, h)

    ctx.save()
    ctx.translate(dx + dw / 2, dy + dh / 2)
    if (flipH) ctx.scale(-1, 1)
    if (flipV) ctx.scale(1, -1)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh)
    ctx.restore()

    const c = effectiveCrop
    const sx = dx + c.x * scale
    const sy = dy + c.y * scale
    const sw = c.w * scale
    const sh = c.h * scale

    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.fillRect(0, 0, w, sy)
    ctx.fillRect(0, sy + sh, w, h - (sy + sh))
    ctx.fillRect(0, sy, sx, sh)
    ctx.fillRect(sx + sw, sy, w - (sx + sw), sh)

    ctx.strokeStyle = '#9A4A2C'
    ctx.lineWidth = 2
    ctx.setLineDash([6, 3])
    ctx.strokeRect(sx, sy, sw, sh)
    ctx.setLineDash([])

    const handleSize = 10
    const corners = [
      { x: sx, y: sy },
      { x: sx + sw, y: sy },
      { x: sx, y: sy + sh },
      { x: sx + sw, y: sy + sh },
    ]
    corners.forEach((pt) => {
      ctx.fillStyle = '#fff'
      ctx.strokeStyle = '#9A4A2C'
      ctx.lineWidth = 1.5
      ctx.fillRect(pt.x - handleSize / 2, pt.y - handleSize / 2, handleSize, handleSize)
      ctx.strokeRect(pt.x - handleSize / 2, pt.y - handleSize / 2, handleSize, handleSize)
    })
  }, [img, rotation, flipH, flipV, effectiveCrop])

  useEffect(() => {
    draw()
  }, [draw])

  useEffect(() => {
    if (!img) return
    setCrop({
      x: Math.round(img.width * 0.1),
      y: Math.round(img.height * 0.1),
      w: Math.round(img.width * 0.8),
      h: Math.round(img.height * 0.8),
    })
  }, [img])

  const getCanvasPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const scaleX = img ? (Math.min(rect.width / img.width, rect.height / img.height) * img.width) / img.width : 1
    const scaleY = img ? (Math.min(rect.width / img.width, rect.height / img.height) * img.height) / img.height : 1
    const dw = img.width * scaleX
    const dh = img.height * scaleY
    const dx = (rect.width - dw) / 2
    const dy = (rect.height - dh) / 2
    const rawX = (e.clientX - rect.left - dx) / scaleX
    const rawY = (e.clientY - rect.top - dy) / scaleY
    return { x: rawX, y: rawY }
  }

  const handleMouseDown = (e) => {
    if (!img) return
    const pos = getCanvasPos(e)
    const c = effectiveCrop
    const threshold = 14 / (Math.min(canvasRef.current.clientWidth / img.width, canvasRef.current.clientHeight / img.height))
    const corners = [
      { cx: c.x, cy: c.y, id: 'tl' },
      { cx: c.x + c.w, cy: c.y, id: 'tr' },
      { cx: c.x, cy: c.y + c.h, id: 'bl' },
      { cx: c.x + c.w, cy: c.y + c.h, id: 'br' },
    ]
    const corner = corners.find((cr) =>
      Math.abs(pos.x - cr.cx) < threshold && Math.abs(pos.y - cr.cy) < threshold
    )
    if (corner) {
      setDragCorner(corner.id)
      setDragStart(pos)
      setDragging(true)
      return
    }
    if (pos.x >= c.x && pos.x <= c.x + c.w && pos.y >= c.y && pos.y <= c.y + c.h) {
      setDragCorner(null)
      setDragStart({ x: pos.x - c.x, y: pos.y - c.y })
      setDragging(true)
    }
  }

  const handleMouseMove = (e) => {
    if (!dragging || !img) return
    const pos = getCanvasPos(e)
    const c = { ...effectiveCrop }

    if (dragCorner) {
      if (dragCorner === 'tl') {
        const nw = c.x + c.w - pos.x
        const nh = c.y + c.h - pos.y
        if (nw >= MIN_CROP) { c.x = pos.x; c.w = nw }
        if (nh >= MIN_CROP) { c.y = pos.y; c.h = nh }
      } else if (dragCorner === 'tr') {
        const nw = pos.x - c.x
        const nh = c.y + c.h - pos.y
        if (nw >= MIN_CROP) c.w = nw
        if (nh >= MIN_CROP) { c.y = pos.y; c.h = nh }
      } else if (dragCorner === 'bl') {
        const nw = c.x + c.w - pos.x
        const nh = pos.y - c.y
        if (nw >= MIN_CROP) { c.x = pos.x; c.w = nw }
        if (nh >= MIN_CROP) c.h = nh
      } else if (dragCorner === 'br') {
        if (pos.x - c.x >= MIN_CROP) c.w = pos.x - c.x
        if (pos.y - c.y >= MIN_CROP) c.h = pos.y - c.y
      }
    } else {
      c.x = clamp(pos.x - dragStart.x, 0, img.width - c.w)
      c.y = clamp(pos.y - dragStart.y, 0, img.height - c.h)
    }

    c.x = clamp(c.x, 0, img.width - MIN_CROP)
    c.y = clamp(c.y, 0, img.height - MIN_CROP)
    c.w = clamp(c.w, MIN_CROP, img.width - c.x)
    c.h = clamp(c.h, MIN_CROP, img.height - c.y)

    setCrop(c)
  }

  const handleMouseUp = () => {
    setDragging(false)
    setDragCorner(null)
  }

  const applyTransformAndCrop = useCallback(() => {
    if (!img) return null
    const c = effectiveCrop

    const cropped = document.createElement('canvas')
    cropped.width = c.w
    cropped.height = c.h
    const cropCtx = cropped.getContext('2d')
    cropCtx.drawImage(img, c.x, c.y, c.w, c.h, 0, 0, c.w, c.h)

    const rad = (rotation * Math.PI) / 180
    const absCos = Math.abs(Math.cos(rad))
    const absSin = Math.abs(Math.sin(rad))
    const outW = Math.round(c.w * absCos + c.h * absSin)
    const outH = Math.round(c.w * absSin + c.h * absCos)

    const out = document.createElement('canvas')
    out.width = outW
    out.height = outH
    const outCtx = out.getContext('2d')

    outCtx.translate(outW / 2, outH / 2)
    if (flipH) outCtx.scale(-1, 1)
    if (flipV) outCtx.scale(1, -1)
    outCtx.rotate(rad)
    outCtx.drawImage(cropped, -c.w / 2, -c.h / 2)
    outCtx.setTransform(1, 0, 0, 1, 0, 0)

    return out
  }, [img, effectiveCrop, rotation, flipH, flipV])

  useEffect(() => {
    const result = applyTransformAndCrop()
    if (result) {
      try {
        setPreviewUrl(result.toDataURL('image/jpeg', 0.9))
      } catch {
        setStatus('Preview unavailable — image host may block canvas access')
        setPreviewUrl(null)
      }
    }
  }, [applyTransformAndCrop])

  const canvasToBlob = (canvas) => {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Failed to create blob'))
      }, 'image/jpeg', 0.9)
    })
  }

  const handleApply = async () => {
    const result = applyTransformAndCrop()
    if (!result) return
    setProcessing(true)
    setStatus('Processing image…')

    try {
      const blob = await canvasToBlob(result)
      onSave(blob)
    } catch (err) {
      setStatus(`Error: ${err.message}`)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#fffcf9', borderRadius: 12, padding: 20, maxWidth: 700, width: '95%',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column', gap: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: '#421428', fontSize: '1.1rem' }}>Edit Image</h3>
          <button type="button" onClick={onCancel} style={{
            background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer',
            color: '#421428', padding: '0 4px',
          }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <canvas
              ref={canvasRef}
              style={{ width: '100%', height: 350, borderRadius: 8, cursor: dragging ? 'grabbing' : 'grab', border: '1px solid rgba(168,57,91,0.2)' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
            <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#5a3040', textAlign: 'center' }}>
              Drag corners to resize crop · Drag inside to move
            </p>
          </div>

          <div style={{ flex: 0.5, minWidth: 160, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: '0.8rem', fontWeight: 600, color: '#421428' }}>Rotate</p>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={() => setRotation((prev) => (prev - 90) % 360)} style={btnStyle}>
                  ↺ 90° Left
                </button>
                <button type="button" onClick={() => setRotation((prev) => (prev + 90) % 360)} style={btnStyle}>
                  90° Right ↻
                </button>
              </div>
            </div>

            <div>
              <p style={{ margin: '0 0 4px', fontSize: '0.8rem', fontWeight: 600, color: '#421428' }}>Flip</p>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => setFlipH((prev) => !prev)}
                  style={{ ...btnStyle, background: flipH ? '#9A4A2C' : undefined, color: flipH ? '#fff' : undefined }}
                >
                  ↔ Horizontal
                </button>
                <button
                  type="button"
                  onClick={() => setFlipV((prev) => !prev)}
                  style={{ ...btnStyle, background: flipV ? '#9A4A2C' : undefined, color: flipV ? '#fff' : undefined }}
                >
                  ↕ Vertical
                </button>
              </div>
            </div>

            <div>
              <p style={{ margin: '0 0 4px', fontSize: '0.8rem', fontWeight: 600, color: '#421428' }}>{previewLabel}</p>
              <div style={{
                width: '100%', aspectRatio: String(previewAspectRatio), borderRadius: 6, overflow: 'hidden',
                border: '1px solid rgba(168,57,91,0.2)', background: '#f0f0f0',
              }}>
                {previewUrl && (
                  <img src={previewUrl} alt="Cropped preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
              </div>
            </div>
          </div>
        </div>

        {status && (
          <p style={{ margin: 0, fontSize: '0.85rem', color: processing ? '#C4A574' : '#9A4A2C', textAlign: 'center' }}>
            {status}
          </p>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCancel} className="ghost-btn">Cancel</button>
          <button type="button" onClick={handleApply} className="primary-btn" disabled={processing || !img}>
            {processing ? 'Processing…' : 'Apply & Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

const btnStyle = {
  padding: '6px 10px',
  fontSize: '0.78rem',
  borderRadius: 6,
  border: '1px solid rgba(168,57,91,0.25)',
  background: '#fff',
  color: '#421428',
  cursor: 'pointer',
  fontWeight: 500,
}
