// Datos de la sección «Tu día» de la nota diaria (cockpit).
// Vista CALCULADA — nunca materializa nodos: devuelve referencias a los nodos
// reales del store para que la UI los muestre y actúe sobre ellos.
import type { Node } from '../types'
import { store } from '../store/nodeStore'
import { isInPapelera } from './papeleraHelper'
import { ensureDayPath } from './agendaHelper'
import { nextRecurrence, recurrenceFromString, type RecurrenceConfig } from './naturalDate'

export interface DailyCockpitData {
  /** Tareas pendientes con due anterior a hoy */
  overdue: Node[]
  /** Tareas pendientes con due = hoy */
  today: Node[]
  /** SEGUIMIENTO: tareas abiertas SIN fecha (sustituye a los «bucles»; incluye
   *  los bucles antiguos por compatibilidad). Permanecen hasta hechas/borradas. */
  seguimiento: Node[]
}

/** Fecha local YYYY-MM-DD de hoy — formato de extraData._doneAt. */
export function todayFocusKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** ¿Se completó la tarea HOY? (criterio para mantenerla visible, tachada, en el cockpit) */
export function wasCompletedToday(n: Node): boolean {
  if (n.status !== 'done') return false
  try { return JSON.parse(n.extraData || '{}')._doneAt === todayFocusKey() } catch { return false }
}

/** Crea la siguiente instancia de un nodo recurrente en el día correcto del diario.
 *  ÚNICA (Alberto, 5 ago 2026 — bug real: las tareas completadas desde cualquier
 *  checkbox de la v2 nunca creaban la siguiente instancia porque `toggleTaskDone`
 *  no llamaba a esto — solo lo hacía el `toggleTask`/`toggleCheckbox` del outliner
 *  v1, así que una tarea recurrente marcada como hecha desde Agenda/Elementos/
 *  Contexto se "perdía": no volvía a aparecer nunca en Futuro). Reciclar el nodo
 *  cambiando `due` está descartado (FROM.md) — SIEMPRE crea un nodo nuevo. */
export function spawnRecurrence(node: Node): void {
  try {
    let ed: Record<string, unknown> = {}
    try { ed = JSON.parse(node.extraData || '{}') } catch { /* extraData corrupto, sigue sin legado */ }
    // Prioritario: node.recurrence (campo DB); fallback: extraData._recurrence (legado).
    const rec: RecurrenceConfig | undefined = node.recurrence
      ? (recurrenceFromString(node.recurrence) ?? undefined)
      : (ed._recurrence as RecurrenceConfig | undefined)
    if (!rec) return

    // Base del cálculo: el día del que cuelga la tarea. Si no cuelga de ninguno (una
    // tarea de un DOCUMENTO, p.ej. «seguimiento cada 15 días»), su propia fecha —
    // antes se caía siempre a HOY y la instancia siguiente nacía el mismo día que la
    // recién completada (visto en vivo: completar el seguimiento del 21 ago creaba
    // otro para el 21 ago). Nunca antes de hoy: completar con mucho retraso no debe
    // generar una tarea que nace ya atrasada.
    const parent = node.parentId ? store.getNode(node.parentId) : null
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const ownDue = node.due ? new Date(node.due) : null
    const baseDate = parent?.diaryDate
      ? new Date(parent.diaryDate)
      : (ownDue && ownDue.getTime() > today.getTime() ? ownDue : today)
    baseDate.setHours(0, 0, 0, 0)
    const nextDate = nextRecurrence(baseDate, rec)
    const dayNode = ensureDayPath(nextDate)
    const sibs = store.children(dayNode.id)
    const lastOrder = sibs.length > 0 ? Math.max(...sibs.map(x => x.siblingOrder)) : 0

    // Due del nuevo nodo: evento con hora → preserva la hora en el nuevo día;
    // tarea o evento sin hora → usa la fecha del nuevo día.
    let newDue: string | undefined
    if (node.due) {
      const origDue = new Date(node.due)
      const hasTime = origDue.getHours() !== 0 || origDue.getMinutes() !== 0
      newDue = hasTime
        ? new Date(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate(), origDue.getHours(), origDue.getMinutes()).toISOString()
        : new Date(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate()).toISOString()
    }

    const newNode = store.createNode({
      text: node.text,
      parentId: dayNode.id,
      siblingOrder: lastOrder + 1000,
      isTask: !node.isEvent,
      types: node.types,
    })
    store.updateNode(newNode.id, {
      // La instancia siguiente hereda `isEvent`, pero SIEMPRE lleva `status` — un
      // evento es una tarea con día y hora (utils/taskNode.ts). Antes el evento
      // recurrente renacía sin status y volvía a quedarse fuera de todo lo que
      // filtra por tarea.
      status: 'pending',
      ...(node.isEvent ? { isEvent: true } : {}),
      ...(newDue ? { due: newDue } : {}),
      recurrence: node.recurrence ?? undefined,
      extraData: JSON.stringify({ ...ed, _recurrence: rec }),
    })
  } catch (e) {
    console.error('[recurrence] Error creando siguiente instancia:', e)
  }
}

/** Completa/reabre una tarea desde el cockpit. Al completar estampa _doneAt=hoy
 *  para que siga visible (tachada) durante el día; mañana desaparece sola. Si la
 *  tarea es recurrente, crea la siguiente instancia (solo al completar, nunca al
 *  reabrir). */
export function toggleTaskDone(n: Node): void {
  let extra: Record<string, unknown> = {}
  try { extra = JSON.parse(n.extraData || '{}') } catch { /* extraData corrupto → lo regeneramos */ }
  if (n.status === 'done') {
    delete extra._doneAt
    store.updateNode(n.id, { status: 'pending', extraData: JSON.stringify(extra) })
  } else {
    extra._doneAt = todayFocusKey()
    store.updateNode(n.id, { status: 'done', extraData: JSON.stringify(extra) })
    spawnRecurrence(n)
  }
}

/** Desengancha `n` de su serie recurrente antes de editarla/moverla/borrarla
 *  SOLO A ELLA (27 ago 2026, Alberto: "debe preguntar igual que Apple
 *  Calendar si quieres mover solo esta instancia o todas las demás"). Crea
 *  primero el sucesor (mismo mecanismo que completar una tarea recurrente,
 *  `spawnRecurrence`) para que la serie siga su curso, y solo DESPUÉS quita
 *  `recurrence` de `n` — así queda como una instancia suelta, independiente,
 *  libre de editar/mover/borrar sin afectar al resto de la serie. Elegir
 *  "todas las siguientes" en su lugar no llama a esto: se edita `n`
 *  directamente, tal y como ya funcionaba. */
export function detachFromRecurrence(n: Node): void {
  if (!n.recurrence) return
  spawnRecurrence(n)
  let extra: Record<string, unknown> = {}
  try { extra = JSON.parse(n.extraData || '{}') } catch { /* corrupto */ }
  delete extra._recurrence
  store.updateNode(n.id, { recurrence: null, extraData: JSON.stringify(extra) })
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

/** Tareas pendientes con `due` en un día FUTURO (después de hoy), en orden
 *  cronológico — completan el bloque «Futuro» de la agenda: Alberto, 22 jul:
 *  "incluiría además, debajo, las tareas de los próximos días en orden
 *  cronológico". */
export function collectUpcomingTasks(): Node[] {
  const today0 = startOfToday()
  const out: Node[] = []
  for (const n of store.allActive()) {
    if (n.isDiaryEntry || n.isEvent || !n.due) continue
    if (n.status !== 'pending') continue
    if (isInPapelera(n.id)) continue
    const due = new Date(n.due)
    if (isNaN(due.getTime())) continue
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate())
    if (dueDay.getTime() <= today0.getTime()) continue // hoy/atrasada ya viven en sus bloques
    out.push(n)
  }
  out.sort((a, b) => (a.due || '').localeCompare(b.due || ''))
  return out
}

/** Recolecta atrasadas + hoy + bucles abiertos, excluyendo papelera y nodos temporales. */
export function collectDailyCockpit(): DailyCockpitData {
  const today0 = startOfToday()
  const now = new Date()
  const overdue: Node[] = []
  const todayTasks: Node[] = []
  const seguimiento: Node[] = []

  for (const n of store.allActive()) {
    if (n.isDiaryEntry) continue
    if (n.isEvent) continue // los eventos GCal tienen su propio bloque, no son tareas

    const legacyBucle = (n.types || []).includes('bucle')

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

  return { overdue, today: todayTasks, seguimiento }
}
