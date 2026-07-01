// nestedCanvasLayout — layout ANIDADO y AUTO-CALCULADO del lienzo único (Fase 1).
//
// Cada CONTEXTO es un ÁREA (caja). Los SUBCONTEXTOS son cajas DENTRO de la caja del
// contexto padre → congruencia física entre la estructura (árbol) y el lienzo. El
// contenido directo del contexto (notas, «Lo que Fromly sabe», etc.) se apila como
// filas dentro de su caja. Todo se calcula en MEMORIA a partir del árbol: no escribe
// nada. Si un contexto tiene `_area` propio (el usuario lo movió), ESE manda; si no,
// usa la caja calculada aquí. Así estructura y lienzo nunca se desincronizan.
import { store } from '../store/nodeStore'
import type { Node } from '../types'
import { isMarkedContext } from './cajones'
import { isContextKnowledge } from './knowledgeNodes'

export interface NRect { x: number; y: number; w: number; h: number }
export interface NestedLayout {
  boxes: Map<string, NRect>     // contextId → caja (área) en coords de mundo
  items: Map<string, NRect>     // contentId → posición de la fila (mundo)
  contextIds: Set<string>       // nodos que son áreas (marco)
  contentIds: Set<string>       // nodos que son contenido (tarjeta)
}

const PAD = 26        // margen interior de una caja
const HEADER = 30     // espacio para la etiqueta arriba
const ITEM_H = 38     // alto de una fila de contenido
const ITEM_GAP = 10   // separación entre filas
const ITEM_W = 560    // ancho de una fila de contenido
const BLOCK_GAP = 22  // separación entre bloques apilados
const TOP_GAP = 90    // separación entre cajas de contexto de nivel superior

function ed(n: Node): Record<string, unknown> {
  try { return JSON.parse(n.extraData || '{}') } catch { return {} }
}

/** ¿Este hijo es CONTENIDO (fila) y no un subcontexto? Excluye capturas/logs. */
function isContentItem(n: Node): boolean {
  if (n.deletedAt) return false
  const e = ed(n)
  if (e._capture === '1' || e._logAt) return false
  return true
}

interface Meta {
  size: Map<string, { w: number; h: number }>
  kids: Map<string, { content: Node[]; ctx: Node[] }>
}

/** Mide (bottom-up) el tamaño de la caja de un contexto y cachea su reparto de hijos. */
function measure(nodeId: string, meta: Meta): { w: number; h: number } {
  const children = store.children(nodeId).filter(c => !c.deletedAt)
  const ctx: Node[] = []
  const content: Node[] = []
  for (const c of children) {
    if (isMarkedContext(c)) ctx.push(c)         // subcontexto → caja anidada
    else if (isContentItem(c)) content.push(c)  // contenido → fila
  }
  meta.kids.set(nodeId, { content, ctx })
  let innerW = ITEM_W
  let innerH = 0
  for (let i = 0; i < content.length; i++) innerH += ITEM_H + ITEM_GAP
  for (const sc of ctx) {
    const s = measure(sc.id, meta)
    innerW = Math.max(innerW, s.w)
    innerH += s.h + BLOCK_GAP
  }
  if (innerH === 0) innerH = ITEM_H // caja vacía: alto mínimo de una fila
  const size = { w: innerW + PAD * 2, h: HEADER + PAD + innerH + PAD }
  meta.size.set(nodeId, size)
  return size
}

/** Coloca (top-down) la caja y su contenido en coords absolutas de mundo. */
function place(nodeId: string, x: number, y: number, out: { boxes: Map<string, NRect>; items: Map<string, NRect> }, meta: Meta): void {
  const size = meta.size.get(nodeId)!
  out.boxes.set(nodeId, { x, y, w: size.w, h: size.h })
  const { content, ctx } = meta.kids.get(nodeId)!
  const cx = x + PAD
  let cy = y + HEADER + PAD
  for (const c of content) {
    out.items.set(c.id, { x: cx, y: cy, w: ITEM_W, h: ITEM_H })
    cy += ITEM_H + ITEM_GAP
  }
  for (const sc of ctx) {
    place(sc.id, cx, cy, out, meta)
    cy += meta.size.get(sc.id)!.h + BLOCK_GAP
  }
}

/**
 * Layout anidado de TODO el árbol de contextos que cuelga de `rootId` (= 🧠 Contexto).
 * Los hijos directos de la raíz son los contextos RAÍZ → cajas de nivel superior,
 * dispuestas en una fila horizontal (el lienzo es infinito). No destructivo.
 */
export function computeNestedLayout(rootId: string): NestedLayout {
  const meta: Meta = { size: new Map(), kids: new Map() }
  // Nivel 0: hijos de 🧠 Contexto = contextos raíz (excluye el nodo de conocimiento
  // de la propia raíz, si lo hubiera).
  const topContexts = store.children(rootId).filter(c => !c.deletedAt && !isContextKnowledge(c.text))
  for (const tc of topContexts) measure(tc.id, meta)

  const boxes = new Map<string, NRect>()
  const items = new Map<string, NRect>()
  let x = 0
  for (const tc of topContexts) {
    place(tc.id, x, 0, { boxes, items }, meta)
    x += (meta.size.get(tc.id)?.w ?? ITEM_W) + TOP_GAP
  }
  return { boxes, items, contextIds: new Set(boxes.keys()), contentIds: new Set(items.keys()) }
}
