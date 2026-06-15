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
import { ensureDayPath } from '../../utils/agendaHelper'
import NodeContextMenu from '../outliner/NodeContextMenu'
import OutlinerNode from '../outliner/OutlinerNode'
import type { Node } from '../../types'

interface Props {
  parentId: string
  // Si true, los hijos SIN posición se auto-colocan en columna (solo en memoria,
  // no se persiste) para que el contenido sea visible en notas normales. En la
  // diaria es false: el lienzo queda libre y el contenido vive en el panel del día.
  flowUnpositioned?: boolean
}

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

export default function PizarraView({ parentId, flowUnpositioned = false }: Props) {
  useStore() // re-render ante cambios del store
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const [cam, setCam] = useState<Cam>({ x: 60, y: 60, scale: 1 })
  const [viewport, setViewport] = useState({ w: 1000, h: 700 })

  // Nodo seleccionado (el OutlinerNode embebido se enfoca/edita al seleccionarlo).
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Menú contextual de nodo (clic derecho en una tarjeta) — el mismo de la lista.
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null)

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
    let autoI = 0
    for (const n of children) {
      const pin = readPin(n)
      if (pin) map.set(n.id, pin)
      else if (flowUnpositioned) { map.set(n.id, { x: AUTO_X, y: AUTO_Y0 + autoI * AUTO_GAP }); autoI++ }
    }
    return map
  }, [children, flowUnpositioned])

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

  // Crear un nodo colocado en coordenadas de mundo y seleccionarlo (el
  // OutlinerNode embebido se enfoca al estar seleccionado → listo para escribir).
  const createNodeAt = useCallback((world: WorldPos) => {
    const node = store.createNode({
      text: '',
      parentId,
      extraData: { [PIN_X]: String(Math.round(world.x)), [PIN_Y]: String(Math.round(world.y)), [PIN_SCALE]: '1' },
    })
    setSelectedId(node.id)
  }, [parentId])

  // ── Pointer down en el fondo → SOLO pan (crear nodo = doble clic) ────────────
  const onBackgroundPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    // Solo si el target es el fondo (no una tarjeta).
    if ((e.target as HTMLElement).dataset.bg !== '1') return
    setSelectedId(null)
    const el = containerRef.current!
    el.setPointerCapture(e.pointerId)
    panRef.current = { startX: e.clientX, startY: e.clientY, camX: cam.x, camY: cam.y, moved: false }
  }, [cam])

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

  // ── Pointer down en el TIRADOR de una tarjeta → iniciar drag de la tarjeta ──
  const onCardPointerDown = useCallback((e: React.PointerEvent, node: Node) => {
    if (e.button !== 0) return
    e.stopPropagation() // no llega al fondo (no pan) ni al editor
    const rect = containerRef.current!.getBoundingClientRect()
    const startWorld = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
    const origin = layout.get(node.id) || { x: 0, y: 0 }
    containerRef.current!.setPointerCapture(e.pointerId)
    dragRef.current = { id: node.id, startWorld, origin, moved: false }
    setDragPos({ id: node.id, pos: origin })
  }, [layout, screenToWorld])

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

      {/* Tarjetas visibles (culling aplicado). Cada tarjeta embebe un OutlinerNode
          REAL → hereda dot en hover, Magic, predictivo de fecha, anticipación, etc.
          Escala por transform (contenido a tamaño de mundo). Se arrastra por el
          tirador izquierdo (no por el texto, para no chocar con el cursor sagrado). */}
      {visible.map(({ node, pos }) => {
        const sx = cam.x + pos.x * cam.scale
        const sy = cam.y + pos.y * cam.scale
        return (
          <div
            key={node.id}
            data-card="1"
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ nodeId: node.id, x: e.clientX, y: e.clientY }) }}
            style={{
              position: 'absolute',
              left: sx,
              top: sy,
              width: CARD_W,
              minHeight: CARD_MIN_H,
              transform: `scale(${cam.scale})`,
              transformOrigin: '0 0',
              background: 'var(--bg-elevated, #fff)',
              border: '1px solid var(--border, #d8d8d8)',
              borderRadius: 10,
              boxShadow: dragPos?.id === node.id ? '0 8px 24px rgba(0,0,0,0.16)' : '0 2px 8px rgba(0,0,0,0.08)',
              boxSizing: 'border-box',
              zIndex: dragPos?.id === node.id ? 10 : 1,
              display: 'flex', alignItems: 'stretch',
            }}
          >
            {/* Tirador de arrastre (mueve la tarjeta por el lienzo) */}
            <div
              onPointerDown={(e) => onCardPointerDown(e, node)}
              title="Arrastrar"
              style={{
                width: 18, flexShrink: 0, cursor: 'grab', display: 'flex',
                alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary, #cfcfcf)',
                borderRight: '1px solid var(--border-subtle, #f0f0f0)', borderRadius: '10px 0 0 10px',
              }}
            >
              <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor"><circle cx="2" cy="3" r="1"/><circle cx="6" cy="3" r="1"/><circle cx="2" cy="7" r="1"/><circle cx="6" cy="7" r="1"/><circle cx="2" cy="11" r="1"/><circle cx="6" cy="11" r="1"/></svg>
            </div>
            {/* Contenido = nodo REAL (editor del outliner en modo flat) */}
            <div className="pizarra-card-body" style={{ flex: 1, minWidth: 0, padding: '5px 6px' }}>
              <OutlinerNode
                node={node}
                depth={0}
                isSelected={selectedId === node.id}
                selectedId={selectedId}
                isMultiSelected={false}
                onSelect={setSelectedId}
                onSelectNext={() => {}}
                onShiftSelect={() => {}}
                filterText=""
                flat
              />
            </div>
          </div>
        )
      })}

      {/* ── Barra de herramientas (estilo iPad) — INFERIOR, horizontal ── */}
      <div style={{
        position: 'absolute', left: '50%', bottom: 14, transform: 'translateX(-50%)', zIndex: 20,
        display: 'flex', alignItems: 'center', gap: 2, padding: 5,
        background: 'var(--bg-elevated, #fff)', border: '1px solid var(--border, #e2e2e2)',
        borderRadius: 16, boxShadow: '0 6px 22px rgba(0,0,0,0.12)',
      }}>
        {/* Ir a hoy */}
        <button style={toolBtn} title="Ir a hoy"
          onClick={() => {
            const day = ensureDayPath(new Date())
            navigate(`/node/${day.id}`)
            setCam({ x: 60, y: 60, scale: 1 })
            window.dispatchEvent(new CustomEvent('from:open-day-panel'))
          }}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>
        </button>
        <div style={vSep} />
        {/* Herramientas de anotación/dibujo — Fase 2 (los nodos se crean con DOBLE CLIC) */}
        <button style={toolBtnDisabled} disabled title="Texto — anotaciones (próximamente)">
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
        <div style={vSep} />
        <button style={store.canUndo ? toolBtn : toolBtnDisabled} disabled={!store.canUndo} title="Deshacer"
          onClick={() => store.undo()}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M7 7H13a4 4 0 010 8H8M7 7l3-3M7 7l3 3"/></svg>
        </button>
        <button style={store.canRedo ? toolBtn : toolBtnDisabled} disabled={!store.canRedo} title="Rehacer"
          onClick={() => store.redo()}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M13 7H7a4 4 0 000 8h5M13 7l-3-3M13 7l-3 3"/></svg>
        </button>
        <div style={vSep} />
        <button style={toolBtn} title="Alejar"
          onClick={() => setCam(c => ({ ...c, scale: Math.max(MIN_SCALE, c.scale / 1.2) }))}>−</button>
        <span style={{ minWidth: 42, textAlign: 'center', fontSize: 12, color: 'var(--text-secondary, #888)' }}>{Math.round(cam.scale * 100)}%</span>
        <button style={toolBtn} title="Acercar"
          onClick={() => setCam(c => ({ ...c, scale: Math.min(MAX_SCALE, c.scale * 1.2) }))}>+</button>
        <button style={toolBtn} title="Centrar"
          onClick={() => setCam({ x: 60, y: 60, scale: 1 })}>⌖</button>
      </div>

      {layout.size === 0 && (
        <div style={{ position: 'absolute', left: cam.x + 40 * cam.scale, top: cam.y + 40 * cam.scale, color: 'var(--text-secondary, #999)', fontSize: 14, pointerEvents: 'none' }}>
          Haz <b>doble clic</b> en cualquier parte para crear un nodo.
        </div>
      )}

      {/* Menú contextual de nodo (clic derecho) — idéntico al de la vista lista */}
      {contextMenu && store.getNode(contextMenu.nodeId) && (
        <NodeContextMenu
          node={store.getNode(contextMenu.nodeId)!}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onNavigate={navigate}
          onSelect={() => { /* selección no aplica en el lienzo */ }}
        />
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
const vSep: React.CSSProperties = {
  width: 1, height: 22, background: 'var(--border, #e2e2e2)', margin: '0 3px',
}

