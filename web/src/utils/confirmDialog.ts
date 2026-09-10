/**
 * askConfirm — confirmación que SÍ pregunta también en la app de Mac.
 *
 * `window.confirm` en Tauri (WKWebView) no muestra ningún diálogo: wry no
 * implementa los paneles de JavaScript en macOS, y la llamada vuelve como si
 * se hubiera aceptado (comprobado en vivo el 10 sep 2026: «Desvincular
 * carpeta» borró lo indexado sin preguntar). Todo confirm destructivo de la
 * web pasa por aquí: en Mac usa el diálogo nativo del plugin `dialog`; en el
 * navegador, el `window.confirm` de siempre.
 */
const isTauri = import.meta.env.VITE_TAURI === 'true'

export async function askConfirm(text: string, opts: { title?: string; kind?: 'info' | 'warning' | 'error' } = {}): Promise<boolean> {
  if (isTauri) {
    try {
      const { confirm } = await import('@tauri-apps/plugin-dialog')
      return await confirm(text, { title: opts.title ?? 'Fromly', kind: opts.kind ?? 'warning' })
    } catch { /* sin plugin: cae al confirm del navegador */ }
  }
  return window.confirm(text)
}
