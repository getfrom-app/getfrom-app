// Datos de la sección «Tu día» de la nota diaria (cockpit).
// Vista CALCULADA — nunca materializa nodos: devuelve referencias a los nodos
// reales del store para que la UI los muestre y actúe sobre ellos.
import type { Node } from '../types'
import { store } from '../store/nodeStore'
import { isInPapelera } from './papeleraHelper'

export interface DailyCockpitData {
  /** Tareas pendientes con due anterior a hoy */
  overdue: Node[]
  /** Tareas pendientes con due = hoy */
  today: Node[]
  /** Bucles abiertos (types:'bucle' y status ≠ 'done') */
  bucles: Node[]
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
  const overdue: Node[] = []
  const todayTasks: Node[] = []
  const bucles: Node[] = []

  for (const n of store.allActive()) {
    if (n.isDiaryEntry) continue
    const isBucle = (n.types || []).includes('bucle')
    const isPendingTask = n.status === 'pending' && !isBucle

    if (isBucle && n.status !== 'done') {
      if (isInPapelera(n.id)) continue
      bucles.push(n)
      continue
    }
    if (!isPendingTask || !n.due) continue
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

  return { overdue, today: todayTasks, bucles }
}
