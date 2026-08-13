import { useState, useEffect } from 'react'

export type Theme = 'light' | 'dark' | 'system' | 'solar'
export type Density = 'normal' | 'compact' | 'comfortable'
export type AccentColor = 'steel' | 'copper' | 'graphite' | 'forest' | 'aubergine' | 'ochre' | 'wine' | 'petrol'
  | 'purple' | 'blue' | 'green' | 'orange' | 'rose' | 'teal'
  | 'indigo' | 'cyan' | 'amber' | 'pink' | 'red' | 'lime'

const THEME_KEY = 'from_theme'
const DENSITY_KEY = 'from_density'
const ACCENT_KEY = 'from_accent'

export function getStoredTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY)
  if (stored === 'dark' || stored === 'system' || stored === 'solar') return stored
  return 'light'
}

export function getEffectiveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  if (theme === 'solar') return getSolarBlend().blend >= 0.5 ? 'dark' : 'light'
  return theme
}

/* ── Modo "solar" — sigue la hora local del dispositivo, no la del sistema
   operativo (Alberto, 13 ago: "de día modo claro, cuando anochece pasa a
   oscuro gradualmente, y cuando amanece vuelve a claro, en horario local del
   dispositivo"). No pedimos geolocalización — usamos amanecer/atardecer
   aproximados (7:00/20:30) con una hora de transición a cada lado, igual en
   iOS (SolarTheme.swift) para que las dos apps se sientan coherentes. ──── */
const DAWN_START = 6 * 60      // 06:00 — empieza a aclarar
const DAWN_END = 7 * 60        // 07:00 — de día
const DUSK_START = 19 * 60 + 30 // 19:30 — empieza a anochecer
const DUSK_END = 20 * 60 + 30   // 20:30 — de noche

/** 0 = pleno día, 1 = noche cerrada; valores intermedios durante amanecer/atardecer. */
export function getSolarBlend(now = new Date()): { blend: number } {
  const mins = now.getHours() * 60 + now.getMinutes()
  if (mins >= DAWN_END && mins < DUSK_START) return { blend: 0 }
  if (mins >= DUSK_END || mins < DAWN_START) return { blend: 1 }
  if (mins >= DAWN_START && mins < DAWN_END) {
    return { blend: 1 - (mins - DAWN_START) / (DAWN_END - DAWN_START) }
  }
  return { blend: (mins - DUSK_START) / (DUSK_END - DUSK_START) }
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function mixHex(lightHex: string, darkHex: string, t: number): string {
  const [lr, lg, lb] = hexToRgb(lightHex)
  const [dr, dg, db] = hexToRgb(darkHex)
  const r = Math.round(lr + (dr - lr) * t)
  const g = Math.round(lg + (dg - lg) * t)
  const b = Math.round(lb + (db - lb) * t)
  return `rgb(${r}, ${g}, ${b})`
}

// Pares light/dark de las superficies principales — v2 (tokens propios) + v1
// (paneles antiguos, aún visibles en algunas vistas). Solo colores sólidos:
// las líneas/hover en rgba(0,0,0,x)↔rgba(255,255,255,x) cambian de tono a
// mitad de transición, que es imperceptible a esa opacidad tan baja.
const SOLAR_PAIRS: [string, string, string][] = [
  ['--v2-surface', '#ffffff', '#1e1e1d'],
  ['--v2-surface-panel', '#fafaf9', '#1a1a19'],
  ['--v2-surface-sunken', '#f6f6f4', '#171716'],
  ['--v2-elevated', '#ffffff', '#262625'],
  ['--bg-primary', '#f8f8f8', '#1a1a1a'],
  ['--bg-secondary', '#ffffff', '#222222'],
  ['--bg-tertiary', '#f0f0f0', '#2a2a2a'],
  ['--bg-hover', '#e8e8e8', '#303030'],
  ['--bg-active', '#e0e0e0', '#383838'],
  ['--text-primary', '#1a1a1a', '#e8e8e8'],
]

function applySolarBlend(now = new Date()) {
  const { blend } = getSolarBlend(now)
  const root = document.documentElement
  root.setAttribute('data-theme', blend >= 0.5 ? 'dark' : 'light')
  if (blend === 0 || blend === 1) {
    // Fuera de ventana de transición: sin overrides inline, que mande la hoja de estilo normal.
    for (const [name] of SOLAR_PAIRS) root.style.removeProperty(name)
    return
  }
  for (const [name, light, dark] of SOLAR_PAIRS) {
    root.style.setProperty(name, mixHex(light, dark, blend))
  }
}

let solarInterval: ReturnType<typeof setInterval> | undefined
function startSolarTicker() {
  stopSolarTicker()
  applySolarBlend()
  solarInterval = setInterval(applySolarBlend, 60 * 1000)
}
function stopSolarTicker() {
  if (solarInterval) { clearInterval(solarInterval); solarInterval = undefined }
  for (const [name] of SOLAR_PAIRS) document.documentElement.style.removeProperty(name)
}

export function getStoredDensity(): Density {
  const stored = localStorage.getItem(DENSITY_KEY)
  return (stored === 'compact' || stored === 'comfortable') ? stored as Density : 'normal'
}

export function getStoredAccent(): AccentColor {
  const stored = localStorage.getItem(ACCENT_KEY)
  const valid: AccentColor[] = ['steel', 'copper', 'graphite', 'forest', 'aubergine', 'ochre', 'wine', 'petrol',
    'purple', 'blue', 'green', 'orange', 'rose', 'teal', 'indigo', 'cyan', 'amber', 'pink', 'red', 'lime']
  return valid.includes(stored as AccentColor) ? stored as AccentColor : 'steel'
}

export function applyTheme(theme: Theme) {
  if (theme === 'solar') {
    startSolarTicker()
  } else {
    stopSolarTicker()
    document.documentElement.setAttribute('data-theme', getEffectiveTheme(theme))
  }
  localStorage.setItem(THEME_KEY, theme)
}

export function applyDensity(density: Density) {
  document.documentElement.setAttribute('data-density', density)
  localStorage.setItem(DENSITY_KEY, density)
}

export function applyAccent(accent: AccentColor) {
  if (accent === 'steel') {
    document.documentElement.removeAttribute('data-accent')
  } else {
    document.documentElement.setAttribute('data-accent', accent)
  }
  localStorage.setItem(ACCENT_KEY, accent)
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme)
  const [density, setDensityState] = useState<Density>(getStoredDensity)
  const [accent, setAccentState] = useState<AccentColor>(getStoredAccent)

  function setTheme(t: Theme) {
    setThemeState(t)
    applyTheme(t)
  }

  function setDensity(d: Density) {
    setDensityState(d)
    applyDensity(d)
  }

  function setAccent(a: AccentColor) {
    setAccentState(a)
    applyAccent(a)
  }

  // Apply on mount + watch system theme changes
  useEffect(() => {
    applyTheme(theme)
    applyDensity(density)
    applyAccent(accent)

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => applyTheme('system')
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [theme, density, accent]) // eslint-disable-line

  return { theme, setTheme, density, setDensity, accent, setAccent }
}
