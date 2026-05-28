/**
 * scheduleHelper — utilidades para calcular la próxima ejecución de un schedule.
 *
 * Formatos soportados:
 *   daily:HH:MM          — cada día a esa hora
 *   weekly:D:HH:MM       — cada semana en ese día (0=Dom, 1=Lun…) a esa hora
 *   ''                   — sin programar
 */

/** Calcula la próxima Date en que debe ejecutarse un schedule. */
export function nextRunDate(schedule: string): Date | null {
  if (!schedule) return null
  const now = new Date()

  if (schedule.startsWith('daily:')) {
    const time = schedule.slice('daily:'.length)
    const [h, m] = time.split(':').map(Number)
    if (isNaN(h) || isNaN(m)) return null

    const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0)
    // Si ya pasó hoy, es mañana
    if (candidate <= now) candidate.setDate(candidate.getDate() + 1)
    return candidate
  }

  if (schedule.startsWith('weekly:')) {
    const parts = schedule.slice('weekly:'.length).split(':')
    const targetDay = parseInt(parts[0] ?? '')
    const h = parseInt(parts[1] ?? '')
    const m = parseInt(parts[2] ?? '')
    if (isNaN(targetDay) || isNaN(h) || isNaN(m)) return null

    const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0)
    const dayDiff = (targetDay - now.getDay() + 7) % 7
    candidate.setDate(candidate.getDate() + dayDiff)
    // Si es hoy y ya pasó la hora, una semana más
    if (candidate <= now) candidate.setDate(candidate.getDate() + 7)
    return candidate
  }

  return null
}

const DAYS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

/** Convierte un schedule en una etiqueta legible: "Diario 08:00 · próxima: mañana 08:00" */
export function scheduleNextLabel(schedule: string): string | null {
  if (!schedule) return null
  const next = nextRunDate(schedule)
  if (!next) return null

  const now = new Date()
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const nextMidnight  = new Date(next.getFullYear(), next.getMonth(), next.getDate())
  const diffDays = Math.round((nextMidnight.getTime() - todayMidnight.getTime()) / 86400000)

  const hh = String(next.getHours()).padStart(2, '0')
  const mm = String(next.getMinutes()).padStart(2, '0')
  const timeStr = `${hh}:${mm}`

  let whenStr: string
  if (diffDays === 0) whenStr = `hoy ${timeStr}`
  else if (diffDays === 1) whenStr = `mañana ${timeStr}`
  else if (diffDays < 7) whenStr = `el ${DAYS_ES[next.getDay()]} ${timeStr}`
  else whenStr = `en ${diffDays} días ${timeStr}`

  return `próxima: ${whenStr}`
}

/** Calcula la etiqueta de "próxima ejecución" para el footer bar.
 *  Devuelve null si no hay schedules activos con horario configurado.
 */
export function nextScheduledRunLabel(
  schedules: Array<{ schedule: string; agentTitle: string | null; enabled: boolean }>
): string | null {
  const active = schedules.filter(s => s.enabled && s.schedule)
  if (!active.length) return null

  // Encontrar el schedule que corre antes
  let earliest: { date: Date; title: string } | null = null
  for (const s of active) {
    const d = nextRunDate(s.schedule)
    if (!d) continue
    if (!earliest || d < earliest.date) {
      earliest = { date: d, title: s.agentTitle ?? 'Agente' }
    }
  }
  if (!earliest) return null

  const now = new Date()
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const nextMidnight  = new Date(earliest.date.getFullYear(), earliest.date.getMonth(), earliest.date.getDate())
  const diffDays = Math.round((nextMidnight.getTime() - todayMidnight.getTime()) / 86400000)

  const hh = String(earliest.date.getHours()).padStart(2, '0')
  const mm = String(earliest.date.getMinutes()).padStart(2, '0')
  const timeStr = `${hh}:${mm}`

  if (diffDays === 0) return `IA: hoy ${timeStr}`
  if (diffDays === 1) return `IA: mañana ${timeStr}`
  return `IA: ${DAYS_ES[earliest.date.getDay()]} ${timeStr}`
}
