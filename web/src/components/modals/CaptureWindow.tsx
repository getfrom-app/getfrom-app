// CaptureWindow — contenido de la ventana flotante "capture" del Mac.
//
// Se renderiza SOLO en la ventana cuyo label es 'capture' (ver App.tsx).
// Reutiliza UnifiedCapture, pero:
//  - carga su propio store (comparte el snapshot de localStorage → instantáneo)
//  - la navegación se redirige a la ventana principal (no navega esta ventana)
//  - cerrar = ocultar la ventana (no se destruye, vive en el tray)

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { store } from '../../store/nodeStore'
import { getToken } from '../../api/client'
import { ToastProvider } from '../Toast'
import UnifiedCapture from './UnifiedCapture'

let didInitialLoad = false

// Oculta la ventana de captura actual.
async function hideSelf() {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().hide()
  } catch (err) {
    // Fuera de Tauri esto es normal (dev server en el navegador) — pero si
    // ocurre DENTRO de la app de Mac es justo el tipo de fallo silencioso
    // que hacía parecer que "ESC no hace nada": queda en consola para poder
    // diagnosticarlo desde el inspector de la ventana, sin cambiar el
    // comportamiento (sigue sin propagar el error al que llama).
    console.error('[CaptureWindow] no se pudo ocultar la ventana:', err)
  }
}

// Muestra la ventana principal y le pide navegar a una ruta; luego oculta esta.
async function routeToMain(path: string) {
  try {
    const [{ getAllWindows }, { emit }] = await Promise.all([
      import('@tauri-apps/api/window'),
      import('@tauri-apps/api/event'),
    ])
    const wins = await getAllWindows()
    const main = wins.find(w => w.label === 'main')
    if (main) { await main.show(); await main.setFocus() }
    await emit('from:navigate-path', path)
  } catch { /* no-op */ }
  await hideSelf()
}

export default function CaptureWindow() {
  const { t } = useTranslation()
  const [ready, setReady] = useState(didInitialLoad)
  const [hasToken, setHasToken] = useState(!!getToken())
  // Cambiar la key remonta UnifiedCapture → limpia el texto y re-enfoca el input.
  const [openKey, setOpenKey] = useState(0)

  // Cargar el store una vez (comparte snapshot de localStorage con la main).
  useEffect(() => {
    if (didInitialLoad) { setReady(true); return }
    didInitialLoad = true
    store.initialLoad().finally(() => setReady(true))
  }, [])

  // Reaccionar a la apertura desde el tray / deep-link → remontar y re-enfocar.
  useEffect(() => {
    let unlisten: (() => void) | null = null
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen('from:capture-open', () => {
        setHasToken(!!getToken())
        setOpenKey(k => k + 1)
      }).then(fn => { unlisten = fn })
    }).catch(() => {})
    return () => { unlisten?.() }
  }, [])

  // ESC cierra esta ventana SIEMPRE, pase lo que pase dentro de UnifiedCapture
  // (Alberto, 3 sep 2026, con captura real: "aquí, la tecla ESC debe cerrar
  // la ventana de quick capture. no funciona"). UnifiedCapture YA maneja
  // Escape en su propio `onKeyDown` de React y ahí sí cierra (verificado: la
  // misma pieza embebida en la app principal cierra bien con ESC) — pero esta
  // ventana flotante es una WKWebView aparte, y un listener nativo en fase de
  // CAPTURA a nivel de `window` no depende de que el foco esté exactamente
  // dentro del contentEditable ni de cómo WebKit entregue el evento sintético
  // de React en esta ventana. Registrado directamente sobre `window`, no
  // sobre React, para no depender del árbol de componentes montado en cada
  // instante (openKey puede estar remontando UnifiedCapture justo entonces).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      hideSelf()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  if (!hasToken) {
    return (
      <div style={{
        position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 12,
        background: 'var(--bg-primary)', color: 'var(--text-secondary)',
        fontFamily: 'Inter, sans-serif', borderRadius: 12,
        border: '1px solid var(--border)', padding: 24, textAlign: 'center',
      }}>
        <strong style={{ color: 'var(--text-primary)', fontSize: 15 }}>{t('captureWindow.loginTitle')}</strong>
        <span style={{ fontSize: 13 }}>{t('captureWindow.loginHint')}</span>
        <button
          onClick={() => routeToMain('/')}
          style={{ marginTop: 4, padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
        >
          {t('captureWindow.openFromly')}
        </button>
      </div>
    )
  }

  if (!ready) {
    return (
      <div style={{
        position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-primary)', color: 'var(--text-tertiary)',
        fontFamily: 'Inter, sans-serif', borderRadius: 12, fontSize: 13,
      }}>
        {t('common.loading')}
      </div>
    )
  }

  return (
    <ToastProvider>
      <UnifiedCapture
        key={openKey}
        onClose={hideSelf}
        onNavigate={routeToMain}
        embedded
      />
    </ToastProvider>
  )
}
