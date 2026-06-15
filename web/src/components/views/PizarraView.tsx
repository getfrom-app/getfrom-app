// PizarraView — modo de vista "pizarra": lienzo infinito con zoom donde los
// hijos del nodo se pintan como tarjetas posicionadas libremente.
//
// Paridad con la Pizarra nativa de iPad: la posición de cada tarjeta vive en
// extraData del nodo como `_pinX/_pinY/_pinScale` (las mismas claves que usa
// WBKeys en Swift), así que la posición sincroniza por ops sin trabajo extra.
//
// Reglas de seguridad (ver plan Fase 1):
//  - NO se escriben coordenadas en masa: los nodos sin `_pinX` se auto-colocan
//    SOLO en memoria (layout en columna); la posición se persiste únicamente
//    cuando el usuario arrastra la tarjeta.
//  - No se toca el código sagrado del outliner (cursor/drag/foco): la tarjeta
//    usa su propio editor mínimo.
//  - Culling: solo se montan las tarjetas visibles en el viewport (virtualiza
//    el lienzo sin librería — un canvas necesita posicionamiento 2D libre).

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'

interface Props { parentId: string }

// Claves de pin — DEBEN coincidir byte a byte con WBKeys del iPad.
const PIN_X = '_pinX'
const PIN_Y = '_pinY'
const PIN_SCALE = '_pinScale'

// Geometría base de una tarjeta en coordenadas de mundo.
const CARD_W = 220
const CARD_MIN_H = 52
// Auto-layout (nodos sin posición): columna en flujo.
// Zoom.
const MIN_SCALE = 0.05
const MAX_SCALE = 6

interface Cam { x: number; y: number; scale: number }
interface WorldPos { x: number; y: number }

function readPin(node: Node): WorldPos | null {
  if (!node.extraData) return null
  try {
    const ed = JSON.parse(node.extraData)
    const sx = ed[PIN_X], sy = ed[PIN_Y]
    if (sx == null || sy == null) return null
    const x = Number(sx), y = Number(sy)
    if (Number.isNaN(x) || Number.isNaN(y)) return null
    return { x, y }
  } catch { return null }
}

// Escribe la posición en extraData preservando el resto de campos (patrón
// crítico: nunca sobrescribir extraData entero).
function writePin(node: Node, pos: WorldPos) {
  let ed: Record<string, unknown> = {}
  try { ed = JSON.parse(node.extraData || '{}') } catch { /* corrupto → vacío */ }
  ed[PIN_X] = String(Math.round(pos.x))
  ed[PIN_Y] = String(Math.round(pos.y))
  if (ed[PIN_SCALE] == null) ed[PIN_SCALE] = '1'
  store.updateNode(node.id, { extraData: JSON.stringify(ed) })
}

export default function PizarraView({ parentId }: Props) {
  useStore() // re-render ante cambios del store
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const [cam, setCam] = useState<Cam>({ x: 60, y: 60, scale: 1 })
  const [viewport, setViewport] = useState({ w: 1000, h: 700 })

  // Edición inline de una tarjeta.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  // Drag de tarjeta (en curso): id + posición de mundo provisional + guías.
  const dragRef = useRef<{ id: string; startWorld: WorldPos; origin: WorldPos; moved: boolean } | null>(null)
  const [dragPos, setDragPos] = useState<{ id: string; pos: WorldPos } | null>(null)
  const [guides, setGuides] = useState<{ vx?: number; hy?: number }>({})

  // Pan del lienzo (en curso).
  const panRef = useRef<{ startX: number; startY: number; camX: number; camY: number; moved: boolean } | null>(null)

  // Hijos del nodo (las tarjetas). Fresco cada render: store.children está
  // cacheado e invalida al cambiar un nodo, así que al persistir _pinX/_pinY el
  // array cambia de referencia y el layout recalcula (antes se memoizaba por
  // longitud → al mover una tarjeta no cambiaba la longitud → volvía a su sitio).
  const children = store.children(parentId)

  // La pizarra muestra SOLO los nodos COLOCADOS (con _pinX/_pinY). Los hijos sin
  // posición (bullets normales del día, tareas, etc.) NO ensucian el lienzo: viven
  // en la columna derecha / vista lista. Así la pizarra queda libre.
  const layout = useMemo(() => {
    const map = new Map<string, WorldPos>()
    for (const n of children) {
      const pin = readPin(n)
      if (pin) map.set(n.id, pin)
    }
    return map
  }, [children])

  // ── Medidas del viewport ──────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => setViewport({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── Conversión pantalla ↔ mundo ─────────────────────────────────────────────
  const screenToWorld = useCallback((sx: number, sy: number): WorldPos => {
    return { x: (sx - cam.x) / cam.scale, y: (sy - cam.y) / cam.scale }
  }, [cam])

  // ── Zoom con la rueda, anclado al cursor ────────────────────────────────────
  // Listener NATIVO (no passive) para poder preventDefault: en modo pizarra la
  // rueda hace SOLO zoom, no scroll de la página.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const rect = el.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      setCam(prev => {
        const factor = Math.exp(-e.deltaY * 0.0015)
        const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale * factor))
        // Mantener fijo el punto de mundo bajo el cursor.
        const wx = (sx - prev.x) / prev.scale
        const wy = (sy - prev.y) / prev.scale
        return { x: sx - wx * next, y: sy - wy * next, scale: next }
      })
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  // Commit de edición inline. Si el nodo quedó vacío y sin hijos → borrar (no
  // dejar tarjetas fantasma). Importante: se llama explícitamente (no por onBlur,
  // que NO se dispara al desmontar el input al cambiar editingId).
  const commitEdit = useCallback((id: string) => {
    const node = store.getNode(id)
    if (node && editText !== node.text) store.updateNode(id, { text: editText })
    if (node && editText.trim() === '' && store.children(id).length === 0) {
      store.deleteNode(id)
    }
    setEditingId(null)
  }, [editText])

  // Crear un nodo colocado en coordenadas de mundo y entrar en edición.
  const createNodeAt = useCallback((world: WorldPos) => {
    if (editingId) commitEdit(editingId)
    const node = store.createNode({
      text: '',
      parentId,
      extraData: { [PIN_X]: String(Math.round(world.x)), [PIN_Y]: String(Math.round(world.y)), [PIN_SCALE]: '1' },
    })
    setEditingId(node.id)
    setEditText('')
  }, [editingId, commitEdit, parentId])

  // ── Pointer down en el fondo → SOLO pan (crear nodo = doble clic) ────────────
  const onBackgroundPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    // Solo si el target es el fondo (no una tarjeta).
    if ((e.target as HTMLElement).dataset.bg !== '1') return
    if (editingId) commitEdit(editingId) // commit real (limpia vacíos), no solo blur
    const el = containerRef.current!
    el.setPointerCapture(e.pointerId)
    panRef.current = { startX: e.clientX, startY: e.clientY, camX: cam.x, camY: cam.y, moved: false }
  }, [cam, editingId, commitEdit])

  // ── Doble clic en el fondo → crear nodo ahí ─────────────────────────────────
  const onBackgroundDoubleClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).dataset.bg !== '1') return
    const rect = containerRef.current!.getBoundingClientRect()
    createNodeAt(screenToWorld(e.clientX - rect.left, e.clientY - rect.top))
  }, [createNodeAt, screenToWorld])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    // Pan del lienzo.
    if (panRef.current) {
      // Capturar en local: setCam corre async y panRef.current puede ser null
      // para entonces (pointerup) → leer .camX de null crasheaba.
      const p = panRef.current
      const dx = e.clientX - p.startX
      const dy = e.clientY - p.startY
      if (Math.abs(dx) + Math.abs(dy) > 3) p.moved = true
      setCam(prev => ({ ...prev, x: p.camX + dx, y: p.camY + dy }))
      return
    }
    // Drag de tarjeta.
    if (dragRef.current) {
      const d = dragRef.current
      const world = screenToWorld(
        e.clientX - containerRef.current!.getBoundingClientRect().left,
        e.clientY - containerRef.current!.getBoundingClientRect().top
      )
      const nx = d.origin.x + (world.x - d.startWorld.x)
      const ny = d.origin.y + (world.y - d.startWorld.y)
      if (Math.abs(world.x - d.startWorld.x) * cam.scale + Math.abs(world.y - d.startWorld.y) * cam.scale > 3) d.moved = true
      // Snap desactivado por ahora (daba problemas al arrastrar). Se retomará.
      setDragPos({ id: d.id, pos: { x: nx, y: ny } })
      return
    }
  }, [cam.scale, layout, screenToWorld])

  const endPointer = useCallback((e: React.PointerEvent) => {
    // Fin de pan (el clic simple ya NO crea nodo — eso es doble clic).
    if (panRef.current) {
      panRef.current = null
      try { containerRef.current?.releasePointerCapture(e.pointerId) } catch { /* noop */ }
      return
    }
    // Fin de drag de tarjeta: persistir posición si se movió.
    if (dragRef.current) {
      const d = dragRef.current
      const dp = dragPos
      dragRef.current = null
      try { containerRef.current?.releasePointerCapture(e.pointerId) } catch { /* noop */ }
      setGuides({})
      if (d.moved && dp) {
        const node = store.getNode(d.id)
        if (node) writePin(node, dp.pos)
      }
      setDragPos(null)
    }
  }, [dragPos, parentId, screenToWorld])

  // ── Pointer down en una tarjeta → iniciar drag ──────────────────────────────
  const onCardPointerDown = useCallback((e: React.PointerEvent, node: Node) => {
    if (e.button !== 0) return
    if (editingId === node.id) return // editando: no arrastrar
    e.stopPropagation()
    const rect = containerRef.current!.getBoundingClientRect()
    const startWorld = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
    const origin = layout.get(node.id) || { x: 0, y: 0 }
    containerRef.current!.setPointerCapture(e.pointerId)
    dragRef.current = { id: node.id, startWorld, origin, moved: false }
    setDragPos({ id: node.id, pos: origin })
  }, [editingId, layout, screenToWorld])

  // ── Render ──────────────────────────────────────────────────────────────────
  // Culling: una tarjeta es visible si su rect en pantalla intersecta el viewport
  // (con margen). Solo montamos esas.
  const margin = 200
  const visible = useMemo(() => {
    const out: { node: Node; pos: WorldPos }[] = []
    for (const n of children) {
      const base = layout.get(n.id)
      if (!base) continue // sin posición → no va al lienzo
      const pos = (dragPos && dragPos.id === n.id) ? dragPos.pos : base
      const sx = cam.x + pos.x * cam.scale
      const sy = cam.y + pos.y * cam.scale
      const w = CARD_W * cam.scale
      if (sx + w < -margin || sx > viewport.w + margin || sy + CARD_MIN_H * cam.scale < -margin || sy > viewport.h + margin) continue
      out.push({ node: n, pos })
    }
    return out
  }, [children, layout, dragPos, cam, viewport])

  return (
    <div
      ref={containerRef}
      data-bg="1"
      className="pizarra-view"
      onPointerDown={onBackgroundPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onDoubleClick={onBackgroundDoubleClick}
      style={{
        position: 'relative',
        width: '100%',
        height: 'calc(100vh - 160px)',
        minHeight: 480,
        overflow: 'hidden',
        background: 'var(--bg, #fff)',
        backgroundImage: 'radial-gradient(circle, var(--border-subtle, #e3e3e3) 1px, transparent 1px)',
        backgroundSize: `${24 * cam.scale}px ${24 * cam.scale}px`,
        backgroundPosition: `${cam.x}px ${cam.y}px`,
        touchAction: 'none',
        cursor: panRef.current ? 'grabbing' : 'default',
        borderRadius: 8,
      }}
    >
      {/* Guías de alineación (snap) */}
      {guides.vx != null && (
        <div style={{ position: 'absolute', left: cam.x + guides.vx * cam.scale, top: 0, width: 1, height: '100%', background: 'var(--accent, #6c5ce7)', opacity: 0.6, pointerEvents: 'none', zIndex: 5 }} />
      )}
      {guides.hy != null && (
        <div style={{ position: 'absolute', top: cam.y + guides.hy * cam.scale, left: 0, height: 1, width: '100%', background: 'var(--accent, #6c5ce7)', opacity: 0.6, pointerEvents: 'none', zIndex: 5 }} />
      )}

      {/* Tarjetas visibles (culling aplicado) */}
      {visible.map(({ node, pos }) => {
        const sx = cam.x + pos.x * cam.scale
        const sy = cam.y + pos.y * cam.scale
        const childCount = store.children(node.id).length
        const isEditing = editingId === node.id
        const isTask = node.status === 'pending' || node.status === 'done'
        return (
          <div
            key={node.id}
            data-card="1"
            onPointerDown={(e) => onCardPointerDown(e, node)}
            onDoubleClick={(e) => { e.stopPropagation(); setEditingId(node.id); setEditText(node.text) }}
            style={{
              position: 'absolute',
              left: sx,
              top: sy,
              width: CARD_W * cam.scale,
              minHeight: CARD_MIN_H * cam.scale,
              transformOrigin: '0 0',
              background: 'var(--bg-elevated, #fff)',
              border: `${Math.max(1, 1.5)}px solid var(--border, #d8d8d8)`,
              borderRadius: 10 * cam.scale,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              padding: `${10 * cam.scale}px ${12 * cam.scale}px`,
              fontSize: 14 * cam.scale,
              lineHeight: 1.35,
              color: 'var(--text, #1a1a1a)',
              cursor: isEditing ? 'text' : 'grab',
              userSelect: isEditing ? 'text' : 'none',
              boxSizing: 'border-box',
              zIndex: dragPos?.id === node.id ? 10 : 1,
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', gap: 6 * cam.scale, alignItems: 'flex-start' }}>
              {isTask && (
                <span style={{
                  width: 14 * cam.scale, height: 14 * cam.scale, marginTop: 3 * cam.scale, flexShrink: 0,
                  borderRadius: 4 * cam.scale, border: `${1.5 * cam.scale}px solid var(--border, #bbb)`,
                  background: node.status === 'done' ? 'var(--accent, #6c5ce7)' : 'transparent',
                }} />
              )}
              {isEditing ? (
                <input
                  autoFocus
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onPointerDown={(e) => e.stopPropagation()}
                  onBlur={() => commitEdit(node.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); commitEdit(node.id) }
                    if (e.key === 'Escape') { e.preventDefault(); setEditingId(null) }
                  }}
                  style={{
                    flex: 1, border: 'none', outline: 'none', background: 'transparent',
                    fontSize: 14 * cam.scale, color: 'inherit', fontFamily: 'inherit', padding: 0,
                  }}
                />
              ) : (
                <span style={{ flex: 1, wordBreak: 'break-word', textDecoration: node.status === 'done' ? 'line-through' : 'none', opacity: node.text ? 1 : 0.4 }}>
                  {node.text || 'Nota vacía'}
                </span>
              )}
            </div>
            {childCount > 0 && !isEditing && (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); navigate(`/node/${node.id}`) }}
                style={{
                  marginTop: 6 * cam.scale, fontSize: 11 * cam.scale, color: 'var(--text-secondary, #888)',
                  background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
                }}
              >
                {childCount} {childCount === 1 ? 'elemento' : 'elementos'} ›
              </button>
            )}
          </div>
        )
      })}

      {/* ── Barra de herramientas (estilo iPad) — flotante a la izquierda ── */}
      <div style={{
        position: 'absolute', left: 12, top: 12, zIndex: 20,
        display: 'flex', flexDirection: 'column', gap: 4, padding: 5,
        background: 'var(--bg-elevated, #fff)', border: '1px solid var(--border, #e2e2e2)',
        borderRadius: 14, boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
      }}>
        <button style={toolBtn} title="Texto — añadir nodo (o doble clic en el lienzo)"
          onClick={() => createNodeAt(screenToWorld(viewport.w / 2, viewport.h / 2))}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 6V5h12v1M10 5v10M7.5 15h5"/></svg>
        </button>
        <button style={toolBtnDisabled} disabled title="Lápiz — dibujar (próximamente)">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M14 3l3 3-9 9-4 1 1-4 9-9z"/></svg>
        </button>
        <button style={toolBtnDisabled} disabled title="Borrador (próximamente)">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M7 16h9M4 13l5-5 6 6-3 3H7l-3-3z"/></svg>
        </button>
        <button style={toolBtnDisabled} disabled title="Lazo (próximamente)">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><ellipse cx="10" cy="8" rx="7" ry="5"/><path d="M7 13c0 2 1 4 3 4"/></svg>
        </button>
        <div style={{ height: 1, background: 'var(--border, #e2e2e2)', margin: '2px 4px' }} />
        <button style={store.canUndo ? toolBtn : toolBtnDisabled} disabled={!store.canUndo} title="Deshacer"
          onClick={() => store.undo()}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M7 7H13a4 4 0 010 8H8M7 7l3-3M7 7l3 3"/></svg>
        </button>
        <button style={store.canRedo ? toolBtn : toolBtnDisabled} disabled={!store.canRedo} title="Rehacer"
          onClick={() => store.redo()}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M13 7H7a4 4 0 000 8h5M13 7l-3-3M13 7l-3 3"/></svg>
        </button>
      </div>

      {/* Controles de zoom — abajo a la derecha */}
      <div style={{ position: 'absolute', right: 12, bottom: 12, display: 'flex', gap: 6, zIndex: 20 }}>
        <button onClick={() => setCam({ x: 60, y: 60, scale: 1 })} title="Centrar"
          style={pillStyle}>⌖</button>
        <button onClick={() => setCam(c => ({ ...c, scale: Math.max(MIN_SCALE, c.scale / 1.2) }))} style={pillStyle}>−</button>
        <span style={{ ...pillStyle, minWidth: 44, textAlign: 'center', cursor: 'default' }}>{Math.round(cam.scale * 100)}%</span>
        <button onClick={() => setCam(c => ({ ...c, scale: Math.min(MAX_SCALE, c.scale * 1.2) }))} style={pillStyle}>+</button>
      </div>

      {layout.size === 0 && (
        <div style={{ position: 'absolute', left: cam.x + 40 * cam.scale, top: cam.y + 40 * cam.scale, color: 'var(--text-secondary, #999)', fontSize: 14, pointerEvents: 'none' }}>
          Haz <b>doble clic</b> en cualquier parte para crear un nodo.
        </div>
      )}
    </div>
  )
}

const toolBtn: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 9, border: 'none', background: 'transparent',
  color: 'var(--text, #333)', cursor: 'pointer', display: 'inline-flex',
  alignItems: 'center', justifyContent: 'center',
}
const toolBtnDisabled: React.CSSProperties = {
  ...toolBtn, color: 'var(--text-secondary, #bbb)', cursor: 'not-allowed', opacity: 0.5,
}

const pillStyle: React.CSSProperties = {
  height: 28, minWidth: 28, padding: '0 8px', borderRadius: 14,
  border: '1px solid var(--border, #d8d8d8)', background: 'var(--bg-elevated, #fff)',
  color: 'var(--text, #333)', fontSize: 14, cursor: 'pointer', display: 'inline-flex',
  alignItems: 'center', justifyContent: 'center',
}
