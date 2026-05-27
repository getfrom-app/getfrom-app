/**
 * naturalDate — Parser de fechas en lenguaje natural en español
 * Soporta: "mañana", "al lunes", "29 mayo", "en 3 días",
 *          "todos los martes", "cada martes", "al 1 de cada mes", etc.
 */

export interface RecurrenceConfig {
  type: 'daily' | 'weekly' | 'monthly' | 'custom'
  days?: number[]   // 0=Dom … 6=Sáb (para weekly)
  monthDay?: number // para monthly en día concreto
  display: string   // badge: "mar", "lun y jue", "diario", "mes"
}

export interface ParsedDate {
  date: Date
  recurrence?: RecurrenceConfig
  label: string     // "Vie 30 may", "Mar 3 jun · ↻ mar"
}

const DAYS_ES: Record<string, number> = {
  domingo: 0, dom: 0,
  lunes: 1, lun: 1,
  martes: 2, mar: 2,
  'miércoles': 3, miercoles: 3, mié: 3, mie: 3,
  jueves: 4, jue: 4,
  viernes: 5, vie: 5,
  'sábado': 6, sabado: 6, sáb: 6, sab: 6,
}

const MONTHS_ES: Record<string, number> = {
  enero: 0, ene: 0,
  febrero: 1, feb: 1,
  marzo: 2, mar: 2,
  abril: 3, abr: 3,
  mayo: 4, may: 4,
  junio: 5, jun: 5,
  julio: 6, jul: 6,
  agosto: 7, ago: 7,
  septiembre: 8, sep: 8, sept: 8,
  octubre: 9, oct: 9,
  noviembre: 10, nov: 10,
  diciembre: 11, dic: 11,
}

const DAY_NAMES_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MONTH_NAMES_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function nextWeekday(from: Date, dayOfWeek: number): Date {
  const d = new Date(from)
  d.setHours(0, 0, 0, 0)
  let daysAhead = dayOfWeek - d.getDay()
  if (daysAhead <= 0) daysAhead += 7
  d.setDate(d.getDate() + daysAhead)
  return d
}

/** Próxima fecha en que cae el día N del mes (puede ser este mes o el siguiente) */
function nextMonthDay(from: Date, day: number): Date {
  const d = new Date(from)
  d.setHours(0, 0, 0, 0)
  const attempt = new Date(d.getFullYear(), d.getMonth(), day)
  if (attempt <= d) {
    attempt.setMonth(attempt.getMonth() + 1)
  }
  return attempt
}

function formatLabel(date: Date, recurrence?: RecurrenceConfig): string {
  const today = new Date(); today.setHours(0,0,0,0)
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)

  let base: string
  if (date.getTime() === today.getTime()) base = 'Hoy'
  else if (date.getTime() === tomorrow.getTime()) base = 'Mañana'
  else {
    const day = date.getDate()
    const month = MONTH_NAMES_SHORT[date.getMonth()]
    const dayName = DAY_NAMES_SHORT[date.getDay()]
    base = `${dayName} ${day} ${month}`
  }

  if (recurrence) return `${base} · ↻ ${recurrence.display}`
  return base
}

/** Limpia el input de prefijos tipo "a ", "al ", "a el " */
function stripPrefix(text: string): string {
  return text
    .replace(/^al?\s+/, '')   // "al lunes" → "lunes", "a mañana" → "mañana"
    .replace(/^a\s+el\s+/, '') // "a el viernes" → "viernes"
    .trim()
}

export function parseNaturalDate(input: string): ParsedDate | null {
  const raw = input.trim()
  if (!raw) return null

  // Normalizar sin tildes para comparar, pero conservar original para display
  const text = norm(raw).replace(/\s+/g, ' ')
  const stripped = norm(stripPrefix(raw)).replace(/\s+/g, ' ')

  const today = new Date(); today.setHours(0, 0, 0, 0)

  // ── Relativos simples ─────────────────────────────────────────────────────
  if (stripped === 'hoy') return { date: new Date(today), label: 'Hoy' }

  if (stripped === 'manana' || stripped === 'mañana') {
    const d = new Date(today); d.setDate(d.getDate() + 1)
    return { date: d, label: formatLabel(d) }
  }
  if (stripped === 'pasado manana' || stripped === 'pasado mañana') {
    const d = new Date(today); d.setDate(d.getDate() + 2)
    return { date: d, label: formatLabel(d) }
  }

  // ── "en N días / semanas" ─────────────────────────────────────────────────
  const inDaysM = text.match(/^(?:al?\s+)?en (\d+) dias?$/)
  if (inDaysM) {
    const d = new Date(today); d.setDate(d.getDate() + parseInt(inDaysM[1]))
    return { date: d, label: formatLabel(d) }
  }
  const inWeeksM = text.match(/^(?:al?\s+)?en (\d+) semanas?$/)
  if (inWeeksM) {
    const d = new Date(today); d.setDate(d.getDate() + parseInt(inWeeksM[1]) * 7)
    return { date: d, label: formatLabel(d) }
  }

  // ── Día de la semana: "lunes", "al viernes", "próximo lunes" ─────────────
  const dayM = stripped.match(/^(?:proximo |el |este )?(\w+)$/)
  if (dayM) {
    const dayNum = DAYS_ES[dayM[1]]
    if (dayNum !== undefined) {
      const d = nextWeekday(today, dayNum)
      return { date: d, label: formatLabel(d) }
    }
  }

  // ── "próximo día N" → próxima vez que cae el día N del mes ───────────────
  const nextDayNM = text.match(/^(?:al?\s+)?pr[oó]ximo\s+d[ií]a\s+(\d+)$/)
  if (nextDayNM) {
    const d = nextMonthDay(today, parseInt(nextDayNM[1]))
    return { date: d, label: formatLabel(d) }
  }

  // ── Recurrencias ──────────────────────────────────────────────────────────

  // "todos los martes" / "cada martes"
  const allOneM = text.match(/^(?:todos los|cada) (\w+)$/)
  if (allOneM) {
    const dayNum = DAYS_ES[allOneM[1]]
    if (dayNum !== undefined) {
      const d = nextWeekday(today, dayNum)
      const rec: RecurrenceConfig = { type: 'weekly', days: [dayNum], display: DAY_NAMES_SHORT[dayNum] }
      return { date: d, recurrence: rec, label: formatLabel(d, rec) }
    }
  }

  // "todos los lunes y jueves" / "cada lunes y jueves"
  const allTwoM = text.match(/^(?:todos los|cada) (\w+) y (\w+)$/)
  if (allTwoM) {
    const d1 = DAYS_ES[allTwoM[1]], d2 = DAYS_ES[allTwoM[2]]
    if (d1 !== undefined && d2 !== undefined) {
      const next1 = nextWeekday(today, d1), next2 = nextWeekday(today, d2)
      const d = next1 < next2 ? next1 : next2
      const rec: RecurrenceConfig = {
        type: 'custom',
        days: [d1, d2].sort((a, b) => a - b),
        display: `${DAY_NAMES_SHORT[d1]} y ${DAY_NAMES_SHORT[d2]}`
      }
      return { date: d, recurrence: rec, label: formatLabel(d, rec) }
    }
  }

  // "al 1 de cada mes" / "cada día 15" / "el día 3 de cada mes"
  const monthDayM = text.match(/^(?:al?\s+|cada\s+d[ií]a\s+|el\s+d[ií]a\s+)?(\d+)(?:\s+de)?\s+cada\s+mes$/)
  if (monthDayM) {
    const day = parseInt(monthDayM[1])
    const d = nextMonthDay(today, day)
    const rec: RecurrenceConfig = { type: 'monthly', monthDay: day, display: `día ${day}` }
    return { date: d, recurrence: rec, label: formatLabel(d, rec) }
  }

  // "cada día" / "diariamente"
  if (['cada dia', 'diariamente', 'diario', 'a diario'].includes(stripped)) {
    const d = new Date(today); d.setDate(d.getDate() + 1)
    const rec: RecurrenceConfig = { type: 'daily', display: 'diario' }
    return { date: d, recurrence: rec, label: formatLabel(d, rec) }
  }

  // "cada semana" / "semanalmente"
  if (['cada semana', 'semanalmente', 'semanal'].includes(stripped)) {
    const d = new Date(today); d.setDate(d.getDate() + 7)
    const rec: RecurrenceConfig = { type: 'weekly', days: [today.getDay()], display: 'semana' }
    return { date: d, recurrence: rec, label: formatLabel(d, rec) }
  }

  // "cada mes" / "mensualmente"
  if (['cada mes', 'mensualmente', 'mensual'].includes(stripped)) {
    const d = new Date(today); d.setMonth(d.getMonth() + 1)
    const rec: RecurrenceConfig = { type: 'monthly', display: 'mes' }
    return { date: d, recurrence: rec, label: formatLabel(d, rec) }
  }

  // ── Fecha concreta: "29 mayo", "29 de mayo", "29/5", "1 de junio 2027" ───
  const dateM = stripped.match(/^(?:el\s+)?(?:proximo\s+)?(?:dia\s+)?(\d{1,2})(?:\s+de\s+|\s+|\/)(\w+)(?:\s+(\d{4}))?$/)
  if (dateM) {
    const day = parseInt(dateM[1])
    const monthStr = dateM[2]
    const year = dateM[3] ? parseInt(dateM[3]) : today.getFullYear()
    const monthNum = /^\d+$/.test(monthStr) ? parseInt(monthStr) - 1 : MONTHS_ES[monthStr]
    if (monthNum !== undefined && day >= 1 && day <= 31) {
      const d = new Date(year, monthNum, day)
      if (isNaN(d.getTime())) return null
      if (d < today && !dateM[3]) d.setFullYear(today.getFullYear() + 1)
      return { date: d, label: formatLabel(d) }
    }
  }

  return null
}

/** Siguiente ocurrencia según recurrencia */
export function nextRecurrence(from: Date, rec: RecurrenceConfig): Date {
  const base = new Date(from); base.setHours(0, 0, 0, 0)

  if (rec.type === 'daily') {
    const d = new Date(base); d.setDate(d.getDate() + 1); return d
  }
  if (rec.type === 'monthly') {
    if (rec.monthDay) return nextMonthDay(new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1), rec.monthDay)
    const d = new Date(base); d.setMonth(d.getMonth() + 1); return d
  }
  if ((rec.type === 'weekly' || rec.type === 'custom') && rec.days?.length) {
    const candidates = rec.days.map(day => nextWeekday(base, day))
    return candidates.reduce((a, b) => (a < b ? a : b))
  }
  const d = new Date(base); d.setDate(d.getDate() + 7); return d
}

/** Sugerencia de autocompletado para el input */
export function getSuggestion(partial: string): string | null {
  if (!partial.trim()) return null
  const t = norm(partial.trim().replace(/\s+/g, ' '))

  // Días de la semana
  const dayNames = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
  for (const day of dayNames) {
    if (day.startsWith(t) && day !== t) return day.slice(t.length)
  }

  // Meses
  const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  // Detectar si es "N [mes]"
  const numMonthM = t.match(/^(\d+)\s+(\w*)$/)
  if (numMonthM) {
    const monthPartial = numMonthM[2]
    if (monthPartial) {
      for (const m of monthNames) {
        if (m.startsWith(monthPartial) && m !== monthPartial) return m.slice(monthPartial.length)
      }
    }
  }

  // Palabras clave
  const keywords = ['mañana', 'todos los ', 'cada ', 'próximo ', 'en ']
  for (const kw of keywords) {
    const kwn = norm(kw)
    if (kwn.startsWith(t) && kwn !== t) return kw.slice(t.length)
  }

  return null
}
