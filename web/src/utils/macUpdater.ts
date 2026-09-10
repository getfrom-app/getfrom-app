/**
 * macUpdater — comprobación de versión nueva de la app de Mac (Tauri).
 *
 * Antes vivía dentro de `components/layout/StatusBar.tsx`… que la interfaz 2.0
 * NO monta. Resultado: desde que la v2 es la app, la app de Mac no comprobaba
 * actualizaciones ni al arrancar ni desde el menú «Buscar actualizaciones…»
 * (Alberto, 10 sep 2026: "le doy a buscar actualización pero no busca nada").
 * Ahora es un hook que monta la barra de estado v2 (`NextEventBar`) — y
 * StatusBar (v1) lo comparte.
 *
 * - Comprobación automática a los 5 s y cada hora, silenciosa salvo que haya
 *   versión nueva (pill «✦ Nueva versión X — Actualizar» en la barra).
 * - Comprobación MANUAL (menú Fromly → «Buscar actualizaciones…», evento
 *   `from:check-update` desde Rust): siempre responde con un aviso nativo,
 *   también cuando ya estás al día o si falla.
 */
import { useEffect, useState } from 'react'

const isTauriEnv = import.meta.env.VITE_TAURI === 'true'

export interface MacUpdaterState {
  checking: boolean
  upToDate: boolean
  error: string | null
  updating: boolean
  available: { version: string; download: () => Promise<void> } | null
  dismissError: () => void
}

async function nativeMessage(text: string): Promise<void> {
  try {
    const { message } = await import('@tauri-apps/plugin-dialog')
    await message(text, { title: 'Fromly', kind: 'info' })
  } catch { window.alert(text) }
}

export function useMacUpdater(): MacUpdaterState {
  const [checking, setChecking] = useState(false)
  const [upToDate, setUpToDate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [available, setAvailable] = useState<MacUpdaterState['available']>(null)

  useEffect(() => {
    if (!isTauriEnv) return

    const check = async (manual = false) => {
      setChecking(true); setError(null); setUpToDate(false)
      const notify = (text: string) => { if (manual) void nativeMessage(text) }
      try {
        const { check: tauriCheck } = await import('@tauri-apps/plugin-updater')
        const update = await tauriCheck()
        if (update?.available) {
          setAvailable({
            version: update.version,
            download: async () => {
              setUpdating(true); setError(null)
              try {
                await update.downloadAndInstall()
                const { relaunch } = await import('@tauri-apps/plugin-process')
                await relaunch()
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e))
                setUpdating(false)
              }
            },
          })
          notify(`Hay una versión nueva: ${update.version}. Pulsa «Actualizar» en la barra inferior para instalarla.`)
        } else {
          setUpToDate(true)
          setTimeout(() => setUpToDate(false), 4000)
          let current = ''
          try { const { getVersion } = await import('@tauri-apps/api/app'); current = await getVersion() } catch { /* */ }
          notify(`Ya tienes la última versión${current ? ` (${current})` : ''}.`)
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setError(msg)
        notify(`No se ha podido comprobar: ${msg}`)
      } finally {
        setChecking(false)
      }
    }

    const t1 = setTimeout(() => { void check(false) }, 5000)
    const t2 = setInterval(() => { void check(false) }, 3_600_000)
    let unlisten: (() => void) | null = null
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen('from:check-update', () => { void check(true) }).then(fn => { unlisten = fn })
    }).catch(() => {})
    return () => { clearTimeout(t1); clearInterval(t2); unlisten?.() }
  }, [])

  return { checking, upToDate, error, updating, available, dismissError: () => setError(null) }
}
