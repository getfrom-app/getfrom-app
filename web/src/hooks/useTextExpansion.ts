// Hook que gestiona los atajos de texto (text expansion)
// Los atajos se guardan en localStorage

const SHORTCUTS_KEY = 'from_text_shortcuts'

export interface Shortcut {
  id: string
  trigger: string   // ej: ";firma"
  expansion: string // ej: "Un saludo, Alberto"
}

export function getShortcuts(): Shortcut[] {
  try { return JSON.parse(localStorage.getItem(SHORTCUTS_KEY) || '[]') } catch { return [] }
}

export function saveShortcuts(shortcuts: Shortcut[]): void {
  localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(shortcuts))
}

// Detecta si el texto termina en un trigger y devuelve el texto expandido
export function tryExpand(text: string, shortcuts: Shortcut[]): string | null {
  for (const sc of shortcuts) {
    if (text.endsWith(sc.trigger)) {
      return text.slice(0, -sc.trigger.length) + sc.expansion
    }
  }
  return null
}
