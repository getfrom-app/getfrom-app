// migrateEventsToTasks — migración ÚNICA y NO DESTRUCTIVA (5 ago 2026).
//
// «Un evento es una tarea con día y hora» (ver utils/taskNode.ts). Hasta ahora un
// evento nacía con `isEvent: true` y SIN `status`, así que para las ~113 comprobaciones
// de "es tarea" repartidas por la app (todas del tipo `status != null`) un evento
// simplemente no lo era: no salía en la lista de tareas de su contexto, no se podía
// completar en el planner, y en Elementos vivía como un tipo aparte.
//
// Esta migración SOLO añade `status: 'pending'` a los eventos que no lo tienen. No
// toca `isEvent`, ni la fecha, ni el enlace con Google: un evento sigue siendo un
// evento (va al timeline y a Google), pero además ya es una tarea de pleno derecho.
//
// Deliberadamente NO marca como 'done' los eventos pasados: el cockpit de Hoy excluye
// `isEvent` de «atrasadas» (utils/dailyCockpit.ts), así que un evento de hace meses no
// aparece ahí por ganar `status`. Si algún día se retira esa exclusión, hay que revisar
// esto ANTES o la lista de atrasadas se llena de reuniones viejas.
import { store } from '../store/nodeStore'
import { isInPapelera } from './papeleraHelper'

const FLAG = 'from-migrate-events-tasks-v1'

/** Devuelve cuántos eventos se convirtieron en tarea (0 si ya se corrió). */
export function migrateEventsToTasks(): number {
  if (localStorage.getItem(FLAG) === '1') return 0
  let migrated = 0
  for (const n of store.allActive()) {
    if (!n.isEvent || n.status != null || n.deletedAt) continue
    if (isInPapelera(n.id)) continue
    store.updateNode(n.id, { status: 'pending' })
    migrated++
  }
  localStorage.setItem(FLAG, '1')
  return migrated
}
