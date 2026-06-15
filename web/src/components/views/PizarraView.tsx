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
const AUTO_X = 40
const AUTO_Y0 = 40
const AUTO_GAP = 84
// Zoom.
const MIN_SCALE = 0.05
const MAX_SCALE = 6
// Snap: distancia (en px de pantalla) para enganchar y mostrar guía.
const SNAP_PX = 7

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

  // Hijos del nodo (las tarjetas).
  const children = useMemo(() => store.children(parentId), [parentId, store.children(parentId).length, editingId])

  // Posición efectiva de cada tarjeta: la persistida (_pinX/_pinY) o, si no hay,
  // un auto-layout en columna por orden (SOLO en memoria, no se persiste).
  const layout = useMemo(() => {
    const map = new Map<string, WorldPos>()
    let autoI = 0
    for (const n of children) {
      const pin = readPin(n)
      if (pin) map.set(n.id, pin)
      else { map.set(n.id, { x: AUTO_X, y: AUTO_Y0 + autoI * AUTO_GAP }); autoI++ }
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
  const onWheel = useCallback((e: React.WheelEvent) => {
    const el = containerRef.current
    if (!el) return
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
  }, [])

  // ── Pointer down en el fondo → pan o crear nodo ─────────────────────────────
  const onBackgroundPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    // Solo si el target es el fondo (no una tarjeta).
    if ((e.target as HTMLElement).dataset.bg !== '1') return
    if (editingId) { setEditingId(null) }
    const el = containerRef.current!
    el.setPointerCapture(e.pointerId)
    panRef.current = { startX: e.clientX, startY: e.clientY, camX: cam.x, camY: cam.y, moved: false }
  }, [cam, editingId])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    // Pan del lienzo.
    if (panRef.current) {
      const dx = e.clientX - panRef.current.startX
      const dy = e.clientY - panRef.current.startY
      if (Math.abs(dx) + Math.abs(dy) > 3) panRef.current.moved = true
      setCam(prev => ({ ...prev, x: panRef.current!.camX + dx, y: panRef.current!.camY + dy }))
      return
    }
    // Drag de tarjeta.
    if (dragRef.current) {
      const d = dragRef.current
      const world = screenToWorld(
        e.clientX - containerRef.current!.getBoundingClientRect().left,
        e.clientY - containerRef.current!.getBoundingClientRect().top
      )
      let nx = d.origin.x + (world.x - d.startWorld.x)
      let ny = d.origin.y + (world.y - d.startWorld.y)
      if (Math.abs(world.x - d.startWorld.x) * cam.scale + Math.abs(world.y - d.startWorld.y) * cam.scale > 3) d.moved = true
      // Snap contra los bordes/centros de las otras tarjetas.
      const snapW = SNAP_PX / cam.scale
      let gx: number | undefined, gy: number | undefined
      for (const [id, p] of layout) {
        if (id === d.id) continue
        if (Math.abs(nx - p.x) < snapW) { nx = p.x; gx = p.x }
        if (Math.abs(ny - p.y) < snapW) { ny = p.y; gy = p.y }
      }
      setDragPos({ id: d.id, pos: { x: nx, y: ny } })
      setGuides({ vx: gx, hy: gy })
      return
    }
  }, [cam.scale, layout, screenToWorld])

  const endPointer = useCallback((e: React.PointerEvent) => {
    // Fin de pan: si no se movió, fue un clic en vacío → crear nodo ahí.
    if (panRef.current) {
      const wasClick = !panRef.current.moved
      panRef.current = null
      try { containerRef.current?.releasePointerCapture(e.pointerId) } catch { /* noop */ }
      if (wasClick) {
        const rect = containerRef.current!.getBoundingClientRect()
        const w = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
        const node = store.createNode({
          text: '',
          parentId,
          extraData: { [PIN_X]: String(Math.round(w.x)), [PIN_Y]: String(Math.round(w.y)), [PIN_SCALE]: '1' },
        })
        setEditingId(node.id)
        setEditText('')
      }
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

  // Commit de edición inline.
  const commitEdit = useCallback((id: string) => {
    const node = store.getNode(id)
    if (node && editText !== node.text) store.updateNode(id, { text: editText })
    // Si quedó vacío y sin hijos → borrar (no dejar tarjetas fantasma).
    if (node && editText.trim() === '' && store.children(id).length === 0) {
      store.deleteNode(id)
    }
    setEditingId(null)
  }, [editText])

  // ── Render ──────────────────────────────────────────────────────────────────
  // Culling: una tarjeta es visible si su rect en pantalla intersecta el viewport
  // (con margen). Solo montamos esas.
  const margin = 200
  const visible = useMemo(() => {
    const out: { node: Node; pos: WorldPos }[] = []
    for (const n of children) {
      const pos = (dragPos && dragPos.id === n.id) ? dragPos.pos : layout.get(n.id)!
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
      onWheel={onWheel}
      onPointerDown={onBackgroundPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
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

      {/* Barra de estado / controles mínimos */}
      <div style={{ position: 'absolute', right: 12, bottom: 12, display: 'flex', gap: 6, zIndex: 20 }}>
        <button onClick={() => setCam({ x: 60, y: 60, scale: 1 })} title="Centrar"
          style={pillStyle}>⌖</button>
        <button onClick={() => setCam(c => ({ ...c, scale: Math.max(MIN_SCALE, c.scale / 1.2) }))} style={pillStyle}>−</button>
        <span style={{ ...pillStyle, minWidth: 44, textAlign: 'center', cursor: 'default' }}>{Math.round(cam.scale * 100)}%</span>
        <button onClick={() => setCam(c => ({ ...c, scale: Math.min(MAX_SCALE, c.scale * 1.2) }))} style={pillStyle}>+</button>
      </div>

      {children.length === 0 && (
        <div style={{ position: 'absolute', left: cam.x + 40 * cam.scale, top: cam.y + 40 * cam.scale, color: 'var(--text-secondary, #999)', fontSize: 14, pointerEvents: 'none' }}>
          Haz clic en cualquier parte para crear un nodo.
        </div>
      )}
    </div>
  )
}

const pillStyle: React.CSSProperties = {
  height: 28, minWidth: 28, padding: '0 8px', borderRadius: 14,
  border: '1px solid var(--border, #d8d8d8)', background: 'var(--bg-elevated, #fff)',
  color: 'var(--text, #333)', fontSize: 14, cursor: 'pointer', display: 'inline-flex',
  alignItems: 'center', justifyContent: 'center',
}
