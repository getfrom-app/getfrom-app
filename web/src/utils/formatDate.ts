// Formato de fechas compartido — listas de elementos (Elementos/Historial) y cabecera
// del elemento abierto. Corto para filas (poco espacio), largo con hora para tooltips
// y la cabecera de detalle, donde sí hay sitio para creación + modificación.
export function fmtDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) } catch { return '' }
}

export function fmtDateFull(iso: string | null | undefined, locale: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

/** "hace 2 horas" / "2 hours ago" — vía Intl.RelativeTimeFormat (nativo, sin diccionario
 *  propio). Más de ~30 días → cae a la fecha absoluta corta (fmtDate), donde lo relativo
 *  deja de aportar y solo estorba ("hace 2 meses" es menos útil que "3 may"). */
export function fmtRelative(iso: string | null | undefined, locale: string): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (isNaN(then)) return ''
  const diffSec = Math.round((then - Date.now()) / 1000)
  const abs = Math.abs(diffSec)
  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
    if (abs < 60) return rtf.format(diffSec, 'second')
    if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute')
    if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour')
    if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), 'day')
  } catch { /* Intl.RelativeTimeFormat no disponible o locale inválido */ }
  return fmtDate(iso, locale)
}
