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
  /** Bucles abiertos (types:'bucle' y status ≠ 'done') */
  bucles: Node[]
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

/** Recolecta atrasadas + hoy + bucles abiertos, excluyendo papelera y nodos temporales. */
export function collectDailyCockpit(): DailyCockpitData {
  const today0 = startOfToday()
  const now = new Date()
  const focus: Node[] = []
  const overdue: Node[] = []
  const todayTasks: Node[] = []
  const bucles: Node[] = []

  for (const n of store.allActive()) {
    if (n.isDiaryEntry) continue
    const isBucle = (n.types || []).includes('bucle')

    // 🎯 Foco de hoy — tiene prioridad sobre el resto de grupos.
    // Incluye completadas (se ven tachadas: el cierre natural del día).
    if (isFocusedToday(n) && !isBucle) {
      if (isInPapelera(n.id)) continue
      focus.push(n)
      continue
    }

    if (isBucle && n.status !== 'done') {
      if (isInPapelera(n.id)) continue
      bucles.push(n)
      continue
    }
    if (n.status !== 'pending' || !n.due) continue
    const due = new Date(n.due)
    if (isNaN(due.getTime())) continue
    if (due < today0) {
      if (isInPapelera(n.id)) continue
      overdue.push(n)
    } else if (isSameDay(due, now)) {
      if (isInPapelera(n.id)) continue
      todayTasks.push(n)
    }
  }

  const byDue = (a: Node, b: Node) => new Date(a.due!).getTime() - new Date(b.due!).getTime()
  overdue.sort(byDue)
  todayTasks.sort(byDue)
  bucles.sort((a, b) => (a.text || '').localeCompare(b.text || ''))
  // Foco: pendientes primero, completadas al final; estable por texto
  focus.sort((a, b) => {
    const da = a.status === 'done' ? 1 : 0, db = b.status === 'done' ? 1 : 0
    return da - db || (a.text || '').localeCompare(b.text || '')
  })

  return { focus, overdue, today: todayTasks, bucles }
}
