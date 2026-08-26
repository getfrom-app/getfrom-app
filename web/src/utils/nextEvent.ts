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

export interface UpcomingItem {
  id: string
  text: string
  due: Date
  dueEnd: Date
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
