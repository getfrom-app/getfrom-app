// nestedCanvasLayout — layout ANIDADO y AUTO-CALCULADO del lienzo único.
//
// Cada CONTEXTO es un ÁREA con FORMA DE PANTALLA (rectángulo apaisado ≈ ratio del
// viewport, con un mínimo tipo pantalla). Su CONTENIDO se pinta como un ESQUEMA vertical
// (una columna): cada nodo es una fila con su texto COMPLETO (sin truncar) y sus hijos
// indentados debajo. El texto no llena el ancho de la caja: respira dentro (hay sitio de
// sobra; el zoom lo acerca al gusto). Los SUBCONTEXTOS son cajas (también con forma de
// pantalla) apiladas debajo. «🧠 Lo que Fromly sabe» NO se pinta (vive en la columna
// derecha). Todo en memoria (no escribe nada). El `_area` propio manda sobre la caja.
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

export const CONTENT_W = 600  // ancho de la tarjeta de texto (el texto envuelve aquí)
const INDENT = 24      // indentación del esquema por nivel de profundidad
const LINE_H = 25      // alto de una línea de texto renderizada
const ROW_PAD = 12     // aire vertical por fila (tirado, para que lea como texto)
const TEXT_W = CONTENT_W - 60 // ancho útil (sobreestima líneas → nunca solapa)
const TEXT_FONT = '15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
const HEADER = 46      // espacio para la etiqueta del área
const PAD = 36         // margen interior de la caja
const SUB_GAP = 44     // separación entre subcontextos apilados
const CONTENT_SUB_GAP = 50 // separación entre el contenido y los subcontextos
const TOP_GAP = 220    // separación entre cajas de contexto de nivel superior
const BASE_H = 640     // alto nominal de "pantalla" → tamaño mínimo del área
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
/** Alto reservado para una fila = líneas medidas · alto de línea + aire. Es un margen
 *  SUPERIOR (mido con ancho útil conservador) → la tarjeta cabe entera, nunca solapa. */
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

interface Plan {
  box: { w: number; h: number }
  content: { id: string; x: number; y: number; h: number }[] // relativo al interior
  subs: { id: string; x: number; y: number }[]
}

/** Esquema vertical (una columna) del subárbol de contenido de `ctxId`; devuelve las
 *  filas colocadas (relativas) y su alto/ancho totales. */
function layoutContent(ctxId: string): { rows: Plan['content']; w: number; h: number } {
  const rows: Plan['content'] = []
  let y = 0, w = CONTENT_W
  const walk = (id: string, depth: number) => {
    const n = store.getNode(id)
    const h = rowHeight(n?.text)
    rows.push({ id, x: depth * INDENT, y, h })
    y += h
    const right = depth * INDENT + CONTENT_W
    if (right > w) w = right
    for (const c of contentChildren(id)) walk(c.id, depth + 1)
  }
  for (const c of contentChildren(ctxId)) walk(c.id, 0)
  return { rows, w, h: y }
}

function measureContext(ctxId: string, aspect: number, meta: Map<string, Plan>): { w: number; h: number } {
  const cached = meta.get(ctxId)
  if (cached) return cached.box

  const content = layoutContent(ctxId)
  const subNodes = store.children(ctxId).filter(n => !n.deletedAt && isMarkedContext(n))
  const subBoxes = subNodes.map(sc => ({ id: sc.id, ...measureContext(sc.id, aspect, meta) }))

  const screenW = Math.round(BASE_H * aspect) // ancho "pantalla" → el contenido respira dentro
  // Subcontextos apilados en columna, debajo del contenido.
  const subs: Plan['subs'] = []
  const subTop = content.h > 0 ? content.h + CONTENT_SUB_GAP : 0
  let sy = subTop, subW = 0
  for (const s of subBoxes) {
    subs.push({ id: s.id, x: 0, y: sy })
    sy += s.h + SUB_GAP
    if (s.w > subW) subW = s.w
  }
  const subBottom = subBoxes.length ? sy - SUB_GAP : subTop

  const innerW = Math.max(screenW, content.w, subW)
  const innerH = Math.max(content.h, subBottom)
  const box = {
    w: innerW + PAD * 2,
    h: Math.max(BASE_H, HEADER + PAD + innerH + PAD),
  }
  meta.set(ctxId, { box, content: content.rows, subs })
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
 * del viewport. No destructivo.
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
