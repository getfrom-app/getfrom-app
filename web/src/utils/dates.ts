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
