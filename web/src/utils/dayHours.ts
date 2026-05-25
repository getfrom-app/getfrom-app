// Configuración de franja horaria visible en calendario y timeline diario
// Persistida en localStorage. Por defecto 7-23 (oculta madrugada y noche tarde).

const KEY_START = 'from_day_start_hour'
const KEY_END = 'from_day_end_hour'

export const DEFAULT_DAY_START = 7
export const DEFAULT_DAY_END = 23

export function getDayStart(): number {
  const v = parseInt(localStorage.getItem(KEY_START) || '')
  if (isNaN(v) || v < 0 || v > 23) return DEFAULT_DAY_START
  return v
}

export function getDayEnd(): number {
  const v = parseInt(localStorage.getItem(KEY_END) || '')
  if (isNaN(v) || v < 1 || v > 24) return DEFAULT_DAY_END
  return v
}

export function setDayStart(h: number): void {
  localStorage.setItem(KEY_START, String(h))
  window.dispatchEvent(new Event('from-day-hours-changed'))
}

export function setDayEnd(h: number): void {
  localStorage.setItem(KEY_END, String(h))
  window.dispatchEvent(new Event('from-day-hours-changed'))
}

/** Devuelve array de horas visibles según los ajustes (inclusive de start, exclusive de end). */
export function getVisibleHours(): number[] {
  const start = getDayStart()
  const end = getDayEnd()
  const out: number[] = []
  for (let h = start; h < end; h++) out.push(h)
  return out
}
