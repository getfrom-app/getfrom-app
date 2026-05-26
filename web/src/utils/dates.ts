/**
 * Helpers para mostrar fechas almacenadas en UTC como hora/fecha local del usuario.
 *
 * Los nodos guardan node.due como ISO UTC (e.g. "2026-05-21T10:00:00.000Z").
 * Hacer .slice(0,10) o .slice(11,16) da fecha/hora UTC, lo que provoca desfases
 * según el timezone del usuario. Estas funciones usan getFullYear/getHours etc.
 * que devuelven la hora LOCAL del navegador.
 */

/** → "2026-05-21" (fecha local) para usar como value en <input type="date"> */
export function isoToLocalDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

/** → "12:00" (hora local) para usar como value en <input type="time"> */
export function isoToLocalTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** → true si la hora local no es medianoche (00:00) */
export function hasLocalTime(iso: string | null | undefined): boolean {
  if (!iso) return false
  const d = new Date(iso)
  return d.getHours() !== 0 || d.getMinutes() !== 0
}

/**
 * Crea un ISO UTC a partir de una fecha local y una hora OPCIONAL.
 * Si no hay hora, usa medianoche local (= "solo fecha").
 * Usar en todos los setDue / setEvtDue para consistencia.
 */
export function makeDueISO(date: string, time: string): string {
  if (!date) return ''
  if (time) {
    return new Date(`${date}T${time}:00`).toISOString()
  }
  // Medianoche local → hasLocalTime() devolverá false → se muestra como "solo fecha"
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0).toISOString()
}

/** Parser de lenguaje natural para fechas (sin el "@" prefix, opcionalmente).
 *  Acepta: "hoy", "mañana", "lunes"..."domingo", "14:30", "dd/mm", "dd/mm/yyyy",
 *  "+N" (días desde hoy). Devuelve ISO o null si no parsea. */
export function parseNaturalDate(input: string): string | null {
  const s = input.trim().toLowerCase().replace(/^@/, '')
  if (!s) return null
  const now = new Date()
  if (s === 'hoy' || s === 'today') {
    const d = new Date(now); d.setHours(23, 59, 0, 0); return d.toISOString()
  }
  if (s === 'mañana' || s === 'manana' || s === 'tomorrow') {
    const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d.toISOString()
  }
  const weekdays = ['domingo','lunes','martes','miércoles','miercoles','jueves','viernes','sábado','sabado']
  for (let i = 0; i < weekdays.length; i++) {
    if (s === weekdays[i]) {
      const target = i === 4 ? 3 : i === 8 ? 6 : (i >= 5 ? i - 1 : i)  // remap variants
      const d = new Date(now)
      const day = d.getDay()
      const diff = day === target ? 7 : ((target - day + 7) % 7) || 7
      d.setDate(d.getDate() + diff); d.setHours(9, 0, 0, 0); return d.toISOString()
    }
  }
  // +N días
  const mPlus = s.match(/^\+(\d+)$/)
  if (mPlus) {
    const d = new Date(now); d.setDate(d.getDate() + parseInt(mPlus[1])); d.setHours(9, 0, 0, 0); return d.toISOString()
  }
  // dd/mm o dd/mm/yyyy
  const mDate = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/)
  if (mDate) {
    const day = parseInt(mDate[1]), month = parseInt(mDate[2]) - 1
    let year = mDate[3] ? parseInt(mDate[3]) : now.getFullYear()
    if (year < 100) year += 2000
    const d = new Date(year, month, day, 9, 0, 0); return d.toISOString()
  }
  // HH:MM (hoy a esa hora)
  const mTime = s.match(/^(\d{1,2}):(\d{2})$/)
  if (mTime) {
    const d = new Date(now); d.setHours(parseInt(mTime[1]), parseInt(mTime[2]), 0, 0); return d.toISOString()
  }
  return null
}
