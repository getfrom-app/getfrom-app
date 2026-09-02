// "Lo próximo" — franja con el siguiente elemento con hora, visible siempre
// (26 ago 2026, Alberto: "un pequeño apartado de 'Lo próximo' con el siguiente
// evento a la hora que sea... siempre mostrará el siguiente evento sea cuando
// sea para que el usuario lo tenga presente"). Incluye tareas con hora,
// eventos y TimeBlocks — cualquier cosa que el planificador ya pinta como
// bloque con hora (mismo criterio que `PlannerPanel.getTimedBlocks`), salvo
// lo ya completado.
import { store } from '../store/nodeStore'
import { isInPapelera } from './papeleraHelper'
import { hasTimeOfDay } from './taskNode'
import { nextRecurrenceOccurrenceOnOrAfter } from './naturalDate'

export interface UpcomingItem {
  id: string
  text: string
  due: Date
  dueEnd: Date
}

function sameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** Elementos con hora, no terminados todavía (en curso o futuros), por orden. */
export function listUpcomingTimed(limit = 6, now: Date = new Date()): UpcomingItem[] {
  const out: UpcomingItem[] = []
  for (const n of store.allActive()) {
    if (!n.due || n.deletedAt || isInPapelera(n.id)) continue
    if (n.isDiaryEntry) continue
    if (n.status === 'done') continue
    if (!hasTimeOfDay(n)) continue
    const due = new Date(n.due)
    if (isNaN(due.getTime())) continue
    const dueEnd = n.dueEnd ? new Date(n.dueEnd) : new Date(due.getTime() + 3600000)
    if (dueEnd < now) continue // ya terminó — deja de ser "lo próximo"
    out.push({ id: n.id, text: n.text || '', due, dueEnd })
  }
  // Recurrentes cuya instancia real (`due`) sigue en el pasado — su ocurrencia
  // de hoy/futura es solo una PROYECCIÓN virtual (mismo criterio que el
  // Planificador, `PlannerPanel.getTimedBlocks`/`recurrenceOccursOn`) hasta
  // que alguien la completa a mano y `spawnRecurrence` crea el nodo real
  // siguiente. Sin esto, un timeblock/tarea recurrente cuyo origen nunca se
  // marca "hecho" (p.ej. "Soporte Media Sector" a diario) desaparecía de "Lo
  // próximo" para siempre en cuanto su `due` original quedaba atrás (2 sep
  // 2026, Alberto, con captura real: sigue en curso en el planner pero la
  // barra apunta al siguiente elemento real, ignorándolo).
  for (const n of store.allActive()) {
    if (!n.due || n.deletedAt || isInPapelera(n.id) || n.isDiaryEntry) continue
    if (!n.recurrence || n.status === 'done') continue
    if (!hasTimeOfDay(n)) continue
    const nextOcc = nextRecurrenceOccurrenceOnOrAfter(n, now)
    if (!nextOcc) continue
    if (sameLocalDay(nextOcc, new Date(n.due))) continue // ya es el nodo real, cubierto arriba
    const durationMs = n.dueEnd ? new Date(n.dueEnd).getTime() - new Date(n.due).getTime() : 3600000
    const dueEnd = new Date(nextOcc.getTime() + durationMs)
    if (dueEnd < now) continue
    out.push({ id: `${n.id}::virtual::${nextOcc.toISOString()}`, text: n.text || '', due: nextOcc, dueEnd })
  }
  out.sort((a, b) => a.due.getTime() - b.due.getTime())
  return out.slice(0, limit)
}

const ENABLED_KEY = 'from_next_event_bar_enabled'
export const NEXT_EVENT_BAR_CHANGED = 'from-next-event-bar-changed'

export function isNextEventBarEnabled(): boolean {
  return localStorage.getItem(ENABLED_KEY) !== '0' // activada por defecto
}

export function setNextEventBarEnabled(v: boolean) {
  localStorage.setItem(ENABLED_KEY, v ? '1' : '0')
  window.dispatchEvent(new Event(NEXT_EVENT_BAR_CHANGED))
}
