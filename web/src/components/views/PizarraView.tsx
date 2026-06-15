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
import { deleteGcalEventForNode, getGcalEventId } from '../../utils/gcalNodesSync'
import { getDayColumnData, isMovedNode } from '../../utils/dayColumn'
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
// Marcador de vista: nodo que guarda una posición+zoom para "volver a esta vista",
// pero NO se pinta como tarjeta en el lienzo (vive solo en la columna derecha).
const PIN_HIDDEN = '_pinHidden'

// Ancho del nodo en el lienzo — IGUAL al del flujo (FLOW_W) para que al arrastrar
// un nodo NO se encoja (mismo ancho flotante que en la columna/lista).
const CARD_W = 700
const CARD_MIN_H = 44
// Columna de FLUJO: dónde empieza la pila de nodos sin posición (coords de mundo).
const FLOW_X = 60
const FLOW_Y = 40
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

// ¿Es un marcador de vista (no se pinta en el lienzo)?
function isHiddenPin(node: Node): boolean {
  try { return JSON.parse(node.extraData || '{}')[PIN_HIDDEN] === '1' } catch { return false }
}

// Lee el zoom guardado del nodo (_pinScale). Default 1.
function readPinScale(node: Node): number {
  try {
    const s = Number(JSON.parse(node.extraData || '{}')[PIN_SCALE])
    return Number.isFinite(s) && s > 0 ? s : 1
  } catch { return 1 }
}
// Ancho de la tarjeta en la pizarra (_pinW, px de mundo). Default CARD_W.
function readCardW(node: Node): number {
  try {
    const w = Number(JSON.parse(node.extraData || '{}')._pinW)
    return Number.isFinite(w) && w >= 120 ? w : CARD_W
  } catch { return CARD_W }
}
// Escala uniforme de la tarjeta (_cardScale). Default 1.
function readCardScale(node: Node): number {
  try {
    const s = Number(JSON.parse(node.extraData || '{}')._cardScale)
    return Number.isFinite(s) && s > 0 ? s : 1
  } catch { return 1 }
}
// Escribe campos de tamaño (_pinW / _cardScale) preservando el resto.
function writeCardSize(node: Node, fields: { w?: number; scale?: number; pin?: WorldPos }) {
  let ed: Record<string, unknown> = {}
  try { ed = JSON.parse(node.extraData || '{}') } catch { /* vacío */ }
  if (fields.w != null) ed._pinW = String(Math.round(fields.w))
  if (fields.scale != null) ed._cardScale = String(Number(fields.scale.toFixed(3)))
  if (fields.pin) { ed._pinX = String(Math.round(fields.pin.x)); ed._pinY = String(Math.round(fields.pin.y)) }
  store.updateNode(node.id, { extraData: JSON.stringify(ed) })
}

// Escribe la posición en extraData preservando el resto de campos (patrón
// crítico: nunca sobrescribir extraData entero).
function writePin(node: Node, pos: WorldPos) {
  let ed: Record<string, unknown> = {}
  try { ed = JSON.parse(node.extraData || '{}') } catch { /* corrupto → vacío */ }
  ed[PIN_X] = String(Math.round(pos.x))
  ed[PIN_Y] = String(Math.round(pos.y))
  if (ed[PIN_SCALE] == null) ed[PIN_SCALE] = '1'
  delete ed[PIN_HIDDEN] // colocar un nodo en el lienzo lo hace visible (deja de ser marcador)
  delete ed._capture    // y lo gradúa de la bandeja «Capturas» a nodo del lienzo
  delete ed._moved      // y de «Movidos» (queda colocado en la nota)
  store.updateNode(node.id, { extraData: JSON.stringify(ed) })
}

// ¿Es una captura aún en la bandeja (no colocada en el lienzo)?
function isCapturePin(node: Node): boolean {
  try { return JSON.parse(node.extraData || '{}')._capture === '1' } catch { return false }
}

// Grupo al que pertenece un nodo (se mueve como unidad con sus compañeros).
function nodeGroupId(node: Node): string | null {
  try { return JSON.parse(node.extraData || '{}')._groupId || null } catch { return null }
}
function strokeBBox(s: WBStroke): { x0: number; y0: number; x1: number; y1: number } | null {
  if (!s.pts.length) return null
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (let i = 0; i + 1 < s.pts.length; i += 2) {
    x0 = Math.min(x0, s.pts[i]); x1 = Math.max(x1, s.pts[i])
    y0 = Math.min(y0, s.pts[i + 1]); y1 = Math.max(y1, s.pts[i + 1])
  }
  return { x0, y0, x1, y1 }
}

// ── Trazos (dibujo) — formato compatible con iPad (bloque ```from-pizarra```) ──
// Los trazos viven en el body del nodo-pizarra. `pts` = polilínea en MUNDO
// [x0,y0,x1,y1,…]; `w` = ancho en MUNDO (grosor constante: screenW = w*scale).
const FENCE = '```from-pizarra'
interface WBStroke { id: string; pts: number[]; w: number; c: string; e?: boolean; a?: number; k?: string; g?: string }
// Texto LIBRE del lienzo (compatible iPad): x,y mundo; size=fuente; w=ancho; md=texto.
interface WBText { id: string; x: number; y: number; size: number; w: number; md: string; c?: string }
interface WBData { version: number; strokes: WBStroke[]; texts?: WBText[]; tasks?: unknown[]; camX?: number; camY?: number; camScale?: number }

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

export default function PizarraView({ parentId, flowUnpositioned }: Props) {
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

  // Multiselección con marco (Cmd/Ctrl + arrastrar sobre el fondo).
  // multiSel = nodos seleccionados; selStrokes = trazos (dibujos) seleccionados.
  const [multiSel, setMultiSel] = useState<Set<string>>(new Set())
  const [selStrokes, setSelStrokes] = useState<Set<string>>(new Set())
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const marqueeRef = useRef<{ x0: number; y0: number } | null>(null)

  // Arrastre de GRUPO (mover varios elementos como unidad).
  const groupRef = useRef<{ gid: string; members: { id: string; origin: WorldPos }[]; strokeIds: string[]; strokeOrigins: Map<string, number[]> } | null>(null)
  const [groupDelta, setGroupDelta] = useState<WorldPos | null>(null)
  // Posición (pantalla) del mini-menú flotante de la selección (estilo iPad).
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null)
  // Menú rápido (clic derecho en el fondo): herramientas favoritas, estilo iPad.
  const [quickMenu, setQuickMenu] = useState<{ x: number; y: number; world: WorldPos } | null>(null)
  // Conjunto configurable de favoritos del menú rápido (CSV en localStorage).
  const [quickTools, setQuickTools] = useState<string[]>(() => {
    const raw = localStorage.getItem('pizarraQuickTools') || 'node,pen,eraser,select,undo'
    return raw.split(',').map(s => s.trim()).filter(Boolean)
  })
  const [quickCfg, setQuickCfg] = useState(false) // panel de configuración abierto
  const toggleQuickTool = (k: string) => {
    setQuickTools(prev => {
      const next = prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]
      localStorage.setItem('pizarraQuickTools', next.join(','))
      return next
    })
  }

  // Hover sobre una tarjeta de nodo (resaltado + manijas de redimensionado).
  const [hoverNode, setHoverNode] = useState<string | null>(null)
  // Redimensionado de tarjeta en curso: ancho (manija izquierda) o escala (esquina).
  const nodeRzRef = useRef<null | { id: string; mode: 'width' | 'scale'; startW: number; startScale: number; startPin: WorldPos; startWorld: WorldPos; cardH: number; moved: boolean }>(null)
  const nodeRzValRef = useRef<{ w: number; scale: number; pin: WorldPos } | null>(null)
  const [nodeRz, setNodeRz] = useState<null | { id: string; w: number; scale: number; pin: WorldPos }>(null)

  // Interacción de TRAZOS (con herramienta «seleccionar»): hover, mover, escalar.
  const [hoverStroke, setHoverStroke] = useState<string | null>(null)
  // Transformación en vivo de los trazos seleccionados (preview; commit al soltar).
  const xfRef = useRef<null | {
    kind: 'move' | 'scale'
    ids: string[]
    origin: Map<string, number[]>      // pts originales por id de trazo
    startWidth: Map<string, number>    // ancho original por id (para escalar)
    start: WorldPos
    anchor?: WorldPos                  // escalar: esquina opuesta (fija)
    corner?: WorldPos                  // escalar: esquina agarrada (original)
    moved: boolean
  }>(null)
  type XfVal = { kind: 'move'; dx: number; dy: number } | { kind: 'scale'; ax: number; ay: number; s: number }
  const [xf, setXf] = useState<XfVal | null>(null)
  const xfValRef = useRef<XfVal | null>(null)
  const setXfBoth = (v: XfVal) => { xfValRef.current = v; setXf(v) }
  const clearSelection = useCallback(() => { setMultiSel(new Set()); setSelStrokes(new Set()); setMenuPos(null) }, [])

  // Herramienta activa: select (mover/editar), pen (dibujar), eraser (borrar trazos).
  const [tool, setTool] = useState<'select' | 'pen' | 'eraser' | 'text'>('select')
  // Texto del lienzo en edición (id del WBText) y hover.
  const [editText, setEditText] = useState<string | null>(null)
  const [hoverText, setHoverText] = useState<string | null>(null)
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
      if (isHiddenPin(n)) continue // marcador de vista → no se pinta en el lienzo
      const pin = readPin(n)
      if (pin) map.set(n.id, pin)
    }
    return map
  }, [children])

  // FLUJO: nodos del día SIN posición → se apilan en una columna sobre el lienzo
  // (orden natural, sin solaparse). Los eventos GCal NO van al lienzo (viven en la
  // columna derecha). Al arrastrar uno del flujo gana pin y pasa a flotar.
  const flowNodes = useMemo(() => {
    if (!flowUnpositioned) return [] as Node[]
    // En la diaria, todo lo que vive en la columna derecha (eventos, capturas y
    // tareas/bucles del cockpit) NO se pinta en el lienzo (evita duplicados).
    const parent = store.getNode(parentId)
    const rightCol = parent?.isDiaryEntry ? getDayColumnData(parent).rightColumnIds : new Set<string>()
    // _moved → bloque «Movidos» de la nota (no en el lienzo hasta colocarlo).
    return children.filter(n => !isHiddenPin(n) && !readPin(n) && !rightCol.has(n.id) && !getGcalEventId(n) && !isCapturePin(n) && !isMovedNode(n))
  }, [children, flowUnpositioned, parentId])

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

  // Duplicar un nodo (texto + cuerpo + tipo + pin desplazado para no solaparse).
  // No copia identidad de Google Calendar (sería un evento fantasma).
  const duplicateNode = useCallback((id: string, offset: number): string | null => {
    const n = store.getNode(id); if (!n) return null
    let ed: Record<string, unknown> = {}
    try { ed = JSON.parse(n.extraData || '{}') } catch { /* corrupto */ }
    delete ed._gcalEventId; delete (ed as Record<string, unknown>).gcalEventId; delete ed._gcalSynced; delete ed._gcalColor
    const pin = readPin(n)
    if (pin) { ed[PIN_X] = String(Math.round(pin.x + offset)); ed[PIN_Y] = String(Math.round(pin.y + offset)) }
    const dup = store.createNode({
      text: n.text || '',
      parentId: n.parentId,
      siblingOrder: (n.siblingOrder ?? 0) + 0.25,
      types: n.types,
      extraData: Object.fromEntries(Object.entries(ed).map(([k, v]) => [k, String(v)])),
    })
    store.updateNode(dup.id, { status: n.status, priority: n.priority, body: n.body })
    return dup.id
  }, [])

  // ── Acciones sobre la selección (nodos + trazos) ──────────────────────────────
  const deleteSelection = useCallback(() => {
    for (const id of multiSel) {
      const n = store.getNode(id)
      if (n) deleteGcalEventForNode(n)
      store.deleteNode(id)
    }
    if (selStrokes.size) {
      const data = parsePizarra(store.getNode(parentId)?.body)
      data.strokes = data.strokes.filter(s => !selStrokes.has(s.id))
      store.updateNode(parentId, { body: bodyWithPizarra(store.getNode(parentId)?.body, data) })
    }
    clearSelection()
  }, [multiSel, selStrokes, parentId, clearSelection])

  const duplicateSelection = useCallback(() => {
    let i = 1
    for (const id of multiSel) duplicateNode(id, 24 * i++)
    if (selStrokes.size) {
      const data = parsePizarra(store.getNode(parentId)?.body)
      const dups = data.strokes.filter(s => selStrokes.has(s.id))
        .map(s => ({ ...s, id: rid(), g: undefined, pts: s.pts.map(v => v + 24) }))
      data.strokes = [...data.strokes, ...dups]
      store.updateNode(parentId, { body: bodyWithPizarra(store.getNode(parentId)?.body, data) })
    }
    clearSelection()
  }, [multiSel, selStrokes, parentId, duplicateNode, clearSelection])

  // Agrupar: los elementos seleccionados pasan a moverse como una unidad. Los
  // nodos del flujo se fijan (pin) en su sitio actual y reciben `_groupId`; los
  // trazos reciben `g`. Arrastrar cualquier miembro mueve a todo el grupo.
  const groupSelection = useCallback(() => {
    const gid = 'g' + rid()
    const rect = containerRef.current?.getBoundingClientRect()
    for (const id of multiSel) {
      const n = store.getNode(id); if (!n) continue
      let ed: Record<string, unknown> = {}
      try { ed = JSON.parse(n.extraData || '{}') } catch { /* vacío */ }
      if (readPin(n) == null && rect) {
        const el = containerRef.current?.querySelector(`[data-card][data-node-id="${id}"]`) as HTMLElement | null
        if (el) {
          const r = el.getBoundingClientRect()
          const w = screenToWorld(r.left - rect.left, r.top - rect.top)
          ed[PIN_X] = String(Math.round(w.x)); ed[PIN_Y] = String(Math.round(w.y))
          if (ed[PIN_SCALE] == null) ed[PIN_SCALE] = '1'
        }
      }
      ed._groupId = gid
      store.updateNode(id, { extraData: JSON.stringify(ed) })
    }
    if (selStrokes.size) {
      const data = parsePizarra(store.getNode(parentId)?.body)
      data.strokes = data.strokes.map(s => selStrokes.has(s.id) ? { ...s, g: gid } : s)
      store.updateNode(parentId, { body: bodyWithPizarra(store.getNode(parentId)?.body, data) })
    }
    clearSelection()
  }, [multiSel, selStrokes, parentId, screenToWorld, clearSelection])

  // ── Interacción de TRAZOS (herramienta «seleccionar») ─────────────────────────
  // Pointer down sobre un trazo → seleccionarlo (o conservar la multiselección si ya
  // estaba) e iniciar arrastre para MOVERLO.
  const onStrokePointerDown = useCallback((e: React.PointerEvent, sid: string) => {
    if (e.button !== 0 || toolRef.current !== 'select') return
    e.stopPropagation()
    if (flyRef.current) { cancelAnimationFrame(flyRef.current); flyRef.current = null }
    const all = parsePizarra(store.getNode(parentId)?.body).strokes
    const alreadySel = selStrokes.has(sid) && selStrokes.size > 1
    const ids = alreadySel ? [...selStrokes] : [sid]
    if (!alreadySel) { setMultiSel(new Set()); setSelStrokes(new Set([sid])); setMenuPos(null) }
    const origin = new Map<string, number[]>()
    const startWidth = new Map<string, number>()
    for (const s of all) if (ids.includes(s.id)) { origin.set(s.id, [...s.pts]); startWidth.set(s.id, s.w) }
    const rect = containerRef.current!.getBoundingClientRect()
    const start = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
    xfRef.current = { kind: 'move', ids, origin, startWidth, start, moved: false }
    containerRef.current!.setPointerCapture(e.pointerId)
    setXf({ kind: 'move', dx: 0, dy: 0 })
  }, [parentId, selStrokes, screenToWorld])

  // Pointer down en una manija de esquina → ESCALAR (uniforme) respecto a la esquina
  // opuesta (anclada). `corner` y `anchor` en coords de mundo.
  const onScaleHandlePointerDown = useCallback((e: React.PointerEvent, corner: WorldPos, anchor: WorldPos) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const all = parsePizarra(store.getNode(parentId)?.body).strokes
    const ids = [...selStrokes]
    const origin = new Map<string, number[]>()
    const startWidth = new Map<string, number>()
    for (const s of all) if (selStrokes.has(s.id)) { origin.set(s.id, [...s.pts]); startWidth.set(s.id, s.w) }
    const rect = containerRef.current!.getBoundingClientRect()
    const start = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
    xfRef.current = { kind: 'scale', ids, origin, startWidth, start, anchor, corner, moved: false }
    containerRef.current!.setPointerCapture(e.pointerId)
    setXf({ kind: 'scale', ax: anchor.x, ay: anchor.y, s: 1 })
  }, [parentId, selStrokes, screenToWorld])

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
        [PIN_HIDDEN]: '1', // marcador: solo en la columna, no se pinta en el lienzo
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

  // ── Textos LIBRES del lienzo (herramienta «Texto») ────────────────────────────
  const mutateTexts = useCallback((fn: (texts: WBText[]) => WBText[]) => {
    const data = parsePizarra(store.getNode(parentId)?.body)
    data.texts = fn(data.texts || [])
    store.updateNode(parentId, { body: bodyWithPizarra(store.getNode(parentId)?.body, data) })
  }, [parentId])

  const createTextAt = useCallback((world: WorldPos) => {
    const id = 't' + rid()
    mutateTexts(texts => [...texts, { id, x: world.x, y: world.y, size: 16, w: 360, md: '' }])
    setTool('select')
    setEditText(id)
  }, [mutateTexts])

  const updateTextMd = useCallback((id: string, md: string) => {
    mutateTexts(texts => texts.map(t => t.id === id ? { ...t, md } : t))
  }, [mutateTexts])

  const deleteText = useCallback((id: string) => {
    mutateTexts(texts => texts.filter(t => t.id !== id))
    setEditText(e => e === id ? null : e)
  }, [mutateTexts])

  // Persistencia diferida del texto mientras se escribe (evita reescribir el body
  // en cada tecla; el textarea es no-controlado para no perder el cursor).
  const textPersistTimer = useRef<number | null>(null)
  const scheduleTextPersist = useCallback((id: string, md: string) => {
    if (textPersistTimer.current) clearTimeout(textPersistTimer.current)
    textPersistTimer.current = window.setTimeout(() => updateTextMd(id, md), 600)
  }, [updateTextMd])

  // contentEditable del texto en edición: cargar HTML y enfocar al entrar en edición.
  const editDivRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!editText) return
    const el = editDivRef.current
    if (!el) return
    const t = parsePizarra(store.getNode(parentId)?.body).texts?.find(x => x.id === editText)
    el.innerHTML = t?.md || ''
    el.focus()
    const sel = window.getSelection(); const range = document.createRange()
    range.selectNodeContents(el); range.collapse(false); sel?.removeAllRanges(); sel?.addRange(range)
  }, [editText, parentId])
  const fmt = (cmd: string, val?: string) => { editDivRef.current?.focus(); document.execCommand(cmd, false, val) }

  // Promociona un texto libre a NODO (documento): crea un nodo con ese texto fijado
  // en su posición y elimina el texto del lienzo. El dot del hover lo dispara.
  const promoteTextToNode = useCallback((t: WBText) => {
    // El texto puede llevar HTML (negritas, etc.) → pasar a texto plano para el nodo.
    const tmp = document.createElement('div'); tmp.innerHTML = t.md
    const plain = (tmp.textContent || '').trim()
    const lines = plain.split('\n')
    const node = store.createNode({
      text: lines[0] || 'Nota',
      parentId,
      extraData: {
        [PIN_X]: String(Math.round(t.x)),
        [PIN_Y]: String(Math.round(t.y)),
        [PIN_SCALE]: String(Number(camRef.current.scale.toFixed(4))),
      },
    })
    const body = lines.slice(1).join('\n').trim()
    if (body) store.updateNode(node.id, { body })
    deleteText(t.id)
    setSelectedId(node.id)
  }, [parentId, deleteText])

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
    // Texto: NO crear aquí (en pointerdown) para no provocar un blur inmediato del
    // textarea. Se crea en el onClick del contenedor (gesto completo). Solo evitamos
    // que arranque el pan.
    if (toolRef.current === 'text') return
    // Multiselección con marco: Cmd (⌘) / Ctrl + arrastrar sobre el fondo.
    if (e.metaKey || e.ctrlKey) {
      el.setPointerCapture(e.pointerId)
      marqueeRef.current = { x0: e.clientX, y0: e.clientY }
      setMarquee({ x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY })
      clearSelection()
      setSelectedId(null)
      return
    }
    setSelectedId(null)
    clearSelection()
    el.setPointerCapture(e.pointerId)
    panRef.current = { startX: e.clientX, startY: e.clientY, camX: cam.x, camY: cam.y, moved: false }
  }, [cam, screenToWorld, eraseAt, createTextAt, clearSelection])

  // ── Doble clic en el fondo → crear nodo ahí ─────────────────────────────────
  const onBackgroundDoubleClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).dataset.bg !== '1') return
    const rect = containerRef.current!.getBoundingClientRect()
    createNodeAt(screenToWorld(e.clientX - rect.left, e.clientY - rect.top))
  }, [createNodeAt, screenToWorld])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    // Redimensionado de tarjeta (ancho / escala) en curso → preview.
    if (nodeRzRef.current) {
      const r = nodeRzRef.current
      const rect = containerRef.current!.getBoundingClientRect()
      const w = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
      if (Math.abs(w.x - r.startWorld.x) + Math.abs(w.y - r.startWorld.y) > 1) r.moved = true
      let val: { w: number; scale: number; pin: WorldPos }
      if (r.mode === 'width') {
        const rightEdge = r.startPin.x + r.startW * r.startScale
        const newW = Math.max(120, r.startW - (w.x - r.startWorld.x) / r.startScale)
        val = { w: newW, scale: r.startScale, pin: { x: rightEdge - newW * r.startScale, y: r.startPin.y } }
      } else {
        const d0 = Math.hypot(r.startW * r.startScale, r.cardH * r.startScale) || 1
        const d1 = Math.hypot(w.x - r.startPin.x, w.y - r.startPin.y)
        val = { w: r.startW, scale: Math.max(0.2, r.startScale * d1 / d0), pin: r.startPin }
      }
      nodeRzValRef.current = val
      setNodeRz({ id: r.id, ...val })
      return
    }
    // Transformación de trazos (mover / escalar) en curso → preview.
    if (xfRef.current) {
      const t = xfRef.current
      const rect = containerRef.current!.getBoundingClientRect()
      const w = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
      if (Math.abs(w.x - t.start.x) * cam.scale + Math.abs(w.y - t.start.y) * cam.scale > 3) t.moved = true
      if (t.kind === 'move') {
        setXfBoth({ kind: 'move', dx: w.x - t.start.x, dy: w.y - t.start.y })
      } else if (t.anchor && t.corner) {
        const d0 = Math.hypot(t.corner.x - t.anchor.x, t.corner.y - t.anchor.y) || 1
        const d1 = Math.hypot(w.x - t.anchor.x, w.y - t.anchor.y)
        setXfBoth({ kind: 'scale', ax: t.anchor.x, ay: t.anchor.y, s: Math.max(0.05, d1 / d0) })
      }
      return
    }
    // Marco de multiselección en curso → actualizar rect y marcar tarjetas dentro.
    if (marqueeRef.current) {
      const m = marqueeRef.current
      setMarquee({ x0: m.x0, y0: m.y0, x1: e.clientX, y1: e.clientY })
      const rx0 = Math.min(m.x0, e.clientX), rx1 = Math.max(m.x0, e.clientX)
      const ry0 = Math.min(m.y0, e.clientY), ry1 = Math.max(m.y0, e.clientY)
      const sel = new Set<string>()
      containerRef.current?.querySelectorAll('[data-card][data-node-id]').forEach(el => {
        const r = (el as HTMLElement).getBoundingClientRect()
        if (r.left < rx1 && r.right > rx0 && r.top < ry1 && r.bottom > ry0) {
          const id = (el as HTMLElement).getAttribute('data-node-id')
          if (id) sel.add(id)
        }
      })
      setMultiSel(sel)
      // Trazos (dibujos): probar su bbox contra el marco en coords de MUNDO.
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        const a = screenToWorld(rx0 - rect.left, ry0 - rect.top)
        const b = screenToWorld(rx1 - rect.left, ry1 - rect.top)
        const wx0 = Math.min(a.x, b.x), wx1 = Math.max(a.x, b.x)
        const wy0 = Math.min(a.y, b.y), wy1 = Math.max(a.y, b.y)
        const ss = new Set<string>()
        for (const s of parsePizarra(store.getNode(parentId)?.body).strokes) {
          const bb = strokeBBox(s)
          if (bb && bb.x0 < wx1 && bb.x1 > wx0 && bb.y0 < wy1 && bb.y1 > wy0) ss.add(s.id)
        }
        setSelStrokes(ss)
      }
      return
    }
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
      // Grupo: el resto de miembros y los trazos se desplazan el mismo delta.
      if (groupRef.current) setGroupDelta({ x: nx - d.origin.x, y: ny - d.origin.y })
      return
    }
  }, [cam.scale, layout, screenToWorld, eraseAt])

  const endPointer = useCallback((e: React.PointerEvent) => {
    // Fin de redimensionado de tarjeta: persistir _pinW / _cardScale (+ pin).
    if (nodeRzRef.current) {
      const r = nodeRzRef.current
      const val = nodeRzValRef.current
      nodeRzRef.current = null
      nodeRzValRef.current = null
      try { containerRef.current?.releasePointerCapture(e.pointerId) } catch { /* noop */ }
      if (r.moved && val) {
        const n = store.getNode(r.id)
        if (n) writeCardSize(n, r.mode === 'width' ? { w: val.w, pin: val.pin } : { scale: val.scale })
      }
      setNodeRz(null)
      return
    }
    // Fin de transformación de trazos (mover / escalar): persistir en el body.
    if (xfRef.current) {
      const t = xfRef.current
      xfRef.current = null
      try { containerRef.current?.releasePointerCapture(e.pointerId) } catch { /* noop */ }
      const cur = xfValRef.current
      xfValRef.current = null
      if (t.moved && cur) {
        const data = parsePizarra(store.getNode(parentId)?.body)
        data.strokes = data.strokes.map(s => {
          const orig = t.origin.get(s.id); if (!orig) return s
          if (cur.kind === 'move') {
            return { ...s, pts: orig.map((v, i) => i % 2 === 0 ? v + cur.dx : v + cur.dy) }
          }
          // scale uniforme respecto al ancla
          const w0 = t.startWidth.get(s.id) ?? s.w
          return { ...s, w: Math.max(0.2, w0 * cur.s), pts: orig.map((v, i) => i % 2 === 0 ? cur.ax + (v - cur.ax) * cur.s : cur.ay + (v - cur.ay) * cur.s) }
        })
        store.updateNode(parentId, { body: bodyWithPizarra(store.getNode(parentId)?.body, data) })
      } else if (t.kind === 'move') {
        // Clic limpio (sin arrastrar) sobre un trazo → mini-menú duplicar/eliminar.
        setMenuPos({ x: e.clientX, y: e.clientY })
      }
      setXf(null)
      return
    }
    // Fin del marco de multiselección: dejar la selección, ocultar el marco.
    if (marqueeRef.current) {
      const m = marqueeRef.current
      marqueeRef.current = null
      try { containerRef.current?.releasePointerCapture(e.pointerId) } catch { /* noop */ }
      setMarquee(null)
      // Mini-menú arriba-centro del marco (solo si hay algo seleccionado — el
      // render lo condiciona al tamaño de la selección).
      setMenuPos({ x: (m.x0 + e.clientX) / 2, y: Math.min(m.y0, e.clientY) })
      return
    }
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
      const grp = groupRef.current
      dragRef.current = null
      groupRef.current = null
      try { containerRef.current?.releasePointerCapture(e.pointerId) } catch { /* noop */ }
      setGuides({})
      const node = store.getNode(d.id)
      if (d.moved && dp && grp) {
        // Commit del GRUPO: mueve todos los nodos y trazos el mismo delta.
        const dx = dp.pos.x - d.origin.x, dy = dp.pos.y - d.origin.y
        for (const m of grp.members) {
          const n = store.getNode(m.id)
          if (n) writePin(n, { x: m.origin.x + dx, y: m.origin.y + dy })
        }
        if (grp.strokeIds.length) {
          const data = parsePizarra(store.getNode(parentId)?.body)
          data.strokes = data.strokes.map(s => {
            const orig = grp.strokeOrigins.get(s.id)
            if (!orig) return s
            return { ...s, pts: orig.map((v, i) => i % 2 === 0 ? v + dx : v + dy) }
          })
          store.updateNode(parentId, { body: bodyWithPizarra(store.getNode(parentId)?.body, data) })
        }
      } else if (d.moved && dp) {
        if (node) writePin(node, dp.pos)
      } else if (node) {
        // Clic limpio en el tirador (sin arrastrar) → seleccionar + mini-menú.
        setSelStrokes(new Set()); setMultiSel(new Set([node.id]))
        setMenuPos({ x: e.clientX, y: e.clientY })
      }
      setDragPos(null)
      setGroupDelta(null)
    }
  }, [dragPos, flyToNode, commitStroke, parentId])

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

    // Si el nodo está AGRUPADO → preparar arrastre de grupo (mueve a todos juntos).
    const gid = nodeGroupId(node)
    if (gid) {
      const members: { id: string; origin: WorldPos }[] = []
      for (const c of store.children(parentId)) {
        if (nodeGroupId(c) !== gid) continue
        const p = readPin(c); if (p) members.push({ id: c.id, origin: p })
      }
      const strokeOrigins = new Map<string, number[]>()
      const strokeIds: string[] = []
      for (const s of parsePizarra(store.getNode(parentId)?.body).strokes) {
        if (s.g === gid) { strokeIds.push(s.id); strokeOrigins.set(s.id, [...s.pts]) }
      }
      groupRef.current = { gid, members, strokeIds, strokeOrigins }
      setGroupDelta({ x: 0, y: 0 })
    } else {
      groupRef.current = null
      setGroupDelta(null)
    }
  }, [layout, screenToWorld, parentId])

  // Pointer down sobre la TARJETA: arrastra el nodo desde cualquier zona libre
  // (debajo/derecha/izquierda del texto). NO arrastra si se pincha sobre el texto
  // editable o un control (dot, checkbox, badges, botones) → deja editar/activar.
  const onCardAreaPointerDown = useCallback((e: React.PointerEvent, node: Node) => {
    if (e.button !== 0) return
    const t = e.target as HTMLElement
    if (t.closest('.node-text, .bullet-btn, button, a, input, textarea, select, [contenteditable="true"], .node-due-badge, .node-qp-badge, .node-date-actions, .node-priority-dot, [class*="ghost"], [class*="chip"]')) return
    onCardPointerDown(e, node)
  }, [onCardPointerDown])

  // ── Redimensionado de TARJETA: manija izquierda (ancho) o esquina (escala) ──
  const onNodeResizeDown = useCallback((e: React.PointerEvent, node: Node, mode: 'width' | 'scale') => {
    if (e.button !== 0) return
    e.stopPropagation()
    const pin = readPin(node) || { x: 0, y: 0 }
    const cardEl = (e.currentTarget as HTMLElement).closest('[data-card]') as HTMLElement | null
    const cardH = cardEl ? cardEl.offsetHeight : CARD_MIN_H
    const rect = containerRef.current!.getBoundingClientRect()
    const startWorld = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
    nodeRzRef.current = { id: node.id, mode, startW: readCardW(node), startScale: readCardScale(node), startPin: pin, startWorld, cardH, moved: false }
    nodeRzValRef.current = null
    containerRef.current!.setPointerCapture(e.pointerId)
    setNodeRz({ id: node.id, w: readCardW(node), scale: readCardScale(node), pin })
  }, [screenToWorld])

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
      onClick={(e) => {
        // Herramienta Texto: clic completo en el fondo → crear texto libre y editar.
        if (toolRef.current !== 'text') return
        if ((e.target as HTMLElement).dataset.bg !== '1') return
        const rect = containerRef.current!.getBoundingClientRect()
        createTextAt(screenToWorld(e.clientX - rect.left, e.clientY - rect.top))
      }}
      onDoubleClick={onBackgroundDoubleClick}
      onContextMenu={(e) => {
        // Clic derecho en el FONDO (no sobre una tarjeta) → menú rápido (estilo iPad).
        if ((e.target as HTMLElement).dataset.bg !== '1') return
        e.preventDefault()
        const rect = containerRef.current!.getBoundingClientRect()
        setQuickMenu({ x: e.clientX, y: e.clientY, world: screenToWorld(e.clientX - rect.left, e.clientY - rect.top) })
      }}
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
        cursor: panRef.current ? 'grabbing' : (tool === 'pen' || tool === 'eraser' ? 'crosshair' : tool === 'text' ? 'text' : 'default'),
        borderRadius: 8,
        animation: 'pizarra-dive 0.28s ease-out',
      }}
    >
      {/* En la tarjeta el ÚNICO tirador de arrastre es el de la izquierda → ocultar
          el tirador interno del OutlinerNode (node-drag-handle) para no duplicar. */}
      <style>{`/* En la pizarra el tirador ⋮⋮ y los "..." sobran: arrastra desde cualquier
   zona libre de la tarjeta; clic derecho = menú. */
.pizarra-card-body .node-drag-handle{display:none!important}
.pizarra-card-body .node-three-dot-btn{display:none!important}
/* El texto NO llena la tarjeta → deja hueco libre (derecha) para arrastrar.
   min-width para que un nodo vacío/corto siga teniendo zona clicable de edición. */
.pizarra-card-body .node-text{flex:0 1 auto!important;min-width:160px}
.pizarra-card-body{padding:4px 6px 8px}
.pizarra-node--sel{box-shadow:0 0 0 2px var(--accent,#6c5ce7);border-radius:8px;background:rgba(108,92,231,0.06)}
.pizarra-node--hover{box-shadow:0 0 0 1.5px rgba(108,92,231,0.45);border-radius:8px}
.pizarra-node--grouped{outline:1px dashed rgba(108,92,231,0.5);outline-offset:3px;border-radius:6px}
.pizarra-card-body .node-row{align-items:flex-start!important}
/* Cursor: el texto editable mantiene el de texto; el resto, "agarrar". */
.pizarra-card-body .node-text{cursor:text}
/* Texto SUELTO del lienzo: sin caja, fondo transparente, WYSIWYG. */
.pizarra-text{caret-color:var(--accent,#6c5ce7)}
.pizarra-text:empty::before{content:'Texto…';opacity:.4;pointer-events:none}
.pizarra-text h1{font-size:1.7em;font-weight:700;margin:.15em 0;line-height:1.25}
.pizarra-text h2{font-size:1.35em;font-weight:700;margin:.15em 0;line-height:1.3}
.pizarra-text ul,.pizarra-text ol{margin:.2em 0;padding-left:1.4em}
.pizarra-text:focus{outline:none}
@keyframes pizarra-dive{from{opacity:0;transform:scale(1.06)}to{opacity:1;transform:scale(1)}}`}</style>

      {/* ── Capa de trazos (dibujo). Con herramienta «seleccionar» son interactivos
             (hover, clic-seleccionar, arrastrar para mover). ── */}
      <svg width={viewport.w} height={viewport.h} style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        {parsePizarra(store.getNode(parentId)?.body).strokes.map(s => {
          const selected = selStrokes.has(s.id)
          const hovered = hoverStroke === s.id
          // pts mostrados: arrastre de grupo, o transformación (mover/escalar) si el trazo
          // está seleccionado, o los originales.
          let pts = s.pts
          let widthMul = 1
          if (groupDelta && groupRef.current?.strokeIds.includes(s.id)) {
            pts = s.pts.map((v, i) => i % 2 === 0 ? v + groupDelta.x : v + groupDelta.y)
          } else if (selected && xf) {
            if (xf.kind === 'move') pts = s.pts.map((v, i) => i % 2 === 0 ? v + xf.dx : v + xf.dy)
            else { pts = s.pts.map((v, i) => i % 2 === 0 ? xf.ax + (v - xf.ax) * xf.s : xf.ay + (v - xf.ay) * xf.s); widthMul = xf.s }
          }
          let d = ''
          for (let i = 0; i + 1 < pts.length; i += 2) {
            d += (i === 0 ? 'M' : 'L') + (cam.x + pts[i] * cam.scale).toFixed(1) + ' ' + (cam.y + pts[i + 1] * cam.scale).toFixed(1) + ' '
          }
          const sw = Math.max(0.4, s.w * widthMul * cam.scale)
          return (
            <g key={s.id}>
              {(selected || (hovered && tool === 'select')) && <path d={d} fill="none" stroke="var(--accent,#6c5ce7)" strokeWidth={sw + 6} strokeOpacity={selected ? 0.25 : 0.18} strokeLinecap="round" strokeLinejoin="round" />}
              <path d={d} fill="none" stroke={s.c || '#222'} strokeWidth={sw} strokeOpacity={s.a ?? 1} strokeLinecap="round" strokeLinejoin="round" />
              {tool === 'select' && (
                <path
                  d={d} fill="none" stroke="transparent" strokeWidth={Math.max(16, sw + 14)}
                  style={{ pointerEvents: 'stroke', cursor: selected ? 'move' : 'pointer' }}
                  onPointerEnter={() => { if (!xfRef.current && !marqueeRef.current && !panRef.current) setHoverStroke(s.id) }}
                  onPointerLeave={() => setHoverStroke(h => h === s.id ? null : h)}
                  onPointerDown={(e) => onStrokePointerDown(e, s.id)}
                  onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setMultiSel(new Set()); setSelStrokes(new Set([s.id])); setMenuPos({ x: e.clientX, y: e.clientY }) }}
                />
              )}
            </g>
          )
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

      {/* Recuadro de selección de trazos + manijas de esquina (ampliar/reducir). */}
      {tool === 'select' && selStrokes.size > 0 && (() => {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
        for (const s of parsePizarra(store.getNode(parentId)?.body).strokes) {
          if (!selStrokes.has(s.id)) continue
          let pts = s.pts
          if (xf) {
            if (xf.kind === 'move') pts = s.pts.map((v, i) => i % 2 === 0 ? v + xf.dx : v + xf.dy)
            else pts = s.pts.map((v, i) => i % 2 === 0 ? xf.ax + (v - xf.ax) * xf.s : xf.ay + (v - xf.ay) * xf.s)
          }
          for (let i = 0; i + 1 < pts.length; i += 2) { x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]); y0 = Math.min(y0, pts[i + 1]); y1 = Math.max(y1, pts[i + 1]) }
        }
        if (!isFinite(x0)) return null
        const S = cam.scale
        const sx0 = cam.x + x0 * S, sy0 = cam.y + y0 * S, sx1 = cam.x + x1 * S, sy1 = cam.y + y1 * S
        const corners = [
          { wx: x0, wy: y0, ax: x1, ay: y1, sx: sx0, sy: sy0, cur: 'nwse-resize' },
          { wx: x1, wy: y0, ax: x0, ay: y1, sx: sx1, sy: sy0, cur: 'nesw-resize' },
          { wx: x0, wy: y1, ax: x1, ay: y0, sx: sx0, sy: sy1, cur: 'nesw-resize' },
          { wx: x1, wy: y1, ax: x0, ay: y0, sx: sx1, sy: sy1, cur: 'nwse-resize' },
        ]
        return (
          <>
            <div style={{ position: 'absolute', left: Math.min(sx0, sx1) - 4, top: Math.min(sy0, sy1) - 4, width: Math.abs(sx1 - sx0) + 8, height: Math.abs(sy1 - sy0) + 8, border: '1px dashed var(--accent,#6c5ce7)', borderRadius: 3, pointerEvents: 'none', zIndex: 6 }} />
            {corners.map((c, i) => (
              <div key={i}
                onPointerDown={(e) => onScaleHandlePointerDown(e, { x: c.wx, y: c.wy }, { x: c.ax, y: c.ay })}
                style={{ position: 'absolute', left: c.sx - 6, top: c.sy - 6, width: 12, height: 12, background: '#fff', border: '2px solid var(--accent,#6c5ce7)', borderRadius: 3, cursor: c.cur, zIndex: 7, touchAction: 'none' }}
              />
            ))}
          </>
        )
      })()}

      {/* Marco de multiselección (Cmd/Ctrl + arrastrar) */}
      {marquee && (
        <div style={{
          position: 'fixed',
          left: Math.min(marquee.x0, marquee.x1),
          top: Math.min(marquee.y0, marquee.y1),
          width: Math.abs(marquee.x1 - marquee.x0),
          height: Math.abs(marquee.y1 - marquee.y0),
          background: 'rgba(108,92,231,0.10)',
          border: '1px solid var(--accent, #6c5ce7)',
          borderRadius: 4, zIndex: 50, pointerEvents: 'none',
        }} />
      )}

      {/* Mini-menú flotante de la selección (estilo iPad): duplicar / eliminar /
          agrupar (si hay más de un elemento). Aparece tras soltar el marco. */}
      {menuPos && !marquee && !dragPos && (multiSel.size + selStrokes.size) > 0 && (
        <div style={{
          position: 'fixed', left: menuPos.x, top: Math.max(8, menuPos.y - 46), transform: 'translateX(-50%)',
          zIndex: 1500, display: 'flex', gap: 2, padding: 4,
          background: 'var(--bg-elevated,#fff)', border: '1px solid var(--border,#e2e2e2)',
          borderRadius: 12, boxShadow: '0 8px 28px rgba(0,0,0,0.16)',
        }}>
          {(multiSel.size + selStrokes.size) > 1 && (
            <button style={miniItem} onClick={() => groupSelection()}>Agrupar</button>
          )}
          <button style={miniItem} onClick={() => duplicateSelection()}>Duplicar</button>
          <button style={{ ...miniItem, color: 'var(--danger,#e03131)' }} onClick={() => deleteSelection()}>Eliminar</button>
        </div>
      )}

      {/* Menú rápido (clic derecho en el fondo) — herramientas favoritas
          CONFIGURABLES (estilo iPad). El engranaje abre la lista para elegir cuáles. */}
      {quickMenu && (() => {
        const runQuick = (key: string) => {
          switch (key) {
            case 'node': createNodeAt(quickMenu.world); break
            case 'pen': setTool('pen'); break
            case 'eraser': setTool('eraser'); break
            case 'select': setTool('select'); break
            case 'undo': store.undo(); break
            case 'redo': store.redo(); break
            case 'today': { const day = ensureDayPath(new Date()); navigate(`/node/${day.id}`); setCam({ x: 60, y: 60, scale: 1 }); window.dispatchEvent(new CustomEvent('from:open-day-panel')); break }
            case 'saveView': setSaveName(''); setSaveModal(true); break
          }
          setQuickMenu(null)
        }
        const isActive = (k: string) => (k === 'pen' || k === 'eraser' || k === 'select') && tool === k
        const isDisabled = (k: string) => (k === 'undo' && !store.canUndo) || (k === 'redo' && !store.canRedo)
        return (
          <>
            <div onPointerDown={() => { setQuickMenu(null); setQuickCfg(false) }} onContextMenu={(e) => { e.preventDefault(); setQuickMenu(null); setQuickCfg(false) }} style={{ position: 'fixed', inset: 0, zIndex: 1599 }} />
            <div style={{ position: 'fixed', left: quickMenu.x, top: Math.max(8, quickMenu.y - 52), transform: 'translateX(-50%)', zIndex: 1600 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 2, padding: 5,
                background: 'var(--bg-elevated,#fff)', border: '1px solid var(--border,#e2e2e2)',
                borderRadius: 999, boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
              }}>
                {quickTools.map(k => (
                  <button key={k} style={isDisabled(k) ? quickBtnDisabled : (isActive(k) ? quickBtnActive : quickBtn)} disabled={isDisabled(k)} title={QUICK_LABEL[k]} onClick={() => runQuick(k)}>
                    {QUICK_ICON[k]}
                  </button>
                ))}
                <div style={{ width: 1, height: 22, background: 'var(--border,#e2e2e2)', margin: '0 2px' }} />
                <button style={quickCfg ? quickBtnActive : quickBtn} title="Configurar accesos" onClick={() => setQuickCfg(c => !c)}>
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="10" cy="10" r="2.4"/><path d="M10 1.6v2M10 16.4v2M3.6 10h-2M18.4 10h-2M5.2 5.2 3.8 3.8M16.2 16.2l-1.4-1.4M14.8 5.2l1.4-1.4M3.8 16.2l1.4-1.4"/></svg>
                </button>
              </div>
              {quickCfg && (
                <div style={{
                  marginTop: 6, padding: 6, minWidth: 180,
                  background: 'var(--bg-elevated,#fff)', border: '1px solid var(--border,#e2e2e2)',
                  borderRadius: 12, boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
                }} onPointerDown={(e) => e.stopPropagation()}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary,#888)', padding: '4px 8px 6px' }}>Accesos del menú rápido</div>
                  {QUICK_ALL.map(k => {
                    const on = quickTools.includes(k)
                    return (
                      <button key={k} onClick={() => toggleQuickTool(k)} style={{
                        display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left',
                        border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px 8px',
                        borderRadius: 8, fontSize: 13, color: 'var(--text,#333)',
                      }}>
                        <span style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${on ? 'var(--accent,#6c5ce7)' : 'var(--border,#ccc)'}`, background: on ? 'var(--accent,#6c5ce7)' : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, flexShrink: 0 }}>{on ? '✓' : ''}</span>
                        <span style={{ width: 20, display: 'inline-flex', justifyContent: 'center', color: 'var(--accent,#6c5ce7)' }}>{QUICK_ICON[k]}</span>
                        {QUICK_LABEL[k]}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )
      })()}

      {/* Tarjetas visibles (culling aplicado). Cada tarjeta embebe un OutlinerNode
          REAL → hereda dot en hover, Magic, predictivo de fecha, anticipación, etc.
          Escala por transform (contenido a tamaño de mundo). Se arrastra por el
          tirador izquierdo (no por el texto, para no chocar con el cursor sagrado). */}
      {/* Nodos COLOCADOS (con pin) → flotan libres aquí. Los nodos SIN posición se
          apilan en una columna de FLUJO sobre el lienzo (más abajo). Los eventos GCal
          son la excepción: viven en la columna derecha, no en el lienzo. */}

      {/* ── FLOTANTES: nodos colocados + el que se arrastra ahora ── */}
      {visible.map(({ node, pos }) => {
        // Miembro de un grupo en arrastre (que NO es el agarrado) → se desplaza el delta.
        let p = pos
        if (groupDelta && groupRef.current && node.id !== dragPos?.id) {
          const m = groupRef.current.members.find(mm => mm.id === node.id)
          if (m) p = { x: m.origin.x + groupDelta.x, y: m.origin.y + groupDelta.y }
        }
        // Tamaño: ancho (_pinW) y escala (_cardScale), con preview en vivo si se redimensiona.
        const live = nodeRz?.id === node.id ? nodeRz : null
        if (live) p = live.pin
        const cardW = live ? live.w : readCardW(node)
        const cardScale = live ? live.scale : readCardScale(node)
        const sx = cam.x + p.x * cam.scale
        const sy = cam.y + p.y * cam.scale
        const grouped = nodeGroupId(node) != null
        const hovered = hoverNode === node.id && tool === 'select'
        const showHandles = (hovered || selectedId === node.id) && !dragPos
        return (
          <div key={node.id} data-card="1" data-node-id={node.id} className={`pizarra-node${multiSel.has(node.id) ? ' pizarra-node--sel' : ''}${grouped ? ' pizarra-node--grouped' : ''}${hovered ? ' pizarra-node--hover' : ''}`}
            onPointerEnter={() => { if (tool === 'select' && !dragPos && !nodeRzRef.current) setHoverNode(node.id) }}
            onPointerLeave={() => setHoverNode(h => h === node.id ? null : h)}
            onPointerDown={(e) => onCardAreaPointerDown(e, node)}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ nodeId: node.id, x: e.clientX, y: e.clientY }) }}
            style={{ position: 'absolute', left: sx, top: sy, width: cardW, transform: `scale(${cam.scale * cardScale})`, transformOrigin: '0 0', zIndex: (dragPos?.id === node.id || live) ? 10 : (hovered ? 4 : 1), cursor: 'grab' }}>
            <div className="pizarra-card-body" style={{ minWidth: 0 }}>
              <OutlinerNode node={node} depth={0} isSelected={selectedId === node.id} selectedId={selectedId} isMultiSelected={false} onSelect={setSelectedId} onSelectNext={() => {}} onShiftSelect={() => {}} filterText="" flat />
            </div>
            {showHandles && (
              <>
                {/* Manija de ANCHURA — borde izquierdo, a media altura. Arrastra → reajusta ancho y salto de línea. */}
                <div title="Ancho" onPointerDown={(e) => onNodeResizeDown(e, node, 'width')}
                  style={{ position: 'absolute', left: -5, top: '50%', width: 8, height: 30, marginTop: -15, background: 'var(--accent,#6c5ce7)', borderRadius: 4, cursor: 'ew-resize', opacity: 0.85, touchAction: 'none' }} />
                {/* Manija de ESCALA — esquina inferior derecha (escala uniforme desde arriba-izquierda). */}
                <div title="Escalar" onPointerDown={(e) => onNodeResizeDown(e, node, 'scale')}
                  style={{ position: 'absolute', right: -6, bottom: -6, width: 12, height: 12, background: '#fff', border: '2px solid var(--accent,#6c5ce7)', borderRadius: 3, cursor: 'nwse-resize', touchAction: 'none' }} />
              </>
            )}
          </div>
        )
      })}

      {/* ── TEXTOS LIBRES del lienzo (herramienta «Texto»). Hover → dot que lo
             convierte en NODO. Doble clic → editar. Clic derecho → eliminar. ── */}
      {(parsePizarra(store.getNode(parentId)?.body).texts || []).map(t => {
        const sx = cam.x + t.x * cam.scale
        const sy = cam.y + t.y * cam.scale
        const editing = editText === t.id
        const hovered = hoverText === t.id && tool === 'select'
        return (
          <div key={t.id} data-card="1"
            style={{ position: 'absolute', left: sx, top: sy, width: t.w, transform: `scale(${cam.scale})`, transformOrigin: '0 0', zIndex: editing ? 20 : (hovered ? 5 : 2), pointerEvents: (tool === 'select' || tool === 'text' || editing) ? 'auto' : 'none' }}
            onPointerEnter={() => { if (tool === 'select' && !editing) setHoverText(t.id) }}
            onPointerLeave={() => setHoverText(h => h === t.id ? null : h)}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); deleteText(t.id) }}>
            {/* DOT pequeño arriba-izquierda (hover) → convertir en nodo/documento */}
            {(hovered || editing) && (
              <div title="Convertir en nodo" onPointerDown={(e) => { e.stopPropagation(); promoteTextToNode(t) }}
                style={{ position: 'absolute', left: -14, top: -2, width: 9, height: 9, borderRadius: '50%', border: '1.5px solid var(--accent,#6c5ce7)', background: '#fff', cursor: 'pointer' }} />
            )}
            {/* Texto SUELTO, sin caja, fondo transparente. WYSIWYG al editar. */}
            <div
              ref={editing ? editDivRef : undefined}
              className="pizarra-text"
              contentEditable={editing}
              suppressContentEditableWarning
              onDoubleClick={(e) => { if (!editing) { e.stopPropagation(); setEditText(t.id) } }}
              onInput={editing ? (e) => scheduleTextPersist(t.id, (e.target as HTMLElement).innerHTML) : undefined}
              onBlur={editing ? (e) => { const html = (e.target as HTMLElement).innerHTML; updateTextMd(t.id, html); if (!(e.target as HTMLElement).textContent?.trim()) deleteText(t.id); setEditText(null) } : undefined}
              onPointerDown={editing ? (e) => e.stopPropagation() : undefined}
              onKeyDown={editing ? (e) => { if (e.key === 'Escape') (e.target as HTMLElement).blur() } : undefined}
              dangerouslySetInnerHTML={editing ? undefined : { __html: t.md || '<span style="opacity:.4">Texto…</span>' }}
              style={{ fontSize: t.size, lineHeight: 1.5, color: t.c || 'var(--text,#222)', wordBreak: 'break-word', outline: 'none', cursor: editing ? 'text' : (tool === 'select' ? 'text' : 'default'), minHeight: t.size }}
            />
          </div>
        )
      })}

      {/* ── Menú flotante de formato (estilo iPad) para el texto en edición ── */}
      {editText && (() => {
        const t = (parsePizarra(store.getNode(parentId)?.body).texts || []).find(x => x.id === editText)
        if (!t) return null
        const mx = cam.x + t.x * cam.scale
        const my = cam.y + t.y * cam.scale
        const COLORS = ['#222222', '#e03131', '#1971c2', '#2f9e44', '#f08c00', '#9c36b5']
        const Btn = ({ label, onAct, title }: { label: React.ReactNode; onAct: () => void; title: string }) => (
          <button title={title} onMouseDown={(e) => { e.preventDefault(); onAct() }}
            style={{ minWidth: 26, height: 26, border: 'none', background: 'transparent', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: 'var(--text,#333)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{label}</button>
        )
        return (
          <div onPointerDown={(e) => e.stopPropagation()} style={{
            position: 'fixed', left: Math.max(8, mx), top: Math.max(8, my - 44), zIndex: 1700,
            display: 'flex', alignItems: 'center', gap: 1, padding: 4,
            background: 'var(--bg-elevated,#fff)', border: '1px solid var(--border,#e2e2e2)',
            borderRadius: 10, boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
          }}>
            <Btn title="Negrita" label={<b>B</b>} onAct={() => fmt('bold')} />
            <Btn title="Cursiva" label={<i>I</i>} onAct={() => fmt('italic')} />
            <Btn title="Subrayado" label={<u>U</u>} onAct={() => fmt('underline')} />
            <div style={{ width: 1, height: 18, background: 'var(--border,#e2e2e2)', margin: '0 2px' }} />
            <Btn title="Encabezado grande" label="H1" onAct={() => fmt('formatBlock', 'H1')} />
            <Btn title="Encabezado" label="H2" onAct={() => fmt('formatBlock', 'H2')} />
            <Btn title="Texto normal" label="¶" onAct={() => fmt('formatBlock', 'DIV')} />
            <Btn title="Lista" label="•" onAct={() => fmt('insertUnorderedList')} />
            <div style={{ width: 1, height: 18, background: 'var(--border,#e2e2e2)', margin: '0 2px' }} />
            {COLORS.map(c => (
              <button key={c} title="Color" onMouseDown={(e) => { e.preventDefault(); fmt('foreColor', c) }}
                style={{ width: 16, height: 16, borderRadius: '50%', background: c, border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer', margin: '0 1px' }} />
            ))}
          </div>
        )
      })()}

      {/* ── FLUJO: nodos del día SIN posición, apilados en columna sobre el lienzo.
             Orden natural (sin solaparse). Se arrastran por el tirador para fijarlos. ── */}
      {flowNodes.length > 0 && (
        <div style={{
          position: 'absolute',
          left: cam.x + FLOW_X * cam.scale,
          top: cam.y + FLOW_Y * cam.scale,
          width: CARD_W,
          transform: `scale(${cam.scale})`,
          transformOrigin: '0 0',
          zIndex: 1,
          display: 'flex', flexDirection: 'column', gap: 2,
        }}>
          {flowNodes.map(node => dragPos?.id === node.id ? null : (
            <div key={node.id} data-card="1" data-node-id={node.id} className={`pizarra-node${multiSel.has(node.id) ? ' pizarra-node--sel' : ''}`} style={{ position: 'relative', width: CARD_W, cursor: 'grab' }}
              onPointerDown={(e) => onCardAreaPointerDown(e, node)}
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ nodeId: node.id, x: e.clientX, y: e.clientY }) }}>
              <div className="pizarra-card-body" style={{ minWidth: 0 }}>
                <OutlinerNode node={node} depth={0} isSelected={selectedId === node.id} selectedId={selectedId} isMultiSelected={false} onSelect={setSelectedId} onSelectNext={() => {}} onShiftSelect={() => {}} filterText="" flat />
              </div>
            </div>
          ))}
        </div>
      )}

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
        <button style={tool === 'text' ? toolBtnActive : toolBtn} title="Texto — escribe libre en el lienzo" onClick={() => setTool(t => t === 'text' ? 'select' : 'text')}>
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


      {/* Menú contextual de la pizarra. Si el nodo clicado forma parte de una
          MULTISELECCIÓN → acciones en lote (eliminar/duplicar todos). Si no →
          menú normal: QUITAR (saca de la pizarra, NO borra) o ELIMINAR. */}
      {contextMenu && store.getNode(contextMenu.nodeId) && (() => {
        const isMulti = multiSel.has(contextMenu.nodeId) && multiSel.size > 1
        return (
          <>
            <div onPointerDown={() => setContextMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 1999 }} />
            <div style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 2000, minWidth: 200,
              background: 'var(--bg-elevated,#fff)', border: '1px solid var(--border,#e2e2e2)', borderRadius: 10, padding: 5,
              boxShadow: '0 8px 28px rgba(0,0,0,0.16)' }}>
              {isMulti ? (
                <>
                  <div style={{ padding: '6px 12px 4px', fontSize: 12, color: 'var(--text-secondary,#888)' }}>{multiSel.size + selStrokes.size} seleccionados</div>
                  {(multiSel.size + selStrokes.size) > 1 && (
                    <button onClick={() => { groupSelection(); setContextMenu(null) }} style={ctxItem}>
                      Agrupar
                    </button>
                  )}
                  <button onClick={() => { duplicateSelection(); setContextMenu(null) }} style={ctxItem}>
                    Duplicar todos
                  </button>
                  <div style={{ height: 1, background: 'var(--border-subtle,#eee)', margin: '4px 0' }} />
                  <button onClick={() => { deleteSelection(); setContextMenu(null) }} style={{ ...ctxItem, color: 'var(--danger,#e03131)' }}>
                    Eliminar todos
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => { removeFromCanvas(contextMenu.nodeId); setContextMenu(null) }} style={ctxItem}>
                    Quitar de la pizarra
                  </button>
                  <button onClick={() => { window.dispatchEvent(new CustomEvent('from:pizarra-flyto', { detail: { nodeId: contextMenu.nodeId } })); navigate(`/node/${contextMenu.nodeId}`); setContextMenu(null) }} style={ctxItem}>
                    Abrir nodo
                  </button>
                  <div style={{ height: 1, background: 'var(--border-subtle,#eee)', margin: '4px 0' }} />
                  <button onClick={() => { duplicateNode(contextMenu.nodeId, 24); setContextMenu(null) }} style={ctxItem}>
                    Duplicar
                  </button>
                  <button onClick={() => {
                    const n = store.getNode(contextMenu.nodeId)
                    if (n) deleteGcalEventForNode(n) // si es evento de Google, lo borra también allí
                    store.deleteNode(contextMenu.nodeId)
                    setContextMenu(null)
                  }} style={{ ...ctxItem, color: 'var(--danger,#e03131)' }}>
                    Eliminar nodo
                  </button>
                </>
              )}
            </div>
          </>
        )
      })()}

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
// Catálogo de herramientas del menú rápido (configurable).
const QUICK_ALL = ['node', 'pen', 'eraser', 'select', 'undo', 'redo', 'today', 'saveView'] as const
const QUICK_LABEL: Record<string, string> = {
  node: 'Crear nodo aquí', pen: 'Lápiz', eraser: 'Borrador', select: 'Seleccionar / mover',
  undo: 'Deshacer', redo: 'Rehacer', today: 'Ir a hoy', saveView: 'Guardar vista',
}
const QUICK_ICON: Record<string, React.ReactNode> = {
  node: <svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M10 5v10M5 10h10"/></svg>,
  pen: <svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M14 3l3 3-9 9-4 1 1-4 9-9z"/></svg>,
  eraser: <svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M7 16h9M4 13l5-5 6 6-3 3H7l-3-3z"/></svg>,
  select: <svg width="19" height="19" viewBox="0 0 20 20" fill="currentColor"><path d="M4 3l13 6-5 1.6L9.6 17 4 3z"/></svg>,
  undo: <svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M7 7H13a4 4 0 010 8H8M7 7l3-3M7 7l3 3"/></svg>,
  redo: <svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M13 7H7a4 4 0 000 8h5M13 7l-3-3M13 7l-3 3"/></svg>,
  today: <svg width="19" height="19" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>,
  saveView: <svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 3h10v14l-5-3-5 3V3z"/></svg>,
}
const quickBtn: React.CSSProperties = {
  width: 40, height: 40, borderRadius: 999, border: 'none', background: 'transparent',
  color: 'var(--accent, #6c5ce7)', cursor: 'pointer', display: 'inline-flex',
  alignItems: 'center', justifyContent: 'center',
}
const quickBtnActive: React.CSSProperties = {
  ...quickBtn, background: 'var(--accent-soft, rgba(108,92,231,0.14))',
}
const quickBtnDisabled: React.CSSProperties = {
  ...quickBtn, color: 'var(--text-secondary, #bbb)', cursor: 'not-allowed', opacity: 0.5,
}
const ctxItem: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 7,
  border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, color: 'var(--text,#333)',
}
const miniItem: React.CSSProperties = {
  border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 500,
  color: 'var(--text,#333)', padding: '6px 12px', borderRadius: 8, whiteSpace: 'nowrap',
}

