// nestedCanvasLayout — layout ANIDADO y AUTO-CALCULADO del lienzo único.
//
// Cada CONTEXTO es un ÁREA con FORMA DE PANTALLA (rectángulo apaisado ≈ ratio del
// viewport): su contenido fluye en COLUMNAS para llenar bien el ancho y leerse cómodo
// (nada se corta). Sus SUBCONTEXTOS son cajas (también con forma de pantalla) colocadas
// debajo, en filas. El nodo «🧠 Lo que Fromly sabe» NO se pinta (vive en la columna
// derecha). Todo se calcula en memoria (no escribe nada). El `_area` propio de un
// contexto (movido a mano) manda sobre la caja calculada.
//
// GARANTÍA anti-solape: los altos de fila se miden de verdad (canvas measureText) y la
// tarjeta se pinta con `overflow:hidden` a ese alto → nada desborda ni se solapa.
import { store } from '../store/nodeStore'
import type { Node } from '../types'
import { isMarkedContext } from './cajones'
import { isContextKnowledge } from './knowledgeNodes'

export interface NRect { x: number; y: number; w: number; h: number }
export interface NestedLayout {
  boxes: Map<string, NRect>
  items: Map<string, NRect>
  contextIds: Set<string>
  contentIds: Set<string>
}

export const CONTENT_W = 600  // ancho de la tarjeta de contenido
const INDENT = 26      // indentación del esquema por nivel de profundidad
const LINE_H = 25      // alto de una línea de texto renderizada (generoso)
const ROW_PAD = 22     // aire vertical por fila
const TEXT_W = CONTENT_W - 72 // ancho útil (deja hueco al bullet → sobreestima líneas)
const TEXT_FONT = '15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
const HEADER = 46      // espacio para la etiqueta del área
const PAD = 34         // margen interior de la caja
const COL_GAP = 44     // separación entre columnas de contenido
const BLOCK_GAP = 22   // separación entre bloques dentro de una columna
const SUB_GAP = 48     // separación entre subcontextos
const CONTENT_SUB_GAP = 54 // separación entre el contenido y los subcontextos
const TOP_GAP = 260    // separación entre cajas de contexto de nivel superior
const MAX_COLS = 6
const DEFAULT_ASPECT = 1.6

// ── Medición REAL del wrap con un canvas 2D (no DOM) ─────────────────────────
let _ctx: CanvasRenderingContext2D | null = null
function countLines(text: string): number {
  const t = (text || '').trim()
  if (!t) return 1
  if (!_ctx) { try { _ctx = document.createElement('canvas').getContext('2d') } catch { _ctx = null } }
  if (!_ctx) return Math.max(1, Math.ceil(t.length / 52))
  _ctx.font = TEXT_FONT
  let line = '', lines = 1
  for (const word of t.split(/\s+/)) {
    const test = line ? line + ' ' + word : word
    if (_ctx.measureText(test).width > TEXT_W && line) { lines++; line = word } else line = test
  }
  return lines
}
export function rowHeight(text: string | null | undefined): number {
  return countLines(text || '') * LINE_H + ROW_PAD
}

function ed(n: Node): Record<string, unknown> {
  try { return JSON.parse(n.extraData || '{}') } catch { return {} }
}
function isContent(n: Node): boolean {
  if (n.deletedAt) return false
  if (isMarkedContext(n)) return false
  if (isContextKnowledge(n.text)) return false
  const e = ed(n)
  if (e._capture === '1' || e._logAt) return false
  return true
}
function contentChildren(id: string): Node[] {
  return store.children(id).filter(isContent)
}

// Un BLOQUE de contenido = un hijo de contenido + TODO su subárbol (outline), como una
// unidad que no se parte entre columnas. Filas con su offset relativo (ry) e indent.
interface Row { id: string; depth: number; y: number; h: number }
interface Block { rows: Row[]; w: number; h: number }

function buildBlock(nodeId: string): Block {
  const rows: Row[] = []
  let y = 0, w = CONTENT_W
  const walk = (id: string, depth: number) => {
    const n = store.getNode(id)
    const h = rowHeight(n?.text)
    rows.push({ id, depth, y, h })
    y += h
    const right = depth * INDENT + CONTENT_W
    if (right > w) w = right
    for (const c of contentChildren(id)) walk(c.id, depth + 1)
  }
  walk(nodeId, 0)
  return { rows, w, h: y }
}

interface Plan {
  box: { w: number; h: number }
  content: { id: string; x: number; y: number; h: number }[] // relativo al interior
  subs: { id: string; x: number; y: number }[]
}

function measureContext(ctxId: string, aspect: number, meta: Map<string, Plan>): { w: number; h: number } {
  const cached = meta.get(ctxId)
  if (cached) return cached.box

  // 1) Bloques de contenido + subcajas (recursivo).
  const blocks = contentChildren(ctxId).map(c => buildBlock(c.id))
  const subNodes = store.children(ctxId).filter(n => !n.deletedAt && isMarkedContext(n))
  const subBoxes = subNodes.map(sc => ({ id: sc.id, ...measureContext(sc.id, aspect, meta) }))

  // 2) Flujo del CONTENIDO en columnas → región con forma de pantalla.
  const colW = blocks.reduce((m, b) => Math.max(m, b.w), CONTENT_W)
  const totalH = blocks.reduce((s, b) => s + b.h + BLOCK_GAP, 0)
  let ncols = Math.max(1, Math.min(MAX_COLS, blocks.length, Math.round(Math.sqrt((aspect * totalH) / colW))))
  const target = totalH / ncols
  const columns: Block[][] = Array.from({ length: ncols }, () => [])
  const colH: number[] = new Array(ncols).fill(0)
  let ci = 0
  for (const b of blocks) {
    if (colH[ci] > 0 && colH[ci] + b.h > target && ci < ncols - 1) ci++
    columns[ci].push(b); colH[ci] += b.h + BLOCK_GAP
  }
  const content: Plan['content'] = []
  for (let c = 0; c < ncols; c++) {
    const cx = c * (colW + COL_GAP)
    let cy = 0
    for (const b of columns[c]) {
      for (const r of b.rows) content.push({ id: r.id, x: cx + r.depth * INDENT, y: cy + r.y, h: r.h })
      cy += b.h + BLOCK_GAP
    }
  }
  const usedCols = columns.filter(c => c.length > 0).length || (blocks.length ? 1 : 0)
  const contentW = usedCols > 0 ? usedCols * colW + (usedCols - 1) * COL_GAP : 0
  const contentH = Math.max(0, ...colH) - (blocks.length ? BLOCK_GAP : 0)

  // 3) Subcontextos en FILAS bajo el contenido (envuelven al superar el ancho objetivo).
  const targetW = Math.max(contentW, CONTENT_W * 2)
  const subs: Plan['subs'] = []
  const baseY = contentH > 0 ? contentH + CONTENT_SUB_GAP : 0
  let sx = 0, sy = baseY, rowH = 0, subRegionW = 0
  for (const s of subBoxes) {
    if (sx > 0 && sx + s.w > targetW) { sy += rowH + SUB_GAP; sx = 0; rowH = 0 }
    subs.push({ id: s.id, x: sx, y: sy })
    sx += s.w + SUB_GAP
    if (sx - SUB_GAP > subRegionW) subRegionW = sx - SUB_GAP
    if (s.h > rowH) rowH = s.h
  }
  const subRegionBottom = subBoxes.length ? sy + rowH : baseY

  // 4) Caja envolvente.
  const innerW = Math.max(contentW, subRegionW, CONTENT_W)
  const innerH = Math.max(contentH, subRegionBottom) || LINE_H
  const box = { w: innerW + PAD * 2, h: HEADER + PAD + innerH + PAD }
  meta.set(ctxId, { box, content, subs })
  return box
}

function placeContext(ctxId: string, x: number, y: number, meta: Map<string, Plan>, out: { boxes: Map<string, NRect>; items: Map<string, NRect> }): void {
  const plan = meta.get(ctxId)!
  out.boxes.set(ctxId, { x, y, w: plan.box.w, h: plan.box.h })
  const ox = x + PAD, oy = y + HEADER + PAD
  for (const c of plan.content) out.items.set(c.id, { x: ox + c.x, y: oy + c.y, w: CONTENT_W, h: c.h })
  for (const s of plan.subs) placeContext(s.id, ox + s.x, oy + s.y, meta, out)
}

/**
 * Layout anidado de TODO el árbol de contextos (hijos de 🧠 Contexto). Cada contexto es
 * una caja con forma de pantalla; los raíz se reparten en una fila. `aspect` = ancho/alto
 * del viewport para dar a las cajas la proporción de la pantalla. No destructivo.
 */
export function computeNestedLayout(rootId: string, aspect = DEFAULT_ASPECT): NestedLayout {
  const asp = aspect > 0.2 && aspect < 6 ? aspect : DEFAULT_ASPECT
  const meta = new Map<string, Plan>()
  const top = store.children(rootId).filter(c => !c.deletedAt && !isContextKnowledge(c.text))
  for (const tc of top) measureContext(tc.id, asp, meta)

  const boxes = new Map<string, NRect>()
  const items = new Map<string, NRect>()
  let x = 0
  for (const tc of top) {
    placeContext(tc.id, x, 0, meta, { boxes, items })
    x += (meta.get(tc.id)?.box.w ?? CONTENT_W) + TOP_GAP
  }
  return { boxes, items, contextIds: new Set(boxes.keys()), contentIds: new Set(items.keys()) }
}
