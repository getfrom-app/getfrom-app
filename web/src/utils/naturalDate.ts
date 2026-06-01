/**
 * naturalDate — Parser de fechas en lenguaje natural en español
 * Soporta: "mañana", "al lunes", "29 mayo", "en 3 días",
 *          "todos los martes", "cada martes", "al 1 de cada mes", etc.
 */

export interface RecurrenceConfig {
  type: 'daily' | 'weekly' | 'monthly' | 'custom'
  interval?: number // intervalo: 1=cada vez, 2=cada 2, 3=cada 3, etc.
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

/** Parser de recurrencia pura: "3 días", "cada lunes", "2 semanas", "mensual"...
 *  Devuelve RecurrenceConfig o null si no reconoce el patrón.
 */
export function parseRecurrenceOnly(input: string): RecurrenceConfig | null {
  const text = input.trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
    .replace(/ó/g, 'o').replace(/ú/g, 'u')

  // "diario" / "cada día" / "diariamente"
  if (['diario', 'cada dia', 'diariamente', 'a diario', 'todos los dias', 'cada 1 dia', 'cada 1 dias'].includes(text)) {
    return { type: 'daily', display: 'diario' }
  }

  // Palabras numéricas en español → número
  const ES_NUMBERS: Record<string, number> = {
    un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
    seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
    once: 11, doce: 12, quince: 15, veinte: 20, treinta: 30,
  }
  function parseNum(s: string): number | undefined {
    const n = parseInt(s)
    if (!isNaN(n)) return n
    return ES_NUMBERS[s]
  }

  // "N días" / "cada N días" / "cada dos días"
  const nDaysM = text.match(/^(?:cada )?(\w+) dias?$/)
  if (nDaysM) {
    const n = parseNum(nDaysM[1])
    if (n && n > 0) return { type: 'daily', interval: n, display: n === 1 ? 'diario' : `${n} días` }
  }

  // "N semanas" / "cada N semanas" / "cada dos semanas"
  const nWeeksM = text.match(/^(?:cada )?(\w+) semanas?$/)
  if (nWeeksM) {
    const n = parseNum(nWeeksM[1])
    if (n && n > 0) return { type: 'weekly', interval: n, display: n === 1 ? 'semana' : `${n} semanas` }
  }

  // "semanal" / "cada semana" / "semanalmente"
  if (['semanal', 'cada semana', 'semanalmente'].includes(text)) {
    return { type: 'weekly', display: 'semana' }
  }

  // "N meses" / "cada N meses" / "cada dos meses"
  const nMonthsM = text.match(/^(?:cada )?(\w+) meses?$/)
  if (nMonthsM) {
    const n = parseNum(nMonthsM[1])
    if (n && n > 0) return { type: 'monthly', interval: n, display: n === 1 ? 'mes' : `${n} meses` }
  }

  // "mensual" / "cada mes"
  if (['mensual', 'cada mes', 'mensualmente'].includes(text)) {
    return { type: 'monthly', display: 'mes' }
  }

  // "N años" / "cada N años"
  const nYearsM = text.match(/^(?:cada )?(\w+) anos?$/)
  if (nYearsM) {
    const n = parseNum(nYearsM[1])
    if (n && n > 0) return { type: 'monthly', interval: n * 12, display: n === 1 ? 'año' : `${n} años` }
  }

  // "cada 2 lunes" / "cada 3 martes" → weekly con intervalo en un día concreto
  const nDayNameM = text.match(/^cada (\w+) (\w+)$/)
  if (nDayNameM) {
    const n = parseNum(nDayNameM[1])
    const dayNum = DAYS_ES[nDayNameM[2]]
    if (n && n > 1 && dayNum !== undefined) {
      return { type: 'weekly', days: [dayNum], interval: n, display: `c/${n} ${DAY_NAMES_SHORT[dayNum]}` }
    }
  }

  // "cada lunes" / "todos los martes"
  const oneDayM = text.match(/^(?:todos los|cada) (\w+)$/)
  if (oneDayM) {
    const dayNum = DAYS_ES[oneDayM[1]]
    if (dayNum !== undefined) {
      return { type: 'weekly', days: [dayNum], display: DAY_NAMES_SHORT[dayNum] }
    }
  }

  // "cada lunes y jueves"
  const twoDaysM = text.match(/^(?:todos los|cada) (\w+) y (\w+)$/)
  if (twoDaysM) {
    const d1 = DAYS_ES[twoDaysM[1]], d2 = DAYS_ES[twoDaysM[2]]
    if (d1 !== undefined && d2 !== undefined) {
      return { type: 'custom', days: [d1, d2].sort((a, b) => a - b), display: `${DAY_NAMES_SHORT[d1]} y ${DAY_NAMES_SHORT[d2]}` }
    }
  }

  // "al 15 de cada mes" / "cada día 15"
  const monthDayM = text.match(/^(?:al?\s+|cada\s+dia\s+|el\s+dia\s+)?(\d+)(?:\s+de)?\s+cada\s+mes$/)
  if (monthDayM) {
    const day = parseInt(monthDayM[1])
    return { type: 'monthly', monthDay: day, display: `día ${day}` }
  }

  return null
}

/** Siguiente ocurrencia según recurrencia */
export function nextRecurrence(from: Date, rec: RecurrenceConfig): Date {
  const base = new Date(from); base.setHours(0, 0, 0, 0)

  const interval = rec.interval ?? 1
  if (rec.type === 'daily') {
    const d = new Date(base); d.setDate(d.getDate() + interval); return d
  }
  if (rec.type === 'monthly') {
    if (rec.monthDay) return nextMonthDay(new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1), rec.monthDay)
    const d = new Date(base); d.setMonth(d.getMonth() + interval); return d
  }
  if ((rec.type === 'weekly' || rec.type === 'custom') && rec.days?.length) {
    const candidates = rec.days.map(day => nextWeekday(base, day))
    return candidates.reduce((a, b) => (a < b ? a : b))
  }
  // weekly sin días específicos: respetar interval
  const d = new Date(base); d.setDate(d.getDate() + 7 * interval); return d
}

// ── Detección de fecha al final del texto de una tarea ───────────────────────

const TIME_PATTERN = /\s+a\s+las?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i
const EVENT_KEYWORDS = ['reunión', 'reunion', 'llamada', 'cita', 'meeting', 'evento', 'entrevista', 'clase', 'visita', 'presentación', 'presentacion']

export interface DateExtraction {
  /** Texto limpio de la tarea (sin la parte de fecha) */
  cleanText: string
  /** Parte de fecha detectada (para mostrar en predictivo) */
  dateText: string
  /** Fecha parseada */
  parsed: ParsedDate
  /** Hora extraída si la hay ("13:00", "09:30") */
  timeStr?: string
  /** Si se detecta como evento (tiene hora o keyword de reunión) */
  isEvent?: boolean
}

/**
 * Intenta extraer una fecha/hora del FINAL del texto.
 * Ej: "reunión con Adrián mañana a la 1" → { cleanText: "reunión con Adrián", dateText: "mañana a la 1", timeStr: "13:00" }
 */
export function extractDateFromEnd(text: string): DateExtraction | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  // Buscar hora al final primero
  let timeStr: string | undefined
  let textWithoutTime = trimmed
  const timeMatch = trimmed.match(TIME_PATTERN)
  if (timeMatch) {
    let h = parseInt(timeMatch[1])
    const m = timeMatch[2] ? parseInt(timeMatch[2]) : 0
    const ampm = timeMatch[3]?.toLowerCase()
    if (ampm === 'pm' && h < 12) h += 12
    if (ampm === 'am' && h === 12) h = 0
    // Heurística: si no hay am/pm y h <= 8, asumir pm (reunión a la 1 = 13:00)
    if (!ampm && h >= 1 && h <= 8) h += 12
    timeStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
    textWithoutTime = trimmed.slice(0, trimmed.length - timeMatch[0].length).trim()
  }

  // Intentar parsear 1-6 palabras del final del texto (sin la hora)
  const words = textWithoutTime.split(/\s+/)
  if (words.length < 2) return null // necesita al menos "[tarea] [fecha]"

  // ── Paso 1: buscar recurrencia al final (hasta 5 palabras) ─────────────────
  // Si la hay, intentar extraer también una fecha en las palabras anteriores.
  for (let rn = Math.min(5, words.length - 1); rn >= 1; rn--) {
    const recPart = words.slice(words.length - rn).join(' ')
    const rec = parseRecurrenceOnly(recPart)
    if (!rec) continue

    const remainingWords = words.slice(0, words.length - rn)
    if (remainingWords.length === 0) return null

    // Intentar extraer una fecha de las palabras restantes (hasta 4 palabras al final)
    for (let dn = Math.min(4, remainingWords.length - 1); dn >= 1; dn--) {
      const datePart = remainingWords.slice(remainingWords.length - dn).join(' ')
      const dateOnly = parseNaturalDate(datePart)
      if (dateOnly) {
        const cleanText = remainingWords.slice(0, remainingWords.length - dn).join(' ')
        if (!cleanText.trim()) return null
        // Base de la recurrencia = la fecha detectada
        const baseDate = dateOnly.date ?? new Date()
        const parsed: ParsedDate = {
          date: baseDate,
          recurrence: rec,
          label: `${dateOnly.label} · ↻ ${rec.display}`,
        }
        return { cleanText, dateText: `${datePart} ${recPart}`, parsed, timeStr, isEvent: false }
      }
    }

    // Solo recurrencia (sin fecha explícita) — base = hoy
    const cleanText = remainingWords.join(' ')
    if (!cleanText.trim()) return null
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const nextDate = nextRecurrence(today, rec)
    const parsed: ParsedDate = { date: nextDate, recurrence: rec, label: `↻ ${rec.display}` }
    return { cleanText, dateText: recPart, parsed, timeStr: undefined, isEvent: false }
  }

  // ── Paso 2: solo fecha (sin recurrencia) ────────────────────────────────────
  for (let n = Math.min(5, words.length - 1); n >= 1; n--) {
    const datePart = words.slice(words.length - n).join(' ')
    const parsed = parseNaturalDate(datePart)
    if (parsed) {
      const cleanText = words.slice(0, words.length - n).join(' ')
      if (!cleanText.trim()) return null
      const fullDateText = datePart + (timeMatch ? timeMatch[0] : '')
      const lowerClean = norm(cleanText)
      const isEvent = !!timeStr || EVENT_KEYWORDS.some(kw => lowerClean.includes(norm(kw)))
      return { cleanText, dateText: fullDateText, parsed, timeStr, isEvent }
    }
  }

  return null
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

/** Convierte RecurrenceConfig a string para node.recurrence (campo DB) */
export function recurrenceToString(rec: RecurrenceConfig): string {
  const n = rec.interval && rec.interval > 1 ? `:i${rec.interval}` : ''
  if (rec.type === 'daily') return `daily${n}`
  if (rec.type === 'monthly') return rec.monthDay ? `monthly:${rec.monthDay}` : `monthly${n}`
  if (rec.type === 'weekly' || rec.type === 'custom') {
    if (rec.days?.length) return `weekly:${rec.days.join(',')}${n}`
    return `weekly${n}`
  }
  return 'daily'
}

/** Convierte string de node.recurrence a RecurrenceConfig */
export function recurrenceFromString(str: string): RecurrenceConfig | null {
  if (!str) return null
  if (str.startsWith('{')) {
    try { return JSON.parse(str) as RecurrenceConfig } catch {}
  }
  // Extraer intervalo si existe ":iN" al final
  const intervalMatch = str.match(/:i(\d+)$/)
  const interval = intervalMatch ? parseInt(intervalMatch[1]) : undefined
  const base = intervalMatch ? str.slice(0, str.lastIndexOf(':i')) : str
  const [type, param] = base.split(':')
  const DAY_NAMES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
  if (type === 'daily') {
    const n = interval ?? 1
    return { type: 'daily', interval: n > 1 ? n : undefined, display: n === 1 ? 'diario' : `${n} días` }
  }
  if (type === 'monthly') {
    const n = interval ?? 1
    return { type: 'monthly', monthDay: param ? parseInt(param) : undefined, interval: n > 1 ? n : undefined, display: n === 1 ? 'mes' : `${n} meses` }
  }
  if (type === 'weekly') {
    if (param) {
      const days = param.split(',').map(Number)
      const display = days.map(d => DAY_NAMES[d] ?? '?').join(' y ')
      return { type: 'weekly', days, display }
    }
    const n = interval ?? 1
    return { type: 'weekly', interval: n > 1 ? n : undefined, display: n === 1 ? 'semana' : `${n} semanas` }
  }
  return null
}
