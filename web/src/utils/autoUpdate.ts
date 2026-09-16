/**
 * Auto-actualización de la web (Alberto, 16 sep 2026: "que la app detecte la
 * versión nueva y se recargue sola").
 *
 * Por qué hace falta: GitHub Pages sirve el HTML con `cache-control: max-age=600`
 * y no se puede cambiar desde aquí (las <meta http-equiv> de index.html no
 * cuentan para la caché HTTP). Tras un deploy, una pestaña abierta sigue con el
 * JS viejo, y una recarga normal durante esos 10 minutos devuelve el HTML viejo
 * de la caché — visto en vivo con la v9.10.77.
 *
 * Cómo: cada pocos minutos (y al volver a la pestaña) se pide el HTML saltando
 * la caché y se compara el `assets/index-<hash>.js` que enlaza con el que está
 * cargado. Si cambió, se recarga con `?v=<ts>` (URL nueva = sin caché; `main.tsx`
 * quita el parámetro al arrancar), pero solo en un momento seguro: pestaña oculta,
 * o sin teclear/clicar en 2 minutos y sin un campo editable con el foco. Los
 * cambios ya hechos no se pierden: el store los guarda y el outbox de
 * operaciones vive en localStorage.
 *
 * Solo web en producción: en Tauri los assets van dentro de la app (se actualiza
 * con el updater) y en dev no hay hash.
 */

const CHECK_EVERY_MS = 5 * 60_000
const FOCUS_THROTTLE_MS = 60_000
const IDLE_MS = 2 * 60_000
const RELOAD_GUARD_KEY = 'from_update_reload_at'
const ENTRY_RE = /assets\/index-[\w-]+\.js/

let lastInteraction = Date.now()
let lastCheck = 0
let pendingEntry: string | null = null

function loadedEntry(): string | null {
  for (const s of Array.from(document.querySelectorAll<HTMLScriptElement>('script[src]'))) {
    const m = s.src.match(ENTRY_RE)
    if (m) return m[0]
  }
  return null
}

async function latestEntry(): Promise<string | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}?_v=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    return (await res.text()).match(ENTRY_RE)?.[0] ?? null
  } catch {
    return null // sin red: se reintenta en la siguiente pasada
  }
}

function isEditing(): boolean {
  const el = document.activeElement as HTMLElement | null
  if (!el) return false
  return el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT'
}

function reloadIfSafe() {
  if (!pendingEntry) return
  const idle = Date.now() - lastInteraction >= IDLE_MS
  if (!document.hidden && (!idle || isEditing())) return
  // Anti-bucle: si hace poco ya recargamos y el HTML seguía siendo el viejo
  // (CDN a medio propagar), esperar a la siguiente ventana.
  try {
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0)
    if (Date.now() - last < 10 * 60_000) return
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()))
  } catch { /* sessionStorage no disponible */ }
  const u = new URL(window.location.href)
  u.searchParams.set('v', String(Date.now()))
  window.location.replace(u.toString())
}

async function check() {
  lastCheck = Date.now()
  const current = loadedEntry()
  if (!current) return
  const latest = await latestEntry()
  if (latest && latest !== current) pendingEntry = latest
  reloadIfSafe()
}

export function startAutoUpdate() {
  if (import.meta.env.DEV || import.meta.env.VITE_TAURI === 'true') return
  const touch = () => { lastInteraction = Date.now() }
  for (const ev of ['keydown', 'pointerdown', 'wheel', 'touchstart']) {
    window.addEventListener(ev, touch, { capture: true, passive: true })
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { reloadIfSafe(); return }
    if (Date.now() - lastCheck > FOCUS_THROTTLE_MS) void check()
  })
  // Tick corto: con versión pendiente, reintenta la recarga en cuanto sea seguro;
  // sin ella, solo comprueba cada CHECK_EVERY_MS.
  setInterval(() => {
    if (pendingEntry) reloadIfSafe()
    else if (Date.now() - lastCheck >= CHECK_EVERY_MS) void check()
  }, 30_000)
  lastCheck = Date.now()
}
