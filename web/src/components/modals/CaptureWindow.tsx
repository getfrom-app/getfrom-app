// CaptureWindow — contenido de la ventana flotante "capture" del Mac.
//
// Se renderiza SOLO en la ventana cuyo label es 'capture' (ver App.tsx).
// Reutiliza UnifiedCapture, pero:
//  - carga su propio store (comparte el snapshot de localStorage → instantáneo)
//  - la navegación se redirige a la ventana principal (no navega esta ventana)
//  - cerrar = ocultar la ventana (no se destruye, vive en el tray)

import { useEffect, useState } from 'react'
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
  } catch { /* no-op fuera de Tauri */ }
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
  const [ready, setReady] = useState(didInitialLoad)
  const [hasToken, setHasToken] = useState(!!getToken())
  // Cambiar la key remonta UnifiedCapture → limpia el texto y re-enfoca el input.
  const [openKey, setOpenKey] = useState(0)

  // Ventana transparente: quitar el fondo opaco de la app para que solo
  // se vea la tarjeta de captura flotando (sin "marco gris").
  useEffect(() => {
    const prevHtml = document.documentElement.style.background
    const prevBody = document.body.style.background
    document.documentElement.style.background = 'transparent'
    document.body.style.background = 'transparent'
    const root = document.getElementById('root')
    if (root) root.style.background = 'transparent'
    return () => {
      document.documentElement.style.background = prevHtml
      document.body.style.background = prevBody
    }
  }, [])

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

  if (!hasToken) {
    return (
      <div style={{
        position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 12,
        background: 'var(--bg-primary)', color: 'var(--text-secondary)',
        fontFamily: 'Inter, sans-serif', borderRadius: 12,
        border: '1px solid var(--border)', padding: 24, textAlign: 'center',
      }}>
        <strong style={{ color: 'var(--text-primary)', fontSize: 15 }}>Inicia sesión en From</strong>
        <span style={{ fontSize: 13 }}>Abre la app de From y entra en tu cuenta para usar la captura rápida.</span>
        <button
          onClick={() => routeToMain('/')}
          style={{ marginTop: 4, padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
        >
          Abrir From
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
        Cargando…
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
