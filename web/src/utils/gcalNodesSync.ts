/**
 * gcalNodesSync — Puente Fromly → Google Calendar para nodos-evento.
 *
 * Los eventos de Google YA NO se materializan como nodos (eso se retiró en v9.6.547;
 * `syncGcalEventsToNodes` se eliminó por código muerto). El planner los muestra
 * directamente desde Google. Este módulo cubre la dirección Fromly → GCal y utilidades:
 *   - mover/empujar un nodo-evento a Google (título, hora, recurrencia)
 *   - borrar el evento de Google al borrar el nodo
 *   - limpiar nodos materializados antiguos (cleanupGcalMaterializedNodes)
 *   - lectores: getGcalEventId / getGcalColor
 */

import { store } from '../store/nodeStore'
import type { Node } from '../types'
import { updateCalendarEvent, deleteCalendarEvent, fromRecToRRule } from '../api/googleCalendar'

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
