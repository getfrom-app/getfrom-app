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
