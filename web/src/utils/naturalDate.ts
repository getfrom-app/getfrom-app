/**
 * naturalDate — Parser de fechas en lenguaje natural en español
 * Soporta: "mañana", "viernes", "29 mayo", "en 3 días",
 *          "todos los martes", "lunes y jueves", "cada semana", etc.
 */

export interface RecurrenceConfig {
  type: 'daily' | 'weekly' | 'monthly' | 'custom'
  days?: number[]   // 0=Dom … 6=Sáb
  display: string   // badge: "mar", "lun y jue", "diario", "semana"
}

export interface ParsedDate {
  date: Date
  recurrence?: RecurrenceConfig
  label: string     // descripción legible: "Viernes 30 may", "Mar 3 jun · ↻ mar"
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

function nextWeekday(from: Date, dayOfWeek: number): Date {
  const d = new Date(from)
  d.setHours(0, 0, 0, 0)
  let daysAhead = dayOfWeek - d.getDay()
  if (daysAhead <= 0) daysAhead += 7
  d.setDate(d.getDate() + daysAhead)
  return d
}

function formatLabel(date: Date, recurrence?: RecurrenceConfig): string {
  const today = new Date(); today.setHours(0,0,0,0)
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)

  let base: string
  if (date.getTime() === today.getTime()) base = 'Hoy'
  else if (date.getTime() === tomorrow.getTime()) base = 'Mañana'
  else {
    const dayName = DAY_NAMES_SHORT[date.getDay()]
    const day = date.getDate()
    const month = MONTH_NAMES_SHORT[date.getMonth()]
    base = `${dayName} ${day} ${month}`
  }

  if (recurrence) return `${base} · ↻ ${recurrence.display}`
  return base
}

export function parseNaturalDate(input: string): ParsedDate | null {
  const raw = input.trim()
  const text = raw.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // sin tildes para matching
    .replace(/\s+/g, ' ')

  const today = new Date(); today.setHours(0, 0, 0, 0)

  // ── Relativos simples ─────────────────────────────────────────────────────
  if (text === 'hoy') {
    return { date: new Date(today), label: formatLabel(today) }
  }
  if (text === 'manana' || text === 'mañana') {
    const d = new Date(today); d.setDate(d.getDate() + 1)
    return { date: d, label: formatLabel(d) }
  }
  if (text === 'pasado manana' || text === 'pasado mañana') {
    const d = new Date(today); d.setDate(d.getDate() + 2)
    return { date: d, label: formatLabel(d) }
  }

  // ── "en N días/semanas" ───────────────────────────────────────────────────
  const inDaysM = text.match(/^en (\d+) dias?$/)
  if (inDaysM) {
    const d = new Date(today); d.setDate(d.getDate() + parseInt(inDaysM[1]))
    return { date: d, label: formatLabel(d) }
  }
  const inWeeksM = text.match(/^en (\d+) semanas?$/)
  if (inWeeksM) {
    const d = new Date(today); d.setDate(d.getDate() + parseInt(inWeeksM[1]) * 7)
    return { date: d, label: formatLabel(d) }
  }

  // ── Día de la semana: "viernes", "proximo lunes" ──────────────────────────
  const nextDayM = text.match(/^(?:proximo |el |este )?(\w+)$/)
  if (nextDayM) {
    const dayNum = DAYS_ES[nextDayM[1]]
    if (dayNum !== undefined) {
      const d = nextWeekday(today, dayNum)
      return { date: d, label: formatLabel(d) }
    }
  }

  // ── Recurrencias ──────────────────────────────────────────────────────────

  // "todos los martes"
  const allOneM = text.match(/^todos los (\w+)$/)
  if (allOneM) {
    const dayNum = DAYS_ES[allOneM[1]]
    if (dayNum !== undefined) {
      const d = nextWeekday(today, dayNum)
      const rec: RecurrenceConfig = { type: 'weekly', days: [dayNum], display: DAY_NAMES_SHORT[dayNum] }
      return { date: d, recurrence: rec, label: formatLabel(d, rec) }
    }
  }

  // "todos los lunes y jueves"
  const allTwoM = text.match(/^todos los (\w+) y (\w+)$/)
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

  // "cada día" / "diariamente" / "diario"
  if (['cada dia', 'diariamente', 'diario', 'cada dia'].includes(text)) {
    const d = new Date(today); d.setDate(d.getDate() + 1)
    const rec: RecurrenceConfig = { type: 'daily', display: 'diario' }
    return { date: d, recurrence: rec, label: formatLabel(d, rec) }
  }

  // "cada semana" / "semanalmente"
  if (['cada semana', 'semanalmente', 'semanal'].includes(text)) {
    const d = new Date(today); d.setDate(d.getDate() + 7)
    const rec: RecurrenceConfig = { type: 'weekly', days: [today.getDay()], display: 'semana' }
    return { date: d, recurrence: rec, label: formatLabel(d, rec) }
  }

  // "cada mes" / "mensualmente"
  if (['cada mes', 'mensualmente', 'mensual'].includes(text)) {
    const d = new Date(today); d.setMonth(d.getMonth() + 1)
    const rec: RecurrenceConfig = { type: 'monthly', display: 'mes' }
    return { date: d, recurrence: rec, label: formatLabel(d, rec) }
  }

  // ── Fecha concreta: "29 mayo", "29 de mayo", "29/5", "29-05" ─────────────
  const dateM = text.match(/^(\d{1,2})(?:\s+de\s+|\s+|\/)(\w+)(?:\s+(\d{4}))?$/)
  if (dateM) {
    const day = parseInt(dateM[1])
    const monthStr = dateM[2]
    const year = dateM[3] ? parseInt(dateM[3]) : today.getFullYear()
    const monthNum = /^\d+$/.test(monthStr) ? parseInt(monthStr) - 1 : MONTHS_ES[monthStr]
    if (monthNum !== undefined && day >= 1 && day <= 31) {
      const d = new Date(year, monthNum, day)
      if (isNaN(d.getTime())) return null
      // Si la fecha ya pasó este año y no se especificó año → próximo año
      if (d < today && !dateM[3]) d.setFullYear(today.getFullYear() + 1)
      return { date: d, label: formatLabel(d) }
    }
  }

  return null
}

/** Calcula la siguiente ocurrencia de una recurrencia a partir de una fecha base */
export function nextRecurrence(from: Date, rec: RecurrenceConfig): Date {
  const base = new Date(from); base.setHours(0, 0, 0, 0)

  if (rec.type === 'daily') {
    const d = new Date(base); d.setDate(d.getDate() + 1); return d
  }
  if (rec.type === 'monthly') {
    const d = new Date(base); d.setMonth(d.getMonth() + 1); return d
  }
  if ((rec.type === 'weekly' || rec.type === 'custom') && rec.days?.length) {
    const candidates = rec.days.map(day => nextWeekday(base, day))
    return candidates.reduce((a, b) => (a < b ? a : b))
  }
  // fallback: 7 días
  const d = new Date(base); d.setDate(d.getDate() + 7); return d
}
