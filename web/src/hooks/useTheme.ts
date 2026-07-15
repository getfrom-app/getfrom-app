import { useState, useEffect } from 'react'

export type Theme = 'light' | 'dark' | 'system'
export type Density = 'normal' | 'compact' | 'comfortable'
export type AccentColor = 'steel' | 'copper' | 'graphite' | 'forest' | 'aubergine' | 'ochre' | 'wine' | 'petrol'
  | 'purple' | 'blue' | 'green' | 'orange' | 'rose' | 'teal'
  | 'indigo' | 'cyan' | 'amber' | 'pink' | 'red' | 'lime'

const THEME_KEY = 'from_theme'
const DENSITY_KEY = 'from_density'
const ACCENT_KEY = 'from_accent'

export function getStoredTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY)
  if (stored === 'dark' || stored === 'system') return stored
  return 'light'
}

export function getEffectiveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
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
  const effective = getEffectiveTheme(theme)
  document.documentElement.setAttribute('data-theme', effective)
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
