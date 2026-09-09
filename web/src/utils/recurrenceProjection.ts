/**
 * recurrenceProjection — dónde "tocan" las ocurrencias futuras de una tarea
 * recurrente, sin materializarlas (9 sep 2026, Alberto: "hay tareas
 * recurrentes que solo se ve la primera recurrencia, deberían verse todas...
 * Desarrollo UDA se debe ver todos los lunes y solo se ve el primero").
 *
 * Modelo (ver FROM.md, "Alcance de recurrencia"): una serie es UN nodo real
 * con `recurrence`; al completarlo `spawnRecurrence` crea el siguiente nodo
 * real. Todo lo demás (los lunes que aún no han llegado) son PROYECCIONES
 * virtuales que calcula este módulo y que el Planificador pinta atenuadas.
 *
 * Dos claves de `extraData` — mismo formato en web, iOS y servidor:
 *  · `_recExdates`: fechas locales `YYYY-MM-DD` separadas por coma en las que
 *    la serie NO ocurre (Apple Calendar: "solo este evento" sobre una
 *    ocurrencia futura la saca de la serie). Ni se proyectan ni las crea
 *    `spawnRecurrence`.
 *  · `_seriesOf`: id del nodo cabeza de serie del que salió una instancia
 *    suelta (materializada o desenganchada). Sirve para que al volver a
 *    editarla se siga preguntando "¿solo esta o esta y las siguientes?" —
 *    antes, tras "solo esta", el nodo perdía toda relación con la serie y no
 *    volvía a preguntar nunca.
 */
import type { Node } from '../types'
import { store } from '../store/nodeStore'
import { ensureDayPath } from './agendaHelper'
import { nextRecurrence, recurrenceFromString } from './naturalDate'

/** Cuántos días por delante de HOY se proyectan las recurrencias — tope de
 *  seguridad para series raras (nunca hace falta ver más allá del horizonte
 *  que el propio Planificador puede mostrar). */
export const MAX_RECURRENCE_LOOKAHEAD_DAYS = 120

export function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function startOfDay(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), d.getDate()) }

export function parseExtra(n: Pick<Node, 'extraData'>): Record<string, unknown> {
  try { return JSON.parse(n.extraData || '{}') as Record<string, unknown> } catch { return {} }
}

/** Fechas (`YYYY-MM-DD` local) excluidas de la serie de `n`. Acepta la cadena
 *  canónica separada por comas y, por tolerancia, un array. */
export function recurrenceExdates(n: Pick<Node, 'extraData'>): Set<string> {
  const raw = parseExtra(n)._recExdates
  const out = new Set<string>()
  const add = (s: unknown) => { if (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.trim())) out.add(s.trim()) }
  if (Array.isArray(raw)) raw.forEach(add)
  else if (typeof raw === 'string') raw.split(',').forEach(add)
  return out
}

/** Excluye `date` de la serie de `originId` (persistido en `_recExdates`). */
export function addRecurrenceExdate(originId: string, date: Date): void {
  const origin = store.getNode(originId)
  if (!origin) return
  const set = recurrenceExdates(origin)
  set.add(localDayKey(date))
  const extra = parseExtra(origin)
  extra._recExdates = Array.from(set).sort().join(',')
  store.updateNode(originId, { extraData: JSON.stringify(extra) })
}

/** Id de la serie de la que salió esta instancia suelta, si lo hay. */
export function seriesOf(n: Pick<Node, 'extraData'>): string | null {
  const v = parseExtra(n)._seriesOf
  return typeof v === 'string' && v ? v : null
}

/** ¿Forma parte de una serie? Cabeza (tiene `recurrence`) o instancia suelta
 *  (`_seriesOf`). Es el criterio para preguntar "¿solo esta o todas?". */
export function belongsToSeries(n: Node): boolean {
  return !!n.recurrence || !!seriesOf(n)
}

/** Nodo que hoy lleva la serie de `n`: el que apunta `_seriesOf` si sigue
 *  vivo, pendiente y recurrente; si no (la serie ya avanzó al completarse),
 *  el nodo pendiente recurrente con el mismo texto; si no hay ninguno, null. */
export function findSeriesHead(n: Node): Node | null {
  if (n.recurrence && n.status !== 'done') return n
  const id = seriesOf(n)
  const direct = id ? store.getNode(id) : null
  if (direct && !direct.deletedAt && direct.recurrence && direct.status !== 'done') return direct
  const key = n.text.trim().toLowerCase()
  const byText = store.allActive().find(x =>
    x.id !== n.id && !!x.recurrence && x.status !== 'done' && !x.deletedAt && x.text.trim().toLowerCase() === key)
  return byText ?? null
}

/** Ocurrencias de la serie de `origin` cuyo día cae en [from, to] (ambos
 *  inclusive, comparados por día local), SIN contar el propio día del origen
 *  (ese ya es el nodo real) ni las fechas excluidas. Nunca más allá de hoy +
 *  MAX_RECURRENCE_LOOKAHEAD_DAYS. Cada fecha lleva la hora del origen. */
export function occurrencesInRange(origin: Node, from: Date, to: Date): Date[] {
  if (!origin.due || !origin.recurrence) return []
  const rec = recurrenceFromString(origin.recurrence)
  if (!rec) return []
  const originDue = new Date(origin.due)
  if (isNaN(originDue.getTime())) return []
  const originDay = startOfDay(originDue)
  const fromDay = startOfDay(from)
  const toDay = startOfDay(to)
  const horizon = startOfDay(new Date()); horizon.setDate(horizon.getDate() + MAX_RECURRENCE_LOOKAHEAD_DAYS)
  const limit = toDay.getTime() < horizon.getTime() ? toDay : horizon
  if (limit.getTime() <= originDay.getTime()) return []
  const exdates = recurrenceExdates(origin)
  const out: Date[] = []
  // Nº de pasos, no de días: una recurrencia DIARIA nunca completada se queda
  // con `due` clavado en el día que se creó — el tope real depende de la
  // distancia hasta el límite, no de una constante (3 sep 2026).
  const daysToLimit = Math.ceil((limit.getTime() - originDay.getTime()) / 86400000)
  const maxIterations = Math.min(Math.max(MAX_RECURRENCE_LOOKAHEAD_DAYS, daysToLimit + 1), 5000)
  let cursor = originDay
  for (let i = 0; i < maxIterations; i++) {
    const next = nextRecurrence(cursor, rec)
    if (next.getTime() <= cursor.getTime()) break // regla degenerada: nunca avanza
    cursor = next
    if (cursor.getTime() > limit.getTime()) break
    if (cursor.getTime() < fromDay.getTime()) continue
    if (exdates.has(localDayKey(cursor))) continue
    out.push(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), originDue.getHours(), originDue.getMinutes()))
  }
  return out
}

/** ¿El patrón de `origin` cae en `day`? Devuelve la fecha exacta (con la hora
 *  heredada del origen) o null. */
export function recurrenceOccursOn(origin: Node, day: Date): Date | null {
  return occurrencesInRange(origin, day, day)[0] ?? null
}

/** Nodos que pueden proyectar: recurrentes, PENDIENTES, con fecha y vivos.
 *  Solo desde instancias pendientes: una vez completada, `spawnRecurrence` ya
 *  crea la instancia real siguiente con el mismo `recurrence` — proyectar
 *  TAMBIÉN desde instancias antiguas ya hechas duplicaría la proyección. */
export function projectableSeries(isHidden: (id: string) => boolean = () => false): Node[] {
  return store.allActive().filter(n => !!n.due && !!n.recurrence && !n.deletedAt && n.status !== 'done' && !isHidden(n.id))
}

/** Una ocurrencia virtual lista para pintar. */
export interface VirtualOccurrence {
  origin: Node
  occursAt: Date
  /** Id estable para keys de React — no es un nodo. */
  key: string
}

/** Ocurrencias virtuales de TODAS las series que caen en `day`. Se salta un
 *  día si ya hay un nodo real con el mismo texto ese día (alguien la
 *  materializó a mano, p.ej. moviendo su fecha) para no pintarla dos veces. */
export function virtualOccurrencesOn(day: Date, opts: { isHidden?: (id: string) => boolean; realTextsThatDay?: Set<string> } = {}): VirtualOccurrence[] {
  const dayKey = localDayKey(day)
  const realTexts = opts.realTextsThatDay ?? new Set(
    store.allActive()
      .filter(n => n.due && !n.deletedAt && localDayKey(new Date(n.due)) === dayKey)
      .map(n => n.text.trim().toLowerCase()))
  const out: VirtualOccurrence[] = []
  for (const origin of projectableSeries(opts.isHidden)) {
    if (localDayKey(new Date(origin.due!)) === dayKey) continue // ya es el nodo real de su propio día
    const occursAt = recurrenceOccursOn(origin, day)
    if (!occursAt) continue
    if (realTexts.has(origin.text.trim().toLowerCase())) continue
    out.push({ origin, occursAt, key: `${origin.id}::virtual::${dayKey}` })
  }
  return out
}

/** Convierte una ocurrencia virtual en un nodo REAL suelto (Apple Calendar:
 *  "solo este evento" sobre una ocurrencia futura). Copia lo que define a la
 *  tarea (texto, tipos, evento, color, contexto vía extraData), la cuelga del
 *  día del diario que le toca, SIN `recurrence`, marcada con `_seriesOf`, y
 *  excluye esa fecha de la serie para que no se proyecte ni se cree dos veces. */
export function materializeOccurrence(origin: Node, occursAt: Date): Node {
  const ed = parseExtra(origin)
  delete ed._recurrence
  delete ed._doneAt
  delete ed._recExdates
  delete ed._gcalEventId
  delete ed.gcalEventId
  ed._seriesOf = origin.id
  const dayNode = ensureDayPath(occursAt)
  const sibs = store.children(dayNode.id)
  const lastOrder = sibs.length > 0 ? Math.max(...sibs.map(x => x.siblingOrder)) : 0
  const origDue = origin.due ? new Date(origin.due) : null
  const hasTime = !!origDue && (origDue.getHours() !== 0 || origDue.getMinutes() !== 0)
  const due = hasTime
    ? new Date(occursAt.getFullYear(), occursAt.getMonth(), occursAt.getDate(), origDue!.getHours(), origDue!.getMinutes())
    : new Date(occursAt.getFullYear(), occursAt.getMonth(), occursAt.getDate())
  const durationMs = origDue && origin.dueEnd ? (new Date(origin.dueEnd).getTime() - origDue.getTime()) : 0
  const created = store.createNode({
    text: origin.text,
    parentId: dayNode.id,
    siblingOrder: lastOrder + 1000,
    isTask: !origin.isEvent,
    types: origin.types,
    due: due.toISOString(),
  })
  store.updateNode(created.id, {
    status: 'pending',
    ...(origin.isEvent ? { isEvent: true } : {}),
    ...(durationMs > 0 ? { dueEnd: new Date(due.getTime() + durationMs).toISOString() } : {}),
    ...(origin.color ? { color: origin.color } : {}),
    ...(origin.priority ? { priority: origin.priority } : {}),
    extraData: JSON.stringify(ed),
  })
  addRecurrenceExdate(origin.id, occursAt)
  return store.getNode(created.id) ?? created
}
