import { useState, useEffect } from 'react'

export type Theme = 'light' | 'dark'
export type Density = 'normal' | 'compact' | 'comfortable'

const THEME_KEY = 'from_theme'
const DENSITY_KEY = 'from_density'

export function getStoredTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY)
  return (stored === 'dark') ? 'dark' : 'light'
}

export function getStoredDensity(): Density {
  const stored = localStorage.getItem(DENSITY_KEY)
  return (stored === 'compact' || stored === 'comfortable') ? stored as Density : 'normal'
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem(THEME_KEY, theme)
}

export function applyDensity(density: Density) {
  document.documentElement.setAttribute('data-density', density)
  localStorage.setItem(DENSITY_KEY, density)
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme)
  const [density, setDensityState] = useState<Density>(getStoredDensity)

  function setTheme(t: Theme) {
    setThemeState(t)
    applyTheme(t)
  }

  function setDensity(d: Density) {
    setDensityState(d)
    applyDensity(d)
  }

  // Apply on mount
  useEffect(() => {
    applyTheme(theme)
    applyDensity(density)
  }, []) // eslint-disable-line

  return { theme, setTheme, density, setDensity }
}
