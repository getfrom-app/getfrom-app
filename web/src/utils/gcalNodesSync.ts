/**
 * gcalNodesSync — Sincroniza eventos de Google Calendar como nodos del árbol.
 *
 * Cada evento de GCal se representa como un nodo hijo de la nota diaria:
 *   📅 Jueves, 28 de mayo de 2026
 *     ├── 07:00–12:00 Café Olé   extraData._gcalEventId="xxx", isEvent=true
 *     └── 15:15–16:30 Streaming  extraData._gcalEventId="yyy", isEvent=true
 *
 * Bidireccional:
 *   GCal → Fromly: al abrir la nota diaria, sync eventos → nodos
 *   Fromly → GCal: al mover un nodo evento a otra nota diaria, actualiza GCal
 */

import { store } from '../store/nodeStore'
import { nodeMeta } from '../store/nodeStore'
import type { Node } from '../types'
import { getCalendarEvents, updateCalendarEvent, deleteCalendarEvent, fromRecToRRule, type CalendarEvent } from '../api/googleCalendar'
import { gcalEventNodeId } from './deterministicId'

// Último título sincronizado por evento (anti-bucle: evita re-empujar lo que vino
// del propio pull de Google). Se rellena en el pull y en cada push.
const lastSyncedTitle = new Map<string, string>()

// Quita el prefijo de hora del texto del nodo-evento → título limpio.
function stripTimePrefix(text: string): string {
  return text
    .replace(/^\s*\d{1,2}:\d{2}\s*[–-]\s*\d{1,2}:\d{2}\s+/, '')
    .replace(/^\s*\d{1,2}:\d{2}\s+/, '')
    .trim()
}

// ── Sync GCal → nodos ────────────────────────────────────────────────────────

/**
 * Sincroniza los eventos de GCal del día como nodos hijos de la nota diaria.
 * - Crea los que no existen
 * - Actualiza los que cambiaron de título/hora
 * - Elimina (archiva en Papelera) los que ya no existen en GCal
 */
export async function syncGcalEventsToNodes(diaryNode: Node): Promise<void> {
  if (!diaryNode.isDiaryEntry || !diaryNode.diaryDate) return

  let events: CalendarEvent[]
  try {
    events = await getCalendarEvents(new Date(diaryNode.diaryDate))
  } catch { return }  // sin conexión o sin permiso → silencioso

  // Nodos GCal existentes bajo esta nota
  const children = store.children(diaryNode.id)
  const gcalChildren: { node: Node; gcalId: string }[] = []
  for (const child of children) {
    try {
      const ed = JSON.parse(child.extraData || '{}')
      if (ed._gcalEventId) gcalChildren.push({ node: child, gcalId: ed._gcalEventId })
    } catch { /* ignore */ }
  }

  // Auto-saneo: si hay VARIOS nodos para el mismo evento (duplicados de la carrera
  // sync-antes-de-bootstrap), conservar el canónico (id determinista si existe, si no
  // el más antiguo) y mandar el resto a la papelera. Idempotente.
  const byGcalId = new Map<string, Node[]>()
  for (const c of gcalChildren) {
    const arr = byGcalId.get(c.gcalId) || []
    arr.push(c.node); byGcalId.set(c.gcalId, arr)
  }
  const trashedDupIds = new Set<string>()
  for (const [gid, list] of byGcalId) {
    if (list.length <= 1) continue
    const detId = gcalEventNodeId(gid)
    list.sort((a, b) =>
      (a.id === detId ? -1 : 0) - (b.id === detId ? -1 : 0) ||
      new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
    for (const dup of list.slice(1)) {
      try { const { trashNode } = await import('./papeleraHelper'); trashNode(dup.id) }
      catch { store.updateNode(dup.id, { deletedAt: new Date().toISOString() }) }
      trashedDupIds.add(dup.id)
    }
  }
  // Trabajar solo con los nodos vivos tras el saneo.
  const liveGcalChildren = gcalChildren.filter(c => !trashedDupIds.has(c.node.id))

  const existingIds = new Set(liveGcalChildren.map(c => c.gcalId))
  const incomingIds = new Set(events.map(e => e.id))

  // Ordenar eventos por hora de inicio
  const sorted = [...events].sort((a, b) => a.start.localeCompare(b.start))

  for (let i = 0; i < sorted.length; i++) {
    const ev = sorted[i]
    const existing = liveGcalChildren.find(c => c.gcalId === ev.id)
    // El nodo guarda el título LIMPIO; la hora vive en due/dueEnd y se muestra
    // como badge (no incrustada en el texto → título editable y sync limpio).
    const newText = ev.title

    lastSyncedTitle.set(ev.id, ev.title) // anti-bucle: este título viene de Google

    if (existing) {
      // Actualizar si cambió el texto o la fecha
      if (existing.node.text !== newText || existing.node.due !== ev.start || existing.node.dueEnd !== ev.end) {
        store.updateNode(existing.node.id, {
          text: newText,
          due:  ev.start,
          dueEnd: ev.end,
          siblingOrder: i + 0.001,  // orden cronológico
        })
      }
    } else {
      // Crear nuevo nodo GCal con id DETERMINISTA (idempotente: la misma carrera o
      // un re-sync produce el mismo id → el upsert lo fusiona, no duplica).
      const node = store.createNode({
        text:     newText,
        parentId: diaryNode.id,
        siblingOrder: i + 0.001,
        predefinedId: gcalEventNodeId(ev.id) ?? undefined,
      })
      store.updateNode(node.id, {
        isEvent: true,
        due:     ev.start,
        dueEnd:  ev.end,
        extraData: JSON.stringify({
          _gcalEventId:    ev.id,
          gcalEventId:     ev.id, // clave que usa el auto-sync de NodeView → evita crear duplicado
          _gcalAllDay:     ev.allDay ? '1' : '0',
          _gcalColor:      ev.backgroundColor || '',
          _gcalSynced:     '1',
        }),
      })
    }
  }

  // Eliminar nodos cuyo evento ya no existe en GCal
  for (const child of liveGcalChildren) {
    if (!incomingIds.has(child.gcalId)) {
      // Soft-delete: mover a papelera
      try {
        const { trashNode } = await import('./papeleraHelper')
        trashNode(child.node.id)
      } catch {
        store.updateNode(child.node.id, { deletedAt: new Date().toISOString() })
      }
    }
  }
}

// ── Sync Fromly → GCal (al mover evento a otra nota) ───────────────────────────

/**
 * Cuando un nodo GCal cambia de nota diaria (parentId),
 * actualiza la fecha del evento en Google Calendar.
 */
export async function syncNodeMoveToGcal(nodeId: string, newParentId: string): Promise<void> {
  const node = store.getNode(nodeId)
  if (!node) return

  let gcalId: string | undefined
  let isAllDay = false
  try {
    const ed = JSON.parse(node.extraData || '{}')
    gcalId   = ed._gcalEventId
    isAllDay = ed._gcalAllDay === '1'
    if (!gcalId) return
  } catch { return }

  // Encontrar la nueva nota diaria para obtener la fecha
  const newParent = store.getNode(newParentId)
  if (!newParent?.isDiaryEntry || !newParent.diaryDate) return

  const newDate    = new Date(newParent.diaryDate)
  const oldStart   = node.due ? new Date(node.due) : new Date()
  const oldEnd     = node.dueEnd ? new Date(node.dueEnd) : new Date(oldStart.getTime() + 3600000)
  const durationMs = oldEnd.getTime() - oldStart.getTime()

  // Mantener hora, cambiar solo el día
  const newStart = new Date(newDate)
  newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), 0, 0)
  const newEnd = new Date(newStart.getTime() + durationMs)

  try {
    await updateCalendarEvent(gcalId, {
      start: newStart.toISOString(),
      end:   newEnd.toISOString(),
    })
    // Actualizar also el due del nodo
    store.updateNode(nodeId, { due: newStart.toISOString(), dueEnd: newEnd.toISOString() })
  } catch {
    window.dispatchEvent(new CustomEvent('from:toast', {
      detail: { message: 'No se pudo actualizar el evento en Google Calendar', type: 'error' }
    }))
  }
}

// ── Sync Fromly → GCal: cambios de TÍTULO ─────────────────────────────────────
/**
 * Empuja a Google los títulos de eventos del día que el usuario haya editado.
 * Conservador: solo TÍTULO (lo más reversible), con guarda anti-bucle (no re-empuja
 * lo que vino del pull). Pensado para llamarse con debounce desde el panel del día.
 */
export async function pushEventTitleChanges(diaryNode: Node): Promise<void> {
  if (!diaryNode?.isDiaryEntry) return
  for (const child of store.children(diaryNode.id)) {
    const gcalId = getGcalEventId(child)
    if (!gcalId) continue
    const title = stripTimePrefix(child.text)
    const prev = lastSyncedTitle.get(gcalId)
    lastSyncedTitle.set(gcalId, title)
    if (prev === undefined) continue          // primera vez visto → solo registrar
    if (prev !== title && title) {
      try { await updateCalendarEvent(gcalId, { title }) } catch { /* silencioso */ }
    }
  }
}

/**
 * Empuja a Google el estado completo de un nodo-evento (título limpio + hora de
 * inicio/fin + recurrencia). Se llama al editar el badge de hora/repetición desde
 * la columna del día (donde el auto-sync de NodeView no aplica, porque el nodo
 * abierto es la diaria, no el evento).
 */
export async function pushEventToGcal(node: Node): Promise<void> {
  const gcalId = getGcalEventId(node)
  if (!gcalId || !node.due) return
  const end = node.dueEnd || new Date(new Date(node.due).getTime() + 3600000).toISOString()
  const title = stripTimePrefix(node.text || 'Evento')
  lastSyncedTitle.set(gcalId, title) // anti-bucle del push de títulos
  try {
    await updateCalendarEvent(gcalId, {
      title,
      start: node.due,
      end,
      recurrence: fromRecToRRule(node.recurrence),
    })
  } catch { /* sin conexión GCal — silencioso */ }
}

/**
 * Borra el evento en Google al ELIMINAR explícitamente un nodo-evento (acción del
 * usuario). NO se llama desde la sincronización de bajada (evita borrados en masa).
 * Devuelve true si era un evento (y se intentó borrar en Google).
 */
export async function deleteGcalEventForNode(node: Node): Promise<boolean> {
  const gcalId = getGcalEventId(node)
  if (!gcalId) return false
  try { await deleteCalendarEvent(gcalId) } catch { /* silencioso */ }
  lastSyncedTitle.delete(gcalId)
  return true
}

/**
 * Limpieza única: los eventos de Google ya NO se materializan como nodos locales.
 * Envía a la Papelera (reversible) todos los nodos que se crearon a partir de un
 * evento de Google (llevan `_gcalEventId`). Idempotente: marca un flag para no
 * repetirse y, una vez hecho, no encuentra ninguno. Devuelve cuántos archivó.
 */
export async function cleanupGcalMaterializedNodes(): Promise<number> {
  const victims = store.allActive().filter(n => {
    try { return !!JSON.parse(n.extraData || '{}')._gcalEventId } catch { return false }
  })
  if (victims.length === 0) return 0
  const { trashNode } = await import('./papeleraHelper')
  for (const n of victims) {
    try { trashNode(n.id) }
    catch { store.updateNode(n.id, { deletedAt: new Date().toISOString() }) }
  }
  return victims.length
}

/** Devuelve el _gcalEventId de un nodo, o null si no tiene */
export function getGcalEventId(node: Node): string | null {
  try {
    const ed = JSON.parse(node.extraData || '{}')
    return ed._gcalEventId || null
  } catch { return null }
}

/** Devuelve el color GCal del nodo evento */
export function getGcalColor(node: Node): string | null {
  try {
    const ed = JSON.parse(node.extraData || '{}')
    return ed._gcalColor || null
  } catch { return null }
}
