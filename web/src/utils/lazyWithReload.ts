import { lazy, type ComponentType } from 'react'

/**
 * lazyWithReload — como React.lazy pero resiliente a chunks obsoletos tras un deploy.
 *
 * Problema: con builds hasheados, una pestaña abierta con un build viejo referencia
 * nombres de chunk que ya no existen en el servidor. Al cargar un componente lazy
 * (panel, vista, modal) el import falla con "Failed to fetch dynamically imported
 * module" → el ErrorBoundary global hacía un hard reload abrupto (pantalla de error
 * + vuelta a la raíz).
 *
 * Solución:
 *  1) Reintenta el import UNA vez tras 350ms (cubre fallos de red transitorios).
 *  2) Si el reintento también falla y parece un chunk obsoleto, recarga la página
 *     EN SU SITIO (preserva ruta y query, solo añade ?v= para saltar caché).
 *  3) Guardia anti-bucle: solo recarga si no recargó en los últimos 10s; si no,
 *     propaga el error para no entrar en bucle de recargas.
 */

const RELOAD_GUARD_KEY = 'from_chunk_reload_at'
const RELOAD_COOLDOWN_MS = 10_000

function isChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(msg)
}

function reloadPreservingLocation(): void {
  try {
    const now = Date.now()
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0)
    if (now - last < RELOAD_COOLDOWN_MS) return  // ya recargamos hace poco → no insistir
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(now))
    const u = new URL(window.location.href)   // conserva /app/settings?tab=… etc.
    u.searchParams.set('v', String(now))       // cache-bust para traer el index/chunks nuevos
    window.location.replace(u.toString())
  } catch { /* noop */ }
}

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

export function lazyWithReload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    // Hasta 3 intentos con backoff antes de recargar: la mayoría de fallos al abrir
    // un panel son red transitoria, no un chunk realmente obsoleto. Reintentar evita
    // la "redirección extraña" (recarga) en esos casos.
    const delays = [0, 400, 1000]
    let lastErr: unknown
    for (const d of delays) {
      try {
        if (d) await delay(d)
        return await factory()
      } catch (err) {
        lastErr = err
        if (!isChunkLoadError(err)) throw err   // error real del módulo → propagar
      }
    }
    // Agotados los reintentos y sigue siendo error de chunk → recargar en su sitio.
    if (isChunkLoadError(lastErr)) reloadPreservingLocation()
    throw lastErr
  })
}
