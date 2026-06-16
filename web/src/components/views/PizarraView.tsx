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
import { uploadFile } from '../../api/client'
import { ensureDayPath } from '../../utils/agendaHelper'
import { findRootByKey } from '../../utils/rootLookup'
import { setTemporalFocus } from '../../utils/pizarraNav'
import { deleteGcalEventForNode, getGcalEventId } from '../../utils/gcalNodesSync'
import { getDayColumnData, isMovedNode } from '../../utils/dayColumn'
import { extractDateFromEnd, recurrenceToString } from '../../utils/naturalDate'
import { isCanvasText, isDocNode, canvasViewKind, firstLineTitle, DOC, CTEXT } from '../../utils/docNode'
import type { CanvasViewKind } from '../../utils/docNode'
import DocEditor from './DocEditor'
import DocInspector from './DocInspector'
import OutlinerNode from '../outliner/OutlinerNode'
import NodeTableView from './NodeTableView'
import NodeKanbanView from './NodeKanbanView'
import NodeCalendarView from './NodeCalendarView'
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
// Por debajo de este zoom, las tarjetas se simplifican a una píldora con su título
// (LOD): mejor legibilidad y rendimiento (no se montan tablas/outliner diminutos).
const LOD_SCALE = 0.5
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

// ── Recursos (PDF / imagen / enlace / archivo) embebidos en el lienzo ──
// Un nodo-recurso lleva `extraData._resourceUrl` + `_resourceType`; el lienzo lo
// pinta como tarjeta-embed y el dot lo abre en su página (NodeView ya renderiza el
// recurso). Mismas claves que un recurso normal → cero divergencia con la lista.
type ResourceKind = 'image' | 'pdf' | 'url' | 'file'
interface ResourceMeta { url: string; type: ResourceKind }
function readResource(node: Node): ResourceMeta | null {
  try {
    const ed = JSON.parse(node.extraData || '{}')
    const url = ed._resourceUrl as string | undefined
    if (!url) return null
    const t = (ed._resourceType as string) || 'file'
    const type: ResourceKind = t === 'image' || t === 'pdf' || t === 'url' ? t : 'file'
    return { url, type }
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
type CanvasTool = 'select' | 'pen' | 'marker' | 'highlighter' | 'eraser' | 'text' | 'task' | 'line' | 'rect' | 'ellipse' | 'arrow'
const isShapeTool = (t: CanvasTool) => t === 'line' || t === 'rect' || t === 'ellipse' || t === 'arrow'
const isInkTool = (t: CanvasTool) => t === 'pen' || t === 'marker' || t === 'highlighter'
const FENCE = '```from-pizarra'
interface WBStroke { id: string; pts: number[]; w: number; c: string; e?: boolean; a?: number; k?: string; g?: string }
// Texto LIBRE del lienzo (compatible iPad): x,y mundo; size=fuente; w=ancho; md=texto.
interface WBText { id: string; x: number; y: number; size: number; w: number; md: string; c?: string; nodeId?: string }

// Conector: flecha que une DOS elementos (nodos). a/b = ids de nodo; c = punto de
// control (mundo) para curvar. Se redibuja según la posición actual de cada nodo.
interface WBConnector { id: string; a: string; b: string; c?: [number, number] }
interface WBData { version: number; strokes: WBStroke[]; texts?: WBText[]; tasks?: unknown[]; connectors?: WBConnector[]; camX?: number; camY?: number; camScale?: number }

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
// Distancia² de un punto al segmento (a,b).
function distToSeg2(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay
  const len2 = dx * dx + dy * dy
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0
  t = Math.max(0, Math.min(1, t))
  const cx = ax + t * dx, cy = ay + t * dy
  return (px - cx) * (px - cx) + (py - cy) * (py - cy)
}
function strokeNear(s: WBStroke, x: number, y: number, r: number): boolean {
  const r2 = r * r
  // Formas (2 puntos): distancia a su geometría, no solo a los extremos.
  if (s.k && s.k !== 'free' && s.pts.length >= 4) {
    const x0 = s.pts[0], y0 = s.pts[1], x1 = s.pts[2], y1 = s.pts[3]
    if (s.k === 'line' || s.k === 'arrow') return distToSeg2(x, y, x0, y0, x1, y1) <= r2
    if (s.k === 'rect') {
      return distToSeg2(x, y, x0, y0, x1, y0) <= r2 || distToSeg2(x, y, x1, y0, x1, y1) <= r2
        || distToSeg2(x, y, x1, y1, x0, y1) <= r2 || distToSeg2(x, y, x0, y1, x0, y0) <= r2
    }
    if (s.k === 'ellipse') { // muestreo del perímetro
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = Math.abs(x1 - x0) / 2, ry = Math.abs(y1 - y0) / 2
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 16) {
        const ex = cx + Math.cos(a) * rx, ey = cy + Math.sin(a) * ry
        if ((ex - x) * (ex - x) + (ey - y) * (ey - y) <= r2) return true
      }
      return false
    }
  }
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
  // Cámara: se PERSISTE en el body (camX/Y/Scale, el mismo campo que el iPad) para
  // volver a donde lo dejaste. Init perezoso + restauración al cambiar de nodo.
  const readSavedCam = useCallback((pid: string): Cam => {
    const d = parsePizarra(store.getNode(pid)?.body)
    if (d.camScale != null && d.camX != null) return { x: d.camX, y: d.camY ?? 60, scale: d.camScale }
    return { x: 60, y: 60, scale: 1 }
  }, [])
  const [cam, setCam] = useState<Cam>(() => readSavedCam(parentId))
  const restoringCamRef = useRef(false)
  const camSaveTimer = useRef<number | null>(null)
  const [viewport, setViewport] = useState({ w: 1000, h: 700 })
  // Refs espejo (para leer el valor actual dentro de animaciones/listeners sin stale).
  const camRef = useRef(cam); camRef.current = cam
  const viewportRef = useRef(viewport); viewportRef.current = viewport
  const flyRef = useRef<number | null>(null)
  const divingRef = useRef(false) // anti-doble-disparo del buceo
  const tryDiveRef = useRef<(s: number) => void>(() => {})

  // Zoom de los botones +/− ANCLADO al centro del viewport (no al origen del mundo,
  // que hacía que el contenido se fuera de pantalla al alejar).
  const zoomAtCenter = useCallback((factor: number) => {
    setCam(c => {
      const ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, c.scale * factor))
      const cx = viewportRef.current.w / 2, cy = viewportRef.current.h / 2
      const wx = (cx - c.x) / c.scale, wy = (cy - c.y) / c.scale
      return { x: cx - wx * ns, y: cy - wy * ns, scale: ns }
    })
  }, [])

  // Restaurar la cámara guardada al cambiar de nodo (la diaria de hoy → otra).
  useEffect(() => {
    restoringCamRef.current = true
    setCam(readSavedCam(parentId))
  }, [parentId, readSavedCam])

  // Persistir la cámara (debounce) en el body. El primer cambio tras restaurar se ignora.
  useEffect(() => {
    if (restoringCamRef.current) { restoringCamRef.current = false; return }
    if (camSaveTimer.current) clearTimeout(camSaveTimer.current)
    camSaveTimer.current = window.setTimeout(() => {
      const body = store.getNode(parentId)?.body
      const d = parsePizarra(body)
      const nx = Math.round(cam.x), ny = Math.round(cam.y), ns = Number(cam.scale.toFixed(4))
      if (d.camX === nx && d.camY === ny && d.camScale === ns) return
      d.camX = nx; d.camY = ny; d.camScale = ns
      store.updateNode(parentId, { body: bodyWithPizarra(body, d) })
    }, 700)
  }, [cam, parentId])

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
  const nodeRzRef = useRef<null | { id: string; mode: 'width' | 'widthR' | 'scale'; startW: number; startScale: number; startPin: WorldPos; startWorld: WorldPos; cardH: number; moved: boolean }>(null)
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
  const [tool, setTool] = useState<CanvasTool>('select')
  // Herramienta Tarea: input flotante en el punto de clic (fecha por lenguaje natural).
  const [taskInput, setTaskInput] = useState<{ x: number; y: number } | null>(null)
  // Color y grosor de tinta (pluma/rotulador/subrayador) + paleta abierta.
  const [penColor, setPenColor] = useState<string>('#222222')
  const penColorRef = useRef(penColor); penColorRef.current = penColor
  const [penWidth, setPenWidth] = useState<number>(2.5)
  const penWidthRef = useRef(penWidth); penWidthRef.current = penWidth
  const [paletteOpen, setPaletteOpen] = useState(false)
  // ── Conectores (flechas entre elementos) ──
  // Primer elemento clicado con la herramienta flecha (ancla el inicio).
  const [arrowAnchor, setArrowAnchor] = useState<string | null>(null)
  // Posición del cursor (pantalla) para la previsualización mientras se conecta.
  const [arrowCursor, setArrowCursor] = useState<{ x: number; y: number } | null>(null)
  const [hoverConn, setHoverConn] = useState<string | null>(null)
  // Arrastre del tirador de curvatura (preview en vivo del punto de control, mundo).
  const [connDrag, setConnDrag] = useState<{ id: string; cx: number; cy: number } | null>(null)
  // Texto del lienzo en edición (id del nodo-documento).
  const [editText, setEditText] = useState<string | null>(null)
  const editTextRef = useRef(editText); editTextRef.current = editText
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
    return children.filter(n => !isHiddenPin(n) && !isDocNode(n) && !canvasViewKind(n) && !readPin(n) && !rightCol.has(n.id) && !getGcalEventId(n) && !isCapturePin(n) && !isMovedNode(n))
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
    // Grosor en pantalla según la herramienta, → mundo. Formas: kind + 2 puntos.
    const t = toolRef.current
    const shape = isShapeTool(t)
    const screenW = t === 'highlighter' ? 18 : t === 'marker' ? 6 : penWidthRef.current
    const alpha = t === 'highlighter' ? 0.32 : 1
    const wWorld = screenW / Math.max(0.0001, camRef.current.scale)
    const pts = shape ? [worldPts[0], worldPts[1], worldPts[worldPts.length - 2], worldPts[worldPts.length - 1]] : worldPts
    data.strokes = [...data.strokes, {
      id: rid(), pts: pts.map(n => Math.round(n * 100) / 100), w: wWorld, c: penColorRef.current, a: alpha, k: shape ? t : 'free',
    }]
    store.updateNode(parentId, { body: bodyWithPizarra(node.body, data) })
  }, [parentId])

  // ── Entidades soltadas/pegadas en el lienzo: PDF / imagen / enlace ───────────
  // Crea un nodo-recurso anclado en el punto del mundo y devuelve su id.
  const RES_W: Record<ResourceKind, number> = { image: 340, pdf: 360, url: 320, file: 280 }
  const createResourceAt = useCallback((world: WorldPos, meta: { url: string; type: ResourceKind; key?: string; title?: string }) => {
    const ed: Record<string, string> = {
      _resourceUrl: meta.url, _resourceType: meta.type,
      [PIN_X]: String(Math.round(world.x)), [PIN_Y]: String(Math.round(world.y)), [PIN_SCALE]: '1',
      _pinW: String(RES_W[meta.type]),
    }
    if (meta.key) ed._resourceKey = meta.key
    const title = meta.title || (meta.type === 'url' ? meta.url : 'Archivo')
    const node = store.createNode({ text: title, parentId, extraData: ed })
    store.updateNode(node.id, { isResource: true })
    return node.id
  }, [parentId])

  // Sube archivos a R2 y los ancla como tarjetas (apiladas con un pequeño offset).
  const uploadAndPinFiles = useCallback(async (files: File[], world: WorldPos) => {
    let i = 0
    for (const file of files) {
      const off = { x: world.x + i * 28, y: world.y + i * 28 }
      const type: ResourceKind = file.type.startsWith('image/') ? 'image' : file.type === 'application/pdf' ? 'pdf' : 'file'
      try {
        const { key, publicUrl } = await uploadFile(file)
        createResourceAt(off, { url: publicUrl, type, key, title: file.name })
      } catch { /* subida fallida → se ignora ese archivo */ }
      i++
    }
  }, [createResourceAt])

  // Soltar sobre la pizarra: archivos→subida+ancla; un nodo interno arrastrado de la
  // columna derecha→se coloca; una URL externa→nodo-enlace anclado en el punto.
  const onCanvasDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const rect = containerRef.current!.getBoundingClientRect()
    const w = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
    const files = Array.from(e.dataTransfer.files || [])
    if (files.length) { void uploadAndPinFiles(files, w); return }
    const id = e.dataTransfer.getData('text/plain')
    const internal = id && store.getNode(id) && store.children(parentId).some(c => c.id === id)
    if (internal) { writePin(store.getNode(id)!, { x: w.x - 16, y: w.y - 12 }); return }
    const uri = (e.dataTransfer.getData('text/uri-list') || id || '').trim()
    if (/^https?:\/\/\S+$/i.test(uri)) createResourceAt(w, { url: uri, type: 'url', title: uri })
  }, [parentId, screenToWorld, uploadAndPinFiles, createResourceAt])

  // Pegar (⌘V) sobre el lienzo en reposo → imagen del portapapeles o URL como
  // entidad, en el centro de la vista. No interceptamos si se edita un texto
  // (TipTap) o el foco está en un campo (lo gestiona el editor correspondiente).
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (editTextRef.current) return
      const ae = document.activeElement as HTMLElement | null
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return
      const items = Array.from(e.clipboardData?.items || [])
      const c = camRef.current, vp = viewportRef.current
      const world = { x: (vp.w / 2 - c.x) / c.scale, y: (vp.h / 2 - c.y) / c.scale }
      const img = items.find(it => it.type.startsWith('image/'))
      if (img) { const f = img.getAsFile(); if (f) { e.preventDefault(); void uploadAndPinFiles([f], world) } return }
      const text = (e.clipboardData?.getData('text/plain') || '').trim()
      if (/^https?:\/\/\S+$/i.test(text)) { e.preventDefault(); createResourceAt(world, { url: text, type: 'url', title: text }) }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [uploadAndPinFiles, createResourceAt])

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

  // Retroceso / Suprimir: borra los elementos seleccionados del lienzo. No se
  // dispara mientras se edita texto o se escribe en un campo (deja borrar letras).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Backspace' && e.key !== 'Delete') return
      if (editText) return
      const ae = document.activeElement as HTMLElement | null
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return
      if (multiSel.size === 0 && selStrokes.size === 0) return
      e.preventDefault()
      deleteSelection()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editText, multiSel, selStrokes, deleteSelection])

  // Atajos de herramienta (una letra, estilo Figma/Excalidraw). No se disparan con
  // modificadores, editando texto, ni con el foco en un campo. Pulsar la misma letra
  // vuelve a Seleccionar (toggle), igual que clicar su botón.
  const TOOL_KEYS: Record<string, CanvasTool> = {
    v: 'select', b: 'pen', m: 'marker', h: 'highlighter', e: 'eraser',
    t: 'text', a: 'arrow', l: 'line', r: 'rect', o: 'ellipse',
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (editTextRef.current) return
      const ae = document.activeElement as HTMLElement | null
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return
      const t = TOOL_KEYS[e.key.toLowerCase()]
      if (!t) return
      e.preventDefault()
      setArrowAnchor(null)
      setTool(cur => (t !== 'select' && cur === t) ? 'select' : t)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        _area: '1', // vista guardada → bloque «Áreas» de la columna derecha
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

  // Herramienta Tarea: crea un nodo-tarea (con due/recurrencia por lenguaje natural)
  // hijo de la nota del lienzo. Vive por DUE → aparece en la columna del día.
  const createTaskFromText = useCallback((text: string) => {
    const raw = text.trim(); if (!raw) return
    const dp = extractDateFromEnd(raw)
    const clean = (dp ? dp.cleanText : raw).trim() || raw
    const node = store.createNode({ text: clean, parentId, isTask: true })
    const updates: Record<string, unknown> = { status: 'pending' }
    if (dp?.parsed.date) {
      updates.due = dp.parsed.date.toISOString()
      if (dp.parsed.recurrence) updates.recurrence = recurrenceToString(dp.parsed.recurrence)
    }
    store.updateNode(node.id, updates)
  }, [parentId])

  // ── Elementos-texto del lienzo = NODOS `_doc`+`_ctext` anclados (FUENTE ÚNICA) ─
  // El texto del lienzo ya NO vive como WBText en el body de la pizarra: es un nodo
  // hijo. El MISMO nodo se pinta aquí y se abre en solitario con DocEditor; ambos
  // editan `node.body`. Sin copias ni sincronización.
  const newTextExtra = (world: WorldPos): Record<string, string> => ({
    [DOC]: '1', [CTEXT]: '1', _pinW: '360',
    [PIN_X]: String(Math.round(world.x)), [PIN_Y]: String(Math.round(world.y)), [PIN_SCALE]: '1',
  })

  const createTextAt = useCallback((world: WorldPos) => {
    const node = store.createNode({ text: '', parentId, extraData: newTextExtra(world) })
    // La 1ª línea es el TÍTULO → arranca como H1 (se ve como tal en lienzo y doc).
    store.updateNode(node.id, { body: '<h1></h1>' })
    setTool('select')
    setEditText(node.id)
  }, [parentId])

  const deleteText = useCallback((id: string) => {
    store.deleteNode(id)
    setEditText(e => e === id ? null : e)
  }, [])

  const duplicateText = useCallback((id: string) => {
    const n = store.getNode(id); if (!n) return
    const pin = readPin(n) || { x: 0, y: 0 }
    const copy = store.createNode({ text: n.text, parentId, extraData: newTextExtra({ x: pin.x + 24, y: pin.y + 24 }) })
    if (n.body) store.updateNode(copy.id, { body: n.body })
    setEditText(copy.id)
  }, [parentId])

  // ── Elementos de VISTA del lienzo (tabla/kanban/calendario) ──────────────────
  // Un nodo hijo con `extraData.viewBlock`; se embebe en el lienzo y se abre en
  // solitario igual (NodeView ya renderiza su vista). Se crea en el centro de la
  // vista actual; el usuario lo recoloca/redimensiona como cualquier elemento.
  const createViewElement = useCallback((kind: CanvasViewKind) => {
    const c = camRef.current, vp = viewportRef.current
    const wx = (vp.w / 2 - c.x) / c.scale
    const wy = (vp.h / 2 - c.y) / c.scale
    const titles: Record<CanvasViewKind, string> = { tabla: 'Tabla', kanban: 'Kanban', calendario: 'Calendario' }
    const width = kind === 'kanban' ? '760' : kind === 'calendario' ? '720' : '560'
    const node = store.createNode({
      text: titles[kind], parentId,
      extraData: { viewBlock: kind, [PIN_X]: String(Math.round(wx - Number(width) / 2)), [PIN_Y]: String(Math.round(wy - 120)), [PIN_SCALE]: '1', _pinW: width },
    })
    // Se crea VACÍA: la tabla muestra «+ Añadir fila» para empezar.
    setTool('select')
    setSelectedId(node.id)
  }, [parentId])

  // ── Conectores: leer/escribir en el body de la pizarra ──
  const mutateConnectors = useCallback((fn: (cs: WBConnector[]) => WBConnector[]) => {
    const data = parsePizarra(store.getNode(parentId)?.body)
    data.connectors = fn(data.connectors || [])
    store.updateNode(parentId, { body: bodyWithPizarra(store.getNode(parentId)?.body, data) })
  }, [parentId])

  // Herramienta flecha: 1er clic en un elemento ancla el inicio; 2º clic en OTRO
  // elemento crea el conector. Devuelve true si gestionó el clic (para no arrastrar).
  const handleArrowClick = useCallback((nodeId: string): boolean => {
    if (toolRef.current !== 'arrow') return false
    if (!arrowAnchor) { setArrowAnchor(nodeId); return true }
    if (arrowAnchor === nodeId) { setArrowAnchor(null); return true }
    const a = arrowAnchor
    mutateConnectors(cs => [...cs, { id: 'c' + rid(), a, b: nodeId }])
    setArrowAnchor(null); setArrowCursor(null); setTool('select')
    return true
  }, [arrowAnchor, mutateConnectors])

  // Arrastre del tirador de curvatura de un conector (previsualiza, commitea al soltar).
  const onConnHandleDown = useCallback((e: React.PointerEvent, id: string) => {
    e.preventDefault(); e.stopPropagation()
    const move = (ev: PointerEvent) => {
      const cont = containerRef.current?.getBoundingClientRect(); if (!cont) return
      const w = screenToWorld(ev.clientX - cont.left, ev.clientY - cont.top)
      setConnDrag({ id, cx: Math.round(w.x), cy: Math.round(w.y) })
    }
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up)
      setConnDrag(cur => {
        if (cur && cur.id === id) mutateConnectors(cs => cs.map(c => c.id === id ? { ...c, c: [cur.cx, cur.cy] } : c))
        return null
      })
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }, [screenToWorld, mutateConnectors])

  // Menú contextual de un texto del lienzo (clic derecho): duplicar / eliminar.
  const [textMenu, setTextMenu] = useState<{ id: string; x: number; y: number } | null>(null)

  // (La edición de texto del lienzo la gestiona DocEditor (TipTap) en modo compact;
  //  ya no hay contentEditable propio ni persistencia manual aquí.)

  // El DOT abre el MISMO nodo en solitario (DocEditor). No hay copia ni sync.
  const openTextAsDoc = useCallback((id: string) => { navigate(`/node/${id}`) }, [navigate])

  // ── Migración: WBText legacy (JSON en el body de la pizarra) → nodos `_ctext` ──
  // Una sola vez por pizarra. Reúne lo existente sin duplicar: si el WBText ya tenía
  // documento vinculado (nodeId), ese nodo pasa a ser el elemento-texto; si no, se
  // crea uno. Después se vacía `texts[]` del body.
  const migratedRef = useRef(false)
  useEffect(() => {
    if (migratedRef.current) return
    migratedRef.current = true
    const data = parsePizarra(store.getNode(parentId)?.body)
    if (!data.texts || !data.texts.length) return
    for (const t of data.texts) {
      const linked = t.nodeId ? store.getNode(t.nodeId) : null
      if (linked && !linked.deletedAt) {
        let ed: Record<string, unknown> = {}
        try { ed = JSON.parse(linked.extraData || '{}') } catch { /* vacío */ }
        ed[DOC] = '1'; ed[CTEXT] = '1'; delete ed[PIN_HIDDEN]
        ed[PIN_X] = String(Math.round(t.x)); ed[PIN_Y] = String(Math.round(t.y))
        if (ed[PIN_SCALE] == null) ed[PIN_SCALE] = '1'
        const body = t.md || linked.body || ''
        store.updateNode(linked.id, { extraData: JSON.stringify(ed), body, text: firstLineTitle(body) })
      } else {
        const node = store.createNode({ text: firstLineTitle(t.md), parentId, extraData: newTextExtra({ x: t.x, y: t.y }) })
        if (t.md) store.updateNode(node.id, { body: t.md })
      }
    }
    const d2 = parsePizarra(store.getNode(parentId)?.body)
    d2.texts = []
    store.updateNode(parentId, { body: bodyWithPizarra(store.getNode(parentId)?.body, d2) })
  }, [parentId])

  // Auto-coloca en el lienzo los DOCUMENTOS (elementos de texto) que aún no tienen
  // posición → el lienzo muestra los MISMOS elementos que la lista. Se apilan en una
  // columna; el usuario los recoloca. (No toca tareas/eventos: viven en la columna.)
  useEffect(() => {
    const unplaced = children.filter(n => isDocNode(n) && !isHiddenPin(n) && !readPin(n))
    if (!unplaced.length) return
    unplaced.forEach((n, i) => {
      let ed: Record<string, unknown> = {}
      try { ed = JSON.parse(n.extraData || '{}') } catch { /* vacío */ }
      ed[DOC] = '1'; if (ed[CTEXT] == null) ed[CTEXT] = '1'
      ed[PIN_X] = String(FLOW_X); ed[PIN_Y] = String(FLOW_Y + i * 200)
      if (ed[PIN_SCALE] == null) ed[PIN_SCALE] = '1'
      if (ed._pinW == null) ed._pinW = '360'
      store.updateNode(n.id, { extraData: JSON.stringify(ed) })
    })
  }, [parentId, children])

  // ── Pointer down en el fondo → pan, o dibujar/borrar según la herramienta ────
  const onBackgroundPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    // Solo si el target es el fondo (no una tarjeta).
    if ((e.target as HTMLElement).dataset.bg !== '1') return
    if (editText) setEditText(null) // salir de la edición de un texto al tocar el fondo
    // Flecha con un elemento ya anclado: clic en vacío → cancelar la conexión.
    if (toolRef.current === 'arrow' && arrowAnchor) { setArrowAnchor(null); setArrowCursor(null); return }
    if (flyRef.current) { cancelAnimationFrame(flyRef.current); flyRef.current = null } // cancelar vuelo
    const el = containerRef.current!
    const rect = el.getBoundingClientRect()
    const w = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
    // Lápiz: iniciar trazo. Borrador: borrar al pasar.
    if (isInkTool(toolRef.current) || isShapeTool(toolRef.current)) {
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
    // Texto/Tarea: NO crear aquí (en pointerdown) para no provocar un blur inmediato.
    // Se crea en el onClick del contenedor (gesto completo). Solo evitamos el pan.
    if (toolRef.current === 'text' || toolRef.current === 'task') return
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
  }, [cam, screenToWorld, eraseAt, createTextAt, clearSelection, arrowAnchor, editText])

  // ── Doble clic en el fondo → crear nodo ahí ─────────────────────────────────
  const onBackgroundDoubleClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).dataset.bg !== '1') return
    const rect = containerRef.current!.getBoundingClientRect()
    createNodeAt(screenToWorld(e.clientX - rect.left, e.clientY - rect.top))
  }, [createNodeAt, screenToWorld])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    // Conectando con la flecha: seguir el cursor para previsualizar la línea.
    if (toolRef.current === 'arrow' && arrowAnchor) setArrowCursor({ x: e.clientX, y: e.clientY })
    // Redimensionado de tarjeta (ancho / escala) en curso → preview.
    if (nodeRzRef.current) {
      const r = nodeRzRef.current
      const rect = containerRef.current!.getBoundingClientRect()
      const w = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
      if (Math.abs(w.x - r.startWorld.x) + Math.abs(w.y - r.startWorld.y) > 1) r.moved = true
      let val: { w: number; scale: number; pin: WorldPos }
      if (r.mode === 'widthR') {
        // Tirador DERECHO: el borde izquierdo (pin) queda fijo; crece hacia la derecha.
        const newW = Math.max(120, r.startW + (w.x - r.startWorld.x) / r.startScale)
        val = { w: newW, scale: r.startScale, pin: r.startPin }
      } else if (r.mode === 'width') {
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
      // Formas: solo 2 puntos (inicio fijo, fin sigue al cursor).
      if (isShapeTool(toolRef.current)) {
        drawRef.current = [drawRef.current[0], drawRef.current[1], w.x, w.y]
      } else {
        drawRef.current.push(w.x, w.y)
      }
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
  }, [cam.scale, layout, screenToWorld, eraseAt, arrowAnchor])

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
        if (n) writeCardSize(n, (r.mode === 'width' || r.mode === 'widthR') ? { w: val.w, pin: val.pin } : { scale: val.scale })
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
      // El marco solo SELECCIONA. El mini-menú (duplicar/eliminar) vive en el clic
      // derecho sobre la selección, no aparece solo (molestaba en medio del lienzo).
      return
    }
    // Fin de dibujo/borrado: persistir el trazo (lápiz).
    if (drawRef.current) {
      const pts = drawRef.current
      drawRef.current = null
      try { containerRef.current?.releasePointerCapture(e.pointerId) } catch { /* noop */ }
      if (isInkTool(toolRef.current) || isShapeTool(toolRef.current)) commitStroke(pts)
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
        // Clic limpio (sin arrastrar): el texto entra a EDITAR; el resto, seleccionar.
        // El mini-menú (duplicar/eliminar) vive SOLO en el clic derecho.
        if (isDocNode(node)) {
          setSelStrokes(new Set()); setMultiSel(new Set())
          setSelectedId(node.id); setEditText(node.id)
        } else {
          setSelStrokes(new Set()); setMultiSel(new Set([node.id])); setSelectedId(node.id)
        }
      }
      setDragPos(null)
      setGroupDelta(null)
    }
  }, [dragPos, flyToNode, commitStroke, parentId])

  // ── Pointer down en el TIRADOR de una tarjeta → iniciar drag de la tarjeta ──
  const onCardPointerDown = useCallback((e: React.PointerEvent, node: Node) => {
    if (e.button !== 0) return
    e.stopPropagation() // no llega al fondo (no pan) ni al editor
    setEditText(et => (et && et !== node.id) ? null : et) // salir de edición de OTRO texto
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
  const onNodeResizeDown = useCallback((e: React.PointerEvent, node: Node, mode: 'width' | 'widthR' | 'scale') => {
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

  // Lienzo vacío: sin elementos colocados, sin flujo, sin trazos ni conectores.
  // Muestra una pista que invita a empezar (no bloquea: pointerEvents none).
  const isCanvasEmpty = layout.size === 0 && flowNodes.length === 0 && (() => {
    const d = parsePizarra(store.getNode(parentId)?.body)
    return (d.strokes?.length ?? 0) === 0 && (d.connectors?.length ?? 0) === 0
  })()


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
        if ((e.target as HTMLElement).dataset.bg !== '1') return
        const rect = containerRef.current!.getBoundingClientRect()
        // Texto → crear texto libre y editar. Tarea → input flotante en el punto.
        if (toolRef.current === 'text') createTextAt(screenToWorld(e.clientX - rect.left, e.clientY - rect.top))
        else if (toolRef.current === 'task') setTaskInput({ x: e.clientX, y: e.clientY })
      }}
      onDoubleClick={onBackgroundDoubleClick}
      onContextMenu={(e) => {
        // Con una herramienta activa (no «seleccionar»), el clic derecho vuelve a
        // Seleccionar/mover (atajo rápido), sin abrir el menú.
        if (toolRef.current !== 'select') { e.preventDefault(); setTool('select'); setArrowAnchor(null); return }
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
        cursor: panRef.current ? 'grabbing' : (tool === 'pen' || tool === 'marker' || tool === 'highlighter' || tool === 'eraser' || isShapeTool(tool) ? 'crosshair' : tool === 'text' || tool === 'task' ? 'text' : 'default'),
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
.pizarra-node--sel{box-shadow:0 0 0 1.5px var(--border,#d8d8d8);border-radius:8px}
.pizarra-node--hover{box-shadow:0 0 0 1px var(--border-subtle,#e6e6e6);border-radius:8px}
.pizarra-node--text.pizarra-node--sel,.pizarra-node--text.pizarra-node--hover{box-shadow:none}
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

      {/* Estado vacío: pista que invita a empezar. No bloquea (pointerEvents none). */}
      {isCanvasEmpty && !editText && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', userSelect: 'none', zIndex: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-secondary,#888)', marginBottom: 8 }}>Tu día, en blanco</div>
          <div style={{ fontSize: 14, color: 'var(--text-tertiary,#aaa)', lineHeight: 1.7, textAlign: 'center' }}>
            Escribe (<b>T</b>), dibuja (<b>B</b>) o suelta una imagen, un PDF o un enlace.<br />
            Rueda para alejar y ver el mes y el año. Doble clic crea un nodo.
          </div>
        </div>
      )}

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
          const sw = Math.max(0.4, s.w * widthMul * cam.scale)
          let d = ''
          if (s.k && s.k !== 'free' && pts.length >= 4) {
            // Forma: definida por 2 puntos (inicio, fin).
            const x0 = cam.x + pts[0] * cam.scale, y0 = cam.y + pts[1] * cam.scale
            const x1 = cam.x + pts[2] * cam.scale, y1 = cam.y + pts[3] * cam.scale
            if (s.k === 'line') d = `M${x0} ${y0}L${x1} ${y1}`
            else if (s.k === 'rect') d = `M${x0} ${y0}H${x1}V${y1}H${x0}Z`
            else if (s.k === 'ellipse') { const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = Math.abs(x1 - x0) / 2, ry = Math.abs(y1 - y0) / 2; d = `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0` }
            else if (s.k === 'arrow') { const ang = Math.atan2(y1 - y0, x1 - x0); const head = Math.max(9, sw * 3); const a1 = ang + Math.PI * 0.82, a2 = ang - Math.PI * 0.82; d = `M${x0} ${y0}L${x1} ${y1}M${x1} ${y1}L${x1 + Math.cos(a1) * head} ${y1 + Math.sin(a1) * head}M${x1} ${y1}L${x1 + Math.cos(a2) * head} ${y1 + Math.sin(a2) * head}` }
          } else {
            for (let i = 0; i + 1 < pts.length; i += 2) {
              d += (i === 0 ? 'M' : 'L') + (cam.x + pts[i] * cam.scale).toFixed(1) + ' ' + (cam.y + pts[i + 1] * cam.scale).toFixed(1) + ' '
            }
          }
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
        {/* ── CONECTORES (flechas entre elementos). Se redibujan según la posición
               actual de cada nodo (centro del rect en pantalla). ── */}
        {(() => {
          const cont = containerRef.current?.getBoundingClientRect()
          if (!cont) return null
          const center = (id: string): { x: number; y: number } | null => {
            const el = containerRef.current?.querySelector(`[data-node-id="${CSS.escape(id)}"]`)
            if (!el) return null
            const r = (el as HTMLElement).getBoundingClientRect()
            return { x: r.left + r.width / 2 - cont.left, y: r.top + r.height / 2 - cont.top }
          }
          const conns = parsePizarra(store.getNode(parentId)?.body).connectors || []
          return conns.map(conn => {
            const A = center(conn.a), B = center(conn.b)
            if (!A || !B) return null
            const cw = connDrag?.id === conn.id ? [connDrag.cx, connDrag.cy] as [number, number] : conn.c
            const ctrl = cw ? { x: cam.x + cw[0] * cam.scale, y: cam.y + cw[1] * cam.scale } : { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 }
            const d = `M${A.x} ${A.y}Q${ctrl.x} ${ctrl.y} ${B.x} ${B.y}`
            const ang = Math.atan2(B.y - ctrl.y, B.x - ctrl.x); const head = 11
            const a1 = ang + Math.PI * 0.82, a2 = ang - Math.PI * 0.82
            const headD = `M${B.x} ${B.y}L${B.x + Math.cos(a1) * head} ${B.y + Math.sin(a1) * head}M${B.x} ${B.y}L${B.x + Math.cos(a2) * head} ${B.y + Math.sin(a2) * head}`
            const hovered = hoverConn === conn.id
            return (
              <g key={conn.id}>
                {hovered && <path d={d} fill="none" stroke="var(--accent,#6c5ce7)" strokeWidth={7} strokeOpacity={0.18} strokeLinecap="round" />}
                <path d={d} fill="none" stroke="var(--text-secondary,#555)" strokeWidth={2} strokeLinecap="round" />
                <path d={headD} fill="none" stroke="var(--text-secondary,#555)" strokeWidth={2} strokeLinecap="round" />
                {tool === 'select' && (
                  <path d={d} fill="none" stroke="transparent" strokeWidth={16}
                    style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                    onPointerEnter={() => setHoverConn(conn.id)}
                    onPointerLeave={() => setHoverConn(h => h === conn.id ? null : h)}
                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); mutateConnectors(cs => cs.filter(c => c.id !== conn.id)); setHoverConn(null) }} />
                )}
                {(hovered || connDrag?.id === conn.id) && tool === 'select' && (
                  <circle cx={ctrl.x} cy={ctrl.y} r={6} fill="#fff" stroke="var(--accent,#6c5ce7)" strokeWidth={2}
                    style={{ pointerEvents: 'all', cursor: 'grab' }}
                    onPointerEnter={() => setHoverConn(conn.id)}
                    onPointerDown={(e) => onConnHandleDown(e, conn.id)} />
                )}
              </g>
            )
          })
        })()}
        {/* Previsualización mientras se conecta (flecha activa, 1er elemento anclado). */}
        {tool === 'arrow' && arrowAnchor && arrowCursor && (() => {
          const cont = containerRef.current?.getBoundingClientRect(); if (!cont) return null
          const el = containerRef.current?.querySelector(`[data-node-id="${CSS.escape(arrowAnchor)}"]`)
          if (!el) return null
          const r = (el as HTMLElement).getBoundingClientRect()
          const ax = r.left + r.width / 2 - cont.left, ay = r.top + r.height / 2 - cont.top
          return <path d={`M${ax} ${ay}L${arrowCursor.x - cont.left} ${arrowCursor.y - cont.top}`} fill="none" stroke="var(--accent,#6c5ce7)" strokeWidth={2} strokeDasharray="5 5" strokeOpacity={0.7} />
        })()}
        {drawPts && drawPts.length >= 4 && (() => {
          let d = ''
          if (isShapeTool(tool)) {
            const x0 = cam.x + drawPts[0] * cam.scale, y0 = cam.y + drawPts[1] * cam.scale
            const x1 = cam.x + drawPts[drawPts.length - 2] * cam.scale, y1 = cam.y + drawPts[drawPts.length - 1] * cam.scale
            if (tool === 'line') d = `M${x0} ${y0}L${x1} ${y1}`
            else if (tool === 'rect') d = `M${x0} ${y0}H${x1}V${y1}H${x0}Z`
            else if (tool === 'ellipse') { const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = Math.abs(x1 - x0) / 2, ry = Math.abs(y1 - y0) / 2; d = `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0` }
            else if (tool === 'arrow') { const ang = Math.atan2(y1 - y0, x1 - x0); const head = 12; const a1 = ang + Math.PI * 0.82, a2 = ang - Math.PI * 0.82; d = `M${x0} ${y0}L${x1} ${y1}M${x1} ${y1}L${x1 + Math.cos(a1) * head} ${y1 + Math.sin(a1) * head}M${x1} ${y1}L${x1 + Math.cos(a2) * head} ${y1 + Math.sin(a2) * head}` }
          } else {
            d = drawPts.reduce((acc, _v, i) => i % 2 === 0 ? acc + (i === 0 ? 'M' : 'L') + (cam.x + drawPts[i] * cam.scale).toFixed(1) + ' ' + (cam.y + drawPts[i + 1] * cam.scale).toFixed(1) + ' ' : acc, '')
          }
          return <path d={d} fill="none" stroke={penColor} strokeWidth={tool === 'highlighter' ? 18 : tool === 'marker' ? 6 : penWidth} strokeOpacity={tool === 'highlighter' ? 0.32 : 1} strokeLinecap="round" strokeLinejoin="round" />
        })()}
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
        const isText = isDocNode(node)
        const elView = canvasViewKind(node)
        const res = !isText && !elView ? readResource(node) : null
        const editing = isText && editText === node.id
        const showHandles = (hovered || selectedId === node.id || multiSel.has(node.id)) && !dragPos && !editing
        const ViewComp = elView === 'tabla' ? NodeTableView : elView === 'kanban' ? NodeKanbanView : elView === 'calendario' ? NodeCalendarView : null
        // LOD: con zoom bajo, píldora con el título (no se monta el contenido pesado).
        const lod = cam.scale < LOD_SCALE && !editing
        const lodTitle = (node.text || (isText ? 'Documento' : elView ? (elView[0].toUpperCase() + elView.slice(1)) : 'Sin título')).slice(0, 60)
        return (
          <div key={node.id} data-card="1" data-node-id={node.id} className={`pizarra-node${isText ? ' pizarra-node--text' : ''}${elView ? ' pizarra-node--el' : ''}${(multiSel.has(node.id) || ((isText || elView) && selectedId === node.id)) ? ' pizarra-node--sel' : ''}${editing ? ' pizarra-node--editing' : ''}${grouped ? ' pizarra-node--grouped' : ''}${hovered ? ' pizarra-node--hover' : ''}`}
            onPointerEnter={() => { if (tool === 'select' && !dragPos && !nodeRzRef.current) setHoverNode(node.id) }}
            onPointerLeave={() => setHoverNode(h => h === node.id ? null : h)}
            onPointerDownCapture={tool === 'arrow' ? (e) => { e.preventDefault(); e.stopPropagation(); handleArrowClick(node.id) } : undefined}
            onPointerDown={(elView && !lod) ? undefined : (e) => onCardAreaPointerDown(e, node)}
            onDoubleClick={isText ? (e) => { e.stopPropagation(); setSelectedId(node.id); setEditText(node.id) } : undefined}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ nodeId: node.id, x: e.clientX, y: e.clientY }) }}
            style={{ position: 'absolute', left: sx, top: sy, width: cardW, transform: `scale(${cam.scale * cardScale})`, transformOrigin: '0 0', zIndex: editing ? 20 : (dragPos?.id === node.id || live) ? 10 : (hovered ? 4 : 1), cursor: editing ? 'text' : 'grab' }}>
            {lod ? (
              // Píldora LOD (zoom bajo): solo el título, barato de renderizar.
              <div className="pizarra-lod" style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.25, color: 'var(--text,#222)', padding: '10px 14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {elView && <span style={{ opacity: 0.5, marginRight: 8 }}>▦</span>}
                {lodTitle}
              </div>
            ) : isText ? (
              // Elemento-texto = el MISMO nodo que el documento. Editando → editor
              // TipTap completo (DocEditor compact); en reposo → body estático (ligero).
              editing ? (
                <DocEditor node={node} compact />
              ) : (
                <div className="pizarra-text"
                  dangerouslySetInnerHTML={{ __html: node.body || '<span style="opacity:.4">Texto…</span>' }}
                  style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--text,#222)', wordBreak: 'break-word', minHeight: 20, userSelect: 'none', WebkitUserSelect: 'none' }}
                />
              )
            ) : elView && ViewComp ? (
              // Elemento de VISTA (tabla/kanban/calendario): el MISMO nodo que se abre
              // en solitario. Cabecera = tirador para mover; el cuerpo es la vista real.
              <div className="pizarra-el">
                <div className="pizarra-el-head" onPointerDown={(e) => onCardPointerDown(e, node)} style={{ cursor: 'grab' }}>
                  {/* DOT a la izquierda → abre el elemento en su propia página. */}
                  <span className="pizarra-el-dot" title="Abrir en su página"
                    onPointerDown={(e) => { e.stopPropagation(); openTextAsDoc(node.id) }}
                    style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--text-secondary,#888)', opacity: 0.85, cursor: 'pointer', flexShrink: 0 }} />
                  <span className="pizarra-el-title">{node.text || 'Vista'}</span>
                </div>
                <div className="pizarra-el-body">
                  <ViewComp parentId={node.id} />
                </div>
              </div>
            ) : res ? (
              // Entidad embebida (imagen / PDF / enlace / archivo) soltada o pegada.
              // El dot la abre en su página (NodeView renderiza el recurso completo).
              <div className="pizarra-res" style={{ borderRadius: 12, overflow: 'hidden', background: 'var(--bg-elevated,#fff)', border: '1px solid var(--border,#e4e4e4)', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
                {res.type === 'image' ? (
                  <img src={res.url} alt={node.text || ''} draggable={false}
                    style={{ display: 'block', width: '100%', height: 'auto', userSelect: 'none', WebkitUserSelect: 'none', pointerEvents: 'none' }} />
                ) : res.type === 'pdf' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px' }}>
                    <span style={{ fontSize: 30, lineHeight: 1 }}>📄</span>
                    <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text,#222)', wordBreak: 'break-word' }}>{node.text || 'Documento PDF'}</span>
                  </div>
                ) : res.type === 'url' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 16px' }}>
                    <span style={{ fontSize: 22, lineHeight: 1 }}>🔗</span>
                    <span style={{ fontSize: 14, color: 'var(--accent,#6c5ce7)', wordBreak: 'break-all', textDecoration: 'underline' }}>{node.text || res.url}</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 16px' }}>
                    <span style={{ fontSize: 24, lineHeight: 1 }}>📎</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text,#222)', wordBreak: 'break-word' }}>{node.text || 'Archivo'}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="pizarra-card-body" style={{ minWidth: 0 }}>
                <OutlinerNode node={node} depth={0} isSelected={selectedId === node.id} selectedId={selectedId} isMultiSelected={false} onSelect={setSelectedId} onSelectNext={() => {}} onShiftSelect={() => {}} filterText="" flat />
              </div>
            )}
            {/* DOT (texto/vista, hover/seleccionado/editando) → abre el elemento en su
                página. Grande y separado, alineado a la 1ª línea. */}
            {(isText || res) && (hovered || selectedId === node.id || editing) && (
              <div title="Abrir en su página"
                onPointerDown={(e) => { e.stopPropagation(); openTextAsDoc(node.id) }}
                style={{ position: 'absolute', left: -30, top: 0, height: 30, width: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--text-secondary,#888)', border: '2px solid var(--bg,#fff)', boxShadow: '0 0 0 1px var(--border,#d8d8d8)' }} />
              </div>
            )}
            {/* Tirador de ANCHO del texto: visible en hover, selección y también EN EDICIÓN. */}
            {isText && (hovered || selectedId === node.id || multiSel.has(node.id) || editing) && !dragPos && (
              <div title="Ancho" onPointerDown={(e) => onNodeResizeDown(e, node, 'widthR')}
                style={{ position: 'absolute', right: -7, top: '50%', width: 5, height: 26, marginTop: -13, background: 'var(--text-tertiary,#bbb)', borderRadius: 3, cursor: 'ew-resize', touchAction: 'none', zIndex: 21 }} />
            )}
            {showHandles && !isText && ((elView || res) ? (
              // Vista o entidad embebida: ancho a la DERECHA + escala en la esquina.
              <>
                <div title="Ancho" onPointerDown={(e) => onNodeResizeDown(e, node, 'widthR')}
                  style={{ position: 'absolute', right: -5, top: '50%', width: 7, height: 28, marginTop: -14, background: 'var(--text-tertiary,#bbb)', borderRadius: 4, cursor: 'ew-resize', opacity: 0.9, touchAction: 'none' }} />
                <div title="Escalar" onPointerDown={(e) => onNodeResizeDown(e, node, 'scale')}
                  style={{ position: 'absolute', right: -6, bottom: -6, width: 12, height: 12, background: '#fff', border: '2px solid var(--text-tertiary,#bbb)', borderRadius: 3, cursor: 'nwse-resize', touchAction: 'none' }} />
              </>
            ) : (
              <>
                {/* Manija de ANCHURA — borde izquierdo, a media altura. Arrastra → reajusta ancho y salto de línea. */}
                <div title="Ancho" onPointerDown={(e) => onNodeResizeDown(e, node, 'width')}
                  style={{ position: 'absolute', left: -5, top: '50%', width: 8, height: 30, marginTop: -15, background: 'var(--accent,#6c5ce7)', borderRadius: 4, cursor: 'ew-resize', opacity: 0.85, touchAction: 'none' }} />
                {/* Manija de ESCALA — esquina inferior derecha (escala uniforme desde arriba-izquierda). */}
                <div title="Escalar" onPointerDown={(e) => onNodeResizeDown(e, node, 'scale')}
                  style={{ position: 'absolute', right: -6, bottom: -6, width: 12, height: 12, background: '#fff', border: '2px solid var(--accent,#6c5ce7)', borderRadius: 3, cursor: 'nwse-resize', touchAction: 'none' }} />
              </>
            ))}
          </div>
        )
      })}

      {/* Editando un texto del lienzo → panel de formato a la DERECHA (estilo Pages),
          el MISMO que en el documento en solitario. Lee el editor TipTap activo. */}
      {editText && (
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 268, zIndex: 1800,
          borderLeft: '1px solid var(--border,#e6e6e6)', background: 'var(--bg-elevated,#fafafa)',
          boxShadow: '-8px 0 24px rgba(0,0,0,0.06)' }}>
          <DocInspector />
        </div>
      )}

      {/* Menú contextual de un texto del lienzo: duplicar / eliminar. */}
      {textMenu && (
        <>
          <div onPointerDown={() => setTextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setTextMenu(null) }} style={{ position: 'fixed', inset: 0, zIndex: 1999 }} />
          <div style={{ position: 'fixed', top: textMenu.y, left: textMenu.x, zIndex: 2000, minWidth: 160,
            background: 'var(--bg-elevated,#fff)', border: '1px solid var(--border,#e2e2e2)', borderRadius: 10, padding: 5,
            boxShadow: '0 8px 28px rgba(0,0,0,0.16)' }}>
            <button onClick={() => { duplicateText(textMenu.id); setTextMenu(null) }} style={ctxItem}>Duplicar</button>
            <button onClick={() => { deleteText(textMenu.id); setTextMenu(null) }} style={{ ...ctxItem, color: 'var(--danger,#e03131)' }}>Eliminar</button>
          </div>
        </>
      )}

      {/* Input de TAREA (herramienta Tarea): escribe con fecha en lenguaje natural. */}
      {taskInput && (
        <>
          <div onPointerDown={() => { setTaskInput(null); setTool('select') }} style={{ position: 'fixed', inset: 0, zIndex: 1599 }} />
          <div style={{ position: 'fixed', left: Math.min(taskInput.x, viewport.w - 280), top: taskInput.y, zIndex: 1600, display: 'flex', alignItems: 'center', gap: 7, padding: '7px 9px', width: 270,
            background: 'var(--bg-elevated,#fff)', border: '1px solid var(--accent,#6c5ce7)', borderRadius: 10, boxShadow: '0 8px 28px rgba(0,0,0,0.18)' }}>
            <span style={{ width: 15, height: 15, border: '1.6px solid var(--text-tertiary,#bbb)', borderRadius: 4, flexShrink: 0 }} />
            <input autoFocus placeholder="Tarea… (ej: Llamar a Marina mañana)"
              onKeyDown={(e) => {
                if (e.key === 'Enter') { createTaskFromText((e.target as HTMLInputElement).value); setTaskInput(null); setTool('select') }
                if (e.key === 'Escape') { setTaskInput(null); setTool('select') }
              }}
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: 'var(--text,#222)' }} />
          </div>
        </>
      )}

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
        <button style={tool === 'select' ? toolBtnActive : toolBtn} title="Seleccionar / mover (V)" onClick={() => setTool('select')}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path d="M4 3l13 6-5 1.6L9.6 17 4 3z"/></svg>
        </button>
        {/* Lápiz — dibujar */}
        <button style={tool === 'pen' ? toolBtnActive : toolBtn} title="Lápiz — fino (B)" onClick={() => setTool(t => t === 'pen' ? 'select' : 'pen')}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M14 3l3 3-9 9-4 1 1-4 9-9z"/></svg>
        </button>
        {/* Rotulador — grueso */}
        <button style={tool === 'marker' ? toolBtnActive : toolBtn} title="Rotulador — grueso (M)" onClick={() => setTool(t => t === 'marker' ? 'select' : 'marker')}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M14 3l3 3-9 9-4 1 1-4 9-9z"/></svg>
        </button>
        {/* Subrayador — translúcido */}
        <button style={tool === 'highlighter' ? toolBtnActive : toolBtn} title="Subrayador (H)" onClick={() => setTool(t => t === 'highlighter' ? 'select' : 'highlighter')}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 13l6-6 4 4-6 6H5v-4z"/><path d="M3 18h14"/></svg>
        </button>
        {/* Color de tinta */}
        <div style={{ position: 'relative' }}>
          <button style={toolBtn} title="Color" onClick={() => setPaletteOpen(o => !o)}>
            <span style={{ width: 16, height: 16, borderRadius: '50%', background: penColor, border: '1.5px solid rgba(0,0,0,0.15)', display: 'inline-block' }} />
          </button>
          {paletteOpen && (
            <>
              <div onPointerDown={() => setPaletteOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 70 }} />
              <div style={{ position: 'absolute', bottom: 42, left: '50%', transform: 'translateX(-50%)', zIndex: 71, padding: 8, background: 'var(--bg-elevated,#fff)', border: '1px solid var(--border,#e2e2e2)', borderRadius: 12, boxShadow: '0 8px 28px rgba(0,0,0,0.18)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                  {['#222222', '#868e96', '#e03131', '#f76707', '#f59f00', '#2f9e44', '#1098ad', '#1971c2', '#7048e8', '#9c36b5', '#e64980', '#ffffff'].map(c => (
                    <button key={c} onClick={() => { setPenColor(c); if (!isInkTool(tool) && !isShapeTool(tool)) setTool('pen') }}
                      style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: penColor === c ? '2px solid var(--accent,#6c5ce7)' : '1px solid rgba(0,0,0,0.12)', cursor: 'pointer' }} />
                  ))}
                </div>
                {/* Grosor de la pluma (paridad iPad: 6 niveles) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border-subtle,#eee)' }}>
                  {[1.5, 2.5, 4, 7, 12, 20].map(wv => (
                    <button key={wv} title={`Grosor ${wv}`} onClick={() => { setPenWidth(wv); if (!isInkTool(tool) && !isShapeTool(tool)) setTool('pen') }}
                      style={{ width: 26, height: 26, borderRadius: 7, border: penWidth === wv ? '2px solid var(--accent,#6c5ce7)' : '1px solid var(--border,#e2e2e2)', background: 'transparent', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ width: Math.min(18, wv + 2), height: Math.min(18, wv + 2), borderRadius: '50%', background: penColor }} />
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        {/* Borrador */}
        <button style={tool === 'eraser' ? toolBtnActive : toolBtn} title="Borrador (E)" onClick={() => setTool(t => t === 'eraser' ? 'select' : 'eraser')}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M7 16h9M4 13l5-5 6 6-3 3H7l-3-3z"/></svg>
        </button>
        <button style={tool === 'text' ? toolBtnActive : toolBtn} title="Texto — escribe libre en el lienzo (T)" onClick={() => setTool(t => t === 'text' ? 'select' : 'text')}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 6V5h12v1M10 5v10M7.5 15h5"/></svg>
        </button>
        {/* Tarea — con fecha por lenguaje natural */}
        <button style={tool === 'task' ? toolBtnActive : toolBtn} title="Tarea — con fecha (lenguaje natural)" onClick={() => setTool(t => t === 'task' ? 'select' : 'task')}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="14" height="13" rx="2"/><path d="M6.5 10.5l2 2 4-4.5"/></svg>
        </button>
        <div style={vSep} />
        {/* Elementos: Tabla / Kanban / Calendario (nodos hijos del lienzo) */}
        <button style={toolBtn} title="Tabla" onClick={() => createViewElement('tabla')}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="4" width="14" height="12" rx="1.5"/><path d="M3 8h14M3 12h14M9 4v12"/></svg>
        </button>
        <button style={toolBtn} title="Kanban" onClick={() => createViewElement('kanban')}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="4" width="4" height="12" rx="1"/><rect x="8.5" y="4" width="4" height="8" rx="1"/><rect x="14" y="4" width="3" height="10" rx="1"/></svg>
        </button>
        <button style={toolBtn} title="Calendario" onClick={() => createViewElement('calendario')}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="4" width="14" height="13" rx="2"/><path d="M3 8h14M7 3v3M13 3v3"/></svg>
        </button>
        <div style={vSep} />
        {/* Formas */}
        <button style={tool === 'line' ? toolBtnActive : toolBtn} title="Línea (L)" onClick={() => setTool(t => t === 'line' ? 'select' : 'line')}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M4 16L16 4"/></svg>
        </button>
        <button style={tool === 'arrow' ? toolBtnActive : toolBtn} title="Flecha (A)" onClick={() => setTool(t => t === 'arrow' ? 'select' : 'arrow')}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 16L16 4M9 4h7v7"/></svg>
        </button>
        <button style={tool === 'rect' ? toolBtnActive : toolBtn} title="Rectángulo (R)" onClick={() => setTool(t => t === 'rect' ? 'select' : 'rect')}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3.5" y="5" width="13" height="10" rx="1"/></svg>
        </button>
        <button style={tool === 'ellipse' ? toolBtnActive : toolBtn} title="Elipse (O)" onClick={() => setTool(t => t === 'ellipse' ? 'select' : 'ellipse')}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><ellipse cx="10" cy="10" rx="7" ry="5.5"/></svg>
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
        <button style={toolBtn} title="Alejar" onClick={() => zoomAtCenter(1 / 1.2)}>−</button>
        <span style={{ minWidth: 42, textAlign: 'center', fontSize: 12, color: 'var(--text-secondary, #888)' }}>{Math.round(cam.scale * 100)}%</span>
        <button style={toolBtn} title="Acercar" onClick={() => zoomAtCenter(1.2)}>+</button>
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
                  {/* Bucle / Favorito (paridad iPad) */}
                  {(() => {
                    const n = store.getNode(contextMenu.nodeId)
                    const types = n?.types || []
                    const hasBucle = types.includes('bucle')
                    return (
                      <>
                        <button onClick={() => {
                          store.updateNode(contextMenu.nodeId, { types: hasBucle ? types.filter(t => t !== 'bucle') : [...types, 'bucle'], status: hasBucle ? null : 'pending' })
                          setContextMenu(null)
                        }} style={ctxItem}>{hasBucle ? '↺ Quitar bucle' : '↺ Convertir en bucle'}</button>
                        <button onClick={() => { store.updateNode(contextMenu.nodeId, { isFavorite: !n?.isFavorite }); setContextMenu(null) }} style={ctxItem}>
                          {n?.isFavorite ? '★ Quitar de favoritos' : '☆ Favorito'}
                        </button>
                        <div style={{ height: 1, background: 'var(--border-subtle,#eee)', margin: '4px 0' }} />
                      </>
                    )
                  })()}
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

