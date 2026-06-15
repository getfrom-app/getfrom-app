// TemporalCanvasView — calendario como LIENZO INFINITO con LOD (Fase 1).
// Idea (paridad iPad): una rejilla continua de semanas (lunes→domingo apiladas).
// Al hacer zoom se ven días; al alejar, los días encogen y aparecen las etiquetas
// de MES y, más lejos, de AÑO. Clic en un día → entra a esa nota diaria (que abre
// como pizarra). «Ir a hoy» recentra.
//
// Es la base navegable; la unificación con el contenido del día (zoom-in dentro de
// un día) es Fase 2/3.

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import { ensureDayPath } from '../../utils/agendaHelper'
import { diaryId } from '../../utils/deterministicId'

// Lunes de referencia (epoch) para mapear fecha ↔ rejilla. 6-ene-2020 fue lunes.
const EPOCH = new Date(2020, 0, 6).getTime()
const DAY_MS = 86400000
const CELL = 120 // px de mundo por celda de día
const MIN_SCALE = 0.02
const MAX_SCALE = 4

interface Cam { x: number; y: number; scale: number }

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function midnight(d: Date): Date { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
function dayIndexOf(d: Date): number { return Math.round((midnight(d).getTime() - EPOCH) / DAY_MS) }
function dateFromColRow(col: number, row: number): Date { return new Date(EPOCH + (row * 7 + col) * DAY_MS) }

export default function TemporalCanvasView() {
  useStore()
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState({ w: 1000, h: 700 })
  // Cámara inicial: hoy centrado, zoom cómodo de días.
  const [cam, setCam] = useState<Cam>(() => {
    const di = dayIndexOf(new Date())
    const col = ((di % 7) + 7) % 7, row = Math.floor(di / 7)
    const s = 0.9
    return { x: -(col * CELL) * s + 500 - CELL * s / 2, y: -(row * CELL) * s + 350, scale: s }
  })
  const panRef = useRef<{ sx: number; sy: number; cx: number; cy: number; moved: boolean } | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => setViewport({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure); ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Zoom con rueda anclado al cursor (listener nativo, no scrollea la página).
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top
      setCam(prev => {
        const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale * Math.exp(-e.deltaY * 0.0015)))
        const wx = (sx - prev.x) / prev.scale, wy = (sy - prev.y) / prev.scale
        return { x: sx - wx * next, y: sy - wy * next, scale: next }
      })
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  const goToday = useCallback(() => {
    const di = dayIndexOf(new Date())
    const col = ((di % 7) + 7) % 7, row = Math.floor(di / 7)
    setViewport(v => { setCam({ x: -(col * CELL) * 0.9 + v.w / 2 - CELL * 0.45, y: -(row * CELL) * 0.9 + v.h / 2, scale: 0.9 }); return v })
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    containerRef.current!.setPointerCapture(e.pointerId)
    panRef.current = { sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y, moved: false }
  }, [cam])
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const p = panRef.current; if (!p) return
    const dx = e.clientX - p.sx, dy = e.clientY - p.sy
    if (Math.abs(dx) + Math.abs(dy) > 3) p.moved = true
    setCam(prev => ({ ...prev, x: p.cx + dx, y: p.cy + dy }))
  }, [])
  const onPointerUp = useCallback((e: React.PointerEvent, day?: Date) => {
    const p = panRef.current
    try { containerRef.current?.releasePointerCapture(e.pointerId) } catch { /* noop */ }
    panRef.current = null
    if (day && p && !p.moved) {
      const node = ensureDayPath(day)
      navigate(`/node/${node.id}`)
    }
  }, [navigate])

  const cellScreen = CELL * cam.scale
  const showDayNumbers = cellScreen >= 26
  const showMonthLabels = cellScreen < 70
  // Al acercar bastante, mostrar un PEEK del contenido del día (nodos) dentro de
  // la celda — el "contenido infinito dentro de los días" empieza a verse aquí.
  const showContent = cellScreen >= 150

  // Devuelve los hijos (no borrados) de la nota diaria de esa fecha, SIN crearla.
  const dayChildren = (date: Date): { id: string; text: string }[] => {
    const id = diaryId(date)
    if (!id) return []
    const d = store.getNode(id)
    if (!d || d.deletedAt) return []
    return store.children(d.id).filter(c => !c.deletedAt).map(c => ({ id: c.id, text: c.text || '' }))
  }

  // Rango de columnas/filas visibles (culling).
  const cells = useMemo(() => {
    const out: { col: number; row: number; date: Date }[] = []
    const x0 = -cam.x / cam.scale, y0 = -cam.y / cam.scale
    const colA = Math.max(0, Math.floor(x0 / CELL)), colB = Math.min(6, Math.ceil((x0 + viewport.w / cam.scale) / CELL))
    const rowA = Math.floor(y0 / CELL) - 1, rowB = Math.ceil((y0 + viewport.h / cam.scale) / CELL) + 1
    // Limitar para no explotar a zoom muy bajo.
    if ((rowB - rowA) * 7 > 4000) return out
    for (let row = rowA; row <= rowB; row++) {
      for (let col = colA; col <= colB; col++) {
        out.push({ col, row, date: dateFromColRow(col, row) })
      }
    }
    return out
  }, [cam, viewport])

  // Etiquetas de mes: una por cada mes cuyo día 1 cae en el rango visible.
  const monthLabels = useMemo(() => {
    if (!showMonthLabels) return []
    const out: { x: number; y: number; label: string; year: number }[] = []
    const seen = new Set<string>()
    for (const c of cells) {
      if (c.date.getDate() !== 1) continue
      const key = `${c.date.getFullYear()}-${c.date.getMonth()}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ x: c.col * CELL, y: c.row * CELL, label: MONTHS[c.date.getMonth()], year: c.date.getFullYear() })
    }
    return out
  }, [cells, showMonthLabels])

  const today = midnight(new Date()).getTime()

  // Días con contenido (una sola pasada sobre el store, no por celda → evita
  // hashear SHA-256 por celda en cada frame de pan). Clave: "YYYY-M-D".
  const daysWithContent = useMemo(() => {
    const counts = new Map<string, number>()
    for (const n of store.nodes.values()) {
      if (!n.parentId || n.deletedAt) continue
      const p = store.getNode(n.parentId)
      if (!p || !p.isDiaryEntry || !p.diaryDate) continue
      const d = new Date(p.diaryDate)
      counts.set(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`, 1)
    }
    return counts
  }, [store.nodes.size]) // eslint-disable-line react-hooks/exhaustive-deps
  const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => onPointerUp(e)}
      onPointerCancel={(e) => onPointerUp(e)}
      style={{
        position: 'relative', width: '100%', height: 'calc(100vh - 160px)', minHeight: 480,
        overflow: 'hidden', background: 'var(--bg, #fff)', borderRadius: 8,
        cursor: panRef.current ? 'grabbing' : 'default', touchAction: 'none', userSelect: 'none',
      }}
    >
      {/* Celdas de día */}
      {cells.map(({ col, row, date }) => {
        const sx = cam.x + col * CELL * cam.scale
        const sy = cam.y + row * CELL * cam.scale
        const size = cellScreen
        const isToday = midnight(date).getTime() === today
        const isWeekend = col >= 5
        const dim = date.getMonth() % 2 === 1
        return (
          <div
            key={`${col},${row}`}
            onPointerUp={(e) => { e.stopPropagation(); onPointerUp(e, date) }}
            title={date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            style={{
              position: 'absolute', left: sx, top: sy, width: size, height: size,
              boxSizing: 'border-box',
              border: `1px solid var(--border-subtle, #eee)`,
              background: isToday ? 'var(--accent-soft, rgba(108,92,231,0.10))' : (isWeekend ? 'var(--bg-subtle, #fafafa)' : (dim ? 'rgba(0,0,0,0.015)' : 'transparent')),
              cursor: 'pointer', overflow: 'hidden',
            }}
          >
            {showDayNumbers && (
              <span style={{
                position: 'absolute', top: size * 0.06, left: size * 0.08,
                fontSize: Math.min(20, size * 0.22), fontWeight: isToday ? 700 : 500,
                color: isToday ? 'var(--accent, #6c5ce7)' : (date.getDate() === 1 ? 'var(--text, #333)' : 'var(--text-secondary, #999)'),
              }}>
                {date.getDate() === 1 ? `${MONTHS[date.getMonth()]} 1` : date.getDate()}
              </span>
            )}
            {showContent && (() => {
              const kids = dayChildren(date)
              if (kids.length === 0) return null
              return (
                <div style={{
                  position: 'absolute', top: size * 0.26, left: size * 0.08, right: size * 0.08,
                  display: 'flex', flexDirection: 'column', gap: size * 0.02, overflow: 'hidden',
                }}>
                  {kids.slice(0, 6).map(k => (
                    <div key={k.id} style={{
                      fontSize: Math.min(14, size * 0.06), lineHeight: 1.25, color: 'var(--text-secondary, #777)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>• {k.text || 'Nota vacía'}</div>
                  ))}
                  {kids.length > 6 && (
                    <div style={{ fontSize: Math.min(12, size * 0.05), color: 'var(--text-tertiary, #aaa)' }}>+{kids.length - 6} más</div>
                  )}
                </div>
              )
            })()}
            {/* Punto indicador de contenido cuando NO se ve el peek (zoom medio) */}
            {!showContent && showDayNumbers && daysWithContent.has(dayKey(date)) && (
              <span style={{
                position: 'absolute', bottom: size * 0.12, left: '50%', transform: 'translateX(-50%)',
                width: Math.max(3, size * 0.05), height: Math.max(3, size * 0.05), borderRadius: '50%',
                background: 'var(--accent, #6c5ce7)', opacity: 0.6,
              }} />
            )}
          </div>
        )
      })}

      {/* Etiquetas de MES (aparecen al alejar) */}
      {monthLabels.map((m, i) => {
        const sx = cam.x + m.x * cam.scale
        const sy = cam.y + m.y * cam.scale
        return (
          <div key={i} style={{
            position: 'absolute', left: sx, top: sy - 4, pointerEvents: 'none',
            fontSize: Math.max(13, Math.min(40, cellScreen * 0.5)), fontWeight: 700,
            color: 'var(--text, #333)', opacity: 0.85, whiteSpace: 'nowrap',
          }}>
            {m.label}{cellScreen < 30 ? ` ${m.year}` : ''}
          </div>
        )
      })}

      {/* Cabecera de año (rango visible) */}
      <div style={{ position: 'absolute', top: 12, left: 14, fontSize: 13, color: 'var(--text-secondary, #888)', pointerEvents: 'none' }}>
        {(() => {
          const c0 = cells[0], c1 = cells[cells.length - 1]
          if (!c0 || !c1) return ''
          const y0 = c0.date.getFullYear(), y1 = c1.date.getFullYear()
          return y0 === y1 ? `${y0}` : `${y0} – ${y1}`
        })()}
      </div>

      {/* Toolbar inferior (fija) */}
      <div style={{
        position: 'fixed', left: '50%', bottom: 22, transform: 'translateX(-50%)', zIndex: 60,
        display: 'flex', alignItems: 'center', gap: 2, padding: 5,
        background: 'var(--bg-elevated, #fff)', border: '1px solid var(--border, #e2e2e2)',
        borderRadius: 16, boxShadow: '0 6px 22px rgba(0,0,0,0.12)',
      }}>
        <button style={tbtn} title="Ir a hoy" onClick={goToday}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>
        </button>
        <div style={{ width: 1, height: 22, background: 'var(--border, #e2e2e2)', margin: '0 3px' }} />
        <button style={tbtn} title="Alejar" onClick={() => setCam(c => ({ ...c, scale: Math.max(MIN_SCALE, c.scale / 1.3) }))}>−</button>
        <span style={{ minWidth: 42, textAlign: 'center', fontSize: 12, color: 'var(--text-secondary, #888)' }}>{Math.round(cam.scale * 100)}%</span>
        <button style={tbtn} title="Acercar" onClick={() => setCam(c => ({ ...c, scale: Math.min(MAX_SCALE, c.scale * 1.3) }))}>+</button>
      </div>
    </div>
  )
}

const tbtn: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 9, border: 'none', background: 'transparent',
  color: 'var(--text, #333)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
}
