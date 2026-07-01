// nestedCanvasLayout — layout ANIDADO y AUTO-CALCULADO del lienzo único.
//
// Cada CONTEXTO es un ÁREA (caja). Sus SUBCONTEXTOS son cajas DENTRO. El CONTENIDO de
// un contexto se pinta como un ESQUEMA (outline) con TODO su subárbol: cada nodo es una
// fila y sus hijos van indentados justo debajo (así no se pierde nada del contenido
// anidado). El nodo «🧠 Lo que Fromly sabe» NO se pinta en el lienzo (vive en la columna
// derecha). Todo se calcula en memoria a partir del árbol: no escribe nada. Si un
// contexto tiene `_area` propio (movido a mano), ESE manda sobre la caja calculada.
import { store } from '../store/nodeStore'
import type { Node } from '../types'
import { isMarkedContext } from './cajones'
import { isContextKnowledge } from './knowledgeNodes'

export interface NRect { x: number; y: number; w: number; h: number }
export interface NestedLayout {
  boxes: Map<string, NRect>     // contextId → caja (área) en coords de mundo
  items: Map<string, NRect>     // contentId → posición de la fila (mundo)
  contextIds: Set<string>       // nodos que son áreas (marco)
  contentIds: Set<string>       // nodos que son contenido (tarjeta flat)
}

const CONTENT_W = 600  // ancho de la tarjeta de contenido
const INDENT = 26      // indentación del esquema por nivel de profundidad
const LINE_H = 23      // alto de una línea de texto (estimación de wrap)
const ROW_PAD = 16     // aire vertical por fila
const CHARS_PER_LINE = CONTENT_W / 7.6 // estimación de caracteres por línea a ~15px
const HEADER = 40      // espacio para la etiqueta del área
const PAD = 30         // margen interior de la caja
const BLOCK_GAP = 26   // separación entre bloques apilados dentro de la caja
const TOP_GAP = 160    // separación entre cajas de contexto de nivel superior

function ed(n: Node): Record<string, unknown> {
  try { return JSON.parse(n.extraData || '{}') } catch { return {} }
}

/** ¿Este nodo se pinta como CONTENIDO (fila del esquema)? Excluye subcontextos, el nodo
 *  de conocimiento (columna derecha), capturas y logs. */
function isContent(n: Node): boolean {
  if (n.deletedAt) return false
  if (isMarkedContext(n)) return false        // subcontexto → caja aparte
  if (isContextKnowledge(n.text)) return false // «Lo que Fromly sabe» → NO en el lienzo
  const e = ed(n)
  if (e._capture === '1' || e._logAt) return false
  return true
}

/** Filas de contenido (subárbol completo) de un nodo, en orden de árbol. */
function contentChildren(id: string): Node[] {
  return store.children(id).filter(isContent)
}

/** Alto estimado de una fila según su texto (wrap al ancho de la tarjeta). */
function rowHeight(text: string | null | undefined): number {
  const len = (text || '').trim().length || 1
  const lines = Math.max(1, Math.ceil(len / CHARS_PER_LINE))
  return lines * LINE_H + ROW_PAD
}

interface Meta {
  size: Map<string, { w: number; h: number }>          // caja de cada contexto
  content: Map<string, Node[]>                          // filas de contenido directo (nivel 0)
  subctx: Map<string, Node[]>                           // subcontextos de cada contexto
}

/** Mide (bottom-up) el esquema de un nodo de contenido: alto total del subárbol y su
 *  extremo derecho (para dimensionar la caja). */
function measureOutline(nodeId: string, depth: number): { h: number; right: number } {
  const self = store.getNode(nodeId)
  let h = rowHeight(self?.text)
  let right = depth * INDENT + CONTENT_W
  for (const c of contentChildren(nodeId)) {
    const s = measureOutline(c.id, depth + 1)
    h += s.h
    if (s.right > right) right = s.right
  }
  return { h, right }
}

/** Coloca (top-down) el esquema de un nodo; devuelve la nueva `y`. */
function placeOutline(nodeId: string, boxX: number, y: number, depth: number, items: Map<string, NRect>): number {
  const self = store.getNode(nodeId)
  const rh = rowHeight(self?.text)
  items.set(nodeId, { x: boxX + depth * INDENT, y, w: CONTENT_W, h: rh })
  y += rh
  for (const c of contentChildren(nodeId)) y = placeOutline(c.id, boxX, y, depth + 1, items)
  return y
}

/** Mide la caja de un contexto (contenido en esquema + subcontextos anidados). */
function measureContext(ctxId: string, meta: Meta): { w: number; h: number } {
  const cached = meta.size.get(ctxId)
  if (cached) return cached
  const content = contentChildren(ctxId)
  const subctx = store.children(ctxId).filter(n => !n.deletedAt && isMarkedContext(n))
  meta.content.set(ctxId, content)
  meta.subctx.set(ctxId, subctx)

  let innerW = CONTENT_W
  let innerH = 0
  for (const c of content) {
    const s = measureOutline(c.id, 0)
    innerH += s.h
    if (s.right > innerW) innerW = s.right
  }
  if (content.length > 0 && subctx.length > 0) innerH += BLOCK_GAP
  for (const sc of subctx) {
    const s = measureContext(sc.id, meta)
    if (s.w > innerW) innerW = s.w
    innerH += s.h + BLOCK_GAP
  }
  if (innerH === 0) innerH = LINE_H
  const size = { w: innerW + PAD * 2, h: HEADER + PAD + innerH + PAD }
  meta.size.set(ctxId, size)
  return size
}

/** Coloca la caja de un contexto y todo su interior en coords absolutas de mundo. */
function placeContext(ctxId: string, x: number, y: number, out: { boxes: Map<string, NRect>; items: Map<string, NRect> }, meta: Meta): void {
  const size = meta.size.get(ctxId)!
  out.boxes.set(ctxId, { x, y, w: size.w, h: size.h })
  const boxX = x + PAD
  let cy = y + HEADER + PAD
  for (const c of (meta.content.get(ctxId) || [])) cy = placeOutline(c.id, boxX, cy, 0, out.items)
  const subctx = meta.subctx.get(ctxId) || []
  if ((meta.content.get(ctxId) || []).length > 0 && subctx.length > 0) cy += BLOCK_GAP
  for (const sc of subctx) {
    placeContext(sc.id, boxX, cy, out, meta)
    cy += meta.size.get(sc.id)!.h + BLOCK_GAP
  }
}

/**
 * Layout anidado de TODO el árbol de contextos que cuelga de `rootId` (= 🧠 Contexto).
 * Los hijos directos de la raíz son los contextos RAÍZ → cajas de nivel superior, en
 * una fila horizontal (el lienzo es infinito). No destructivo.
 */
export function computeNestedLayout(rootId: string): NestedLayout {
  const meta: Meta = { size: new Map(), content: new Map(), subctx: new Map() }
  const topContexts = store.children(rootId).filter(c => !c.deletedAt && !isContextKnowledge(c.text))
  for (const tc of topContexts) measureContext(tc.id, meta)

  const boxes = new Map<string, NRect>()
  const items = new Map<string, NRect>()
  let x = 0
  for (const tc of topContexts) {
    placeContext(tc.id, x, 0, { boxes, items }, meta)
    x += (meta.size.get(tc.id)?.w ?? CONTENT_W) + TOP_GAP
  }
  return { boxes, items, contextIds: new Set(boxes.keys()), contentIds: new Set(items.keys()) }
}
