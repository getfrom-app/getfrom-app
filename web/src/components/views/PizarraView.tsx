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
import { findRootByKey } from '../../utils/rootLookup'
import { setTemporalFocus } from '../../utils/pizarraNav'
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

// Ancho del nodo en el lienzo — IGUAL al del flujo (FLOW_W) para que al arrastrar
// un nodo NO se encoja (mismo ancho flotante que en la columna/lista).
const CARD_W = 700
const CARD_MIN_H = 44
// Zoom.
const MIN_SCALE = 0.04
const MAX_SCALE = 50   // zoom profundo (antes 6 = 600%, escaso)
// Umbrales de "buceo" (dive): al cruzarlos con la rueda se navega de lienzo.
const DIVE_OUT_SCALE = 0.32   // alejar → subir al padre / mes (antes 0.08 = demasiado)
const DIVE_IN_SCALE = 4.0     // acercar sobre una tarjeta → entrar en ella

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

// Lee el zoom guardado del nodo (_pinScale). Default 1.
function readPinScale(node: Node): number {
  try {
    const s = Number(JSON.parse(node.extraData || '{}')[PIN_SCALE])
    return Number.isFinite(s) && s > 0 ? s : 1
  } catch { return 1 }
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

// ── Trazos (dibujo) — formato compatible con iPad (bloque ```from-pizarra```) ──
// Los trazos viven en el body del nodo-pizarra. `pts` = polilínea en MUNDO
// [x0,y0,x1,y1,…]; `w` = ancho en MUNDO (grosor constante: screenW = w*scale).
const FENCE = '```from-pizarra'
interface WBStroke { id: string; pts: number[]; w: number; c: string; e?: boolean; a?: number; k?: string }
interface WBData { version: number; strokes: WBStroke[]; texts?: unknown[]; tasks?: unknown[]; camX?: number; camY?: number; camScale?: number }

function parsePizarra(body: string | null | undefined): WBData {
  const def: WBData = { version: 1, strokes: [], texts: [], tasks: [] }
  if (!body) return def
  const i = body.indexOf(FENCE)
  if (i < 0) return def
  const after = body.slice(i + FENCE.length)
  const j = after.indexOf('```')
  if (j < 0) return def
  try {
    const d = JSON.parse(after.slice(0, j).trim())
    return { version: 1, strokes: [], texts: [], tasks: [], ...d }
  } catch { return def }
}
function bodyWithPizarra(body: string | null | undefined, data: WBData): string {
  const md = body || ''
  const block = `${FENCE}\n${JSON.stringify(data)}\n\`\`\``
  const i = md.indexOf(FENCE)
  if (i >= 0) {
    const after = md.slice(i + FENCE.length)
    const j = after.indexOf('```')
    if (j >= 0) return md.slice(0, i) + block + after.slice(j + 3)
  }
  return (md && !md.endsWith('\n') ? md + '\n' : md) + (md ? '\n' : '') + block + '\n'
}
function rid(): string {
  // id corto único (no hace falta UUID v4 estricto para trazos).
  return 'w' + Math.abs(Math.floor((performance.now() % 1) * 1e9)).toString(36) + (performance.now() | 0).toString(36)
}
// ¿Algún punto del trazo está a ≤ r (mundo) de (x,y)? (borrador, v1 por puntos).
function strokeNear(s: WBStroke, x: number, y: number, r: number): boolean {
  const r2 = r * r
  for (let i = 0; i + 1 < s.pts.length; i += 2) {
    const dx = s.pts[i] - x, dy = s.pts[i + 1] - y
    if (dx * dx + dy * dy <= r2) return true
  }
  return false
}

export default function PizarraView({ parentId }: Props) {
  useStore() // re-render ante cambios del store
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const [cam, setCam] = useState<Cam>({ x: 60, y: 60, scale: 1 })
  const [viewport, setViewport] = useState({ w: 1000, h: 700 })
  // Refs espejo (para leer el valor actual dentro de animaciones/listeners sin stale).
  const camRef = useRef(cam); camRef.current = cam
  const viewportRef = useRef(viewport); viewportRef.current = viewport
  const flyRef = useRef<number | null>(null)
  const divingRef = useRef(false) // anti-doble-disparo del buceo
  const tryDiveRef = useRef<(s: number) => void>(() => {})

  // Nodo seleccionado (el OutlinerNode embebido se enfoca/edita al seleccionarlo).
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Herramienta activa: select (mover/editar), pen (dibujar), eraser (borrar trazos).
  const [tool, setTool] = useState<'select' | 'pen' | 'eraser'>('select')
  const toolRef = useRef(tool); toolRef.current = tool
  // Trazo en curso (puntos en MUNDO) mientras se dibuja.
  const [drawPts, setDrawPts] = useState<number[] | null>(null)
  const drawRef = useRef<number[] | null>(null)

  // Modal "guardar esta vista (posición+zoom) como nodo".
  const [saveModal, setSaveModal] = useState(false)
  const [saveName, setSaveName] = useState('')

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

  // Modelo: los nodos COLOCADOS (con _pinX/_pinY) flotan libres en el lienzo; los
  // demás fluyen como en la LISTA (columna ancho-completo, apilados naturalmente,
  // sin solaparse). Al arrastrar uno del flujo, gana posición y pasa a flotar; al
  // volver a Lista, todos vuelven a su orden.
  const layout = useMemo(() => {
    const map = new Map<string, WorldPos>()
    for (const n of children) {
      const pin = readPin(n)
      if (pin) map.set(n.id, pin)
    }
    return map
  }, [children])

  // ── Buceo (dive) entre lienzos al cruzar umbrales de zoom con la rueda ──────
  // Zoom-out fuerte → SUBE: si es la diaria → Agenda (calendario centrado en su
  // mes); si no → al nodo padre. Zoom-in fuerte sobre la tarjeta centrada → ENTRA.
  tryDiveRef.current = (nextScale: number) => {
    if (divingRef.current) return
    const node = store.getNode(parentId)
    if (!node) return
    // SUBIR
    if (nextScale <= DIVE_OUT_SCALE) {
      if (node.isDiaryEntry && node.diaryDate) {
        const agenda = findRootByKey('agenda')
        if (agenda) {
          divingRef.current = true
          setTemporalFocus({ date: new Date(node.diaryDate).getTime(), level: 'months' }) // calendario anual 3×4
          navigate(`/node/${agenda.id}`)
        }
        return
      }
      // Nodo normal → su padre (si no es raíz de sistema/estructura).
      if (node.parentId) {
        divingRef.current = true
        navigate(`/node/${node.parentId}`)
      }
      return
    }
    // ENTRAR: tarjeta más cercana al centro que domine la pantalla.
    if (nextScale >= DIVE_IN_SCALE) {
      const { w, h } = viewportRef.current
      const c = camRef.current
      let best: string | null = null, bestD = Infinity
      for (const [id, pos] of layout) {
        const sx = c.x + (pos.x + CARD_W / 2) * c.scale
        const sy = c.y + (pos.y + CARD_MIN_H / 2) * c.scale
        const d = Math.hypot(sx - w / 2, sy - h / 2)
        if (d < bestD) { bestD = d; best = id }
      }
      if (best && CARD_W * nextScale > w * 0.55 && bestD < w * 0.35) {
        divingRef.current = true
        navigate(`/node/${best}`)
      }
    }
  }

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

  // ── Vuelo animado de la cámara a (wx,wy) con el zoom destino (estilo iPad) ──
  // Centra el punto de mundo en el viewport con un tween suave.
  const flyTo = useCallback((wx: number, wy: number, targetScale: number) => {
    if (flyRef.current) cancelAnimationFrame(flyRef.current)
    const start = { ...camRef.current }
    const { w, h } = viewportRef.current
    const s2 = Math.min(MAX_SCALE, Math.max(MIN_SCALE, targetScale || start.scale))
    const end = { scale: s2, x: w / 2 - wx * s2, y: h / 2 - wy * s2 }
    const dur = 480
    let t0 = -1
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
    const step = (now: number) => {
      if (t0 < 0) t0 = now
      const k = Math.min(1, (now - t0) / dur), e = ease(k)
      setCam({
        x: start.x + (end.x - start.x) * e,
        y: start.y + (end.y - start.y) * e,
        scale: start.scale + (end.scale - start.scale) * e,
      })
      if (k < 1) flyRef.current = requestAnimationFrame(step)
      else flyRef.current = null
    }
    flyRef.current = requestAnimationFrame(step)
  }, [])

  // Volar a un nodo concreto (centra su tarjeta usando su zoom guardado).
  const flyToNode = useCallback((node: Node) => {
    const pin = readPin(node); if (!pin) return
    flyTo(pin.x + CARD_W / 2, pin.y + CARD_MIN_H / 2, readPinScale(node))
  }, [flyTo])

  // ── Dibujo: persistir un trazo nuevo (ancho en MUNDO = grosor-pantalla/scale) ──
  const commitStroke = useCallback((worldPts: number[]) => {
    if (worldPts.length < 4) return
    const node = store.getNode(parentId); if (!node) return
    const data = parsePizarra(node.body)
    const wWorld = 2.4 / Math.max(0.0001, camRef.current.scale)
    data.strokes = [...data.strokes, {
      id: rid(), pts: worldPts.map(n => Math.round(n * 100) / 100), w: wWorld, c: '#222222', a: 1, k: 'free',
    }]
    store.updateNode(parentId, { body: bodyWithPizarra(node.body, data) })
  }, [parentId])

  // Soltar un nodo arrastrado desde la columna derecha → colocarlo en la pizarra.
  const onCanvasDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain')
    if (!id) return
    const node = store.getNode(id)
    if (!node || !store.children(parentId).some(c => c.id === id)) return
    const rect = containerRef.current!.getBoundingClientRect()
    const w = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
    writePin(node, { x: w.x - 16, y: w.y - 12 })
  }, [parentId, screenToWorld])

  // Quitar de la pizarra (NO borra el nodo): elimina _pinX/_pinY/_pinScale → vuelve
  // a vivir solo en la columna derecha.
  const removeFromCanvas = useCallback((id: string) => {
    const node = store.getNode(id); if (!node) return
    let ed: Record<string, unknown> = {}
    try { ed = JSON.parse(node.extraData || '{}') } catch { /* corrupto */ }
    delete ed[PIN_X]; delete ed[PIN_Y]; delete ed[PIN_SCALE]
    store.updateNode(id, { extraData: JSON.stringify(ed) })
  }, [])

  // Guardar la VISTA actual (centro del viewport + zoom) como un nodo nuevo.
  // Aparece en el panel del día; al pulsar su dot, la cámara vuela a esta vista.
  const saveViewAsNode = useCallback((name: string) => {
    const c = camRef.current, vp = viewportRef.current
    const wx = (vp.w / 2 - c.x) / c.scale
    const wy = (vp.h / 2 - c.y) / c.scale
    // El pin se guarda restando medio CARD para que al volar quede centrado igual.
    store.createNode({
      text: name.trim() || 'Vista',
      parentId,
      extraData: {
        [PIN_X]: String(Math.round(wx - CARD_W / 2)),
        [PIN_Y]: String(Math.round(wy - CARD_MIN_H / 2)),
        [PIN_SCALE]: String(Number(c.scale.toFixed(4))),
      },
    })
  }, [parentId])

  // Borrar trazos cerca de (wx,wy) en mundo.
  const eraseAt = useCallback((wx: number, wy: number) => {
    const node = store.getNode(parentId); if (!node) return
    const data = parsePizarra(node.body)
    const r = 12 / Math.max(0.0001, camRef.current.scale)
    const keep = data.strokes.filter(s => !strokeNear(s, wx, wy, r))
    if (keep.length !== data.strokes.length) {
      data.strokes = keep
      store.updateNode(parentId, { body: bodyWithPizarra(node.body, data) })
    }
  }, [parentId])

  // Evento externo: el panel del día / árbol pueden pedir volar a un nodo.
  useEffect(() => {
    const h = (e: Event) => {
      const id = (e as CustomEvent<{ nodeId?: string }>).detail?.nodeId
      if (!id) return
      const n = store.getNode(id)
      if (n && store.children(parentId).some(c => c.id === id)) flyToNode(n)
    }
    window.addEventListener('from:pizarra-flyto', h)
    return () => window.removeEventListener('from:pizarra-flyto', h)
  }, [flyToNode, parentId])

  // ── Zoom con la rueda, anclado al cursor ────────────────────────────────────
  // Listener NATIVO (no passive) para poder preventDefault: en modo pizarra la
  // rueda hace SOLO zoom, no scroll de la página.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (flyRef.current) { cancelAnimationFrame(flyRef.current); flyRef.current = null } // cancelar vuelo
      const rect = el.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      let nextScale = camRef.current.scale
      setCam(prev => {
        const factor = Math.exp(-e.deltaY * 0.0015)
        const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale * factor))
        nextScale = next
        // Mantener fijo el punto de mundo bajo el cursor.
        const wx = (sx - prev.x) / prev.scale
        const wy = (sy - prev.y) / prev.scale
        return { x: sx - wx * next, y: sy - wy * next, scale: next }
      })
      tryDiveRef.current(nextScale) // buceo si cruza umbral
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  // Crear un nodo colocado en coordenadas de mundo y seleccionarlo (el
  // OutlinerNode embebido se enfoca al estar seleccionado → listo para escribir).
  const createNodeAt = useCallback((world: WorldPos) => {
    // El nodo guarda el ZOOM actual del lienzo (_pinScale) → al pulsarlo después,
    // la cámara vuela a su posición con ese zoom (estilo iPad).
    const node = store.createNode({
      text: '',
      parentId,
      extraData: {
        [PIN_X]: String(Math.round(world.x)),
        [PIN_Y]: String(Math.round(world.y)),
        [PIN_SCALE]: String(Number(camRef.current.scale.toFixed(4))),
      },
    })
    setSelectedId(node.id)
  }, [parentId])

  // ── Pointer down en el fondo → pan, o dibujar/borrar según la herramienta ────
  const onBackgroundPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    // Solo si el target es el fondo (no una tarjeta).
    if ((e.target as HTMLElement).dataset.bg !== '1') return
    if (flyRef.current) { cancelAnimationFrame(flyRef.current); flyRef.current = null } // cancelar vuelo
    const el = containerRef.current!
    const rect = el.getBoundingClientRect()
    const w = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
    // Lápiz: iniciar trazo. Borrador: borrar al pasar.
    if (toolRef.current === 'pen') {
      el.setPointerCapture(e.pointerId)
      drawRef.current = [w.x, w.y]
      setDrawPts([w.x, w.y])
      return
    }
    if (toolRef.current === 'eraser') {
      el.setPointerCapture(e.pointerId)
      drawRef.current = [] // marca "borrando"
      eraseAt(w.x, w.y)
      return
    }
    setSelectedId(null)
    el.setPointerCapture(e.pointerId)
    panRef.current = { startX: e.clientX, startY: e.clientY, camX: cam.x, camY: cam.y, moved: false }
  }, [cam, screenToWorld, eraseAt])

  // ── Doble clic en el fondo → crear nodo ahí ─────────────────────────────────
  const onBackgroundDoubleClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).dataset.bg !== '1') return
    const rect = containerRef.current!.getBoundingClientRect()
    createNodeAt(screenToWorld(e.clientX - rect.left, e.clientY - rect.top))
  }, [createNodeAt, screenToWorld])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    // Dibujo / borrado en curso (herramienta lápiz/borrador).
    if (drawRef.current) {
      const rect = containerRef.current!.getBoundingClientRect()
      const w = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
      if (toolRef.current === 'eraser') { eraseAt(w.x, w.y); return }
      drawRef.current.push(w.x, w.y)
      setDrawPts([...drawRef.current])
      return
    }
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
  }, [cam.scale, layout, screenToWorld, eraseAt])

  const endPointer = useCallback((e: React.PointerEvent) => {
    // Fin de dibujo/borrado: persistir el trazo (lápiz).
    if (drawRef.current) {
      const pts = drawRef.current
      drawRef.current = null
      try { containerRef.current?.releasePointerCapture(e.pointerId) } catch { /* noop */ }
      if (toolRef.current === 'pen') commitStroke(pts)
      setDrawPts(null)
      return
    }
    // Fin de pan (el clic simple ya NO crea nodo — eso es doble clic).
    if (panRef.current) {
      panRef.current = null
      try { containerRef.current?.releasePointerCapture(e.pointerId) } catch { /* noop */ }
      return
    }
    // Fin de drag de tarjeta: persistir posición si se movió; si NO se movió,
    // fue un clic en el tirador → volar a ese nodo (centra + zoom guardado).
    if (dragRef.current) {
      const d = dragRef.current
      const dp = dragPos
      dragRef.current = null
      try { containerRef.current?.releasePointerCapture(e.pointerId) } catch { /* noop */ }
      setGuides({})
      const node = store.getNode(d.id)
      if (d.moved && dp) {
        if (node) writePin(node, dp.pos)
      } else if (node) {
        flyToNode(node)
      }
      setDragPos(null)
    }
  }, [dragPos, flyToNode, commitStroke])

  // ── Pointer down en el TIRADOR de una tarjeta → iniciar drag de la tarjeta ──
  const onCardPointerDown = useCallback((e: React.PointerEvent, node: Node) => {
    if (e.button !== 0) return
    e.stopPropagation() // no llega al fondo (no pan) ni al editor
    if (flyRef.current) { cancelAnimationFrame(flyRef.current); flyRef.current = null } // cancelar vuelo
    const rect = containerRef.current!.getBoundingClientRect()
    const startWorld = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
    // Origen = posición de mundo ACTUAL del nodo (rect real en pantalla). Vale para
    // nodos flotantes y para los del flujo (lista): así al arrastrar uno del flujo
    // no da un salto — empieza justo donde estaba y desde ahí queda flotando.
    let origin = layout.get(node.id)
    if (!origin) {
      const cardEl = (e.currentTarget as HTMLElement).closest('[data-card]') as HTMLElement | null
      if (cardEl) { const r = cardEl.getBoundingClientRect(); origin = screenToWorld(r.left - rect.left, r.top - rect.top) }
    }
    origin = origin || { x: 0, y: 0 }
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
    // Si se está arrastrando un nodo del FLUJO (aún sin pin), renderizarlo flotando.
    if (dragPos && !layout.has(dragPos.id)) {
      const dn = store.getNode(dragPos.id)
      if (dn) out.push({ node: dn, pos: dragPos.pos })
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
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
      onDrop={onCanvasDrop}
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
        cursor: panRef.current ? 'grabbing' : (tool === 'pen' || tool === 'eraser' ? 'crosshair' : 'default'),
        borderRadius: 8,
        animation: 'pizarra-dive 0.28s ease-out',
      }}
    >
      {/* En la tarjeta el ÚNICO tirador de arrastre es el de la izquierda → ocultar
          el tirador interno del OutlinerNode (node-drag-handle) para no duplicar. */}
      <style>{`.pizarra-card-body .node-drag-handle{display:none!important}
.pizarra-node .pizarra-grip{opacity:0;transition:opacity .12s}
.pizarra-node:hover .pizarra-grip{opacity:1}
@keyframes pizarra-dive{from{opacity:0;transform:scale(1.06)}to{opacity:1;transform:scale(1)}}`}</style>

      {/* ── Capa de trazos (dibujo) — detrás de las tarjetas, sin capturar el puntero ── */}
      <svg width={viewport.w} height={viewport.h} style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        {parsePizarra(store.getNode(parentId)?.body).strokes.map(s => {
          let d = ''
          for (let i = 0; i + 1 < s.pts.length; i += 2) {
            d += (i === 0 ? 'M' : 'L') + (cam.x + s.pts[i] * cam.scale).toFixed(1) + ' ' + (cam.y + s.pts[i + 1] * cam.scale).toFixed(1) + ' '
          }
          return <path key={s.id} d={d} fill="none" stroke={s.c || '#222'} strokeWidth={Math.max(0.4, s.w * cam.scale)} strokeOpacity={s.a ?? 1} strokeLinecap="round" strokeLinejoin="round" />
        })}
        {drawPts && drawPts.length >= 4 && (
          <path
            d={drawPts.reduce((acc, _v, i) => i % 2 === 0 ? acc + (i === 0 ? 'M' : 'L') + (cam.x + drawPts[i] * cam.scale).toFixed(1) + ' ' + (cam.y + drawPts[i + 1] * cam.scale).toFixed(1) + ' ' : acc, '')}
            fill="none" stroke="#222" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"
          />
        )}
      </svg>

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
      {/* Los nodos SIN posición viven en la COLUMNA DERECHA (panel del día), NO en
          el lienzo. En la pizarra solo aparecen los COLOCADOS (arrastrados desde la
          columna o creados con doble clic). Así no hay duplicidad. */}

      {/* ── FLOTANTES: nodos colocados + el que se arrastra ahora ── */}
      {visible.map(({ node, pos }) => {
        const sx = cam.x + pos.x * cam.scale
        const sy = cam.y + pos.y * cam.scale
        return (
          <div key={node.id} data-card="1" className="pizarra-node"
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ nodeId: node.id, x: e.clientX, y: e.clientY }) }}
            style={{ position: 'absolute', left: sx, top: sy, width: CARD_W, transform: `scale(${cam.scale})`, transformOrigin: '0 0', zIndex: dragPos?.id === node.id ? 10 : 1 }}>
            <div className="pizarra-grip" onPointerDown={(e) => onCardPointerDown(e, node)} title="Arrastrar" style={gripStyle}>
              <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor"><circle cx="2" cy="3" r="1"/><circle cx="6" cy="3" r="1"/><circle cx="2" cy="7" r="1"/><circle cx="6" cy="7" r="1"/><circle cx="2" cy="11" r="1"/><circle cx="6" cy="11" r="1"/></svg>
            </div>
            <div className="pizarra-card-body" style={{ minWidth: 0 }}>
              <OutlinerNode node={node} depth={0} isSelected={selectedId === node.id} selectedId={selectedId} isMultiSelected={false} onSelect={setSelectedId} onSelectNext={() => {}} onShiftSelect={() => {}} filterText="" flat />
            </div>
          </div>
        )
      })}

      {/* ── Barra de herramientas (estilo iPad) — INFERIOR, horizontal ──
          position:fixed: el contenedor del lienzo desborda por debajo del viewport,
          así que anclamos la barra a la parte inferior de la PANTALLA (siempre visible). */}
      <div style={{
        position: 'fixed', left: '50%', bottom: 22, transform: 'translateX(-50%)', zIndex: 60,
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
        {/* Guardar esta vista (posición+zoom) como nodo */}
        <button style={toolBtn} title="Guardar esta vista como nodo" onClick={() => { setSaveName(''); setSaveModal(true) }}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 3h10v14l-5-3-5 3V3z"/></svg>
        </button>
        <div style={vSep} />
        {/* Seleccionar / mover */}
        <button style={tool === 'select' ? toolBtnActive : toolBtn} title="Seleccionar / mover" onClick={() => setTool('select')}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path d="M4 3l13 6-5 1.6L9.6 17 4 3z"/></svg>
        </button>
        {/* Lápiz — dibujar */}
        <button style={tool === 'pen' ? toolBtnActive : toolBtn} title="Lápiz — dibujar" onClick={() => setTool(t => t === 'pen' ? 'select' : 'pen')}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M14 3l3 3-9 9-4 1 1-4 9-9z"/></svg>
        </button>
        {/* Borrador */}
        <button style={tool === 'eraser' ? toolBtnActive : toolBtn} title="Borrador" onClick={() => setTool(t => t === 'eraser' ? 'select' : 'eraser')}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M7 16h9M4 13l5-5 6 6-3 3H7l-3-3z"/></svg>
        </button>
        <button style={toolBtnDisabled} disabled title="Texto / Lazo (próximamente)">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 6V5h12v1M10 5v10M7.5 15h5"/></svg>
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

      {/* Menú contextual de la pizarra: QUITAR (saca de la pizarra, NO borra) o
          ELIMINAR (borra el nodo del todo, también de la columna). */}
      {contextMenu && store.getNode(contextMenu.nodeId) && (
        <>
          <div onPointerDown={() => setContextMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 1999 }} />
          <div style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 2000, minWidth: 200,
            background: 'var(--bg-elevated,#fff)', border: '1px solid var(--border,#e2e2e2)', borderRadius: 10, padding: 5,
            boxShadow: '0 8px 28px rgba(0,0,0,0.16)' }}>
            <button onClick={() => { removeFromCanvas(contextMenu.nodeId); setContextMenu(null) }} style={ctxItem}>
              Quitar de la pizarra
            </button>
            <button onClick={() => { window.dispatchEvent(new CustomEvent('from:pizarra-flyto', { detail: { nodeId: contextMenu.nodeId } })); navigate(`/node/${contextMenu.nodeId}`); setContextMenu(null) }} style={ctxItem}>
              Abrir nodo
            </button>
            <div style={{ height: 1, background: 'var(--border-subtle,#eee)', margin: '4px 0' }} />
            <button onClick={() => { store.deleteNode(contextMenu.nodeId); setContextMenu(null) }} style={{ ...ctxItem, color: 'var(--danger,#e03131)' }}>
              Eliminar nodo
            </button>
          </div>
        </>
      )}

      {/* Modal: guardar esta vista (posición+zoom) como nodo */}
      {saveModal && (
        <div onPointerDown={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) setSaveModal(false) }}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onPointerDown={(e) => e.stopPropagation()}
            style={{ background: 'var(--bg-elevated,#fff)', borderRadius: 14, padding: 20, width: 360, boxShadow: '0 12px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: 'var(--text,#222)' }}>Guardar esta vista como nodo</div>
            <input autoFocus value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Nombre del nodo…"
              onKeyDown={(e) => { if (e.key === 'Enter') { saveViewAsNode(saveName); setSaveModal(false) } if (e.key === 'Escape') setSaveModal(false) }}
              style={{ width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 9, border: '1px solid var(--border,#d8d8d8)', fontSize: 14, outline: 'none', background: 'var(--bg,#fff)', color: 'var(--text,#222)' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button onClick={() => setSaveModal(false)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border,#ddd)', background: 'transparent', cursor: 'pointer', color: 'var(--text,#333)' }}>Cancelar</button>
              <button onClick={() => { saveViewAsNode(saveName); setSaveModal(false) }} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: 'var(--accent,#6c5ce7)', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Guardar</button>
            </div>
          </div>
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
const toolBtnActive: React.CSSProperties = {
  ...toolBtn, background: 'var(--accent-soft, rgba(108,92,231,0.14))', color: 'var(--accent, #6c5ce7)',
}
const vSep: React.CSSProperties = {
  width: 1, height: 22, background: 'var(--border, #e2e2e2)', margin: '0 3px',
}
const gripStyle: React.CSSProperties = {
  position: 'absolute', left: -22, top: 1, width: 18, height: 22, cursor: 'grab',
  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary, #cbcbcb)',
}
const ctxItem: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 7,
  border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, color: 'var(--text,#333)',
}

