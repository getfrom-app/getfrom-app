// Lectura/escritura del bloque ```from-pizarra``` en el body de un nodo-pizarra
// (formato compatible con iPad). El nodo-pizarra guarda en su body un bloque
// cercado con WBData { strokes, texts, ... }. Estas utilidades permiten, desde
// fuera de PizarraView (p. ej. el DocEditor), leer y actualizar ese bloque —
// en concreto, mantener sincronizado el texto del lienzo enlazado a un documento.

import { store } from '../store/nodeStore'

export const FENCE = '```from-pizarra'

export interface WBText { id: string; x: number; y: number; size: number; w: number; md: string; c?: string; nodeId?: string }
export interface WBData { version: number; strokes: unknown[]; texts?: WBText[]; tasks?: unknown[]; camX?: number; camY?: number; camScale?: number }

export function parsePizarra(body: string | null | undefined): WBData {
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

export function bodyWithPizarra(body: string | null | undefined, data: WBData): string {
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

// Sincroniza el texto del lienzo (WBText) enlazado a un documento: busca, en el
// body del nodo-pizarra `parentId`, el texto cuyo `nodeId` === `docNodeId` y le
// asigna el `md` dado. No hace nada si el padre no es una pizarra o no hay enlace.
export function updateLinkedCanvasText(parentId: string | null | undefined, docNodeId: string, md: string): void {
  if (!parentId) return
  const parent = store.getNode(parentId)
  if (!parent) return
  const data = parsePizarra(parent.body)
  if (!data.texts || !data.texts.length) return
  let changed = false
  const texts = data.texts.map(t => {
    if (t.nodeId === docNodeId && t.md !== md) { changed = true; return { ...t, md } }
    return t
  })
  if (!changed) return
  data.texts = texts
  store.updateNode(parentId, { body: bodyWithPizarra(parent.body, data) })
}
