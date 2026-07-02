// nestedCanvasLayout — layout ANIDADO y AUTO-CALCULADO del lienzo único.
//
// DOS regiones, ambas de cajas anidadas con forma de pantalla:
//   · CONTEXTOS: 🧠 Contexto → contexto → subcontexto → … (caja = contexto marcado).
//   · AGENDA:    📅 Agenda → Año → Mes → Día (caja = contenedor temporal; el día es
//                `isDiaryEntry`). El contenido de cada día son sus notas/tareas (filas).
// La agenda se coloca a la DERECHA de los contextos. El contenido de una caja se pinta
// como esquema vertical con el texto COMPLETO (sin truncar). Todo en memoria (no escribe
// nada). El `_area` propio de un nodo (movido a mano) manda sobre la caja calculada.
import { store } from '../store/nodeStore'
import type { Node } from '../types'
import { isMarkedContext } from './cajones'
import { isContextKnowledge } from './knowledgeNodes'
import { findAgendaRoot } from './agendaHelper'
import { findContextRoot } from './rootLookup'

export interface NRect { x: number; y: number; w: number; h: number }
export interface NestedLayout {
  boxes: Map<string, NRect>
  items: Map<string, NRect>
  contextIds: Set<string>
  contentIds: Set<string>
  todayId: string | null   // id del día de HOY (para volar la cámara), si existe
}

export const CONTENT_W = 600
const INDENT = 24
const LINE_H = 25
const ROW_PAD = 12
const TEXT_W = CONTENT_W - 60
const TEXT_FONT = '15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
const HEADER = 46
const PAD = 36
const SUB_GAP = 120       // aire generoso entre subcontextos
const CONTENT_SUB_GAP = 140 // aire entre el texto y los subcontextos
const REGION_GAP = 900    // separación entre la región de contextos y la de agenda
const TOP_GAP = 500       // separación entre cajas de contexto de nivel superior
const BASE_H = 1300       // alto MÍNIMO de un contexto (aunque tenga poco) → grande
const EMPTY_RIGHT = 1400  // espacio libre a la derecha del contenido dentro de la caja
const EMPTY_BOTTOM = 1000 // espacio libre bajo el contenido dentro de la caja
const DEFAULT_ASPECT = 1.6

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

// ── Predicados de CAJA (sub-área) por región ─────────────────────────────────
/** Contextos: una caja es un contexto marcado (`_ctx='1'`). */
function isContextBox(n: Node): boolean { return isMarkedContext(n) }
/** Agenda: Año/Mes/Día son cajas. Día = `isDiaryEntry`; Mes = tiene día; Año = tiene mes. */
function isAgendaBox(n: Node): boolean {
  if (n.isDiaryEntry) return true
  const kids = store.children(n.id).filter(c => !c.deletedAt)
  if (kids.some(c => c.isDiaryEntry)) return true
  return kids.some(c => store.children(c.id).some(g => !g.deletedAt && g.isDiaryEntry))
}

/** ¿Es CONTENIDO (fila) y no una sub-caja? Excluye conocimiento, capturas y logs. */
function isContent(n: Node, isBox: (n: Node) => boolean): boolean {
  if (n.deletedAt) return false
  if (isBox(n)) return false
  if (isContextKnowledge(n.text)) return false
  const e = ed(n)
  if (e._capture === '1' || e._logAt) return false
  return true
}
function contentChildren(id: string, isBox: (n: Node) => boolean): Node[] {
  return store.children(id).filter(n => isContent(n, isBox))
}

interface Plan { box: { w: number; h: number }; content: { id: string; x: number; y: number; h: number }[]; subs: { id: string; x: number; y: number }[] }

function layoutContent(boxId: string, isBox: (n: Node) => boolean): { rows: Plan['content']; w: number; h: number } {
  const rows: Plan['content'] = []
  let y = 0, w = CONTENT_W
  const walk = (id: string, depth: number) => {
    const n = store.getNode(id)
    const h = rowHeight(n?.text)
    rows.push({ id, x: depth * INDENT, y, h })
    y += h
    const right = depth * INDENT + CONTENT_W
    if (right > w) w = right
    for (const c of contentChildren(id, isBox)) walk(c.id, depth + 1)
  }
  for (const c of contentChildren(boxId, isBox)) walk(c.id, 0)
  return { rows, w, h: y }
}

function measureBox(boxId: string, aspect: number, isBox: (n: Node) => boolean, meta: Map<string, Plan>): { w: number; h: number } {
  const cached = meta.get(boxId)
  if (cached) return cached.box
  const content = layoutContent(boxId, isBox)
  const subNodes = store.children(boxId).filter(n => !n.deletedAt && isBox(n))
  const subBoxes = subNodes.map(sc => ({ id: sc.id, ...measureBox(sc.id, aspect, isBox, meta) }))

  const screenW = Math.round(BASE_H * aspect)
  const subs: Plan['subs'] = []
  const subTop = content.h > 0 ? content.h + CONTENT_SUB_GAP : 0
  let sy = subTop, subW = 0
  for (const s of subBoxes) {
    subs.push({ id: s.id, x: 0, y: sy })
    sy += s.h + SUB_GAP
    if (s.w > subW) subW = s.w
  }
  const subBottom = subBoxes.length ? sy - SUB_GAP : subTop
  const innerW = Math.max(content.w, subW)
  const innerH = Math.max(content.h, subBottom)
  // La caja es MUCHO más grande que su contenido: el texto ocupa un ~5-10% del área,
  // anclado arriba-izquierda, y queda MUCHÍSIMO espacio libre dentro para navegar,
  // escribir y dibujar más adelante. (El lienzo es infinito → el zoom lo ajusta.)
  const box = {
    w: Math.max(screenW, innerW + EMPTY_RIGHT),
    h: Math.max(BASE_H, HEADER + PAD + innerH + PAD + EMPTY_BOTTOM),
  }
  meta.set(boxId, { box, content: content.rows, subs })
  return box
}

function placeBox(boxId: string, x: number, y: number, meta: Map<string, Plan>, out: { boxes: Map<string, NRect>; items: Map<string, NRect> }): void {
  const plan = meta.get(boxId)!
  out.boxes.set(boxId, { x, y, w: plan.box.w, h: plan.box.h })
  const ox = x + PAD, oy = y + HEADER + PAD
  for (const c of plan.content) out.items.set(c.id, { x: ox + c.x, y: oy + c.y, w: CONTENT_W, h: c.h })
  for (const s of plan.subs) placeBox(s.id, ox + s.x, oy + s.y, meta, out)
}

/** Coloca una REGIÓN (los hijos-caja de `rootId`) en una fila horizontal desde `startX`.
 *  Devuelve el borde derecho alcanzado. */
function placeRegion(rootId: string, aspect: number, isBox: (n: Node) => boolean, startX: number, meta: Map<string, Plan>, out: { boxes: Map<string, NRect>; items: Map<string, NRect> }): number {
  const tops = store.children(rootId).filter(c => !c.deletedAt && !isContextKnowledge(c.text))
  for (const tc of tops) measureBox(tc.id, aspect, isBox, meta)
  let x = startX
  for (const tc of tops) {
    placeBox(tc.id, x, 0, meta, out)
    x += (meta.get(tc.id)?.box.w ?? CONTENT_W) + TOP_GAP
  }
  return x
}

/**
 * Layout anidado de TODO el lienzo: región de CONTEXTOS (izquierda) + región de AGENDA
 * (derecha). `aspect` = ancho/alto del viewport (cajas con forma de pantalla).
 */
export function computeNestedLayout(rootId: string, aspect = DEFAULT_ASPECT): NestedLayout {
  const asp = aspect > 0.2 && aspect < 6 ? aspect : DEFAULT_ASPECT
  const meta = new Map<string, Plan>()
  const boxes = new Map<string, NRect>()
  const items = new Map<string, NRect>()

  // Región de CONTEXTOS.
  const ctxRoot = findContextRoot()?.id ?? rootId
  const afterCtx = placeRegion(ctxRoot, asp, isContextBox, 0, meta, { boxes, items })

  // Región de AGENDA (a la derecha).
  const agenda = findAgendaRoot()
  if (agenda) placeRegion(agenda.id, asp, isAgendaBox, afterCtx + REGION_GAP, meta, { boxes, items })

  // Id del día de HOY (para volar la cámara al abrir / pulsar «hoy»).
  let todayId: string | null = null
  const today = (() => { try { return new Date() } catch { return null } })()
  if (today) {
    const y = today.getFullYear(), m = today.getMonth(), d = today.getDate()
    for (const id of boxes.keys()) {
      const n = store.getNode(id)
      if (n?.isDiaryEntry && n.diaryDate) {
        const dd = new Date(n.diaryDate)
        if (dd.getFullYear() === y && dd.getMonth() === m && dd.getDate() === d) { todayId = id; break }
      }
    }
  }

  return { boxes, items, contextIds: new Set(boxes.keys()), contentIds: new Set(items.keys()), todayId }
}
