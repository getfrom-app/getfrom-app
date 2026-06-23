// Datos de la sección «Tu día» de la nota diaria (cockpit).
// Vista CALCULADA — nunca materializa nodos: devuelve referencias a los nodos
// reales del store para que la UI los muestre y actúe sobre ellos.
import type { Node } from '../types'
import { store } from '../store/nodeStore'
import { isInPapelera } from './papeleraHelper'

export interface DailyCockpitData {
  /** 🎯 Foco del día: nodos con extraData._focusDate === hoy (incluye completadas, para verlas tachadas) */
  focus: Node[]
  /** Tareas pendientes con due anterior a hoy (excluye las que están en foco) */
  overdue: Node[]
  /** Tareas pendientes con due = hoy (excluye las que están en foco) */
  today: Node[]
  /** SEGUIMIENTO: tareas abiertas SIN fecha (sustituye a los «bucles»; incluye
   *  los bucles antiguos por compatibilidad). Permanecen hasta hechas/borradas. */
  seguimiento: Node[]
}

/** Fecha local YYYY-MM-DD de hoy — el formato de extraData._focusDate. */
export function todayFocusKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function focusDateOf(n: Node): string | null {
  try { return JSON.parse(n.extraData || '{}')._focusDate ?? null } catch { return null }
}

/** ¿Está el nodo en el foco de HOY? (el flag de días anteriores caduca solo) */
export function isFocusedToday(n: Node): boolean {
  return focusDateOf(n) === todayFocusKey()
}

/** Mete/saca el nodo del foco de hoy. El flag caduca solo al cambiar el día. */
export function toggleFocusToday(n: Node): void {
  let extra: Record<string, unknown> = {}
  try { extra = JSON.parse(n.extraData || '{}') } catch { /* extraData corrupto → lo regeneramos */ }
  if (extra._focusDate === todayFocusKey()) delete extra._focusDate
  else extra._focusDate = todayFocusKey()
  store.updateNode(n.id, { extraData: JSON.stringify(extra) })
}

/** ¿Se completó la tarea HOY? (criterio para mantenerla visible, tachada, en el cockpit) */
export function wasCompletedToday(n: Node): boolean {
  if (n.status !== 'done') return false
  try { return JSON.parse(n.extraData || '{}')._doneAt === todayFocusKey() } catch { return false }
}

/** Completa/reabre una tarea desde el cockpit. Al completar estampa _doneAt=hoy
 *  para que siga visible (tachada) durante el día; mañana desaparece sola. */
export function toggleTaskDone(n: Node): void {
  let extra: Record<string, unknown> = {}
  try { extra = JSON.parse(n.extraData || '{}') } catch { /* extraData corrupto → lo regeneramos */ }
  if (n.status === 'done') {
    delete extra._doneAt
    store.updateNode(n.id, { status: 'pending', extraData: JSON.stringify(extra) })
  } else {
    extra._doneAt = todayFocusKey()
    store.updateNode(n.id, { status: 'done', extraData: JSON.stringify(extra) })
  }
}

/** Nº de veces que una tarea se ha reagendado (movido de fecha). */
export function rescheduleCount(n: Node): number {
  try { const v = JSON.parse(n.extraData || '{}')._rescheduled; return typeof v === 'number' ? v : 0 } catch { return 0 }
}

/** Incrementa el contador de reagendados de una tarea (al moverla de fecha). */
export function bumpReschedule(nodeId: string): void {
  const n = store.getNode(nodeId)
  if (!n) return
  let extra: Record<string, unknown> = {}
  try { extra = JSON.parse(n.extraData || '{}') } catch { /* corrupto */ }
  extra._rescheduled = (typeof extra._rescheduled === 'number' ? extra._rescheduled : 0) + 1
  store.updateNode(nodeId, { extraData: JSON.stringify(extra) })
}

/** Programa una tarea en una fecha (días desde hoy) y cuenta el reagendado si ya tenía fecha. */
export function scheduleTask(n: Node, days: number): void {
  const hadDate = !!n.due
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + days)
  store.updateNode(n.id, { due: d.toISOString() })
  if (hadDate) bumpReschedule(n.id)
}

/** Pospone una tarea: días desde hoy (1 = mañana, 7 = +1 semana) o null = sin fecha. */
export function postponeTask(n: Node, days: number | null): void {
  if (days === null) {
    store.updateNode(n.id, { due: null })
    return
  }
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + days)
  store.updateNode(n.id, { due: d.toISOString() })
}

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** Tareas con `due` en una fecha concreta (para la columna de días que NO son hoy:
 *  el de hoy usa collectDailyCockpit con atrasadas/hoy/bucles). Incluye tareas
 *  pendientes y completadas ese día; excluye eventos, diarias y papelera. */
export function collectDayTasks(date: Date): Node[] {
  const out: Node[] = []
  for (const n of store.allActive()) {
    if (n.isDiaryEntry || n.isEvent || !n.due) continue
    if (n.status == null) continue // solo tareas (pendientes/completadas), no notas datadas
    if (isInPapelera(n.id)) continue
    if (!isSameDay(new Date(n.due), date)) continue
    out.push(n)
  }
  out.sort((a, b) => (a.due || '').localeCompare(b.due || ''))
  return out
}

/** Recolecta atrasadas + hoy + bucles abiertos, excluyendo papelera y nodos temporales. */
export function collectDailyCockpit(): DailyCockpitData {
  const today0 = startOfToday()
  const now = new Date()
  const focus: Node[] = []
  const overdue: Node[] = []
  const todayTasks: Node[] = []
  const seguimiento: Node[] = []

  for (const n of store.allActive()) {
    if (n.isDiaryEntry) continue
    if (n.isEvent) continue // los eventos GCal tienen su propio bloque, no son tareas
    const legacyBucle = (n.types || []).includes('bucle')

    // 🎯 Foco de hoy — tiene prioridad sobre el resto de grupos.
    // Incluye completadas (se ven tachadas: el cierre natural del día).
    if (isFocusedToday(n)) {
      if (isInPapelera(n.id)) continue
      focus.push(n)
      continue
    }

    // SEGUIMIENTO: tarea ABIERTA y SIN fecha (incluye los bucles antiguos).
    // Es lo que antes era un «bucle», ahora sin tipo aparte: una tarea sin fecha
    // que permanece hasta marcarla hecha o borrarla.
    if (n.status !== 'done' && !n.due && (n.status === 'pending' || legacyBucle)) {
      if (isInPapelera(n.id)) continue
      seguimiento.push(n)
      continue
    }
    // Pendientes con due + completadas HOY (siguen visibles, tachadas, hasta mañana)
    const qualifies = (n.status === 'pending' || wasCompletedToday(n)) && !!n.due
    if (!qualifies) continue
    const due = new Date(n.due!)
    if (isNaN(due.getTime())) continue
    if (due < today0) {
      if (isInPapelera(n.id)) continue
      overdue.push(n)
    } else if (isSameDay(due, now)) {
      if (isInPapelera(n.id)) continue
      todayTasks.push(n)
    }
  }

  // Pendientes por due; las completadas al final de su grupo
  const byDue = (a: Node, b: Node) => {
    const da = a.status === 'done' ? 1 : 0, db = b.status === 'done' ? 1 : 0
    return da - db || new Date(a.due!).getTime() - new Date(b.due!).getTime()
  }
  overdue.sort(byDue)
  todayTasks.sort(byDue)
  seguimiento.sort((a, b) => (a.text || '').localeCompare(b.text || ''))
  // Foco: pendientes primero, completadas al final; estable por texto
  focus.sort((a, b) => {
    const da = a.status === 'done' ? 1 : 0, db = b.status === 'done' ? 1 : 0
    return da - db || (a.text || '').localeCompare(b.text || '')
  })

  return { focus, overdue, today: todayTasks, seguimiento }
}
