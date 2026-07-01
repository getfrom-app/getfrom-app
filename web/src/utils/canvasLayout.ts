// Auto-layout del lienzo único (NO destructivo): calcula EN MEMORIA una posición
// para cada nodo del árbol de contenido que no tenga pin propio, disponiendo el
// árbol en el plano (contextos como zonas que contienen a sus hijos, recursivo).
// No escribe nada: si el usuario mueve algo, ESO se persiste (pin propio) y manda
// sobre el auto-layout. Así «aparece todo» sin tocar los datos.
import { store } from '../store/nodeStore'
import type { Node } from '../types'
import { parseExtraData } from './papeleraHelper'

export interface LRect { x: number; y: number; w: number; h: number; zone: boolean }

const CARD_W = 300
const CARD_H = 150
const GAP = 48
const PAD = 64
const HEADER = 64

function aggregable(n: Node): boolean {
  if (n.deletedAt) return false
  const ed = parseExtraData(n.extraData)
  if (ed._capture === '1' || ed._logAt) return false
  return !!(n.text && n.text.trim())
}

function realChildren(id: string): Node[] {
  return store.children(id).filter(aggregable)
}

interface Box { id: string; w: number; h: number; kids: Box[] }

function measure(id: string, depth: number): Box {
  const kids = depth >= 4 ? [] : realChildren(id).map(k => measure(k.id, depth + 1))
  if (!kids.length) return { id, w: CARD_W, h: CARD_H, kids: [] }
  const cols = Math.max(1, Math.ceil(Math.sqrt(kids.length)))
  const rows = Math.ceil(kids.length / cols)
  const cw = Math.max(...kids.map(b => b.w))
  const ch = Math.max(...kids.map(b => b.h))
  const w = PAD * 2 + cols * cw + (cols - 1) * GAP
  const h = HEADER + PAD + rows * ch + (rows - 1) * GAP
  return { id, w, h, kids }
}

function place(box: Box, x: number, y: number, out: Map<string, LRect>): void {
  out.set(box.id, { x, y, w: box.w, h: box.h, zone: box.kids.length > 0 })
  if (!box.kids.length) return
  const cols = Math.max(1, Math.ceil(Math.sqrt(box.kids.length)))
  const cw = Math.max(...box.kids.map(b => b.w))
  const ch = Math.max(...box.kids.map(b => b.h))
  box.kids.forEach((c, i) => {
    const col = i % cols, row = Math.floor(i / cols)
    place(c, x + PAD + col * (cw + GAP), y + HEADER + row * (ch + GAP), out)
  })
}

/** Auto-layout del subárbol de `rootId` en el plano. Map id → rect (mundo). */
export function computeCanvasLayout(rootId: string): Map<string, LRect> {
  const out = new Map<string, LRect>()
  const tops = realChildren(rootId).map(r => measure(r.id, 0))
  if (!tops.length) return out
  // Disponer las zonas de nivel superior en filas que se ajustan a un ancho objetivo.
  const targetW = Math.max(2200, Math.ceil(Math.sqrt(tops.length)) * 900)
  let x = 0, y = 0, rowH = 0
  for (const b of tops) {
    if (x > 0 && x + b.w > targetW) { x = 0; y += rowH + GAP * 3; rowH = 0 }
    place(b, x, y, out)
    x += b.w + GAP * 3
    rowH = Math.max(rowH, b.h)
  }
  return out
}
