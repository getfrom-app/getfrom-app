// Tareas DE UN DOCUMENTO — «seguimiento cada 15 días» sobre el documento de un
// alumno, un cliente o un proyecto (Alberto, 6 ago 2026: "no sería una tarea
// separada del documento, sino que al hacer clic sobre ella en cualquier parte se
// abriría el propio documento").
//
// No hay tipo nuevo: es una TAREA normal (status/due/recurrence, con todo lo que
// eso ya arrastra — cockpit, planner, búsqueda, Google) con `_taskOf` apuntando al
// documento. El vínculo va por ID, no por `parentId`, justamente porque la
// siguiente instancia de una tarea recurrente NACE EN OTRO SITIO: `spawnRecurrence`
// la cuelga del nodo del día correspondiente. Enlazar por el árbol habría perdido
// el documento en el primer seguimiento completado.
//
// Convive con las casillas del cuerpo (`_taskEmbed`, ver DocEditor.tsx): esas son
// tareas de documento ancladas a una casilla concreta del texto; estas otras son
// del documento entero. Las dos se listan juntas en el bloque «Tareas» de la ficha.
import { store } from '../store/nodeStore'
import { parseExtraData, isInPapelera } from './papeleraHelper'
import { isDocNode } from './docNode'
import { assignContext, nodeCtxRefs } from './cajones'
import { extractDateFromEnd, recurrenceToString } from './naturalDate'
import type { Node } from '../types'

export const TASK_OF = '_taskOf'

/** Documento al que pertenece esta tarea, o null si es una tarea suelta. */
export function docIdOfTask(n: Node | null | undefined): string | null {
  if (!n) return null
  const e = parseExtraData(n.extraData)
  const explicit = e[TASK_OF]
  if (typeof explicit === 'string' && explicit) return explicit
  // Legado: las casillas del cuerpo se enlazaban SOLO por parentId (DocEditor.tsx
  // escribía `_taskEmbed` sin decir de qué documento). Se resuelve al vuelo — no
  // hace falta migración: en cuanto el documento se abre, el sync les pone `_taskOf`.
  if (e._taskEmbed === '1' && n.parentId) {
    const p = store.getNode(n.parentId)
    if (p && !p.deletedAt && isDocNode(p)) return p.id
  }
  return null
}

/** Documento VIVO al que pertenece la tarea (null si no lo tiene o está borrado). */
export function docOfTask(n: Node | null | undefined): Node | null {
  const id = docIdOfTask(n)
  if (!id) return null
  const doc = store.getNode(id)
  return doc && !doc.deletedAt ? doc : null
}

export function isDocTask(n: Node | null | undefined): boolean {
  return docOfTask(n) != null
}

/** Tareas de un documento: pendientes primero por fecha (las que no tienen, al
 *  final), luego las completadas de más reciente a más antigua. */
export function tasksOfDoc(docId: string): Node[] {
  const out: Node[] = []
  for (const n of store.allActive()) {
    if (n.status == null) continue
    if (isInPapelera(n.id)) continue
    if (docIdOfTask(n) !== docId) continue
    out.push(n)
  }
  out.sort((a, b) => {
    const ad = a.status === 'done', bd = b.status === 'done'
    if (ad !== bd) return ad ? 1 : -1
    if (ad) return (b.updatedAt || '').localeCompare(a.updatedAt || '')
    if (!a.due) return b.due ? 1 : 0
    if (!b.due) return -1
    return a.due.localeCompare(b.due)
  })
  return out
}

/** La instancia VIVA que dejó `spawnRecurrence` al completar `done`: misma tarea
 *  (mismo documento y mismo título), pendiente y creada después. Se busca por
 *  contenido y no por un puntero guardado porque quien crea la instancia siguiente
 *  puede ser cualquiera de los clientes — el cockpit, el planner o el iPhone — y
 *  ninguno anota de dónde venía. Si hay varias, la más reciente. */
export function nextRecurrenceInstance(done: Node): Node | null {
  const docId = docIdOfTask(done)
  if (!docId) return null
  const title = (done.text || '').trim()
  let best: Node | null = null
  for (const n of store.allActive()) {
    if (n.id === done.id || n.status !== 'pending') continue
    if ((n.text || '').trim() !== title) continue
    if (docIdOfTask(n) !== docId) continue
    if (isInPapelera(n.id)) continue
    if (!best || (n.createdAt || '') > (best.createdAt || '')) best = n
  }
  return best
}

/** Crea una tarea del documento a partir de lo ESCRITO, con el mismo magic que la
 *  captura rápida: «seguimiento cada 15 días» → título «seguimiento», fecha dentro
 *  de 15 días y recurrencia cada 15 días. Hereda el contexto del documento, así que
 *  aparece también en la columna de ese contexto. */
export function createDocTask(docId: string, raw: string): Node | null {
  const doc = store.getNode(docId)
  const input = raw.trim()
  if (!doc || !input) return null

  const dp = extractDateFromEnd(input)
  const text = (dp?.cleanText || input).trim() || input
  const updates: Record<string, unknown> = { status: 'pending' }
  if (dp?.parsed.date) {
    const d = new Date(dp.parsed.date)
    if (dp.timeStr) { const [h, m] = dp.timeStr.split(':').map(Number); d.setHours(h, m, 0, 0) } else d.setHours(0, 0, 0, 0)
    updates.due = d.toISOString()
  }
  if (dp?.parsed.recurrence) updates.recurrence = recurrenceToString(dp.parsed.recurrence)

  const sibs = store.children(docId).filter(n => !n.deletedAt)
  const created = store.createNode({
    text,
    parentId: docId,
    siblingOrder: (sibs.length ? Math.max(...sibs.map(s => s.siblingOrder)) : 0) + 1000,
    isTask: true,
    extraData: { [TASK_OF]: docId },
  })
  store.updateNode(created.id, updates)
  for (const ref of nodeCtxRefs(doc)) assignContext(created.id, ref)
  return store.getNode(created.id) ?? created
}
