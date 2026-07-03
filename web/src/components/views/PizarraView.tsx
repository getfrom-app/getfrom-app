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

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import { uploadFile } from '../../api/client'
import { ensureDayPath } from '../../utils/agendaHelper'
import { findRootByKey, findContextRoot } from '../../utils/rootLookup'
import { setTemporalFocus } from '../../utils/pizarraNav'
import { deleteGcalEventForNode, getGcalEventId } from '../../utils/gcalNodesSync'
import { getDayColumnData, isMovedNode } from '../../utils/dayColumn'
import { isCanvasText, isDocNode, canvasViewKind, firstLineTitle, DOC, CTEXT } from '../../utils/docNode'
import { isContextKnowledge } from '../../utils/knowledgeNodes'
import { firstContextOf, contextColor, isMarkedContext, reparentContext, clearContextParent, assignContext } from '../../utils/cajones'
import { findTagNodeBySlug } from '../../utils/tagsHelper'
import { createMarkdownNode } from '../../utils/importMarkdown'
import { computeNestedLayout, CONTENT_W, type NestedLayout } from '../../utils/nestedCanvasLayout'
import type { CanvasViewKind } from '../../utils/docNode'
import { mergeNodesToBlock } from '../../utils/noteBlocks'
import DocEditor from './DocEditor'
import DocEditorBoundary from '../DocEditorBoundary'
import { useActiveDocNodeId } from '../../utils/docEditorStore'
import OutlinerNode from '../outliner/OutlinerNode'
import ContextPicker from '../panels/ContextPicker'
import PdfCanvasPreview from './PdfCanvasPreview'
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
  // Si se pasa una URL de PDF, se renderiza como FONDO del lienzo (ancla mundo 0,0),
  // nítido al ampliar, detrás de trazos y tarjetas. Las herramientas marcan encima.
  pdfBackground?: string
  // Clave R2 del PDF de fondo (bucket privado → carga por proxy autenticado si está).
  pdfBackgroundKey?: string
  // Lienzo GLOBAL (home): al seleccionar un nodo se abre su columna derecha SIN
  // salir del lienzo (evento `from:open-detail`), en vez de navegar a él.
  globalCanvas?: boolean
}

// Ancho en unidades de mundo del PDF de fondo (alto se ajusta solo por página).
const PDF_BG_W = 820

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
const MIN_SCALE = 0.002 // zoom out MUY profundo (ver todo el plano)

// Rejilla de puntos ADAPTATIVA: el paso en pantalla se mantiene ~18-90px sea cual
// sea el zoom, así el fondo es SIEMPRE blanco con puntos (nunca gris por bunching).
function dotGrid(camX: number, camY: number, scale: number): { backgroundSize: string; backgroundPosition: string } {
  let d = 24 * scale
  if (!(d > 0)) d = 24
  while (d < 18) d *= 5
  while (d > 90) d /= 5
  return { backgroundSize: `${d}px ${d}px`, backgroundPosition: `${camX % d}px ${camY % d}px` }
}
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
  try { const e = JSON.parse(node.extraData || '{}'); return e[PIN_HIDDEN] === '1' || !!e._absorbedBy } catch { return false }
}

// ── ÁREAS: región rectangular del lienzo (contenedora). El área es un nodo
// `_area='1'` con su rect en mundo (_pinX/_pinY = esquina sup-izq, _areaW/_areaH =
// tamaño). Las cards dentro son sus hijas; el área es hija de la nota. Se dibuja como
// un frame etiquetado y NO se pinta como tarjeta. ──────────────────────────────
const AREA = '_area'
const AREA_W = '_areaW'
const AREA_H = '_areaH'
function isArea(node: Node): boolean {
  try { return JSON.parse(node.extraData || '{}')[AREA] === '1' } catch { return false }
}
function readAreaRect(node: Node): { x: number; y: number; w: number; h: number } | null {
  let ed: Record<string, unknown> = {}
  try { ed = JSON.parse(node.extraData || '{}') } catch { return null }
  if (ed[AREA] !== '1') return null
  const x = Number(ed[PIN_X]), y = Number(ed[PIN_Y])
  const w = Number(ed[AREA_W]), h = Number(ed[AREA_H])
  if ([x, y, w, h].every(v => Number.isFinite(v)) && w > 0 && h > 0) return { x, y, w, h }
  // Compat: área «vieja» (punto + zoom) → rect aproximado del viewport de entonces.
  const sc = Number(ed[PIN_SCALE]) || 1
  if (Number.isFinite(x) && Number.isFinite(y)) return { x, y, w: 1280 / sc, h: 820 / sc }
  return null
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

// ── HEPTABASE FASE 3: anotaciones ENCIMA de una tarjeta (texto/PDF/imagen) ──
// Trazos en coordenadas PORCENTUALES (0-100) relativas a la propia tarjeta — se
// pintan con un `viewBox="0 0 100 100"`, así que el trazo se mueve/escala CON la
// tarjeta automáticamente (vive dentro de su mismo div transformado), sin depender
// en absoluto del ancho/alto real en píxeles ni de la cámara del lienzo.
interface CardAnno { id: string; pts: number[]; c: string; w: number }
function readCardAnnos(node: Node): CardAnno[] {
  try {
    const a = JSON.parse(node.extraData || '{}')._cardAnnotations
    return Array.isArray(a) ? a : []
  } catch { return [] }
}
function writeCardAnnos(node: Node, annos: CardAnno[]) {
  let ed: Record<string, unknown> = {}
  try { ed = JSON.parse(node.extraData || '{}') } catch { /* vacío */ }
  ed._cardAnnotations = annos
  store.updateNode(node.id, { extraData: JSON.stringify(ed) })
}

// ── Recursos (PDF / imagen / enlace / archivo) embebidos en el lienzo ──
// Un nodo-recurso lleva `extraData._resourceUrl` + `_resourceType`; el lienzo lo
// pinta como tarjeta-embed y el dot lo abre en su página (NodeView ya renderiza el
// recurso). Mismas claves que un recurso normal → cero divergencia con la lista.
type ResourceKind = 'image' | 'pdf' | 'url' | 'file'
interface ResourceMeta { url: string; type: ResourceKind; key?: string }
function readResource(node: Node): ResourceMeta | null {
  try {
    const ed = JSON.parse(node.extraData || '{}')
    // Nodos antiguos guardan la url/tipo en el campo del nodo (`node.resourceUrl`), no en
    // extraData (migración «Antes extraData._resourceUrl» — types/index.ts); aceptar ambos.
    const url = (ed._resourceUrl as string | undefined) || node.resourceUrl || undefined
    if (!url) return null
    // El tipo puede venir como código corto ('pdf'/'image') O como MIME crudo
    // ('application/pdf', 'image/png'…) si el nodo se creó con una versión anterior
    // del sistema de recursos → antes caía siempre en el fallback genérico 'file'
    // (icono + nombre) en vez de la previsualización real. Como último recurso, mirar
    // la extensión de la URL.
    const raw = (ed._resourceType as string | undefined) || node.resourceType || ''
    const type: ResourceKind =
      raw === 'image' || raw.startsWith('image/') || /\.(jpe?g|png|gif|webp|svg|heic)$/i.test(url) ? 'image' :
      raw === 'pdf' || raw === 'application/pdf' || /\.pdf$/i.test(url) ? 'pdf' :
      raw === 'url' ? 'url' : 'file'
    // Clave R2 (para cargar el PDF por el proxy autenticado — el bucket no es público).
    const key = (ed._resourceKey as string | undefined) || undefined
    return { url, type, key }
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

// ── Referencias del lienzo (_refs) ────────────────────────────────────────────
// Un nodo arrastrado desde la columna derecha que NO es hijo de este lienzo se
// MUESTRA aquí como "espejo" sin moverlo: el lienzo guarda su id en `_refs` y el
// nodo se posiciona por su propio pin (_pinX/_pinY). Quitarlo del lienzo solo
// borra la referencia; el nodo sigue en su sitio (columna/agenda).
function readRefs(parentId: string): string[] {
  const p = store.getNode(parentId)
  try { const v = JSON.parse(p?.extraData || '{}')._refs; return Array.isArray(v) ? v.filter((x: unknown): x is string => typeof x === 'string') : [] }
  catch { return [] }
}
function addRef(parentId: string, id: string) {
  const p = store.getNode(parentId); if (!p) return
  let ed: Record<string, unknown> = {}
  try { ed = JSON.parse(p.extraData || '{}') } catch { /* */ }
  const cur = Array.isArray(ed._refs) ? (ed._refs as string[]) : []
  if (cur.includes(id)) return
  ed._refs = [...cur, id]
  store.updateNode(parentId, { extraData: JSON.stringify(ed) })
}
function removeRef(parentId: string, id: string) {
  const p = store.getNode(parentId); if (!p) return
  let ed: Record<string, unknown> = {}
  try { ed = JSON.parse(p.extraData || '{}') } catch { /* */ }
  const next = (Array.isArray(ed._refs) ? (ed._refs as string[]) : []).filter(x => x !== id)
  if (next.length) ed._refs = next; else delete ed._refs
  store.updateNode(parentId, { extraData: JSON.stringify(ed) })
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
type CanvasTool = 'select' | 'pen' | 'marker' | 'highlighter' | 'eraser' | 'text' | 'doc' | 'line' | 'rect' | 'ellipse' | 'arrow'
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

// Portapapeles EN MEMORIA del lienzo: copiar/pegar la selección (trazos + cards)
// entre pizarras de la misma sesión. Coords relativas al origen (min x,y) de la
// selección. El texto plano se copia aparte al portapapeles del sistema (para pegar
// en un editor de texto, donde solo interesa el texto).
type PizClipCard = { text: string; body: string | null; types: string[]; dx: number; dy: number; sc: number; w: number }
type PizClip = { strokes: WBStroke[]; cards: PizClipCard[]; text: string; ts: number }
let pizarraClipboard: PizClip | null = null

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
// [x0,y0,x1,y1,...] → «M x0 y0 L x1 y1 L ...» (path SVG de un trazo a mano alzada).
function pathFromPts(pts: number[]): string {
  let d = ''
  for (let i = 0; i < pts.length; i += 2) d += (i === 0 ? 'M' : 'L') + pts[i] + ' ' + pts[i + 1] + ' '
  return d
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

export default function PizarraView({ parentId, flowUnpositioned, pdfBackground, pdfBackgroundKey, globalCanvas }: Props) {
  const { t } = useTranslation()
  const nodesVersion = useStore(st => st.nodesVersion) // re-render + memoizar por versión
  const navigate = useNavigate()
  // Id del nodo cuyo editor está registrado como «activo» (el panel de documento,
  // `LienzoDocPanel`). Si coincide con la tarjeta que se está pintando, la tarjeta CEDE la
  // edición y se muestra en modo lectura — nunca dos editores TipTap vivos sobre el MISMO
  // nodo a la vez (causaba un bucle de renders al seleccionar texto — v9.6.680).
  const activeDocNodeId = useActiveDocNodeId()
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
  // Altura REAL (en unidades de mundo) medida de cada tarjeta — para que el culling
  // no descarte un documento alto cuando su ancla sale de pantalla pero su cuerpo
  // sigue visible. heightsV fuerza recálculo del culling al cambiar una altura.
  const cardHeights = useRef<Map<string, number>>(new Map())
  const [heightsV, setHeightsV] = useState(0)
  // Refs espejo (para leer el valor actual dentro de animaciones/listeners sin stale).
  const camRef = useRef(cam); camRef.current = cam
  const viewportRef = useRef(viewport); viewportRef.current = viewport
  const flyRef = useRef<number | null>(null)
  const divingRef = useRef(false) // anti-doble-disparo del buceo
  const tryDiveRef = useRef<(next: number, prev: number) => void>(() => {})

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

  // Lienzo GLOBAL (home): al seleccionar un nodo, abrir su columna derecha (la de
  // siempre de ese nodo) SIN salir del lienzo. Al deseleccionar, volver a la
  // columna del día. MainLayout escucha estos eventos.
  // Firma del TIPO del nodo seleccionado (tarea/evento/doc/contexto): si cambia mientras
  // sigue seleccionado (Magic lo convierte en tarea, se marca contexto…), re-disparamos
  // `open-detail` → la columna derecha pasa a la de TAREA / CONTEXTO / etc.
  const selKind = (() => {
    if (!selectedId) return ''
    const n = store.getNode(selectedId); if (!n) return ''
    return `${n.status != null ? 'task' : ''}${n.isEvent ? 'ev' : ''}${isDocNode(n) ? 'doc' : ''}${isMarkedContext(n) ? 'ctx' : ''}`
  })()
  useEffect(() => {
    if (!globalCanvas) return
    if (selectedId) window.dispatchEvent(new CustomEvent('from:open-detail', { detail: { nodeId: selectedId } }))
    else window.dispatchEvent(new CustomEvent('from:close-detail'))
  }, [globalCanvas, selectedId, selKind])

  // Multiselección con marco (Cmd/Ctrl + arrastrar sobre el fondo).
  // multiSel = nodos seleccionados; selStrokes = trazos (dibujos) seleccionados.
  const [multiSel, setMultiSel] = useState<Set<string>>(new Set())
  const [selStrokes, setSelStrokes] = useState<Set<string>>(new Set())
  // Refs espejo (para handlers nativos con closure estable — useEffect deps []).
  const multiSelRef = useRef(multiSel); multiSelRef.current = multiSel
  const selStrokesRef = useRef(selStrokes); selStrokesRef.current = selStrokes
  const parentIdRef = useRef(parentId); parentIdRef.current = parentId
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const marqueeRef = useRef<{ x0: number; y0: number } | null>(null)

  // Arrastre de GRUPO (mover varios elementos como unidad).
  const groupRef = useRef<{ gid: string; members: { id: string; origin: WorldPos }[]; strokeIds: string[]; strokeOrigins: Map<string, number[]> } | null>(null)
  const [groupDelta, setGroupDelta] = useState<WorldPos | null>(null)
  // Posición (pantalla) del mini-menú flotante de la selección (estilo iPad).
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null)
  // Menú de un conector (flecha): el clic derecho NO borra; abre este mini-menú.
  const [connMenu, setConnMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  // Menú rápido (clic derecho en el fondo): herramientas favoritas, estilo iPad.
  const [quickMenu, setQuickMenu] = useState<{ x: number; y: number; world: WorldPos } | null>(null)
  // Conjunto configurable de favoritos del menú rápido (CSV en localStorage).
  const [quickTools, setQuickTools] = useState<string[]>(() => {
    const raw = localStorage.getItem('pizarraQuickTools') || 'text,pen,eraser,select,undo'
    // Migra el antiguo 'node' → 'text' (ahora el texto ES el nodo-outliner).
    const list = raw.split(',').map(s => s.trim()).filter(Boolean).map(k => k === 'node' ? 'text' : k)
    return Array.from(new Set(list))
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
    cards: { id: string; px: number; py: number; sc: number }[]  // cards seleccionadas: pin + escala originales
    start: WorldPos
    anchor?: WorldPos                  // escalar: esquina opuesta (fija)
    corner?: WorldPos                  // escalar: esquina agarrada (original)
    moved: boolean
  }>(null)
  type XfVal = { kind: 'move'; dx: number; dy: number } | { kind: 'scale'; ax: number; ay: number; s: number }
  const [xf, setXf] = useState<XfVal | null>(null)
  const xfValRef = useRef<XfVal | null>(null)
  const setXfBoth = (v: XfVal) => { xfValRef.current = v; setXf(v) }
  const clearSelection = useCallback(() => { setMultiSel(new Set()); setSelStrokes(new Set()); setMenuPos(null); setHoverConn(null) }, [])

  // Herramienta activa: select (mover/editar), pen (dibujar), eraser (borrar trazos).
  const [tool, setTool] = useState<CanvasTool>('select')
  // Herramienta Tarea: input flotante en el punto de clic (fecha por lenguaje natural).
  // Color y grosor de tinta (pluma/rotulador/subrayador) + paleta abierta.
  const [penColor, setPenColor] = useState<string>('#222222')
  const penColorRef = useRef(penColor); penColorRef.current = penColor
  const [penWidth, setPenWidth] = useState<number>(2.5)
  const penWidthRef = useRef(penWidth); penWidthRef.current = penWidth
  const [paletteOpen, setPaletteOpen] = useState(false)
  // ── HEPTABASE FASE 3: pintar/anotar ENCIMA de una tarjeta concreta (texto, PDF,
  // imagen) — el dibujo se guarda en `node.extraData._cardAnnotations`, en coordenadas
  // PORCENTUALES (0-100) relativas a la propia tarjeta, así que se mueve y escala CON
  // ella automáticamente (el overlay SVG vive dentro del mismo div ya transformado por
  // `scale(cam.scale*cardScale)`) — a diferencia de la tinta del lienzo (`wbData.strokes`,
  // global, en coordenadas de MUNDO, independiente de cualquier tarjeta). Reutiliza
  // `penColor`/`penWidth` de la tinta del lienzo para no duplicar la paleta.
  const [annotatingId, setAnnotatingId] = useState<string | null>(null)
  const annoDraftRef = useRef<{ pts: number[]; rect: DOMRect } | null>(null)
  const [annoDraftPts, setAnnoDraftPts] = useState<number[] | null>(null)
  // Escape sale del modo «anotar esta tarjeta» (sin tocar el resto de atajos globales).
  useEffect(() => {
    if (!annotatingId) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAnnotatingId(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [annotatingId])
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

  // Menú contextual de nodo (clic derecho en una tarjeta) — el mismo de la lista.
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null)
  // Menú de clic derecho sobre un CONTEXTO (área): eliminar + color de acento.
  const [areaMenu, setAreaMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  // REGIÓN visible del lienzo: 'contexts' (contextos) o 'agenda' (calendario de días).
  // Son como DOS hojas del mismo plano infinito: solo se ve/pana una a la vez; se cambia
  // volando (calendario/día → agenda; contexto → contextos). No te tropiezas con la otra.
  const [region, setRegion] = useState<'contexts' | 'agenda'>('contexts')

  // Drag de tarjeta (en curso): id + posición de mundo provisional + guías.
  const dragRef = useRef<{ id: string; startWorld: WorldPos; origin: WorldPos; moved: boolean } | null>(null)
  const [dragPos, setDragPos] = useState<{ id: string; pos: WorldPos } | null>(null)
  // Arrastre del MARCO de un área desde su etiqueta → mueve la región + sus hijos.
  const [areaDrag, setAreaDrag] = useState<{ id: string; dx: number; dy: number } | null>(null)
  const areaDragRef = useRef<{ id: string; sx: number; sy: number; moved: boolean } | null>(null)
  // Redimensionado manual de un contexto (tirador esquina) → guarda `_ctxW/_ctxH`.
  const [areaRz, setAreaRz] = useState<{ id: string; w: number; h: number } | null>(null)
  const areaRzRef = useRef<{ id: string; sx: number; sy: number; w0: number; h0: number } | null>(null)
  const [guides, setGuides] = useState<{ vx?: number; hy?: number }>({})

  // Pan del lienzo (en curso).
  const panRef = useRef<{ startX: number; startY: number; camX: number; camY: number; moved: boolean } | null>(null)

  // Hijos del nodo (las tarjetas). Fresco cada render: store.children está
  // cacheado e invalida al cambiar un nodo, así que al persistir _pinX/_pinY el
  // array cambia de referencia y el layout recalcula (antes se memoizaba por
  // longitud → al mover una tarjeta no cambiaba la longitud → volvía a su sitio).
  // Hijos del lienzo + los anidados dentro de ÁREAS (las cards de un área son sus
  // hijas; el lienzo las pinta igual, por su pin). El área en sí se pinta como frame.
  const directChildren = store.children(parentId)
  // LIENZO GLOBAL: un solo plano = TODO el subárbol posicionado (recursivo). Las
  // zonas (contextos/áreas) son marcos que contienen a sus hijos, en el MISMO
  // plano (pins absolutos). Fuera de global: hijos directos + un nivel de áreas.
  // LIENZO GLOBAL: layout ANIDADO auto-calculado — cada contexto es un ÁREA (caja) y
  // sus subcontextos son cajas DENTRO. No destructivo (solo memoria); el `_area` propio
  // de un contexto (si el usuario lo movió) manda sobre la caja calculada.
  // RENDIMIENTO: el recálculo (recorre el árbol) NO corre en cada tecla/sync; se DEBOUNCEA
  // con `layoutTick` (~250ms tras el último cambio) → evita tormentas de recomputación.
  const [layoutTick, setLayoutTick] = useState(0)
  useEffect(() => {
    if (!globalCanvas) return
    const h = setTimeout(() => setLayoutTick(t => t + 1), 250)
    return () => clearTimeout(h)
  }, [nodesVersion, globalCanvas])
  const nested = useMemo<NestedLayout | null>(() => {
    if (!globalCanvas) return null
    try {
      const vp = viewportRef.current
      const aspect = vp && vp.h > 0 ? vp.w / vp.h : 1.6 // cajas con forma de PANTALLA
      return computeNestedLayout(findContextRoot()?.id ?? parentId, aspect)
    } catch { return null } // ante cualquier fallo, el lienzo se pinta sin layout (no rompe)
  }, [globalCanvas, parentId, layoutTick]) // eslint-disable-line react-hooks/exhaustive-deps
  const nestedRef = useRef<NestedLayout | null>(null)
  useEffect(() => { nestedRef.current = nested }, [nested])

  const children = useMemo(() => {
    if (globalCanvas) {
      // Solo lo que el layout anidado coloca: CONTEXTOS (marcos) + su CONTENIDO directo
      // (filas). Lo más profundo no se pinta suelto (vive dentro de su fila/contexto).
      if (!nested) return [] as Node[]
      const out: Node[] = []
      const seen = new Set<string>()
      const add = (id: string) => {
        if (seen.has(id)) return
        const n = store.getNode(id)
        if (n && !n.deletedAt) { seen.add(id); out.push(n) }
      }
      if (region === 'agenda') {
        // Hoja AGENDA: solo el contenido de los DÍAS (calendario). Los contextos no se ven.
        for (const id of nested.dayContentIds) add(id)
        return out
      }
      // Hoja CONTEXTOS: contextos (marcos) + su contenido (excluyendo el de días).
      for (const id of nested.contextIds) add(id)
      for (const id of nested.contentIds) if (!nested.dayContentIds.has(id)) add(id)
      // Áreas EXPLÍCITAS (`_area`, movidas a mano o legacy) → seguir pintándolas.
      for (const n of store.allActive()) {
        if (n.deletedAt || seen.has(n.id) || !isArea(n)) continue
        add(n.id)
        for (const c of store.children(n.id)) add(c.id)
      }
      // Elementos SUELTOS del lienzo (hijos directos del nodo-lienzo con posición): vistas
      // (tabla/kanban/calendario), texto creado fuera de un contexto, recursos pegados…
      for (const n of store.children(parentId)) {
        if (n.deletedAt || seen.has(n.id)) continue
        if (readPin(n) || canvasViewKind(n)) add(n.id)
      }
      return out
    }
    const out = [...directChildren]
    for (const n of directChildren) if (isArea(n)) out.push(...store.children(n.id).filter(c => !c.deletedAt))
    return out
  }, [parentId, globalCanvas, nodesVersion, nested, region]) // eslint-disable-line react-hooks/exhaustive-deps
  // Referencias (espejos) de este lienzo — nodos de la columna arrastrados aquí.
  const refIds = readRefs(parentId)
  const refsKey = refIds.join(',')

  // Cuerpo de la pizarra (trazos + conectores) parseado UNA vez por cambio de body,
  // no en cada render. Pan/zoom no tocan el body (salvo el guardado de cámara cada
  // ~700ms), así que evita el JSON.parse por frame en el render de trazos/conectores.
  const parentBody = store.getNode(parentId)?.body
  const wbData = useMemo(() => parsePizarra(parentBody), [parentBody])

  // Modelo: los nodos COLOCADOS (con _pinX/_pinY) flotan libres en el lienzo; los
  // demás fluyen como en la LISTA (columna ancho-completo, apilados naturalmente,
  // sin solaparse). Al arrastrar uno del flujo, gana posición y pasa a flotar; al
  // volver a Lista, todos vuelven a su orden.
  // Zonas = MARCOS. En el lienzo global TODO contexto es un marco (área anidada). Fuera
  // de global, solo las áreas guardadas explícitamente (`_area`).
  const zoneIds = useMemo(() => {
    const set = new Set<string>()
    if (globalCanvas && nested) for (const id of nested.contextIds) set.add(id)
    for (const n of children) if (isArea(n)) set.add(n.id) // áreas explícitas (todos los modos)
    return set
  }, [children, globalCanvas, nested])
  const layout = useMemo(() => {
    const map = new Map<string, WorldPos>()
    for (const n of children) {
      if (isHiddenPin(n) || zoneIds.has(n.id)) continue // marco / marcador de vista → no es card
      const auto = nested ? nested.items.get(n.id) ?? null : null
      const pin = readPin(n) ?? (auto ? { x: auto.x, y: auto.y } : null)
      if (pin) map.set(n.id, { x: pin.x, y: pin.y })
    }
    return map
  }, [children, nested, zoneIds])

  // ── Minimapa: rectángulos (en MUNDO) de todo el contenido del lienzo, para
  // dibujar la «vista de pájaro» abajo a la izquierda. Se recalcula solo cuando
  // cambian los elementos o los trazos (no en cada pan/zoom). ──────────────────
  const miniRects = useMemo(() => {
    const rects: { x: number; y: number; w: number; h: number }[] = []
    for (const [id, pos] of layout) {
      const n = store.getNode(id); if (!n) continue
      const w = readCardW(n) * readCardScale(n)
      const h = 120 * readCardScale(n)
      rects.push({ x: pos.x, y: pos.y, w, h })
    }
    for (const s of (wbData.strokes || [])) {
      const b = strokeBBox(s); if (b) rects.push({ x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 })
    }
    return rects
  }, [layout, wbData])

  // FLUJO: nodos del día SIN posición → se apilan en una columna sobre el lienzo
  // (orden natural, sin solaparse). Los eventos GCal NO van al lienzo (viven en la
  // columna derecha). Al arrastrar uno del flujo gana pin y pasa a flotar.
  const flowNodes = useMemo(() => {
    if (globalCanvas) return [] as Node[] // en el plano único solo aparece lo COLOCADO
    if (!flowUnpositioned) return [] as Node[]
    // En la diaria, todo lo que vive en la columna derecha (eventos, capturas y
    // tareas/bucles del cockpit) NO se pinta en el lienzo (evita duplicados).
    const parent = store.getNode(parentId)
    const isDiary = !!parent?.isDiaryEntry
    // REGLA: en el lienzo solo aparece lo CREADO en el lienzo o ARRASTRADO a él
    // (= lo que tiene pin, que se gestiona aparte en `visible`). En la DIARIA NO se
    // auto-fluye nada: su contenido (tareas, eventos, notas, capturas) vive en la
    // columna del día; el lienzo del día es solo para lo que el usuario coloca.
    if (isDiary) return [] as Node[]
    // _moved → bloque «Movidos» de la nota (no en el lienzo hasta colocarlo).
    return children.filter(n => !isHiddenPin(n) && !isDocNode(n) && !canvasViewKind(n) && !readPin(n) && !getGcalEventId(n) && !n.isEvent && !isCapturePin(n) && !isMovedNode(n) && !isContextKnowledge(n.text))
  }, [children, flowUnpositioned, parentId, globalCanvas])

  // ── Buceo (dive) entre lienzos al cruzar umbrales de zoom con la rueda ──────
  // Zoom-out fuerte → SUBE: si es la diaria → Agenda (calendario centrado en su
  // mes); si no → al nodo padre. Zoom-in fuerte sobre la tarjeta centrada → ENTRA.
  tryDiveRef.current = (nextScale: number, prevScale: number) => {
    if (divingRef.current) return
    const node = store.getNode(parentId)
    if (!node) return
    const zoomingOut = nextScale < prevScale
    const zoomingIn = nextScale > prevScale
    // SUBIR — solo al ALEJAR y cruzar el umbral (no por estar ya por debajo).
    if (zoomingOut && nextScale <= DIVE_OUT_SCALE) {
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
    // ENTRAR — solo al ACERCAR y cruzar el umbral sobre una tarjeta dominante.
    if (zoomingIn && nextScale >= DIVE_IN_SCALE) {
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

  // ── Mover elementos con BOTÓN DERECHO + arrastrar ────────────────────────────
  // Pulsa el botón derecho sobre CUALQUIER parte de un elemento y arrastra → se
  // mueve (da igual dónde piques). Soltar SIN mover = menú contextual; soltar tras
  // mover = solo mueve (sin menú). Listeners NATIVOS en captura: funciona aunque un
  // hijo (editor) pare la propagación y controla el contextmenu en toda plataforma.
  // Las TABLAS (`pizarra-node--el`) se excluyen: ahí el clic derecho es para sus
  // filas/columnas (se mueven desde su cabecera).
  const suppressContextRef = useRef(false)
  const layoutRef = useRef(layout); layoutRef.current = layout
  const nodeCtx = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault(); e.stopPropagation()
    if (suppressContextRef.current) return   // lo gestiona el right-drag (lo abre en pointerup)
    setContextMenu({ nodeId: id, x: e.clientX, y: e.clientY })
  }, [])
  useEffect(() => {
    const el = containerRef.current; if (!el) return
    const s2w = (sx: number, sy: number): WorldPos => ({ x: (sx - camRef.current.x) / camRef.current.scale, y: (sy - camRef.current.y) / camRef.current.scale })
    let rd: { id: string; sw: WorldPos; origin: WorldPos; sx: number; sy: number; moved: boolean; last: WorldPos } | null = null
    const onDown = (e: PointerEvent) => {
      suppressContextRef.current = false   // resetea de un right-click anterior
      if (e.button !== 2) return
      // GRUPO: si hay una selección activa (cards y/o trazos), botón derecho + arrastrar
      // mueve TODA la selección junta vía el xf (preview/commit los gestiona React).
      if (toolRef.current === 'select' && (multiSelRef.current.size + selStrokesRef.current.size) > 0) {
        const r0 = el.getBoundingClientRect()
        const start = s2w(e.clientX - r0.left, e.clientY - r0.top)
        const all = parsePizarra(store.getNode(parentIdRef.current)?.body).strokes
        const ids = [...selStrokesRef.current]
        const origin = new Map<string, number[]>()
        const startWidth = new Map<string, number>()
        for (const s of all) if (selStrokesRef.current.has(s.id)) { origin.set(s.id, [...s.pts]); startWidth.set(s.id, s.w) }
        const cards: { id: string; px: number; py: number; sc: number }[] = []
        for (const id of multiSelRef.current) {
          const n = store.getNode(id); if (!n) continue
          const p = layoutRef.current.get(id) ?? readPin(n); if (!p) continue
          cards.push({ id, px: p.x, py: p.y, sc: readCardScale(n) })
        }
        xfRef.current = { kind: 'move', ids, origin, startWidth, cards, start, moved: false }
        setXf({ kind: 'move', dx: 0, dy: 0 })
        try { el.setPointerCapture(e.pointerId) } catch { /* noop */ }
        suppressContextRef.current = true   // este right-click lo maneja el group-drag
        return
      }
      const card = (e.target as HTMLElement)?.closest?.('[data-card][data-node-id]') as HTMLElement | null
      if (!card || card.classList.contains('pizarra-node--el')) return
      const id = card.getAttribute('data-node-id'); if (!id) return
      const r = el.getBoundingClientRect()
      const sw = s2w(e.clientX - r.left, e.clientY - r.top)
      let origin = layoutRef.current.get(id)
      if (!origin) { const cr = card.getBoundingClientRect(); origin = s2w(cr.left - r.left, cr.top - r.top) }
      const o = origin || { x: 0, y: 0 }
      rd = { id, sw, origin: o, sx: e.clientX, sy: e.clientY, moved: false, last: o }
      suppressContextRef.current = true     // este right-click lo abre/maneja el right-drag
    }
    const onMove = (e: PointerEvent) => {
      if (!rd) return
      if (!rd.moved && Math.abs(e.clientX - rd.sx) + Math.abs(e.clientY - rd.sy) < 4) return
      if (!rd.moved) { rd.moved = true; try { el.setPointerCapture(e.pointerId) } catch { /* noop */ } }
      const r = el.getBoundingClientRect()
      const w = s2w(e.clientX - r.left, e.clientY - r.top)
      rd.last = { x: rd.origin.x + (w.x - rd.sw.x), y: rd.origin.y + (w.y - rd.sw.y) }
      setDragPos({ id: rd.id, pos: rd.last })
    }
    const onUp = (e: PointerEvent) => {
      if (!rd) return
      const cur = rd; rd = null
      try { el.releasePointerCapture(e.pointerId) } catch { /* noop */ }
      if (cur.moved) {
        const node = store.getNode(cur.id)
        if (node) { writePin(node, cur.last); reparentByRegionRef.current(cur.id, cur.last) }
        setDragPos(null)
      } else {
        // Clic derecho limpio (sin mover) → menú contextual del nodo.
        setContextMenu({ nodeId: cur.id, x: e.clientX, y: e.clientY })
      }
    }
    const onCtx = (e: MouseEvent) => { if (suppressContextRef.current) { e.preventDefault(); e.stopPropagation() } }
    el.addEventListener('pointerdown', onDown, true)
    window.addEventListener('pointermove', onMove, true)
    window.addEventListener('pointerup', onUp, true)
    el.addEventListener('contextmenu', onCtx, true)
    return () => {
      el.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('pointermove', onMove, true)
      window.removeEventListener('pointerup', onUp, true)
      el.removeEventListener('contextmenu', onCtx, true)
    }
  }, [])

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

  // Volar a un ÁREA: centra su región y ajusta el zoom para encuadrarla (usa el zoom
  // guardado si lo tiene; si no, encaja la región en el viewport).
  const flyToArea = useCallback((id: string) => {
    const a = store.getNode(id); if (!a) return
    // Área explícita (`_area`), caja de contexto o ZONA de día (agenda-calendario).
    const rect = readAreaRect(a) ?? nestedRef.current?.boxes.get(id) ?? nestedRef.current?.dayCells.get(id) ?? null
    if (!rect) { flyToNode(a); return }
    const vp = viewportRef.current
    let ed: Record<string, unknown> = {}; try { ed = JSON.parse(a.extraData || '{}') } catch { /* vacío */ }
    const saved = Number(ed[PIN_SCALE])
    // Caja auto: encuadrar la región en el viewport (deja aire). Explícita con zoom guardado: usarlo.
    const scale = (readAreaRect(a) && Number.isFinite(saved) && saved > 0)
      ? saved
      : Math.min(vp.w / rect.w, vp.h / rect.h) * 0.9
    flyTo(rect.x + rect.w / 2, rect.y + rect.h / 2, scale)
  }, [flyTo, flyToNode])

  // Volar al DÍA DE HOY (área de la agenda) + abrir su columna del día. Si el día acaba
  // de crearse, la caja aparece tras el re-render del layout → reintento breve.
  const flyToToday = useCallback(() => {
    const day = ensureDayPath(new Date())
    setRegion('agenda') // entrar en la hoja de la agenda
    window.dispatchEvent(new CustomEvent('from:open-detail', { detail: { nodeId: day.id } }))
    flyToArea(day.id)
    setTimeout(() => flyToArea(day.id), 90)
  }, [flyToArea])

  // ⚠️ REVERTIDO en v9.6.677: un useEffect de montaje que llamaba flyToToday() (con
  // ensureDayPath → store.createNode) nada más entrar al lienzo global causaba un error al
  // escribir poco después de cargar. Sospecha: se disparaba ANTES de que el store terminase de
  // hidratarse/sincronizar desde el servidor, creando un día "local" que luego colisionaba con
  // el que llega por sync. Antes de reintentar «abrir siempre en hoy», hace falta enganchar el
  // trigger a una señal real de «datos ya cargados», no al montaje del componente.

  // Color de acento de un contexto (`_tagColor`) — desde el menú de clic derecho.
  const setContextAccentColor = useCallback((id: string, color: string) => {
    const n = store.getNode(id); if (!n) return
    let eo: Record<string, unknown> = {}; try { eo = JSON.parse(n.extraData || '{}') } catch { /* noop */ }
    eo._tagColor = color
    store.updateNode(id, { extraData: JSON.stringify(eo) })
  }, [])

  // Eliminar un contexto Y todo su contenido (subárbol completo).
  const deleteContextTree = useCallback((id: string) => {
    const ids: string[] = []
    const collect = (nid: string) => { ids.push(nid); for (const c of store.children(nid)) if (!c.deletedAt) collect(c.id) }
    collect(id)
    store.beginBatch()
    try { for (const nid of ids) store.deleteNode(nid) } finally { store.endBatch() }
    setSelectedId(null)
  }, [])

  // Al abrir, el lienzo arranca en la hoja de CONTEXTOS (principal). La AGENDA es una
  // hoja aparte a la que se entra desde el botón de día / el calendario. (Antes se
  // auto-volaba a hoy; ahora la agenda es separada y no se entra sin pedirlo.)

  // Auto-reparentar una card según la REGIÓN donde cae su pin: si entra en un área →
  // pasa a ser su hija; si sale de toda área → vuelve a la nota. Mantiene viva la
  // jerarquía al arrastrar (las áreas viejas/marcadores no cuentan).
  const reparentByRegion = useCallback((nodeId: string, pin: WorldPos) => {
    const n = store.getNode(nodeId); if (!n || isArea(n)) return
    let target: string | null = null
    for (const a of store.children(parentId)) {
      if (!isArea(a)) continue
      const r = readAreaRect(a); if (!r) continue
      if (pin.x >= r.x && pin.x <= r.x + r.w && pin.y >= r.y && pin.y <= r.y + r.h) { target = a.id; break }
    }
    const desired = target ?? parentId
    if (n.parentId !== desired) store.updateNode(nodeId, { parentId: desired })
  }, [parentId])
  const reparentByRegionRef = useRef(reparentByRegion); reparentByRegionRef.current = reparentByRegion

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
  const uploadAndPinFiles = useCallback(async (files: File[], world: WorldPos): Promise<string | null> => {
    let i = 0
    let firstId: string | null = null
    for (const file of files) {
      const off = { x: world.x + i * 28, y: world.y + i * 28 }
      const type: ResourceKind = file.type.startsWith('image/') ? 'image' : file.type === 'application/pdf' ? 'pdf' : 'file'
      window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: `Subiendo ${file.name}…`, type: 'info' } }))
      try {
        const { key, publicUrl } = await uploadFile(file)
        const id = createResourceAt(off, { url: publicUrl, type, key, title: file.name })
        if (!firstId) firstId = id
        window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: `${file.name} añadido al lienzo`, type: 'success' } }))
      } catch (err) {
        window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: `Error subiendo ${file.name}: ${err instanceof Error ? err.message : 'desconocido'}`, type: 'warning' } }))
      }
      i++
    }
    return firstId
  }, [createResourceAt])

  // Soltar sobre la pizarra: archivos→subida+ancla; un nodo interno arrastrado de la
  // columna derecha→se coloca; una URL externa→nodo-enlace anclado en el punto.
  const onCanvasDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()  // el lienzo gestiona el drop; no dejar que NodeView lo suba como adjunto
    const rect = containerRef.current!.getBoundingClientRect()
    const w = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
    const files = Array.from(e.dataTransfer.files || [])
    if (files.length) {
      // .md/.txt → se vuelca su contenido en un nodo-documento anclado (no se sube
      // como archivo). El resto (imágenes, PDF, etc.) → subida + tarjeta.
      const mdFiles = files.filter(f => /\.(md|markdown|txt)$/i.test(f.name))
      const otherFiles = files.filter(f => !/\.(md|markdown|txt)$/i.test(f.name))
      // Cada .md → su propio nodo-documento, colocados en REJILLA (no en cascada,
      // para que muchos no se solapen).
      const cols = Math.max(1, Math.ceil(Math.sqrt(mdFiles.length)))
      const GAP_X = 260, GAP_Y = 210
      if (mdFiles.length) {
        // Todo el import = UN solo paso de undo (beginBatch/endBatch). Async → se
        // batchea de forma manual leyendo todos los textos antes de crear.
        void (async () => {
          const contents = await Promise.all(mdFiles.map(f => f.text()))
          store.beginBatch()
          try {
            contents.forEach((content, i) => {
              const n = createMarkdownNode(parentId, content, mdFiles[i].name, false)
              if (n) writePin(store.getNode(n.id)!, { x: w.x + (i % cols) * GAP_X, y: w.y + Math.floor(i / cols) * GAP_Y })
            })
          } finally { store.endBatch() }
        })()
      }
      if (otherFiles.length) uploadAndPinFiles(otherFiles, w).then(id => {
        // Vuela al recurso recién soltado y lo selecciona → visible aunque estés muy alejado
        // (zoom bajo) o el drop cayera lejos. Abre además su columna derecha (visor).
        if (!id) return
        setSelectedId(id)
        const n = store.getNode(id)
        if (n) setTimeout(() => flyToNode(n), 200)
      })
      return
    }
    // Nodo arrastrado desde la columna derecha / árbol (varias claves posibles).
    const id = (e.dataTransfer.getData('nodeId') || e.dataTransfer.getData('from/nodeId') || e.dataTransfer.getData('text/plain') || '').trim()
    const dn = id ? store.getNode(id) : null
    if (dn && id !== parentId) {
      const isChild = store.children(parentId).some(c => c.id === id)
      writePin(dn, { x: w.x - 16, y: w.y - 12 })
      // Si no es hijo de este lienzo, se MUESTRA como referencia (no se mueve).
      if (!isChild) addRef(parentId, id)
      return
    }
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
      // PEGAR selección copiada del lienzo (trazos + cards) — solo si el portapapeles
      // del sistema sigue siendo el nuestro (si copiaron otro texto, no la usamos).
      const sysText = e.clipboardData?.getData('text/plain') ?? ''
      if (pizarraClipboard && sysText === pizarraClipboard.text && (pizarraClipboard.cards.length + pizarraClipboard.strokes.length) > 0) {
        e.preventDefault()
        const clip = pizarraClipboard
        store.beginBatch()
        try {
          for (const cd of clip.cards) {
            const ed: Record<string, string> = {
              [PIN_X]: String(Math.round(world.x + cd.dx)), [PIN_Y]: String(Math.round(world.y + cd.dy)),
              [PIN_SCALE]: '1', _cardScale: String(cd.sc), _pinW: String(Math.round(cd.w)),
            }
            const node = store.createNode({ text: cd.text, parentId, siblingOrder: 0, types: cd.types, extraData: ed })
            if (cd.body != null) store.updateNode(node.id, { body: cd.body })
          }
          if (clip.strokes.length) {
            const data = parsePizarra(store.getNode(parentId)?.body)
            const add = clip.strokes.map(s => ({ ...s, id: rid(), pts: s.pts.map((v, i) => i % 2 === 0 ? v + world.x : v + world.y) }))
            data.strokes = [...data.strokes, ...add]
            store.updateNode(parentId, { body: bodyWithPizarra(store.getNode(parentId)?.body, data) })
          }
        } finally { store.endBatch() }
        return
      }
      const img = items.find(it => it.type.startsWith('image/'))
      if (img) { const f = img.getAsFile(); if (f) { e.preventDefault(); void uploadAndPinFiles([f], world) } return }
      const text = (e.clipboardData?.getData('text/plain') || '').trim()
      if (!text) return
      if (/^https?:\/\/\S+$/i.test(text)) { e.preventDefault(); createResourceAt(world, { url: text, type: 'url', title: text }); return }
      // Texto/markdown pegado → nodo-documento anclado en el centro de la vista.
      // Un solo paso de undo.
      e.preventDefault()
      store.beginBatch()
      try {
        const n = createMarkdownNode(parentId, text, undefined, false)
        if (n) writePin(store.getNode(n.id)!, world)
      } finally { store.endBatch() }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [uploadAndPinFiles, createResourceAt, parentId])

  // Quitar de la pizarra (NO borra el nodo): elimina el pin y lo marca `_moved` para
  // que salga del lienzo y aparezca en la lista «Movidos» de la columna derecha de la
  // nota (NoteColumn), de donde se puede arrastrar de vuelta o eliminar con su icono.
  const removeFromCanvas = useCallback((id: string) => {
    const node = store.getNode(id); if (!node) return
    // Si es un ESPEJO (referencia, no hijo del lienzo): solo se quita la referencia;
    // el nodo sigue en su sitio (columna/agenda).
    if (readRefs(parentId).includes(id) && !store.children(parentId).some(c => c.id === id)) {
      removeRef(parentId, id)
      return
    }
    let ed: Record<string, unknown> = {}
    try { ed = JSON.parse(node.extraData || '{}') } catch { /* corrupto */ }
    delete ed[PIN_X]; delete ed[PIN_Y]; delete ed[PIN_SCALE]
    ed._moved = '1'
    store.updateNode(id, { extraData: JSON.stringify(ed) })
  }, [parentId])

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

  // COPIAR un único nodo (menú clic-derecho, node aún no está en multiSel).
  const copyNode = useCallback((id: string) => {
    const n = store.getNode(id); if (!n) return
    pizarraClipboard = {
      strokes: [],
      cards: [{ text: n.text || '', body: n.body ?? null, types: [...(n.types || [])], dx: 0, dy: 0, sc: readCardScale(n), w: readCardW(n) }],
      text: n.text || '', ts: Date.now(),
    }
    try { void navigator.clipboard.writeText(n.text || '') } catch { /* sin permiso → solo portapapeles interno */ }
  }, [])

  // COPIAR la selección (trazos + cards) «tal cual». La guarda en el portapapeles en
  // memoria del lienzo (para pegar en CUALQUIER pizarra) y, aparte, copia el TEXTO
  // plano al portapapeles del sistema (para pegar en un editor de texto). Coords
  // relativas al origen (min x,y) de la selección → se pega centrado donde toque.
  const copySelection = useCallback(() => {
    const data = parsePizarra(store.getNode(parentId)?.body)
    const strokes = data.strokes.filter(s => selStrokes.has(s.id))
    // Origen = mínimo (x,y) de todo lo seleccionado (trazos + cards).
    let ox = Infinity, oy = Infinity
    for (const s of strokes) for (let i = 0; i + 1 < s.pts.length; i += 2) { ox = Math.min(ox, s.pts[i]); oy = Math.min(oy, s.pts[i + 1]) }
    const cardPins = new Map<string, WorldPos>()
    for (const id of multiSel) { const n = store.getNode(id); if (!n) continue; const p = layout.get(id) ?? readPin(n); if (p) { cardPins.set(id, p); ox = Math.min(ox, p.x); oy = Math.min(oy, p.y) } }
    if (!isFinite(ox)) { ox = 0; oy = 0 }
    const cards: PizClipCard[] = []
    const textParts: string[] = []
    for (const id of multiSel) {
      const n = store.getNode(id); if (!n) continue
      const p = cardPins.get(id) ?? { x: ox, y: oy }
      cards.push({ text: n.text || '', body: n.body ?? null, types: [...(n.types || [])], dx: p.x - ox, dy: p.y - oy, sc: readCardScale(n), w: readCardW(n) })
      if (n.text) textParts.push(n.text)
    }
    const plain = textParts.join('\n')
    pizarraClipboard = {
      strokes: strokes.map(s => ({ ...s, id: rid(), g: undefined, pts: s.pts.map((v, i) => i % 2 === 0 ? v - ox : v - oy) })),
      cards, text: plain, ts: Date.now(),
    }
    try { void navigator.clipboard.writeText(plain) } catch { /* sin permiso → solo portapapeles interno */ }
    setMenuPos(null)
  }, [parentId, selStrokes, multiSel, layout])

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
    // 't'/'d' (texto/documento) retirados: el texto se crea con DOBLE CLIC.
    v: 'select', b: 'pen', m: 'marker', h: 'highlighter', e: 'eraser',
    a: 'arrow', l: 'line', r: 'rect', o: 'ellipse',
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
  // Captura las cards seleccionadas (multiSel) con su pin + escala actuales, para
  // transformarlas (mover/escalar) junto con los trazos en una sola operación.
  const captureSelCards = useCallback((): { id: string; px: number; py: number; sc: number }[] => {
    const out: { id: string; px: number; py: number; sc: number }[] = []
    for (const id of multiSel) {
      const n = store.getNode(id); if (!n) continue
      const p = layout.get(id) ?? readPin(n); if (!p) continue
      out.push({ id, px: p.x, py: p.y, sc: readCardScale(n) })
    }
    return out
  }, [multiSel, layout])

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
    // Si la multiselección también tiene cards, moverlas junto a los trazos.
    const cards = alreadySel ? captureSelCards() : []
    xfRef.current = { kind: 'move', ids, origin, startWidth, cards, start, moved: false }
    containerRef.current!.setPointerCapture(e.pointerId)
    setXf({ kind: 'move', dx: 0, dy: 0 })
  }, [parentId, selStrokes, screenToWorld, captureSelCards])

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
    xfRef.current = { kind: 'scale', ids, origin, startWidth, cards: captureSelCards(), start, anchor, corner, moved: false }
    containerRef.current!.setPointerCapture(e.pointerId)
    setXf({ kind: 'scale', ax: anchor.x, ay: anchor.y, s: 1 })
  }, [parentId, selStrokes, screenToWorld, captureSelCards])

  // Dar CUERPO FÍSICO (un ÁREA = la región visible ahora mismo) a un CONTEXTO. El
  // contexto puede ser existente (elegido en el buscador) o recién creado — mismo dato.
  // Contexto y área son la MISMA entidad: aquí solo le añadimos `_area` + pin/tamaño al
  // nodo del contexto. Las cards dentro de la región se reparentan como hijas (contención
  // física). Al pulsar el contexto (aquí o desde cualquier columna) la cámara vuela aquí.
  const attachAreaToContext = useCallback((contextId: string) => {
    const ctx = store.getNode(contextId); if (!ctx) return
    const c = camRef.current, vp = viewportRef.current
    const x0 = (0 - c.x) / c.scale, y0 = (0 - c.y) / c.scale
    const w = vp.w / c.scale, h = vp.h / c.scale
    store.beginBatch()
    try {
      let ed: Record<string, unknown> = {}
      try { ed = JSON.parse(ctx.extraData || '{}') } catch { /* corrupto → vacío */ }
      ed[AREA] = '1'
      ed['_ctx'] = '1' // asegura que es contexto (gana su columna derecha)
      ed[PIN_X] = String(Math.round(x0))
      ed[PIN_Y] = String(Math.round(y0))
      ed[AREA_W] = String(Math.round(w))
      ed[AREA_H] = String(Math.round(h))
      ed[PIN_SCALE] = String(Number(c.scale.toFixed(4))) // zoom de referencia para volar
      store.updateNode(contextId, { extraData: JSON.stringify(ed) })
      // Reparentar las CARDS cuyo pin cae dentro de la región como hijas del contexto.
      // (No mueve nada visualmente: el pin es absoluto; solo cambia el padre en el árbol.)
      for (const n of store.children(parentId)) {
        if (n.id === contextId || isArea(n) || isHiddenPin(n)) continue
        const p = readPin(n); if (!p) continue
        if (p.x >= x0 && p.x <= x0 + w && p.y >= y0 && p.y <= y0 + h) {
          store.updateNode(n.id, { parentId: contextId })
        }
      }
    } finally { store.endBatch() }
    // Feedback: selecciona el contexto (abre su columna) y vuela a la región recién creada.
    setSelectedId(contextId)
    window.dispatchEvent(new CustomEvent('from:pizarra-flyto', { detail: { nodeId: contextId } }))
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
      if (!n) return
      // DÍA (celda de agenda) → cambia a la HOJA agenda y vuela. Contexto/área → hoja contextos.
      if (nestedRef.current?.dayCells.has(id)) { setRegion('agenda'); flyToArea(id); return }
      if (isArea(n) || nestedRef.current?.boxes.has(id)) { setRegion('contexts'); flyToArea(id); return }
      if (store.children(parentId).some(c => c.id === id)) flyToNode(n)
    }
    window.addEventListener('from:pizarra-flyto', h)
    return () => window.removeEventListener('from:pizarra-flyto', h)
  }, [flyToNode, flyToArea, parentId])

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
      const prevScale = camRef.current.scale
      let nextScale = prevScale
      setCam(prev => {
        const factor = Math.exp(-e.deltaY * 0.0015)
        const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale * factor))
        nextScale = next
        // Mantener fijo el punto de mundo bajo el cursor.
        const wx = (sx - prev.x) / prev.scale
        const wy = (sy - prev.y) / prev.scale
        return { x: sx - wx * next, y: sy - wy * next, scale: next }
      })
      // Solo bucea si el gesto va en el sentido del salto (salir al alejar, entrar
      // al acercar). Si no, estar por debajo/encima del umbral no debe disparar nada.
      tryDiveRef.current(nextScale, prevScale)
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  // Crear un nodo colocado en coordenadas de mundo y seleccionarlo (el
  // OutlinerNode embebido se enfoca al estar seleccionado → listo para escribir).

  // ── Elementos-texto del lienzo = NODOS `_doc`+`_ctext` anclados (FUENTE ÚNICA) ─
  // El texto del lienzo ya NO vive como WBText en el body de la pizarra: es un nodo
  // hijo. El MISMO nodo se pinta aquí y se abre en solitario con DocEditor; ambos
  // editan `node.body`. Sin copias ni sincronización.
  const newTextExtra = (world: WorldPos): Record<string, string> => ({
    [DOC]: '1', [CTEXT]: '1', _pinW: '360',
    [PIN_X]: String(Math.round(world.x)), [PIN_Y]: String(Math.round(world.y)), [PIN_SCALE]: '1',
  })

  const createTextAt = useCallback((world: WorldPos, parentOverride?: string) => {
    // Texto libre (DocEditor/TipTap): entra directo en EDICIÓN → cursor parpadeando y
    // barra flotante de estilos. Nace dentro del contexto donde se hace clic (si hay).
    // Se crea SIEMPRE a tamaño NORMAL legible sea cual sea el zoom (`_cardScale = 1/zoom`
    // compensa el zoom del lienzo) y queda anclado a ese zoom (acercar→más grande).
    const cs = camRef.current.scale
    const extra = { ...newTextExtra(world), [PIN_SCALE]: String(Number(cs.toFixed(4))), _cardScale: String(Number((1 / cs).toFixed(3))) }
    const node = store.createNode({ text: '', parentId: parentOverride || parentId, extraData: extra })
    store.updateNode(node.id, { body: '<p></p>' })
    setTool('select')
    setEditText(node.id)
    return node.id
  }, [parentId])

  // Al SALIR de la edición de un texto: si quedó VACÍO (no se escribió nada), se borra
  // → no deja nodos «Sin título» sueltos por clics accidentales. Cubre el DOCUMENTO
  // (editText) y el NODO de esquema creado con un clic (selección).
  const prevEditRef = useRef<string | null>(null)
  useEffect(() => {
    const prev = prevEditRef.current
    prevEditRef.current = editText
    if (prev && prev !== editText) {
      const n = store.getNode(prev)
      if (n && isDocNode(n)) {
        const body = (n.body || '').replace(/<[^>]*>/g, '').trim()
        if (!body && !(n.text || '').trim()) store.deleteNode(prev)
      }
    }
  }, [editText])
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

  // Heptabase Fase 2: seleccionar texto en el visor PDF (columna derecha) → botón
  // «Enviar al lienzo» → tarjeta `_doc` con la cita, anclada junto al PDF de origen.
  // Se marca `_pdfSelection` (+ referencia al PDF y página) para que sea BUSCABLE y
  // filtrable como «selección» en el panel de Elementos (igual que en Heptabase).
  // `mode:'canvas'` (Enviar al lienzo) coloca la tarjeta con pin, visible, y vuela la
  // cámara. `mode:'save'` (Guardar) crea el MISMO nodo buscable pero SIN pin: no ocupa
  // sitio en el lienzo, solo aparece por búsqueda / panel Elementos.
  useEffect(() => {
    const h = (e: Event) => {
      const detail = (e as CustomEvent<{ text?: string; sourceNodeId?: string; filename?: string; page?: number | null; mode?: 'canvas' | 'save' }>).detail
      const text = (detail?.text || '').trim()
      const sourceId = detail?.sourceNodeId
      if (!text || !sourceId) return
      const src = store.getNode(sourceId)
      if (!src) return
      const targetParent = src.parentId || parentId
      const mode = detail?.mode ?? 'canvas'
      let extra: Record<string, string> = { [DOC]: '1', [CTEXT]: '1', _pdfSelection: '1', _pdfSourceId: sourceId }
      if (mode === 'canvas') {
        const pin = readPin(src) || { x: 0, y: 0 }
        const world = { x: pin.x + 380, y: pin.y }
        extra = { ...extra, ...newTextExtra(world) }
      }
      if (detail?.page != null) extra._pdfPage = String(detail.page)
      const quoteNode = store.createNode({ text: '', parentId: targetParent, extraData: extra })
      const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      store.updateNode(quoteNode.id, { body: `<blockquote><p>${escapeHtml(text)}</p></blockquote>` })
      if (mode === 'canvas') {
        setSelectedId(quoteNode.id)
        setTimeout(() => { const n = store.getNode(quoteNode.id); if (n) flyToNode(n) }, 200)
      } else {
        window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: t('elements.savedToast'), type: 'success' } }))
      }
    }
    window.addEventListener('from:pdf-send-to-canvas', h)
    return () => window.removeEventListener('from:pdf-send-to-canvas', h)
  }, [parentId, flyToNode])

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
    // Nace DENTRO del contexto donde está el centro del viewport (si lo hay) → le pertenece.
    let parent = parentId
    const boxes = nestedRef.current?.boxes
    if (boxes) { let best = Infinity; for (const [id, r] of boxes) { if (wx >= r.x && wx <= r.x + r.w && wy >= r.y && wy <= r.y + r.h) { const sz = r.w * r.h; if (sz < best) { best = sz; parent = id } } } }
    const node = store.createNode({
      text: titles[kind], parentId: parent,
      extraData: { viewBlock: kind, [PIN_X]: String(Math.round(wx - Number(width) / 2)), [PIN_Y]: String(Math.round(wy - 120)), [PIN_SCALE]: '1', _pinW: width },
    })
    // La TABLA arranca con una fila vacía → las celdas aparecen ya y se puede escribir al
    // instante (NodeTableView enfoca la 1ª celda). Enter crea la siguiente, sin botón.
    if (kind === 'tabla') store.createNode({ text: '', parentId: node.id, siblingOrder: Date.now() })
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
  // LIENZO ÚNICO: el texto es LIBRE, no se "entra" a ningún sitio. Clic en su dot/
  // marcador = SELECCIONAR (abre columna derecha), nunca navegar a /node.
  const openTextAsDoc = useCallback((id: string) => {
    if (globalCanvas) { setSelectedId(id); return }
    navigate(`/node/${id}`)
  }, [navigate, globalCanvas])

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
    // Texto/Documento: NO crear aquí (en pointerdown) para no provocar un blur inmediato.
    // Se crea en el onClick del contenedor (gesto completo). Solo evitamos el pan.
    if (toolRef.current === 'text' || toolRef.current === 'doc') return
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
        // CARDS de la selección: misma transformación sobre su pin (+ escala al escalar).
        for (const c of t.cards) {
          const n = store.getNode(c.id); if (!n) continue
          const np = cur.kind === 'move'
            ? { x: c.px + cur.dx, y: c.py + cur.dy }
            : { x: cur.ax + (c.px - cur.ax) * cur.s, y: cur.ay + (c.py - cur.ay) * cur.s }
          writeCardSize(n, cur.kind === 'move' ? { pin: np } : { pin: np, scale: Math.max(0.1, c.sc * cur.s) })
          reparentByRegion(c.id, np)
        }
      } else if (t.kind === 'move') {
        // Clic limpio (sin arrastrar): si la selección es UN solo elemento (card), unificar
        // con el menú completo del clic-derecho normal (Quitar/Copiar/Favorito/Duplicar/Eliminar).
        // Si es selección múltiple o incluye trazos, mini-menú reducido (Copiar/Duplicar/Eliminar).
        if (t.cards.length === 1 && t.ids.length === 0) {
          setContextMenu({ nodeId: t.cards[0].id, x: e.clientX, y: e.clientY })
        } else {
          setMenuPos({ x: e.clientX, y: e.clientY })
        }
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
      // Tras el marco, mostrar el mini-menú (Duplicar/Eliminar) sobre la selección.
      // Solo se pinta si hay algo seleccionado (guard en el render de menuPos).
      setMenuPos({ x: e.clientX, y: e.clientY })
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
          if (n) { const np = { x: m.origin.x + dx, y: m.origin.y + dy }; writePin(n, np); reparentByRegion(m.id, np) }
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
        if (node) { writePin(node, dp.pos); reparentByRegion(node.id, dp.pos) }
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
    if (t.closest('.node-text, .bullet-btn, button, a, input, textarea, select, [contenteditable="true"], .node-due-badge, .node-qp-badge, .node-date-actions, .node-priority-dot, [class*="ghost"], [class*="chip"], .context-inline, .cajon-inline')) return
    onCardPointerDown(e, node)
  }, [onCardPointerDown])

  // ── Redimensionado de TARJETA: manija izquierda (ancho) o esquina (escala) ──
  const onNodeResizeDown = useCallback((e: React.PointerEvent, node: Node, mode: 'width' | 'widthR' | 'scale') => {
    if (e.button !== 0) return
    e.stopPropagation()
    const pin = readPin(node) || { x: 0, y: 0 }
    const cardEl = (e.currentTarget as HTMLElement).closest('[data-card]') as HTMLElement | null
    const cardH = cardEl ? cardEl.offsetHeight : CARD_MIN_H
    // Texto limpio sin _pinW fijado (ancho max-content) → arrancar del ancho REAL del
    // CONTENIDO (offsetWidth menos el padding gutter de 22+30=52), no de CARD_W, para
    // que el tirador no salte y _pinW guarde el ancho de texto, no el del border-box.
    const hasW = (() => { try { return JSON.parse(node.extraData || '{}')._pinW != null } catch { return false } })()
    const plain = !isDocNode(node) && !canvasViewKind(node) && !readResource(node)
    const startW = hasW ? readCardW(node) : Math.max(120, (cardEl?.offsetWidth ?? readCardW(node)) - (plain ? 52 : 0))
    const rect = containerRef.current!.getBoundingClientRect()
    const startWorld = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
    nodeRzRef.current = { id: node.id, mode, startW, startScale: readCardScale(node), startPin: pin, startWorld, cardH, moved: false }
    nodeRzValRef.current = null
    containerRef.current!.setPointerCapture(e.pointerId)
    setNodeRz({ id: node.id, w: startW, scale: readCardScale(node), pin })
  }, [screenToWorld])

  // ── HEPTABASE FASE 3: dibujar ENCIMA de una tarjeta concreta ──────────────────
  // Mientras `annotatingId === node.id`, un overlay SVG (viewBox 0 0 100 100) cubre
  // TODA la tarjeta y captura el puntero. Los puntos se normalizan a 0-100 dividiendo
  // por el `getBoundingClientRect()` del propio overlay — así el trazo queda anclado
  // a la tarjeta (se mueve/escala con ella) sin tocar para nada las coordenadas de
  // mundo ni la cámara del lienzo.
  const onAnnoPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    annoDraftRef.current = { pts: [x, y], rect }
    setAnnoDraftPts([x, y]);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [])
  const onAnnoPointerMove = useCallback((e: React.PointerEvent) => {
    const draft = annoDraftRef.current
    if (!draft) return
    const x = ((e.clientX - draft.rect.left) / draft.rect.width) * 100
    const y = ((e.clientY - draft.rect.top) / draft.rect.height) * 100
    draft.pts.push(x, y)
    setAnnoDraftPts([...draft.pts])
  }, [])
  const onAnnoPointerUp = useCallback((node: Node) => {
    const draft = annoDraftRef.current
    annoDraftRef.current = null
    setAnnoDraftPts(null)
    if (!draft || draft.pts.length < 4) return // un solo punto (clic sin arrastrar): descartar
    const stroke: CardAnno = { id: rid(), pts: draft.pts.map(n => Math.round(n * 100) / 100), c: penColorRef.current, w: penWidthRef.current }
    writeCardAnnos(node, [...readCardAnnos(node), stroke])
  }, [])

  // ── Render ──────────────────────────────────────────────────────────────────
  // Mide la altura real de las tarjetas montadas (en unidades de mundo) tras cada
  // render. Si cambia, fuerza el recálculo del culling (heightsV).
  useLayoutEffect(() => {
    const cont = containerRef.current
    if (!cont) return
    let changed = false
    cont.querySelectorAll<HTMLElement>('[data-card="1"]').forEach(el => {
      const id = el.dataset.nodeId
      if (!id) return
      const h = el.offsetHeight   // altura de layout (sin el transform de escala)
      if (h <= 0) return
      const prev = cardHeights.current.get(id)
      if (prev == null || Math.abs(prev - h) > 2) { cardHeights.current.set(id, h); changed = true }
    })
    if (changed) setHeightsV(v => v + 1)
  })

  // Culling: una tarjeta es visible si su rect en pantalla intersecta el viewport
  // (con margen). Solo montamos esas. La altura usa la medida real; si aún no se ha
  // medido, los DOCUMENTOS usan un fallback grande (pueden ser muy altos) para no
  // descartarlos antes de medirlos; el resto, la altura mínima.
  const margin = 200
  const visible = useMemo(() => {
    void heightsV
    // LOD (rendimiento): de LEJOS (zoom bajo) NO se monta el CONTENIDO de los contextos,
    // solo sus cajas + etiquetas (baratísimo). El contenido aparece al ACERCARSE. Así el
    // DOM se mantiene pequeño sin importar cuántos nodos totales haya (web + iPad).
    const contentLOD = globalCanvas && cam.scale < 0.34 && !!nested
    const out: { node: Node; pos: WorldPos }[] = []
    for (const n of children) {
      if (contentLOD && nested!.contentIds.has(n.id)) continue
      const base = layout.get(n.id)
      if (!base) continue // sin posición → no va al lienzo
      const pos = (dragPos && dragPos.id === n.id) ? dragPos.pos : base
      const sx = cam.x + pos.x * cam.scale
      const sy = cam.y + pos.y * cam.scale
      const w = CARD_W * cam.scale
      const measured = cardHeights.current.get(n.id)
      const worldH = measured ?? (isDocNode(n) ? 4000 : CARD_MIN_H)
      const screenH = worldH * cam.scale * readCardScale(n)
      if (sx + w < -margin || sx > viewport.w + margin || sy + screenH < -margin || sy > viewport.h + margin) continue
      out.push({ node: n, pos })
    }
    // Nodos REFERENCIADOS (arrastrados desde la columna derecha): espejos colocados
    // por su propio pin, sin moverlos de su sitio. No duplicar los que ya son hijos.
    const childIds = new Set(children.map(c => c.id))
    for (const id of refIds) {
      if (childIds.has(id)) continue
      const n = store.getNode(id)
      if (!n || n.deletedAt) continue
      const p = (dragPos && dragPos.id === id) ? dragPos.pos : (readPin(n) ?? { x: 0, y: 0 })
      const sx = cam.x + p.x * cam.scale
      const sy = cam.y + p.y * cam.scale
      const w = CARD_W * cam.scale
      const worldH = cardHeights.current.get(id) ?? (isDocNode(n) ? 4000 : CARD_MIN_H)
      const screenH = worldH * cam.scale * readCardScale(n)
      if (sx + w < -margin || sx > viewport.w + margin || sy + screenH < -margin || sy > viewport.h + margin) continue
      out.push({ node: n, pos: p })
    }
    // Si se está arrastrando un nodo del FLUJO (aún sin pin), renderizarlo flotando.
    if (dragPos && !layout.has(dragPos.id) && !out.some(o => o.node.id === dragPos.id)) {
      const dn = store.getNode(dragPos.id)
      if (dn) out.push({ node: dn, pos: dragPos.pos })
    }
    return out
  }, [children, layout, dragPos, cam, viewport, heightsV, refsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Herramientas que PINTAN sobre el fondo (no la flecha, que conecta tarjetas).
  // Con una activa, las tarjetas se vuelven transparentes al puntero para poder
  // dibujar/borrar ENCIMA de ellas, y la tinta se renderiza por encima (estilo pizarra).
  const inkActive = isInkTool(tool) || tool === 'line' || tool === 'rect' || tool === 'ellipse' || tool === 'eraser'

  // Lienzo vacío: sin elementos colocados, sin flujo, sin trazos ni conectores.
  // Muestra una pista que invita a empezar (no bloquea: pointerEvents none).
  const isCanvasEmpty = layout.size === 0 && flowNodes.length === 0 &&
    (wbData.strokes?.length ?? 0) === 0 && (wbData.connectors?.length ?? 0) === 0


  return (
    <div
      ref={containerRef}
      data-bg="1"
      className="pizarra-view"
      onPointerDown={onBackgroundPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      /* LIENZO ÚNICO: nunca se entra a un nodo. Intercepto (a nivel de TODO el lienzo,
         antes que cualquier rama de tarjeta) el dot «abrir página» y los chips de
         contexto → solo SELECCIONAN el nodo (abre su columna derecha). Nada navega. */
      onClickCapture={globalCanvas ? (e) => {
        const tgt = e.target as HTMLElement
        // Chip de @contexto → abre la columna del CONTEXTO (selecciona el contexto,
        // no el nodo). La «×» de quitar contexto NO se intercepta: cae en OutlinerNode.
        const chip = tgt.closest('.context-inline') as HTMLElement | null
        if (chip && !tgt.closest('.ctx-chip-remove')) {
          const slug = chip.getAttribute('data-slug') || ''
          const ctx = slug ? findTagNodeBySlug(slug) : null
          if (ctx) { e.preventDefault(); e.stopPropagation(); setSelectedId(ctx.id); return }
        }
        // Dot «abrir página» / cajón → seleccionar el propio nodo (su columna derecha).
        if (tgt.closest('.bullet-nav-dot, .cajon-inline, .node-context-chip')) {
          const card = tgt.closest('[data-node-id]') as HTMLElement | null
          const id = card?.getAttribute('data-node-id')
          e.preventDefault(); e.stopPropagation()
          if (id) setSelectedId(id)
        }
      } : undefined}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).dataset.bg !== '1') return
        if (toolRef.current !== 'select') return // con herramienta de dibujo activa, no crear texto
        const rect = containerRef.current!.getBoundingClientRect()
        const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
        // LIENZO: DOBLE CLIC en zona vacía → crea TEXTO LIBRE ahí (el clic simple es demasiado
        // intrusivo). Texto = nodo `_doc` (TipTap WYSIWYG): negrita/color en vivo, multilínea
        // como UN bloque que se mueve junto. Entra directo en edición.
        // NO se etiqueta con el contexto aunque caiga dentro de su área: la pertenencia se
        // SOBREENTIENDE por la posición física. Etiquetar (`_ctxRefs`) se reserva para
        // tareas/textos creados en un DÍA, FUERA del contexto o desde quick-capture.
        if (globalCanvas) createTextAt(world)
      }}
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
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy' }}
      onDrop={onCanvasDrop}
      style={{
        position: globalCanvas ? 'absolute' : 'relative',
        ...(globalCanvas ? { inset: 0 } : { width: '100%', height: 'calc(100vh - 160px)', minHeight: 480 }),
        overflow: 'hidden',
        background: 'var(--bg, #fff)',
        backgroundImage: 'radial-gradient(circle, var(--border-subtle, #e3e3e3) 1px, transparent 1px)',
        ...dotGrid(cam.x, cam.y, cam.scale), // paso adaptativo: fondo siempre blanco con puntos
        touchAction: 'none',
        cursor: panRef.current ? 'grabbing' : (tool === 'pen' || tool === 'marker' || tool === 'highlighter' || tool === 'eraser' || isShapeTool(tool) ? 'crosshair' : tool === 'text' || tool === 'doc' ? 'text' : 'default'),
        borderRadius: globalCanvas ? 0 : 8, // sin bordes: la app ES el lienzo
        animation: 'pizarra-dive 0.28s ease-out',
      }}
    >
      {/* PDF de fondo: anclado al mundo (0,0), escala con la cámara → pequeño de lejos,
          nítido de cerca. Detrás de trazos (z15) y tarjetas; no captura el puntero, así
          las herramientas del lienzo marcan por encima. */}
      {pdfBackground && (
        <div
          style={{
            position: 'absolute', left: 0, top: 0, transformOrigin: '0 0',
            transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.scale})`,
            width: PDF_BG_W, pointerEvents: 'none', zIndex: 1,
            boxShadow: '0 4px 24px rgba(0,0,0,0.10)', borderRadius: 4, overflow: 'hidden',
          }}
        >
          <PdfCanvasPreview url={pdfBackground} width={PDF_BG_W} scale={cam.scale} allPages resourceKey={pdfBackgroundKey} />
        </div>
      )}

      {/* ÁREAS — frames etiquetados (región rectangular) dibujados DETRÁS de las cards.
          Un ÁREA es un CONTEXTO con cuerpo físico: mismo dato (`_ctx='1'`) + `_area`.
          En el lienzo global también se dibujan (el contexto sin área NO se pinta;
          con área SÍ, como marco). Clic en la etiqueta → abre su columna de contexto
          (nunca navega ni hace zoom-in). */}
      {children.filter(n => zoneIds.has(n.id)).map(a => {
        const rect = readAreaRect(a) ?? (nested ? nested.boxes.get(a.id) ?? null : null); if (!rect) return null
        const col = (() => { const cx = firstContextOf(a) ?? (isMarkedContext(a) ? a : null); return cx ? contextColor(cx.id) : 'var(--accent,#6c5ce7)' })()
        // Preview en vivo del redimensionado manual (tirador esquina).
        const pw = areaRz?.id === a.id ? areaRz.w : rect.w
        const ph = areaRz?.id === a.id ? areaRz.h : rect.h
        const sx = cam.x + rect.x * cam.scale, sy = cam.y + rect.y * cam.scale
        const sw = pw * cam.scale, sh = ph * cam.scale
        // Culling: fuera del viewport → no montar.
        if (sx + sw < -50 || sx > viewport.w + 50 || sy + sh < -50 || sy > viewport.h + 50) return null
        const off = areaDrag?.id === a.id ? `translate(${areaDrag.dx}px, ${areaDrag.dy}px)` : undefined
        return (
          <div key={a.id} data-area-id={a.id} style={{ position: 'absolute', left: sx, top: sy, width: sw, height: sh, zIndex: 2, pointerEvents: 'none', border: '1px solid var(--border, #c9c9cf)', borderRadius: 4, background: 'transparent', transform: off }}>
            <div
              onPointerDown={(e) => { if (e.button !== 0) return; e.stopPropagation(); try { (e.target as HTMLElement).setPointerCapture(e.pointerId) } catch { /* noop */ }; areaDragRef.current = { id: a.id, sx: e.clientX, sy: e.clientY, moved: false } }}
              onPointerMove={(e) => { const d = areaDragRef.current; if (!d || d.id !== a.id) return; const dx = e.clientX - d.sx, dy = e.clientY - d.sy; if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true; if (d.moved) setAreaDrag({ id: a.id, dx, dy }) }}
              onPointerUp={(e) => {
                const d = areaDragRef.current; areaDragRef.current = null; setAreaDrag(null)
                if (!d || d.id !== a.id) return
                // Clic (sin arrastre): en el lienzo global NO se vuela ni se entra —
                // solo se SELECCIONA el área → abre su columna derecha de contexto.
                if (!d.moved) { if (globalCanvas) setSelectedId(a.id); else flyToArea(a.id); return }
                const wdx = (e.clientX - d.sx) / cam.scale, wdy = (e.clientY - d.sy) / cam.scale
                const node = store.getNode(a.id); if (!node) return
                if (globalCanvas) {
                  const rr = readAreaRect(node) ?? nested?.boxes.get(a.id) ?? null
                  if (rr && nested) {
                    // POSICIÓN LIBRE: la nueva esquina sup-izq absoluta = donde lo sueltas.
                    const nx = Math.round(rr.x + wdx), ny = Math.round(rr.y + wdy)
                    const cxp = rr.x + rr.w / 2 + wdx, cyp = rr.y + rr.h / 2 + wdy
                    let eo: Record<string, unknown> = {}; try { eo = JSON.parse(node.extraData || '{}') } catch { /* vacío */ }
                    eo._gx = String(nx); eo._gy = String(ny)
                    store.updateNode(a.id, { extraData: JSON.stringify(eo) })
                    // Congruencia con el árbol (como un elemento): si cae DENTRO de otro
                    // contexto → se anida en él; si cae FUERA de todo → pasa a raíz.
                    let target: { id: string; area: number } | null = null
                    const selfBox = nested.boxes.get(a.id)
                    for (const [id, b] of nested.boxes) {
                      if (id === a.id) continue
                      if (selfBox && b.x <= selfBox.x && b.y <= selfBox.y && b.x + b.w >= selfBox.x + selfBox.w && b.y + b.h >= selfBox.y + selfBox.h) continue
                      if (cxp >= b.x && cxp <= b.x + b.w && cyp >= b.y && cyp <= b.y + b.h) {
                        const ar = b.w * b.h
                        if (!target || ar < target.area) target = { id, area: ar }
                      }
                    }
                    if (target && store.getNode(a.id)?.parentId !== target.id) reparentContext(a.id, target.id)
                    else if (!target) clearContextParent(a.id)
                  }
                  return
                }
                const r = readAreaRect(node)
                store.beginBatch()
                try {
                  if (r) writePin(node, { x: r.x + wdx, y: r.y + wdy })
                  for (const ch of store.children(a.id)) {
                    if (ch.deletedAt) continue
                    const p = readPin(ch); if (!p) continue
                    writePin(ch, { x: p.x + wdx, y: p.y + wdy })
                  }
                } finally { store.endBatch() }
              }}
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setAreaMenu({ id: a.id, x: e.clientX, y: e.clientY }) }}
              style={{ position: 'absolute', top: -10, left: 12, pointerEvents: 'auto', cursor: 'grab', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 9px', borderRadius: 3, background: 'var(--bg-elevated, #fff)', color: 'var(--text-secondary, #52525b)', fontSize: 11, fontWeight: 600, letterSpacing: '0.4px', textTransform: 'uppercase', whiteSpace: 'nowrap', border: '1px solid var(--border, #e0e0e4)', touchAction: 'none' }}
              title={t('tip.dragAreaMove')}
            ><span style={{ width: 6, height: 6, borderRadius: '50%', background: col, flexShrink: 0 }} />{a.text || t('pizarra.area')}</div>
            {/* Tirador de REDIMENSIONADO (esquina inferior derecha) — solo en el lienzo.
                Al arrastrar guarda `_ctxW/_ctxH`; la colocación secuencial recoloca a los
                demás → nunca solapa. */}
            {globalCanvas && (
              <div title={t('tip.scale')}
                onPointerDown={(e) => { if (e.button !== 0) return; e.stopPropagation(); try { (e.target as HTMLElement).setPointerCapture(e.pointerId) } catch { /* noop */ }; areaRzRef.current = { id: a.id, sx: e.clientX, sy: e.clientY, w0: rect.w, h0: rect.h }; setAreaRz({ id: a.id, w: rect.w, h: rect.h }) }}
                onPointerMove={(e) => { const r = areaRzRef.current; if (!r || r.id !== a.id) return; const nw = Math.max(360, r.w0 + (e.clientX - r.sx) / cam.scale); const nh = Math.max(240, r.h0 + (e.clientY - r.sy) / cam.scale); setAreaRz({ id: a.id, w: nw, h: nh }) }}
                onPointerUp={(e) => {
                  const r = areaRzRef.current; areaRzRef.current = null; setAreaRz(null)
                  if (!r || r.id !== a.id) return
                  const nw = Math.max(360, r.w0 + (e.clientX - r.sx) / cam.scale), nh = Math.max(240, r.h0 + (e.clientY - r.sy) / cam.scale)
                  const node = store.getNode(a.id); if (!node) return
                  let eo: Record<string, unknown> = {}; try { eo = JSON.parse(node.extraData || '{}') } catch { /* vacío */ }
                  eo._ctxW = String(Math.round(nw)); eo._ctxH = String(Math.round(nh))
                  store.updateNode(a.id, { extraData: JSON.stringify(eo) })
                }}
                style={{ position: 'absolute', right: -11, bottom: -11, width: 24, height: 24, background: 'transparent', cursor: 'nwse-resize', pointerEvents: 'auto', touchAction: 'none', zIndex: 3 }} />
            )}
          </div>
        )
      })}


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
.pizarra-node--text.pizarra-node--hover{box-shadow:none}
/* Selección minimalista igual que dibujos/PDF: rectángulo de línea DISCONTINUA con margen
   (outline-offset da aire alrededor del texto), sin el borde sólido morado pegado. */
.pizarra-node--text.pizarra-node--sel{box-shadow:none;outline:1px dashed var(--accent,#6c5ce7);outline-offset:6px;border-radius:3px}
.pizarra-node--grouped{outline:1px dashed rgba(108,92,231,0.5);outline-offset:3px;border-radius:6px}
.pizarra-card-body .node-row{align-items:flex-start!important}
/* Cursor: el texto editable mantiene el de texto; el resto, "agarrar". */
.pizarra-card-body .node-text{cursor:text}
/* Texto SUELTO del lienzo: sin caja, fondo transparente, WYSIWYG. */
.pizarra-text{caret-color:var(--accent,#6c5ce7)}
/* Aire lateral en las tarjetas de texto del lienzo, tanto en lectura como en edición, para
   que el texto no quede pegado al borde/selección. El panel derecho tiene su propio padding. */
.pizarra-node--text .pizarra-text,.pizarra-node--text .doc-editor--compact .ProseMirror{padding-left:8px;padding-right:8px}
.pizarra-text:empty::before{content:'Texto…';opacity:.4;pointer-events:none}
/* El preview estático (lectura) DEBE calcar EXACTAMENTE al editor compacto (edición): mismos
   tamaños y márgenes de encabezados/párrafos/listas. Si difieren, al seleccionar el texto se
   «amplía» un poco (glitch). Valores idénticos a los del editor compacto (index.css). */
.pizarra-text p{margin:.3em 0}
.pizarra-text h1{font-size:1.8em;font-weight:700;margin:0 0 .2em;line-height:1.25}
.pizarra-text h2{font-size:1.4em;font-weight:700;margin:.4em 0 .15em;line-height:1.3}
.pizarra-text h3{font-size:1.18em;font-weight:700;margin:.35em 0 .1em}
.pizarra-text ul,.pizarra-text ol{margin:.3em 0;padding-left:1.4em}
.pizarra-text li{margin:.15em 0}
.pizarra-text blockquote{border-left:3px solid var(--border,#ddd);margin:.4em 0;padding:.1em 0 .1em .8em;color:var(--text-secondary,#666)}
.pizarra-text code{background:var(--bg-subtle,#f3f3f3);padding:.1em .35em;border-radius:4px;font-size:.9em}
.pizarra-text:focus{outline:none}
/* ── Texto LIMPIO del lienzo (nodo-tarea con Magic) ──────────────────────────
   Al crear con la herramienta Texto: SOLO el cursor. Nada de bullet, chip de
   contexto, placeholder, recuadro ni tiradores. Magic añade badges al escribir;
   el dot (zoom) y el tirador de ancho aparecen únicamente en hover. */
.pizarra-node--cleantext .node-bullet-slot{display:none!important}
/* Tarea/evento/bucle/captura limpios: SÍ muestran su marcador (checkbox/icono),
   pegado al texto, sin gutter. El resto del cromo (caja, tiradores) sigue oculto. */
.pizarra-node--cleantext.pizarra-node--check .node-bullet-slot{display:inline-flex!important;width:auto!important;min-width:0!important;margin-right:4px!important}
.pizarra-node--cleantext .collapse-btn,.pizarra-node--cleantext .node-collapse{display:none!important}
.pizarra-node--cleantext .auto-ctx-badge--placeholder{display:none!important}
.pizarra-node--cleantext .node-text:empty::before{content:''!important}
.pizarra-node--cleantext .node-text:focus{outline:none}
/* El texto limpio abraza su contenido (la tarjeta es max-content): sin el min-width
   de 160px del outliner-en-pizarra, así el tirador queda pegado al final del texto. */
.pizarra-node--cleantext .node-text{min-width:24px!important;flex:0 0 auto!important}
.pizarra-node--cleantext .node-row{padding-left:0!important;background:none!important}
.pizarra-node--cleantext .pizarra-card-body{padding:0}
.pizarra-node--cleantext.pizarra-node--hover,.pizarra-node--cleantext.pizarra-node--sel{box-shadow:none!important}
/* Transiciones suaves: el contorno de hover/selección no aparece de golpe. */
.pizarra-node{transition:box-shadow .14s ease}
@keyframes pizarra-dive{from{opacity:0;transform:scale(1.06)}to{opacity:1;transform:scale(1)}}
@keyframes pizarra-fade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* (Estado vacío «Tu día, en blanco» retirado: el lienzo queda limpio.) */}

      {/* ── Capa de trazos (dibujo). Con herramienta «seleccionar» son interactivos
             (hover, clic-seleccionar, arrastrar para mover). ── */}
      <svg width={viewport.w} height={viewport.h} style={{ position: 'absolute', inset: 0, zIndex: 15, pointerEvents: 'none' }}>
        {wbData.strokes.map(s => {
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
          // Rect del elemento (centro + semiejes) en coords del contenedor.
          const rectInfo = (id: string): { cx: number; cy: number; hw: number; hh: number } | null => {
            const el = containerRef.current?.querySelector(`[data-node-id="${CSS.escape(id)}"]`)
            if (!el) return null
            const r = (el as HTMLElement).getBoundingClientRect()
            return { cx: r.left + r.width / 2 - cont.left, cy: r.top + r.height / 2 - cont.top, hw: r.width / 2, hh: r.height / 2 }
          }
          // Punto del BORDE del rect en la dirección de (tx,ty), con un pequeño hueco
          // para que la flecha no toque la tarjeta. Así inicio y fin quedan visibles.
          const clip = (R: { cx: number; cy: number; hw: number; hh: number }, tx: number, ty: number, gap = 4) => {
            const dx = tx - R.cx, dy = ty - R.cy
            if (dx === 0 && dy === 0) return { x: R.cx, y: R.cy }
            const s = Math.min(R.hw / Math.abs(dx || 1e-6), R.hh / Math.abs(dy || 1e-6))
            const len = Math.hypot(dx, dy)
            const g = (s * len + gap) / len
            return { x: R.cx + dx * g, y: R.cy + dy * g }
          }
          const conns = wbData.connectors || []
          return conns.map(conn => {
            const RA = rectInfo(conn.a), RB = rectInfo(conn.b)
            if (!RA || !RB) return null
            const cw = connDrag?.id === conn.id ? [connDrag.cx, connDrag.cy] as [number, number] : conn.c
            const ctrl = cw ? { x: cam.x + cw[0] * cam.scale, y: cam.y + cw[1] * cam.scale } : { x: (RA.cx + RB.cx) / 2, y: (RA.cy + RB.cy) / 2 }
            // Recorta cada extremo al borde de su tarjeta, en la dirección del control.
            const A = clip(RA, ctrl.x, ctrl.y)
            const B = clip(RB, ctrl.x, ctrl.y)
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
                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setConnMenu({ id: conn.id, x: e.clientX, y: e.clientY }) }} />
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
          const cx = r.left + r.width / 2 - cont.left, cy = r.top + r.height / 2 - cont.top
          const tx = arrowCursor.x - cont.left, ty = arrowCursor.y - cont.top
          // Arranca en el BORDE de la tarjeta ancla (hacia el cursor), no en su centro.
          const dx = tx - cx, dy = ty - cy
          const s = Math.min((r.width / 2) / Math.abs(dx || 1e-6), (r.height / 2) / Math.abs(dy || 1e-6))
          const len = Math.hypot(dx, dy) || 1
          const g = (s * len + 4) / len
          const ax = cx + dx * g, ay = cy + dy * g
          return <path d={`M${ax} ${ay}L${tx} ${ty}`} fill="none" stroke="var(--accent,#6c5ce7)" strokeWidth={2} strokeDasharray="5 5" strokeOpacity={0.7} />
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
      {tool === 'select' && (selStrokes.size + multiSel.size) > 0 && !marquee && (() => {
        const cont = containerRef.current?.getBoundingClientRect()
        if (!cont) return null
        const S = cam.scale
        // BBox en pantalla (relativo al contenedor) uniendo TRAZOS y CARDS de la selección,
        // para que la caja abarque todos los elementos, no solo el dibujo.
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        for (const s of parsePizarra(store.getNode(parentId)?.body).strokes) {
          if (!selStrokes.has(s.id)) continue
          let pts = s.pts
          if (xf) {
            if (xf.kind === 'move') pts = s.pts.map((v, i) => i % 2 === 0 ? v + xf.dx : v + xf.dy)
            else pts = s.pts.map((v, i) => i % 2 === 0 ? xf.ax + (v - xf.ax) * xf.s : xf.ay + (v - xf.ay) * xf.s)
          }
          for (let i = 0; i + 1 < pts.length; i += 2) {
            const sx = cam.x + pts[i] * S, sy = cam.y + pts[i + 1] * S
            minX = Math.min(minX, sx); maxX = Math.max(maxX, sx); minY = Math.min(minY, sy); maxY = Math.max(maxY, sy)
          }
        }
        // Cards: su rect de pantalla del DOM (ya refleja el preview del xf vía `p`).
        for (const id of multiSel) {
          const el = containerRef.current?.querySelector(`[data-card][data-node-id="${CSS.escape(id)}"]`) as HTMLElement | null
          if (!el) continue
          const r = el.getBoundingClientRect()
          minX = Math.min(minX, r.left - cont.left); maxX = Math.max(maxX, r.right - cont.left)
          minY = Math.min(minY, r.top - cont.top); maxY = Math.max(maxY, r.bottom - cont.top)
        }
        if (!isFinite(minX)) return null
        // Esquinas en MUNDO (para el ancla del escalado) a partir del punto de pantalla.
        const wTL = screenToWorld(minX, minY), wBR = screenToWorld(maxX, maxY)
        const corners = [
          { sx: minX, sy: minY, wx: wTL.x, wy: wTL.y, ax: wBR.x, ay: wBR.y, cur: 'nwse-resize' },
          { sx: maxX, sy: minY, wx: wBR.x, wy: wTL.y, ax: wTL.x, ay: wBR.y, cur: 'nesw-resize' },
          { sx: minX, sy: maxY, wx: wTL.x, wy: wBR.y, ax: wBR.x, ay: wTL.y, cur: 'nesw-resize' },
          { sx: maxX, sy: maxY, wx: wBR.x, wy: wBR.y, ax: wTL.x, ay: wTL.y, cur: 'nwse-resize' },
        ]
        return (
          <>
            <div style={{ position: 'absolute', left: minX - 4, top: minY - 4, width: (maxX - minX) + 8, height: (maxY - minY) + 8, border: '1px dashed var(--accent,#6c5ce7)', borderRadius: 3, pointerEvents: 'none', zIndex: 6 }} />
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
          {multiSel.size > 1 && (
            <button style={miniItem} onClick={() => {
              const id = mergeNodesToBlock([...multiSel])
              clearSelection()
              if (id) { setSelectedId(id); setMenuPos(null) }
            }}>{t('pizarra.mergeText', 'Unir en texto')}</button>
          )}
          {(multiSel.size + selStrokes.size) > 1 && (
            <button style={miniItem} onClick={() => groupSelection()}>{t('pizarra.group')}</button>
          )}
          <button style={miniItem} onClick={() => copySelection()}>{t('common.copy')}</button>
          <button style={miniItem} onClick={() => duplicateSelection()}>{t('common.duplicate')}</button>
          <button style={{ ...miniItem, color: 'var(--danger,#e03131)' }} onClick={() => deleteSelection()}>{t('common.delete')}</button>
        </div>
      )}

      {/* Menú de un conector (flecha): clic derecho ya NO borra; abre esto. */}
      {connMenu && (
        <>
          <div onPointerDown={() => setConnMenu(null)} onContextMenu={(e) => { e.preventDefault(); setConnMenu(null) }}
            style={{ position: 'fixed', inset: 0, zIndex: 1499 }} />
          <div style={{ position: 'fixed', left: connMenu.x, top: connMenu.y, zIndex: 1500, padding: 4,
            background: 'var(--bg-elevated,#fff)', border: '1px solid var(--border,#e2e2e2)', borderRadius: 10, boxShadow: '0 8px 28px rgba(0,0,0,0.16)' }}
            onClick={(e) => e.stopPropagation()}>
            <button style={{ ...miniItem, color: 'var(--danger,#e03131)' }}
              onClick={() => { mutateConnectors(cs => cs.filter(c => c.id !== connMenu.id)); setHoverConn(null); setConnMenu(null) }}>
              {t('pizarra.deleteArrow')}
            </button>
          </div>
        </>
      )}

      {/* Menú rápido (clic derecho en el fondo) — herramientas favoritas
          CONFIGURABLES (estilo iPad). El engranaje abre la lista para elegir cuáles. */}
      {quickMenu && (() => {
        const runQuick = (key: string) => {
          switch (key) {
            case 'text': createTextAt(quickMenu.world); break   // Texto = nodo `_doc` (TipTap WYSIWYG)
            case 'node': createTextAt(quickMenu.world); break   // compat
            case 'pen': setTool('pen'); break
            case 'eraser': setTool('eraser'); break
            case 'select': setTool('select'); break
            case 'undo': store.undo(); break
            case 'redo': store.redo(); break
            case 'today': { const day = ensureDayPath(new Date()); navigate(`/node/${day.id}`); setCam({ x: 60, y: 60, scale: 1 }); window.dispatchEvent(new CustomEvent('from:open-day-panel')); break }
            case 'saveView': setSaveModal(true); break
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
                  <button key={k} style={isDisabled(k) ? quickBtnDisabled : (isActive(k) ? quickBtnActive : quickBtn)} disabled={isDisabled(k)} title={t(QUICK_LABEL[k])} onClick={() => runQuick(k)}>
                    {QUICK_ICON[k]}
                  </button>
                ))}
                <div style={{ width: 1, height: 22, background: 'var(--border,#e2e2e2)', margin: '0 2px' }} />
                <button style={quickCfg ? quickBtnActive : quickBtn} title={t('tip.configureShortcuts')} onClick={() => setQuickCfg(c => !c)}>
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="10" cy="10" r="2.4"/><path d="M10 1.6v2M10 16.4v2M3.6 10h-2M18.4 10h-2M5.2 5.2 3.8 3.8M16.2 16.2l-1.4-1.4M14.8 5.2l1.4-1.4M3.8 16.2l1.4-1.4"/></svg>
                </button>
              </div>
              {quickCfg && (
                <div style={{
                  marginTop: 6, padding: 6, minWidth: 180,
                  background: 'var(--bg-elevated,#fff)', border: '1px solid var(--border,#e2e2e2)',
                  borderRadius: 12, boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
                }} onPointerDown={(e) => e.stopPropagation()}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary,#888)', padding: '4px 8px 6px' }}>{t('pizarra.quickMenuShortcuts')}</div>
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
                        {t(QUICK_LABEL[k])}
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
        // Preview de la transformación de SELECCIÓN unificada (mover/escalar todo junto):
        // si esta card está en la operación xf en curso, aplicar el delta a su pin/escala.
        const xfCard = xf ? xfRef.current?.cards.find(c => c.id === node.id) : undefined
        let xfScale = 1
        if (xfCard && xf) {
          if (xf.kind === 'move') p = { x: xfCard.px + xf.dx, y: xfCard.py + xf.dy }
          else { p = { x: xf.ax + (xfCard.px - xf.ax) * xf.s, y: xf.ay + (xfCard.py - xf.ay) * xf.s }; xfScale = xf.s }
        }
        // Tamaño: ancho (_pinW) y escala (_cardScale), con preview en vivo si se redimensiona.
        const live = nodeRz?.id === node.id ? nodeRz : null
        if (live) p = live.pin
        const cardW = live ? live.w : readCardW(node)
        const cardScale = (live ? live.scale : readCardScale(node)) * xfScale
        // LIENZO ANIDADO: el contenido ocupa EXACTAMENTE su hueco calculado (ancho fijo
        // + alto medido, `overflow:hidden`) → nunca desborda su contexto ni se solapa.
        // `slot` (ancho fijo + posición del layout) para el contenido de un contexto: texto
        // plano del esquema Y bloques `_doc` convertidos (que viven dentro del contexto sin
        // pin propio). Un `_doc` SUELTO (con pin) no está en `items` → slot null → va libre.
        // Vistas/recursos conservan su propio ancho.
        const slot = (globalCanvas && !canvasViewKind(node) && !readResource(node)) ? nested?.items.get(node.id) ?? null : null
        const sx = cam.x + p.x * cam.scale
        const sy = cam.y + p.y * cam.scale
        const grouped = nodeGroupId(node) != null
        const hovered = hoverNode === node.id && tool === 'select'
        const isText = isDocNode(node)
        const elView = canvasViewKind(node)
        const res = !isText && !elView ? readResource(node) : null
        // LIMPIO = nodo plano (ni doc, ni vista, ni recurso): se pinta vía OutlinerNode
        // pero SIN cromo (CSS `.pizarra-node--cleantext`): sin caja ni tiradores grandes.
        // Una TAREA/evento/bucle/captura también va LIMPIA (mismo estilo que un nodo
        // normal), pero conserva su MARCADOR (checkbox/icono) → clase `--check`.
        const hasChrome = node.status !== null || node.isEvent || (node.types || []).some(t => t === 'bucle' || t === 'captura')
        const isPlainText = !isText && !elView && !res && !hasChrome   // texto puro
        const isClean = !isText && !elView && !res                      // limpio (texto o tarea)
        // ¿Tiene nodos hijos? (como las notas): si los tiene, el dot se muestra SIEMPRE
        // (marcado); si no, solo en hover. Misma lógica que los nodos del outliner.
        const plainHasKids = isPlainText && store.children(node.id).some(c => !c.deletedAt)
        // ¿Tiene ancho FIJADO por el usuario (_pinW)? Si no, el Texto limpio crece
        // con su contenido (max-content) → el tirador queda pegado al final del texto.
        const hasFixedW = (() => { try { return JSON.parse(node.extraData || '{}')._pinW != null } catch { return false } })()
        const cleanAutoW = isPlainText && !hasFixedW
        const editing = isText && editText === node.id
        const showHandles = (hovered || selectedId === node.id || multiSel.has(node.id)) && !dragPos && !editing
        const ViewComp = elView === 'tabla' ? NodeTableView : elView === 'kanban' ? NodeKanbanView : elView === 'calendario' ? NodeCalendarView : null
        // LOD: con zoom bajo, píldora con el título (no se monta el contenido pesado).
        // LOD (píldora con solo el título al alejar) SOLO para vistas pesadas
        // (tabla/kanban/calendario). El TEXTO y los DOCUMENTOS se ven siempre
        // completos a cualquier zoom (es ligero y el usuario quiere leerlo).
        const lod = cam.scale < LOD_SCALE && !editing && !!elView
        const lodTitle = (node.text || (isText ? t('pizarra.document') : elView ? (elView[0].toUpperCase() + elView.slice(1)) : t('common.noTitle'))).slice(0, 60)
        return (
          <div key={node.id} data-card="1" data-node-id={node.id} className={`pizarra-node${isText ? ' pizarra-node--text' : ''}${isClean ? ' pizarra-node--cleantext' : ''}${hasChrome ? ' pizarra-node--check' : ''}${elView ? ' pizarra-node--el' : ''}${slot ? ' pizarra-node--fit' : ''}${(multiSel.has(node.id) || ((isText || elView) && selectedId === node.id)) ? ' pizarra-node--sel' : ''}${editing ? ' pizarra-node--editing' : ''}${grouped ? ' pizarra-node--grouped' : ''}${hovered ? ' pizarra-node--hover' : ''}`}
            onPointerEnter={() => { if (tool === 'select' && !dragPos && !nodeRzRef.current) setHoverNode(node.id) }}
            onPointerLeave={() => setHoverNode(h => h === node.id ? null : h)}
            onPointerDownCapture={tool === 'arrow' ? (e) => { e.preventDefault(); e.stopPropagation(); handleArrowClick(node.id) } : undefined}
            onPointerDown={(elView && !lod) ? undefined : (
              // DOCUMENTO: clic IZQUIERDO = editar directo (cursor + escribir), como
              // un nodo normal — NO arrastra. Mover = arrastrar con botón DERECHO
              // (handler global de tarjetas). El resto de tarjetas: arrastre normal.
              (isText && !lod) ? (e: React.PointerEvent) => {
                if (e.button !== 0) return
                const t = e.target as HTMLElement
                // Clic DENTRO del editor ya activo (colocar cursor, arrastrar para
                // seleccionar texto, casilla de tarea…): dejar que TipTap lo gestione,
                // pero SIEMPRE cortar la propagación — si no, el pointerdown sigue
                // subiendo hasta el fondo del lienzo (`onBackgroundPointerDown`), que
                // limpia la selección (`setSelectedId(null)`) EN MITAD del gesto de
                // seleccionar texto → desmonta el editor del panel a mitad de una
                // transacción de ProseMirror → crash (React #185).
                if (t.closest('button, a, input, textarea, select, [contenteditable="true"], .ProseMirror')) { e.stopPropagation(); return }
                if (editing) { e.stopPropagation(); return }
                e.stopPropagation()
                setSelectedId(node.id); setEditText(node.id)
              } : (e: React.PointerEvent) => onCardAreaPointerDown(e, node)
            )}
            onContextMenu={(e) => nodeCtx(e, node.id)}
            style={{ position: 'absolute', left: sx, top: sy, width: slot ? CONTENT_W : (cleanAutoW ? 'max-content' : cardW), transform: `scale(${cam.scale * cardScale})`, transformOrigin: '0 0', zIndex: editing ? 20 : (dragPos?.id === node.id || live) ? 10 : (hovered ? 4 : 1), cursor: editing ? 'text' : 'grab', pointerEvents: inkActive ? 'none' : undefined,
              // Layout anidado: ancho fijo (el texto envuelve dentro y se ve ENTERO, sin
              // recorte); el alto lo reserva el layout (margen superior) → no se solapa.
              ...(slot ? { boxSizing: 'border-box' as const, paddingLeft: 18, paddingRight: 12 }
                // Texto limpio: gutter izq (dot) + espacio dcho (handle + zona de arrastre).
                : isPlainText ? { boxSizing: 'content-box' as const, paddingLeft: 22, paddingRight: 30 } : {}) }}>
            {lod ? (
              // Píldora LOD (zoom bajo): solo el título, barato de renderizar.
              <div className="pizarra-lod" style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.25, color: 'var(--text,#222)', padding: '10px 14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {elView && <span style={{ opacity: 0.5, marginRight: 8 }}>▦</span>}
                {lodTitle}
              </div>
            ) : isText ? (
              // Elemento-texto = el MISMO nodo que el documento. Editando → editor
              // TipTap completo (DocEditor compact); en reposo → body estático (ligero).
              // Colapsado → solo el título + chevron (el usuario despliega para leer).
              // La tarjeta SIEMPRE edita aquí directamente (doble clic al crear, clic al
              // reeditar) — decisión explícita de Alberto: quiere poder escribir en el propio
              // lienzo como siempre, CON su barra flotante y borde de selección, ADEMÁS del
              // panel cómodo de la derecha para lectura/edición con más espacio. La causa real
              // del bucle de renders (React #185) que motivó la regla «nunca dos editores» NO
              // era la coexistencia en sí — era un bug en `MainLayout` (`showDocInspector`)
              // ajeno a esto, ya arreglado (v9.6.681). `activeDocNodeId` se conserva en
              // `docEditorStore` para otros usos, pero ya no bloquea la edición de la tarjeta.
              editing ? (
                <DocEditorBoundary compact>
                  <DocEditor node={node} compact />
                </DocEditorBoundary>
              ) : globalCanvas ? (
                // LIENZO: TEXTO PURO — sin gutter, sin chevron, sin dot, sin accesorios.
                // Solo el cuerpo del documento renderizado. (El formato va en la barra
                // flotante al seleccionar; se edita con doble clic / al seleccionarlo.)
                <div className="pizarra-text" style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--text,#222)', wordBreak: 'break-word', minHeight: 20, userSelect: 'none', WebkitUserSelect: 'none' }}
                  dangerouslySetInnerHTML={{ __html: node.body || `<span style="opacity:.4">${t('pizarra.textPlaceholder')}</span>` }}
                />
              ) : (
                // Gutter [chevron][dot] + cuerpo, alineados con la 1ª línea — como el
                // bullet de la lista. chevron = colapsar/desplegar · dot = abrir página.
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                  <button title={node.isCollapsed ? t('tip.expand') : t('tip.collapse')}
                    onPointerDown={(e) => { e.stopPropagation(); store.updateNode(node.id, { isCollapsed: !node.isCollapsed }) }}
                    style={{ marginTop: node.isCollapsed ? 4 : 9, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary,#999)', fontSize: 11, lineHeight: 1, padding: 0, flexShrink: 0, width: 12, textAlign: 'center' }}>
                    {node.isCollapsed ? '▸' : '▾'}
                  </button>
                  <span title={t('tip.openOwnPage')}
                    onPointerDown={(e) => { e.stopPropagation(); openTextAsDoc(node.id) }}
                    style={{ marginTop: node.isCollapsed ? 6 : 11, width: 9, height: 9, borderRadius: '50%', background: 'var(--text-secondary,#888)', border: '2px solid var(--bg,#fff)', boxShadow: '0 0 0 1px var(--border,#d8d8d8)', cursor: 'pointer', flexShrink: 0 }} />
                  {node.isCollapsed ? (
                    <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text,#222)', wordBreak: 'break-word', minHeight: 20, userSelect: 'none', WebkitUserSelect: 'none' }}>
                      {node.text || firstLineTitle(node.body) || t('pizarra.document')}
                    </div>
                  ) : (
                    <div className="pizarra-text" style={{ flex: 1, minWidth: 0, fontSize: 16, lineHeight: 1.6, color: 'var(--text,#222)', wordBreak: 'break-word', minHeight: 20, userSelect: 'none', WebkitUserSelect: 'none' }}
                      dangerouslySetInnerHTML={{ __html: node.body || `<span style="opacity:.4">${t('pizarra.textPlaceholder')}</span>` }}
                    />
                  )}
                </div>
              )
            ) : elView && ViewComp ? (
              // Elemento de VISTA (tabla/kanban/calendario): el MISMO nodo que se abre
              // en solitario. Cabecera = tirador para mover; el cuerpo es la vista real.
              <div className="pizarra-el">
                <div className="pizarra-el-head" onPointerDown={(e) => onCardPointerDown(e, node)} style={{ cursor: 'grab' }}>
                  {/* DOT a la izquierda → abre el elemento en su propia página. */}
                  <span className="pizarra-el-dot" title={t('tip.openOwnPage')}
                    onPointerDown={(e) => { e.stopPropagation(); openTextAsDoc(node.id) }}
                    style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--text-secondary,#888)', opacity: 0.85, cursor: 'pointer', flexShrink: 0 }} />
                  <span className="pizarra-el-title">{node.text || t('pizarra.view')}</span>
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
                  // El lienzo carga el PROPIO PDF (1ª página, nítido al ampliar). El
                  // dot lo abre en su página para marcarlo/editarlo.
                  <PdfCanvasPreview url={res.url} width={cardW} scale={cam.scale * cardScale} title={node.text} resourceKey={res.key} />
                ) : res.type === 'url' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 16px' }}>
                    <span style={{ fontSize: 22, lineHeight: 1 }}>🔗</span>
                    <span style={{ fontSize: 14, color: 'var(--accent,#6c5ce7)', wordBreak: 'break-all', textDecoration: 'underline' }}>{node.text || res.url}</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 16px' }}>
                    <span style={{ fontSize: 24, lineHeight: 1 }}>📎</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text,#222)', wordBreak: 'break-word' }}>{node.text || t('pizarra.file')}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="pizarra-card-body" style={{ minWidth: 0 }}
                /* Capturar el clic derecho ANTES de que llegue al node-row de OutlinerNode
                   (que abriría su propio menú) → solo se abre el menú del lienzo. Evita
                   la duplicidad de dos menús superpuestos. */
                onContextMenuCapture={(e) => nodeCtx(e, node.id)}
                /* LIENZO ÚNICO: nunca se entra a un nodo. El dot (abrir página) y los
                   chips de contexto NO navegan → solo SELECCIONAN (abre su columna derecha). */
                onClickCapture={(e) => {
                  if (!globalCanvas) return
                  const tgt = e.target as HTMLElement
                  if (tgt.closest('.bullet-nav-dot, .cajon-inline, a')) {
                    e.stopPropagation(); e.preventDefault(); setSelectedId(node.id)
                  }
                }}>
                <OutlinerNode node={node} depth={0} isSelected={selectedId === node.id} selectedId={selectedId} isMultiSelected={false} onSelect={setSelectedId} onSelectNext={() => {}} onShiftSelect={() => {}} filterText="" flat canvasMode={globalCanvas} />
              </div>
            )}
            {/* (Documento: chevron + DOT van INLINE en el cuerpo, alineados con la 1ª
                línea como el bullet de la lista — ya no en el margen.) */}
            {/* El RECURSO (imagen/PDF/enlace/archivo) ya no tiene dot de «abrir en su página»:
                no aportaba nada desde el lienzo (navegar a otro plano), igual que se quitó
                «Abrir nodo» del menú clic-derecho. */}
            {/* TEXTO LIMPIO: SOLO en hover (no al crear) aparece el dot (zoom a su pin) a
                la izquierda y el tirador de ancho a la derecha. Nada más. */}
            {/* DOT del texto del lienzo: en hover SIEMPRE; sin hover, solo si tiene hijos
                (marcado, como una nota). Al crear/editar NO aparece: solo el cursor.
                Clic = ENTRAR en el nodo (su propia página), igual que el bullet de un nodo. */}
            {isPlainText && (hovered || plainHasKids) && !dragPos && !globalCanvas && (
              <div title={t('tip.openNode')} onPointerDown={(e) => { e.stopPropagation(); openTextAsDoc(node.id) }}
                style={{ position: 'absolute', left: 2, top: 0, height: 26, width: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 22 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--text-secondary,#888)', border: plainHasKids ? '2px solid var(--accent-soft,#e9e6ff)' : '2px solid var(--bg,#fff)', boxShadow: plainHasKids ? '0 0 0 2px var(--accent,#6c5ce7)' : '0 0 0 1px var(--border,#d8d8d8)' }} />
              </div>
            )}
            {/* Redimensionar — MISMOS tiradores para TODOS los elementos de contenido del
                lienzo (texto, PDF, imagen, vistas): zona invisible en los DOS lados (ancho) y
                en la esquina inferior derecha (proporcional). Se puede arrastrar desde
                cualquier lado; el cursor (ew-resize/nwse-resize) da la pista. Consistencia
                total: en el texto el ancho reajusta el salto de línea; en imagen/PDF/vista
                cambia el tamaño manteniendo su proporción. */}
            {(isText || elView || res) && (hovered || selectedId === node.id || multiSel.has(node.id) || (isText && editing)) && !dragPos && (
              <>
                {/* Lado izquierdo — ancho (el borde derecho queda fijo). */}
                <div title={t('tip.width')} onPointerDown={(e) => onNodeResizeDown(e, node, 'width')}
                  style={{ position: 'absolute', left: -5, top: 0, bottom: 0, width: 10, background: 'transparent', cursor: 'ew-resize', touchAction: 'none', zIndex: 21 }} />
                {/* Lado derecho — ancho (el borde izquierdo queda fijo). */}
                <div title={t('tip.width')} onPointerDown={(e) => onNodeResizeDown(e, node, 'widthR')}
                  style={{ position: 'absolute', right: -5, top: 0, bottom: 0, width: 10, background: 'transparent', cursor: 'ew-resize', touchAction: 'none', zIndex: 21 }} />
                {/* Esquina inferior derecha — escala proporcional desde arriba-izquierda. */}
                <div title={t('tip.scale')} onPointerDown={(e) => onNodeResizeDown(e, node, 'scale')}
                  style={{ position: 'absolute', right: -6, bottom: -6, width: 16, height: 16, background: 'transparent', cursor: 'nwse-resize', touchAction: 'none', zIndex: 21 }} />
              </>
            )}
            {/* HEPTABASE FASE 3: overlay de anotación — SIEMPRE presente si ya hay trazos
                guardados (para pintarlos), y con el puntero activo SOLO mientras se está
                anotando ESTA tarjeta (si no, `pointerEvents:none` deja pasar los clics
                normales de la tarjeta por debajo). */}
            {(() => {
              if (!res) return null // anotación SOLO en PDF/imagen (el texto se edita, no se pinta)
              const annos = readCardAnnos(node)
              const isAnnotating = annotatingId === node.id
              if (!annos.length && !isAnnotating) return null
              return (
                <svg viewBox="0 0 100 100" preserveAspectRatio="none"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 30, pointerEvents: isAnnotating ? 'auto' : 'none', cursor: isAnnotating ? 'crosshair' : undefined, touchAction: 'none', borderRadius: 8 }}
                  onPointerDown={isAnnotating ? onAnnoPointerDown : undefined}
                  onPointerMove={isAnnotating ? onAnnoPointerMove : undefined}
                  onPointerUp={isAnnotating ? () => onAnnoPointerUp(node) : undefined}
                  onPointerCancel={isAnnotating ? () => onAnnoPointerUp(node) : undefined}
                >
                  {annos.map(a => (
                    <path key={a.id} d={pathFromPts(a.pts)} fill="none" stroke={a.c} strokeWidth={a.w} strokeLinecap="round" strokeLinejoin="round" />
                  ))}
                  {isAnnotating && annoDraftPts && annoDraftPts.length >= 4 && (
                    <path d={pathFromPts(annoDraftPts)} fill="none" stroke={penColor} strokeWidth={penWidth} strokeLinecap="round" strokeLinejoin="round" />
                  )}
                </svg>
              )
            })()}
            {/* Botón «✏️ Anotar» — SOLO en PDF/imagen (`res`): ahí no puedes «editar» el
                contenido, así que pintar encima es el valor (como marcar un PDF en Heptabase).
                En el TEXTO NO va: el texto se edita seleccionándolo (o desde el panel derecho),
                sin botón — el lápiz creaba fricción y no aportaba (Alberto). Mientras se anota
                (`✓`), aparecen además Deshacer (último trazo) y Borrar todo. */}
            {res && (showHandles || hovered || selectedId === node.id || annotatingId === node.id) && !dragPos && (
              <div style={{ position: 'absolute', left: 4, top: -30, zIndex: 31, display: 'flex', gap: 4 }}
                onPointerDown={e => { e.stopPropagation(); e.preventDefault() }}>
                <button
                  title={annotatingId === node.id ? t('tip.doneAnnotating') : t('tip.annotateCard')}
                  onClick={e => { e.stopPropagation(); setAnnotatingId(id => id === node.id ? null : node.id) }}
                  style={{
                    width: 24, height: 24, borderRadius: 6, border: '1px solid var(--border,#e2e2e2)', cursor: 'pointer',
                    fontSize: 12, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: annotatingId === node.id ? 'var(--accent,#6c5ce7)' : 'var(--bg-elevated,#fff)',
                    color: annotatingId === node.id ? '#fff' : 'var(--text-secondary,#666)',
                  }}>
                  {annotatingId === node.id ? '✓' : '✏️'}
                </button>
                {annotatingId === node.id && readCardAnnos(node).length > 0 && (
                  <>
                    <button title={t('tip.undo')}
                      onClick={e => { e.stopPropagation(); const a = readCardAnnos(node); writeCardAnnos(node, a.slice(0, -1)) }}
                      style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid var(--border,#e2e2e2)', cursor: 'pointer', fontSize: 13, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-elevated,#fff)', color: 'var(--text-secondary,#666)' }}>
                      ↶
                    </button>
                    <button title={t('tip.clearAll')}
                      onClick={e => { e.stopPropagation(); writeCardAnnos(node, []) }}
                      style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid var(--border,#e2e2e2)', cursor: 'pointer', fontSize: 12, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-elevated,#fff)', color: 'var(--danger,#e03131)' }}>
                      🗑
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Al editar un texto del lienzo, la COLUMNA DERECHA se reconvierte en el panel
          de formato (lo gestiona MainLayout leyendo el editor TipTap activo), igual
          que en la vista de documento. Ya no hay overlay flotante encima del panel. */}

      {/* Menú contextual de un texto del lienzo: duplicar / eliminar. */}
      {textMenu && (
        <>
          <div onPointerDown={() => setTextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setTextMenu(null) }} style={{ position: 'fixed', inset: 0, zIndex: 1999 }} />
          <div style={{ position: 'fixed', top: textMenu.y, left: textMenu.x, zIndex: 2000, minWidth: 160,
            background: 'var(--bg-elevated,#fff)', border: '1px solid var(--border,#e2e2e2)', borderRadius: 10, padding: 5,
            boxShadow: '0 8px 28px rgba(0,0,0,0.16)' }}>
            <button onClick={() => { duplicateText(textMenu.id); setTextMenu(null) }} style={ctxItem}>{t('common.duplicate')}</button>
            <button onClick={() => { deleteText(textMenu.id); setTextMenu(null) }} style={{ ...ctxItem, color: 'var(--danger,#e03131)' }}>{t('common.delete')}</button>
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
          pointerEvents: inkActive ? 'none' : undefined,
        }}>
          {flowNodes.map(node => dragPos?.id === node.id ? null : (
            <div key={node.id} data-card="1" data-node-id={node.id} className={`pizarra-node${multiSel.has(node.id) ? ' pizarra-node--sel' : ''}`} style={{ position: 'relative', width: CARD_W, cursor: 'grab' }}
              onPointerDown={(e) => onCardAreaPointerDown(e, node)}
              onContextMenu={(e) => nodeCtx(e, node.id)}>
              <div className="pizarra-card-body" style={{ minWidth: 0 }}
                /* Capturar el clic derecho ANTES de que llegue al node-row de OutlinerNode
                   (que abriría su propio menú) → solo se abre el menú del lienzo. Evita
                   la duplicidad de dos menús superpuestos. */
                onContextMenuCapture={(e) => nodeCtx(e, node.id)}
                /* LIENZO ÚNICO: nunca se entra a un nodo. El dot (abrir página) y los
                   chips de contexto NO navegan → solo SELECCIONAN (abre su columna derecha). */
                onClickCapture={(e) => {
                  if (!globalCanvas) return
                  const tgt = e.target as HTMLElement
                  if (tgt.closest('.bullet-nav-dot, .cajon-inline, a')) {
                    e.stopPropagation(); e.preventDefault(); setSelectedId(node.id)
                  }
                }}>
                <OutlinerNode node={node} depth={0} isSelected={selectedId === node.id} selectedId={selectedId} isMultiSelected={false} onSelect={setSelectedId} onSelectNext={() => {}} onShiftSelect={() => {}} filterText="" flat canvasMode={globalCanvas} />
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
        <button style={toolBtn} title={t('tip.goToToday')}
          onClick={() => {
            if (globalCanvas) { flyToToday(); return } // lienzo: vuela al área de hoy + columna
            const day = ensureDayPath(new Date())
            navigate(`/node/${day.id}`)
            setCam({ x: 60, y: 60, scale: 1 })
            window.dispatchEvent(new CustomEvent('from:open-day-panel'))
          }}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>
        </button>
        {/* Guardar esta vista (posición+zoom) como nodo */}
        <button style={toolBtn} title={t('tip.saveViewAsNode')} onClick={() => setSaveModal(true)}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 3h10v14l-5-3-5 3V3z"/></svg>
        </button>
        <div style={vSep} />
        {/* Seleccionar / mover */}
        <button style={tool === 'select' ? toolBtnActive : toolBtn} title={t('tip.toolSelect')} onClick={() => setTool('select')}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path d="M4 3l13 6-5 1.6L9.6 17 4 3z"/></svg>
        </button>
        {/* Lápiz — dibujar */}
        <button style={tool === 'pen' ? toolBtnActive : toolBtn} title={t('tip.toolPen')} onClick={() => setTool(t => t === 'pen' ? 'select' : 'pen')}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M14 3l3 3-9 9-4 1 1-4 9-9z"/></svg>
        </button>
        {/* Rotulador — grueso */}
        <button style={tool === 'marker' ? toolBtnActive : toolBtn} title={t('tip.toolMarker')} onClick={() => setTool(t => t === 'marker' ? 'select' : 'marker')}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M14 3l3 3-9 9-4 1 1-4 9-9z"/></svg>
        </button>
        {/* Subrayador — translúcido */}
        <button style={tool === 'highlighter' ? toolBtnActive : toolBtn} title={t('tip.toolHighlighter')} onClick={() => setTool(t => t === 'highlighter' ? 'select' : 'highlighter')}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 13l6-6 4 4-6 6H5v-4z"/><path d="M3 18h14"/></svg>
        </button>
        {/* Color de tinta */}
        <div style={{ position: 'relative' }}>
          <button style={toolBtn} title={t('tip.color')} onClick={() => setPaletteOpen(o => !o)}>
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
                    <button key={wv} title={t('tip.thickness', { n: wv })} onClick={() => { setPenWidth(wv); if (!isInkTool(tool) && !isShapeTool(tool)) setTool('pen') }}
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
        <button style={tool === 'eraser' ? toolBtnActive : toolBtn} title={t('tip.toolEraser')} onClick={() => setTool(t => t === 'eraser' ? 'select' : 'eraser')}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M7 16h9M4 13l5-5 6 6-3 3H7l-3-3z"/></svg>
        </button>
        {/* Texto/Documento eliminados: en el lienzo se escribe con DOBLE CLIC en cualquier
            parte (crea texto libre; slash → tarea/etc.; Magic detecta tarea y fecha). */}
        <div style={vSep} />
        {/* Elementos: Tabla / Kanban / Calendario (nodos hijos del lienzo) */}
        <button style={toolBtn} title={t('tip.toolTable')} onClick={() => createViewElement('tabla')}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="4" width="14" height="12" rx="1.5"/><path d="M3 8h14M3 12h14M9 4v12"/></svg>
        </button>
        <button style={toolBtn} title={t('tip.toolKanban')} onClick={() => createViewElement('kanban')}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="4" width="4" height="12" rx="1"/><rect x="8.5" y="4" width="4" height="8" rx="1"/><rect x="14" y="4" width="3" height="10" rx="1"/></svg>
        </button>
        <button style={toolBtn} title={t('tip.toolCalendar')} onClick={() => createViewElement('calendario')}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="4" width="14" height="13" rx="2"/><path d="M3 8h14M7 3v3M13 3v3"/></svg>
        </button>
        <div style={vSep} />
        {/* Formas */}
        <button style={tool === 'line' ? toolBtnActive : toolBtn} title={t('tip.toolLine')} onClick={() => setTool(t => t === 'line' ? 'select' : 'line')}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M4 16L16 4"/></svg>
        </button>
        <button style={tool === 'arrow' ? toolBtnActive : toolBtn} title={t('tip.toolArrow')} onClick={() => setTool(t => t === 'arrow' ? 'select' : 'arrow')}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 16L16 4M9 4h7v7"/></svg>
        </button>
        <button style={tool === 'rect' ? toolBtnActive : toolBtn} title={t('tip.toolRect')} onClick={() => setTool(t => t === 'rect' ? 'select' : 'rect')}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3.5" y="5" width="13" height="10" rx="1"/></svg>
        </button>
        <button style={tool === 'ellipse' ? toolBtnActive : toolBtn} title={t('tip.toolEllipse')} onClick={() => setTool(t => t === 'ellipse' ? 'select' : 'ellipse')}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><ellipse cx="10" cy="10" rx="7" ry="5.5"/></svg>
        </button>
        <div style={vSep} />
        <button style={store.canUndo ? toolBtn : toolBtnDisabled} disabled={!store.canUndo} title={t('tip.undo')}
          onClick={() => store.undo()}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M7 7H13a4 4 0 010 8H8M7 7l3-3M7 7l3 3"/></svg>
        </button>
        <button style={store.canRedo ? toolBtn : toolBtnDisabled} disabled={!store.canRedo} title={t('tip.redo')}
          onClick={() => store.redo()}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M13 7H7a4 4 0 000 8h5M13 7l-3-3M13 7l-3 3"/></svg>
        </button>
        <div style={vSep} />
        <button style={toolBtn} title={t('tip.zoomOut')} onClick={() => zoomAtCenter(1 / 1.2)}>−</button>
        <span style={{ minWidth: 42, textAlign: 'center', fontSize: 12, color: 'var(--text-secondary, #888)' }}>{Math.round(cam.scale * 100)}%</span>
        <button style={toolBtn} title={t('tip.zoomIn')} onClick={() => zoomAtCenter(1.2)}>+</button>
        <button style={toolBtn} title={t('tip.center')}
          onClick={() => setCam({ x: 60, y: 60, scale: 1 })}>⌖</button>
      </div>


      {/* Menú contextual de la pizarra. Si el nodo clicado forma parte de una
          MULTISELECCIÓN → acciones en lote (eliminar/duplicar todos). Si no →
          menú normal: QUITAR (saca de la pizarra, NO borra) o ELIMINAR. */}
      {/* Menú de clic derecho de un CONTEXTO: color de acento + eliminar (con contenido). */}
      {areaMenu && store.getNode(areaMenu.id) && (
        <>
          <div onPointerDown={() => setAreaMenu(null)} onContextMenu={(e) => { e.preventDefault(); setAreaMenu(null) }} style={{ position: 'fixed', inset: 0, zIndex: 1999 }} />
          <div style={{ position: 'fixed', top: areaMenu.y, left: areaMenu.x, zIndex: 2000, minWidth: 190, background: 'var(--bg-elevated,#fff)', border: '1px solid var(--border,#e2e2e2)', borderRadius: 10, padding: 8, boxShadow: '0 8px 28px rgba(0,0,0,0.16)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary,#999)', padding: '2px 6px 6px' }}>{t('ctxPanel.accentColor', 'Color de acento')}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 4px 8px' }}>
              {['#6c5ce7', '#e03131', '#f76707', '#f59f00', '#2f9e44', '#1098ad', '#1971c2', '#7048e8', '#9c36b5', '#e64980', '#495057'].map(c => (
                <button key={c} title={c} onClick={() => { setContextAccentColor(areaMenu.id, c); setAreaMenu(null) }}
                  style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: '1px solid rgba(0,0,0,0.12)', cursor: 'pointer' }} />
              ))}
            </div>
            <div style={{ height: 1, background: 'var(--border,#eee)', margin: '2px 0 6px' }} />
            <button onClick={() => { deleteContextTree(areaMenu.id); setAreaMenu(null) }} style={{ ...ctxItem, color: 'var(--danger,#e03131)' }}>
              {t('pizarra.deleteContext', 'Eliminar contexto y su contenido')}
            </button>
          </div>
        </>
      )}
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
                  <div style={{ padding: '6px 12px 4px', fontSize: 12, color: 'var(--text-secondary,#888)' }}>{t('pizarra.selectedCount', { n: multiSel.size + selStrokes.size })}</div>
                  {(multiSel.size + selStrokes.size) > 1 && (
                    <button onClick={() => { groupSelection(); setContextMenu(null) }} style={ctxItem}>
                      {t('pizarra.group')}
                    </button>
                  )}
                  <button onClick={() => { duplicateSelection(); setContextMenu(null) }} style={ctxItem}>
                    {t('pizarra.duplicateAll')}
                  </button>
                  <div style={{ height: 1, background: 'var(--border-subtle,#eee)', margin: '4px 0' }} />
                  <button onClick={() => { deleteSelection(); setContextMenu(null) }} style={{ ...ctxItem, color: 'var(--danger,#e03131)' }}>
                    {t('pizarra.deleteAll')}
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => { removeFromCanvas(contextMenu.nodeId); setContextMenu(null) }} style={ctxItem}>
                    {t('pizarra.removeFromCanvas')}
                  </button>
                  <button onClick={() => { copyNode(contextMenu.nodeId); setContextMenu(null) }} style={ctxItem}>
                    {t('common.copy')}
                  </button>
                  <div style={{ height: 1, background: 'var(--border-subtle,#eee)', margin: '4px 0' }} />
                  {/* Convertir en tarea (hoy) / Favorito — no aplica a recursos (PDF/imagen/archivo) */}
                  {(() => {
                    const n = store.getNode(contextMenu.nodeId)
                    const isTask = n?.status != null
                    const isResourceNode = !!(n && (n.isResource || readResource(n)))
                    return (
                      <>
                        {!isResourceNode && (
                          <button onClick={() => {
                            if (isTask) {
                              store.updateNode(contextMenu.nodeId, { status: null })
                            } else {
                              const today = new Date(); today.setHours(23, 59, 59, 0)
                              store.updateNode(contextMenu.nodeId, { status: 'pending', due: today.toISOString() })
                            }
                            setContextMenu(null)
                          }} style={ctxItem}>{isTask ? t('pizarra.removeTask') : t('pizarra.convertToTask')}</button>
                        )}
                        <button onClick={() => { store.updateNode(contextMenu.nodeId, { isFavorite: !n?.isFavorite }); setContextMenu(null) }} style={ctxItem}>
                          {n?.isFavorite ? t('pizarra.removeFavorite') : t('pizarra.addFavorite')}
                        </button>
                        <div style={{ height: 1, background: 'var(--border-subtle,#eee)', margin: '4px 0' }} />
                      </>
                    )
                  })()}
                  <button onClick={() => { duplicateNode(contextMenu.nodeId, 24); setContextMenu(null) }} style={ctxItem}>
                    {t('common.duplicate')}
                  </button>
                  <button onClick={() => {
                    const n = store.getNode(contextMenu.nodeId)
                    if (n) deleteGcalEventForNode(n) // si es evento de Google, lo borra también allí
                    store.deleteNode(contextMenu.nodeId)
                    setContextMenu(null)
                  }} style={{ ...ctxItem, color: 'var(--danger,#e03131)' }}>
                    {t('pizarra.deleteNode')}
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
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: 'var(--text,#222)' }}>{t('pizarra.saveViewTitle')}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-tertiary,#999)', marginBottom: 10 }}>{t('pizarra.saveViewHint')}</div>
            {/* Buscador predictivo: si el nombre coincide con un contexto EXISTENTE, esta
                vista se convierte en su cuerpo físico (área). Si no, «Crear «x»» hace un
                contexto nuevo. En ambos casos onPick devuelve el id → attachAreaToContext. */}
            <div className="ctx-pick" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <ContextPicker currentId={null} onPick={(id) => {
                if (id) attachAreaToContext(id)
                setSaveModal(false)
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button onClick={() => setSaveModal(false)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border,#ddd)', background: 'transparent', cursor: 'pointer', color: 'var(--text,#333)' }}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Minimapa (vista de pájaro): abajo-izquierda, sin tapar Feedback. Muestra
            todo el contenido del lienzo y un recuadro con lo que se ve en pantalla;
            clic en cualquier punto → la cámara vuela allí. ── */}
      {miniRects.length > 0 && (() => {
        const MW = 152, MH = 104, PAD = 8
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
        for (const r of miniRects) { x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h) }
        const vx0 = -cam.x / cam.scale, vy0 = -cam.y / cam.scale
        const vx1 = (viewport.w - cam.x) / cam.scale, vy1 = (viewport.h - cam.y) / cam.scale
        x0 = Math.min(x0, vx0); y0 = Math.min(y0, vy0); x1 = Math.max(x1, vx1); y1 = Math.max(y1, vy1)
        const bw = (x1 - x0) || 1, bh = (y1 - y0) || 1
        x0 -= bw * 0.06; x1 += bw * 0.06; y0 -= bh * 0.06; y1 += bh * 0.06
        const W = x1 - x0, H = y1 - y0
        const s = Math.min((MW - PAD * 2) / W, (MH - PAD * 2) / H)
        const offX = PAD + ((MW - PAD * 2) - W * s) / 2
        const offY = PAD + ((MH - PAD * 2) - H * s) / 2
        const m = (wx: number, wy: number) => ({ x: offX + (wx - x0) * s, y: offY + (wy - y0) * s })
        const vp0 = m(vx0, vy0), vp1 = m(vx1, vy1)
        const goTo = (e: React.PointerEvent) => {
          e.stopPropagation()
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
          const wx = (e.clientX - r.left - offX) / s + x0
          const wy = (e.clientY - r.top - offY) / s + y0
          setCam(c => ({ ...c, x: viewport.w / 2 - wx * c.scale, y: viewport.h / 2 - wy * c.scale }))
        }
        return (
          <div style={{ position: 'absolute', left: 12, bottom: 80, width: MW, height: MH, zIndex: 40, boxSizing: 'content-box',
            background: 'var(--bg-elevated,#fff)', border: '1px solid var(--border,#e2e2e2)', borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)', overflow: 'hidden', cursor: 'pointer', touchAction: 'none' }}
            onPointerDown={goTo} title={t('tip.canvasMap')}>
            <svg width={MW} height={MH} style={{ display: 'block' }}>
              {miniRects.map((r, i) => { const a = m(r.x, r.y); return <rect key={i} x={a.x} y={a.y} width={Math.max(1.5, r.w * s)} height={Math.max(1.5, r.h * s)} rx={1} fill="var(--text-tertiary,#bbb)" opacity={0.5} /> })}
              <rect x={vp0.x} y={vp0.y} width={Math.max(4, vp1.x - vp0.x)} height={Math.max(4, vp1.y - vp0.y)}
                fill="var(--accent,#6c5ce7)" fillOpacity={0.12} stroke="var(--accent,#6c5ce7)" strokeWidth={1.5} rx={2} />
            </svg>
          </div>
        )
      })()}
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
const QUICK_ALL = ['text', 'pen', 'eraser', 'select', 'undo', 'redo', 'today', 'saveView'] as const
const QUICK_LABEL: Record<string, string> = {
  text: 'pizarra.toolText', node: 'pizarra.toolText', pen: 'pizarra.toolPen', eraser: 'pizarra.toolEraser', select: 'pizarra.toolSelect',
  undo: 'tip.undo', redo: 'tip.redo', today: 'tip.goToToday', saveView: 'pizarra.toolSaveView',
}
const QUICK_ICON: Record<string, React.ReactNode> = {
  text: <svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 6V5h12v1M10 5v10M7.5 15h5"/></svg>,
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

