import { useState, useEffect } from 'react'

export type Theme = 'light' | 'dark'
export type Density = 'normal' | 'compact' | 'comfortable'
export type AccentColor = 'purple' | 'blue' | 'green' | 'orange' | 'rose' | 'teal'

const THEME_KEY = 'from_theme'
const DENSITY_KEY = 'from_density'
const ACCENT_KEY = 'from_accent'

export function getStoredTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY)
  return (stored === 'dark') ? 'dark' : 'light'
}

export function getStoredDensity(): Density {
  const stored = localStorage.getItem(DENSITY_KEY)
  return (stored === 'compact' || stored === 'comfortable') ? stored as Density : 'normal'
}

export function getStoredAccent(): AccentColor {
  const stored = localStorage.getItem(ACCENT_KEY)
  const valid: AccentColor[] = ['purple', 'blue', 'green', 'orange', 'rose', 'teal']
  return valid.includes(stored as AccentColor) ? stored as AccentColor : 'purple'
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem(THEME_KEY, theme)
}

export function applyDensity(density: Density) {
  document.documentElement.setAttribute('data-density', density)
  localStorage.setItem(DENSITY_KEY, density)
}

export function applyAccent(accent: AccentColor) {
  if (accent === 'purple') {
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

  // Apply on mount
  useEffect(() => {
    applyTheme(theme)
    applyDensity(density)
    applyAccent(accent)
  }, []) // eslint-disable-line

  return { theme, setTheme, density, setDensity, accent, setAccent }
}
