import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles/index.css'
import { getStoredTheme, applyTheme, getStoredDensity, applyDensity, getStoredAccent, applyAccent } from './hooks/useTheme'
import './i18n/config'

// Apply all preferences immediately to avoid FOUC
applyTheme(getStoredTheme())
applyDensity(getStoredDensity())
applyAccent(getStoredAccent())

// Detectar entorno: Tauri (app desktop) vs web
// import.meta.env.VITE_TAURI = "true" se inyecta en vite.config.tauri.ts en build time
const isTauri = import.meta.env.VITE_TAURI === 'true'
const basename = isTauri ? '/' : '/app'

// En Tauri: añadir clase al body para CSS específico (titlebar, etc.)
if (isTauri) {
  document.documentElement.classList.add('tauri-mac')
  document.body.classList.add('tauri-mac')
}

// GitHub Pages SPA redirect: restore path from ?p= param (solo en web)
if (!isTauri) {
  ;(function () {
    const search = window.location.search
    if (search.startsWith('?p=')) {
      const path = decodeURIComponent(search.slice(3))
      window.history.replaceState(null, '', '/app/' + path)
    }
  })()
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter
      basename={basename}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <App />
    </BrowserRouter>
  </React.StrictMode>
)

// Ocultar el loading screen cuando el store esté listo (no al montar React,
// sino cuando hay datos que mostrar — evita el flash de pantalla en blanco)
function hideLoader() {
  const el = document.getElementById('app-loading')
  if (!el) return
  el.classList.add('hidden')
  setTimeout(() => el.remove(), 280)
}
window.addEventListener('from:store-loaded', hideLoader, { once: true })
// Fallback: ocultar a los 8s por si el evento no llega (error de red, etc.)
setTimeout(hideLoader, 8000)
