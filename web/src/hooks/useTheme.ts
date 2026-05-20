import { useState, useEffect } from 'react'

export type Theme = 'light' | 'dark'

const THEME_KEY = 'from_theme'

export function getStoredTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY)
  return (stored === 'dark') ? 'dark' : 'light'
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem(THEME_KEY, theme)
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme)

  function setTheme(t: Theme) {
    setThemeState(t)
    applyTheme(t)
  }

  // Apply on mount
  useEffect(() => { applyTheme(theme) }, []) // eslint-disable-line

  return { theme, setTheme }
}
