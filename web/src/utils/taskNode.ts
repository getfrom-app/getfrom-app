/**
 * taskNode — «un evento ES una tarea con día y hora» (Alberto, 5 ago 2026:
 * "deberían aparecer solamente tareas... los eventos son tareas que tienen día y
 * hora. Por tanto, esto hay que unificarlo no solo aquí, sino en todo Fromly").
 *
 * Modelo resultante, una sola frase: **`status` dice que es una tarea; `isEvent`
 * dice que va al timeline del día y a Google Calendar.** No son dos tipos, son dos
 * propiedades del mismo tipo.
 *
 * Antes un evento nacía con `isEvent: true` y `status: null` (ver el histórico de
 * `dailyCockpit.spawnRecurrence`), o sea que literalmente NO era una tarea para el
 * resto de la app — de ahí que apareciera como un tipo aparte en Elementos, sin
 * checkbox en el planner, y fuera de la lista de tareas de su contexto.
 * `migrateEventsToTasks()` (utils/migrateEventsToTasks.ts) arregla los existentes;
 * las vías de creación ponen ya las dos cosas.
 *
 * `isTaskNode` sigue aceptando `isEvent` sin `status` a propósito: la migración es
 * de la web, pero iOS/Mac pueden seguir creando eventos a la vieja usanza hasta que
 * se actualicen, y esas filas deben seguir contando como tareas aquí.
 */
import type { Node } from '../types'

/** ¿Es una tarea? (incluye los eventos: son tareas con día y hora). */
export function isTaskNode(n: Node): boolean {
  return n.status != null || !!n.isEvent || (n.types || []).includes('tarea')
}

/** ¿Tiene HORA (no solo día)? Es lo que la lleva al timeline y a Google Calendar. */
export function hasTimeOfDay(n: Node): boolean {
  if (!n.due) return false
  const d = new Date(n.due)
  return d.getHours() !== 0 || d.getMinutes() !== 0
}

/**
 * ¿Es un TimeBlock? (26 ago 2026, Alberto: "un timeblock no es un evento porque
 * no es obligatorio asistir... tampoco es una tarea, es un espacio reservado
 * para hacer algo... no aparece en la lista de tareas, simplemente se ve en el
 * planificador"). Marca propia (`extraData._timeblock`, minúscula a propósito —
 * NO confundir con el `_timeBlock` legacy de `PlannerPanel.getTimedBlocks`, un
 * concepto viejo y distinto de nodo standalone/enlazado). Nace SIN `status`
 * (no es una tarea: no cuenta en `isTaskNode`, no lleva checkbox, no aparece en
 * ninguna lista de tareas/agenda) y con `isEvent: false` (no es un evento: no
 * entra en el bloque "Eventos" de un contexto ni en las reglas pensadas para
 * eventos) — solo `due`+`dueEnd` y esta marca. El planificador lo busca
 * explícitamente (`getTimedBlocks`) y la sincronización con Google Calendar es
 * directa (`syncNodeToGcal`), sin pasar por el camino gateado por `isEvent`.
 */
export function isTimeBlockNode(n: Node): boolean {
  try {
    return JSON.parse(n.extraData || '{}')._timeblock === '1'
  } catch {
    return false
  }
}
