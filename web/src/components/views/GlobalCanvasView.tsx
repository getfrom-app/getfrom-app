// Lienzo infinito GLOBAL — Fase 1 (experimental).
//
// Un ÚNICO plano donde se pintan los nodos que tienen posición global
// (`_gx/_gy/_gscale`, ver utils/globalCanvas). Cámara con pan + zoom infinito y
// vuelo animado al hacer clic en una tarjeta. NO toca la lista ni la columna
// derecha ni la jerarquía: solo lee/escribe la posición en extraData.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import { firstLineTitle } from '../../utils/docNode'
import { contextColor, listContextsForParent } from '../../utils/cajones'
import { placedNodes, readGlobal, writeGlobal, clearGlobal } from '../../utils/globalCanvas'

interface Cam { x: number; y: number; scale: number }
const MIN_SCALE = 0.04
const MAX_SCALE = 50
const CARD_W = 260
const CARD_H = 128
const GRID = 420 // separación al auto-colocar áreas

function nodeTitle(text: string | null | undefined): string {
  const t = firstLineTitle(text || '')
  return t && t.trim() ? t.trim() : '—'
}

export default function GlobalCanvasView() {
  const s = useStore()
  const navigate = useNavigate()
  const { t } = useTranslation()
  void s.nodesVersion // reactivo a cambios del árbol

  const wrapRef = useRef<HTMLDivElement | null>(null)
  const viewportRef = useRef<{ w: number; h: number }>({ w: 1200, h: 800 })
  const [cam, setCam] = useState<Cam>({ x: 600, y: 400, scale: 1 })
  const camRef = useRef(cam); camRef.current = cam
  const panRef = useRef<{ sx: number; sy: number; cx: number; cy: number; moved: boolean } | null>(null)
  const dragRef = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null)
  const [dragPos, setDragPos] = useState<{ id: string; x: number; y: number } | null>(null)
  const flyRef = useRef<number | null>(null)

  const placed = useMemo(() => placedNodes(), [s.nodesVersion])

  // Medir viewport
  useEffect(() => {
    const measure = () => {
      const r = wrapRef.current?.getBoundingClientRect()
      if (r) viewportRef.current = { w: r.width, h: r.height }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // Vuelo animado de cámara (portado de PizarraView.flyTo)
  const flyTo = useCallback((wx: number, wy: number, targetScale?: number) => {
    if (flyRef.current) cancelAnimationFrame(flyRef.current)
    const start = { ...camRef.current }
    const { w, h } = viewportRef.current
    const s2 = Math.min(MAX_SCALE, Math.max(MIN_SCALE, targetScale || start.scale))
    const end = { scale: s2, x: w / 2 - wx * s2, y: h / 2 - wy * s2 }
    const dur = 480
    let t0 = -1
    const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2)
    const step = (now: number) => {
      if (t0 < 0) t0 = now
      const k = Math.min(1, (now - t0) / dur), e = ease(k)
      setCam({
        x: start.x + (end.x - start.x) * e,
        y: start.y + (end.y - start.y) * e,
        scale: start.scale + (end.scale - start.scale) * e,
      })
      if (k < 1) flyRef.current = requestAnimationFrame(step)
    }
    flyRef.current = requestAnimationFrame(step)
  }, [])

  const fitAll = useCallback(() => {
    const items = placedNodes()
    if (!items.length) return
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const n of items) {
      const g = readGlobal(n)!
      minX = Math.min(minX, g.x); minY = Math.min(minY, g.y)
      maxX = Math.max(maxX, g.x + CARD_W * g.scale); maxY = Math.max(maxY, g.y + CARD_H * g.scale)
    }
    const { w, h } = viewportRef.current
    const bw = Math.max(1, maxX - minX), bh = Math.max(1, maxY - minY)
    const sc = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min((w - 120) / bw, (h - 120) / bh, 1.2)))
    flyTo(minX + bw / 2, minY + bh / 2, sc)
  }, [flyTo])

  // Encuadrar todo al entrar (si hay algo)
  const didFit = useRef(false)
  useEffect(() => {
    if (didFit.current) return
    if (placed.length) { didFit.current = true; setTimeout(fitAll, 60) }
  }, [placed.length, fitAll])

  // Zoom con rueda anclado al cursor (listener nativo no-pasivo)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top
      setCam(prev => {
        const factor = Math.exp(-e.deltaY * 0.0015)
        const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale * factor))
        const wx = (sx - prev.x) / prev.scale, wy = (sy - prev.y) / prev.scale
        return { x: sx - wx * next, y: sy - wy * next, scale: next }
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const zoomAtCenter = useCallback((factor: number) => {
    setCam(c => {
      const ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, c.scale * factor))
      const { w, h } = viewportRef.current
      const cx = w / 2, cy = h / 2
      const wx = (cx - c.x) / c.scale, wy = (cy - c.y) / c.scale
      return { x: cx - wx * ns, y: cy - wy * ns, scale: ns }
    })
  }, [])

  // Pan del fondo
  const onBgPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    panRef.current = { sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y, moved: false }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }
  const onBgPointerMove = (e: React.PointerEvent) => {
    // arrastre de tarjeta
    if (dragRef.current) {
      const d = dragRef.current
      const dx = (e.clientX - d.sx) / camRef.current.scale
      const dy = (e.clientY - d.sy) / camRef.current.scale
      if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 3) d.moved = true
      setDragPos({ id: d.id, x: d.ox + dx, y: d.oy + dy })
      return
    }
    const p = panRef.current
    if (!p) return
    if (Math.abs(e.clientX - p.sx) + Math.abs(e.clientY - p.sy) > 3) p.moved = true
    setCam(prev => ({ ...prev, x: p.cx + (e.clientX - p.sx), y: p.cy + (e.clientY - p.sy) }))
  }
  const onBgPointerUp = () => {
    if (dragRef.current) {
      const d = dragRef.current
      if (dragPos && d.moved) writeGlobal(d.id, { x: dragPos.x, y: dragPos.y })
      dragRef.current = null
      setDragPos(null)
    }
    panRef.current = null
  }

  const onCardPointerDown = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const g = readGlobal(store.getNode(id))
    if (!g) return
    dragRef.current = { id, sx: e.clientX, sy: e.clientY, ox: g.x, oy: g.y, moved: false }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }
  const onCardClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (dragRef.current?.moved) return // fue arrastre, no clic
    const g = readGlobal(store.getNode(id))
    if (!g) return
    flyTo(g.x + (CARD_W * g.scale) / 2, g.y + (CARD_H * g.scale) / 2, Math.max(g.scale, 0.9))
  }

  // Demo Fase 1: colocar las áreas/contextos en el plano (reversible)
  const placeAreas = useCallback(() => {
    const ctx = listContextsForParent()
    if (!ctx.length) return
    const per = Math.max(1, Math.ceil(Math.sqrt(ctx.length)))
    ctx.forEach((n, i) => {
      const col = i % per, row = Math.floor(i / per)
      writeGlobal(n.id, { x: col * GRID, y: row * GRID }, 1)
    })
    setTimeout(fitAll, 80)
  }, [fitAll])

  const world = placed

  return (
    <div className="view" style={{ position: 'relative', height: '100%', minHeight: '70vh', overflow: 'hidden' }}>
      <div
        ref={wrapRef}
        onPointerDown={onBgPointerDown}
        onPointerMove={onBgPointerMove}
        onPointerUp={onBgPointerUp}
        style={{
          position: 'absolute', inset: 0, overflow: 'hidden', cursor: 'grab',
          background: 'var(--bg-primary)',
          backgroundImage: 'radial-gradient(var(--border-color) 1px, transparent 1px)',
          backgroundSize: `${24 * cam.scale}px ${24 * cam.scale}px`,
          backgroundPosition: `${cam.x}px ${cam.y}px`,
          touchAction: 'none',
        }}
      >
        {/* Mundo */}
        <div style={{ position: 'absolute', left: 0, top: 0, transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.scale})`, transformOrigin: '0 0' }}>
          {world.map(n => {
            const g = readGlobal(n)!
            const pos = (dragPos && dragPos.id === n.id) ? dragPos : g
            const color = contextColor(n.id)
            return (
              <div
                key={n.id}
                onPointerDown={e => onCardPointerDown(e, n.id)}
                onClick={e => onCardClick(e, n.id)}
                style={{
                  position: 'absolute', left: pos.x, top: pos.y,
                  width: CARD_W, minHeight: CARD_H, transform: `scale(${g.scale})`, transformOrigin: '0 0',
                  background: 'var(--bg-secondary)', border: `1px solid var(--border-color)`,
                  borderLeft: `4px solid ${color}`, borderRadius: 12, padding: '14px 16px',
                  boxSizing: 'border-box', cursor: 'pointer', userSelect: 'none',
                }}
                title={nodeTitle(n.text)}
              >
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6, lineHeight: 1.3 }}>
                  {nodeTitle(n.text)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {s.children(n.id).filter(c => !c.deletedAt).length} · {t('globalCanvas.related', 'nodos')}
                </div>
                <button
                  onClick={e => { e.stopPropagation(); clearGlobal(n.id) }}
                  onPointerDown={e => e.stopPropagation()}
                  title={t('globalCanvas.removeFromCanvas', 'Quitar del lienzo')}
                  style={{ position: 'absolute', top: 6, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 16, lineHeight: 1 }}
                >×</button>
              </div>
            )
          })}
        </div>

        {/* Estado vacío */}
        {placed.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ pointerEvents: 'auto', textAlign: 'center', maxWidth: 420, padding: 24, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>
                {t('globalCanvas.emptyTitle', 'El lienzo infinito')}
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 18 }}>
                {t('globalCanvas.emptyHint', 'Un único plano para todo. Coloca tus áreas y muévete entre ellas con la cámara. Es reversible: quitar del lienzo no borra nada.')}
              </div>
              <button className="btn-primary" onClick={placeAreas}>
                {t('globalCanvas.placeAreas', 'Colocar mis áreas en el lienzo')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Barra flotante */}
      <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', gap: 8, zIndex: 5 }}>
        <button className="gc-btn" onClick={() => navigate('/')} title={t('common.back', 'Atrás')}
          style={gcBtn}>←</button>
        <button className="gc-btn" onClick={() => zoomAtCenter(1 / 1.25)} style={gcBtn} title="−">−</button>
        <button className="gc-btn" onClick={() => zoomAtCenter(1.25)} style={gcBtn} title="+">+</button>
        <button className="gc-btn" onClick={fitAll} style={{ ...gcBtn, width: 'auto', padding: '0 12px' }} title={t('globalCanvas.fitAll', 'Reencuadrar')}>
          {t('globalCanvas.fitAll', 'Reencuadrar')}
        </button>
        <button className="gc-btn" onClick={() => window.dispatchEvent(new CustomEvent('from:open-day-agg'))} style={{ ...gcBtn, width: 'auto', padding: '0 12px' }} title={t('globalCanvas.openDay', 'Día')}>
          {t('globalCanvas.openDay', 'Día')}
        </button>
        <span style={{ alignSelf: 'center', fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 4 }}>
          {Math.round(cam.scale * 100)}%
        </span>
      </div>
    </div>
  )
}

const gcBtn: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-color)',
  background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer',
  fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center',
}
