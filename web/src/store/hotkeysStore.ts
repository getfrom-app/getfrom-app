/**
 * hotkeysStore — Atajos de teclado configurables
 *
 * Los hotkeys se definen aquí con sus valores por defecto.
 * El usuario puede cambiarlos desde Ajustes → Atajos.
 * Los cambios se persisten en localStorage.
 *
 * Para hotkeys con modificador (⌘K, ⇧Enter...) solo se muestra el display
 * y no se permite cambiar el modificador — solo la tecla base.
 */

const STORAGE_KEY = 'from_wf_hotkeys'

export interface HotkeyDef {
  id: string
  category: string
  label: string
  description: string
  /** Tecla por defecto (sin modificadores) */
  defaultKey: string
  /** Modificadores fijos (no configurables) — solo display */
  modifiers?: string[]   // 'meta' | 'shift' | 'ctrl' | 'alt'
  /** Si es false no se puede cambiar la tecla base */
  configurable?: boolean
}

// ── Definiciones por defecto ──────────────────────────────────────────────────

export const DEFAULT_HOTKEYS: HotkeyDef[] = [
  // Navegación global
  { id: 'go-today',         category: 'Captura',      label: 'Ir a hoy',                description: 'Navegar a la nota del día de hoy',                defaultKey: 'h',          configurable: true },
  { id: 'new-today',        category: 'Captura',      label: 'Nuevo nodo hoy',          description: 'Ir al diario de hoy y crear nodo vacío',          defaultKey: 'n',          configurable: true },
  { id: 'toggle-planner',   category: 'Captura',      label: 'Planificador',             description: 'Abrir / cerrar el planificador lateral',          defaultKey: 'p',          configurable: true },
  { id: 'command-palette',  category: 'Navegación',   label: 'Paleta de comandos',       description: 'Búsqueda rápida, comandos, contextos',             defaultKey: 'k',          modifiers: ['meta'], configurable: true },
  { id: 'magic-chat-open',  category: 'IA',           label: 'Abrir Magic Chat',         description: 'Espacio (sin input) o ⌘J abren el asistente IA', defaultKey: 'Space',      configurable: false },
  { id: 'magic-chat-voice', category: 'IA',           label: 'Grabar y enviar (mantener)', description: 'Mantén R para grabar voz. Suelta para enviar.',    defaultKey: 'r',          configurable: false },
  { id: 'ai-chat',          category: 'IA',           label: 'Chat IA (alt)',             description: 'Atajo alternativo para abrir From AI',            defaultKey: 'j',          modifiers: ['meta'], configurable: false },
  { id: 'toggle-sidebar',   category: 'Navegación',   label: 'Toggle sidebar',           description: 'Mostrar / ocultar la barra lateral',              defaultKey: 's',          modifiers: ['meta', 'shift'], configurable: false },
  { id: 'go-back',          category: 'Navegación',   label: 'Página anterior',          description: 'Navegar atrás en el historial',                   defaultKey: '[',          modifiers: ['meta'], configurable: false },
  { id: 'go-forward',       category: 'Navegación',   label: 'Página siguiente',         description: 'Navegar adelante en el historial',                defaultKey: ']',          modifiers: ['meta'], configurable: false },
  { id: 'show-shortcuts',   category: 'Navegación',   label: 'Ver atajos',               description: 'Abrir este panel de atajos de teclado',           defaultKey: '?',          configurable: true },
  { id: 'settings',         category: 'Navegación',   label: 'Ajustes',                  description: 'Abrir la página de ajustes',                      defaultKey: ',',          modifiers: ['meta'], configurable: false },
  { id: 'escape-up',        category: 'Navegación',   label: 'Subir jerarquía',          description: 'Escape: cierra modales → quita foco → sube nivel', defaultKey: 'Escape',    configurable: false },

  // Outliner
  { id: 'new-sibling',      category: 'Outliner',     label: 'Nuevo nodo hermano',       description: 'Crear nodo en la misma posición (mismo nivel)',   defaultKey: 'Enter',      configurable: false },
  { id: 'zoom-in',          category: 'Outliner',     label: 'Zoom in al nodo',          description: 'Entrar en el nodo como contexto (Shift+Enter)',   defaultKey: 'Enter',      modifiers: ['shift'], configurable: false },
  { id: 'indent',           category: 'Outliner',     label: 'Indentar',                 description: 'Hacer hijo del nodo anterior',                    defaultKey: 'Tab',        configurable: false },
  { id: 'outdent',          category: 'Outliner',     label: 'Desindentar',              description: 'Subir un nivel (Shift+Tab)',                      defaultKey: 'Tab',        modifiers: ['shift'], configurable: false },
  { id: 'toggle-task',      category: 'Outliner',     label: 'Ciclar estado tarea',      description: 'Normal → Pendiente → Hecha → Normal (⌘Enter)',    defaultKey: 'Enter',      modifiers: ['meta'], configurable: false },
  { id: 'slash-menu',       category: 'Outliner',     label: 'Menú de bloques',          description: 'Abrir menú / para cambiar tipo de nodo',          defaultKey: '/',          configurable: false },
  { id: 'context-picker',   category: 'Outliner',     label: 'Mencionar contexto',       description: 'Picker de contextos (🧠 Contexto)',                defaultKey: '@',          configurable: false },
  { id: 'note-reference',   category: 'Outliner',     label: 'Referencia a nota',        description: 'Picker de notas para crear referencia',           defaultKey: '#',          configurable: false },
  { id: 'collapse-all',     category: 'Outliner',     label: 'Colapsar/expandir todo',   description: 'Toggle colapsar / expandir todos los nodos',      defaultKey: 'c',          modifiers: ['meta', 'shift'], configurable: false },
  { id: 'undo',             category: 'Outliner',     label: 'Deshacer',                 description: 'Deshacer última acción',                          defaultKey: 'z',          modifiers: ['meta'], configurable: false },
  { id: 'redo',             category: 'Outliner',     label: 'Rehacer',                  description: 'Rehacer acción deshecha',                         defaultKey: 'z',          modifiers: ['meta', 'shift'], configurable: false },

  // Selección múltiple
  { id: 'delete-selected',  category: 'Selección',    label: 'Borrar selección',         description: 'Eliminar nodos seleccionados',                    defaultKey: 'Backspace',  configurable: false },
  { id: 'clear-selection',  category: 'Selección',    label: 'Limpiar selección',        description: 'Quitar selección múltiple',                       defaultKey: 'Escape',     configurable: false },

  // Formato de texto
  { id: 'bold',             category: 'Formato',      label: 'Negrita',                  description: 'Aplicar / quitar negrita al texto seleccionado',  defaultKey: 'b',          modifiers: ['meta'], configurable: false },
  { id: 'italic',           category: 'Formato',      label: 'Cursiva',                  description: 'Aplicar / quitar cursiva',                        defaultKey: 'i',          modifiers: ['meta'], configurable: false },
  { id: 'code',             category: 'Formato',      label: 'Código',                   description: 'Aplicar / quitar formato de código',              defaultKey: 'e',          modifiers: ['meta'], configurable: false },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadCustomKeys(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch { return {} }
}

function saveCustomKeys(keys: Record<string, string>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys))
}

/** Devuelve la tecla actual para un hotkey (custom o default) */
export function getHotkeyKey(id: string): string {
  const custom = loadCustomKeys()
  const def = DEFAULT_HOTKEYS.find(h => h.id === id)
  return custom[id] ?? def?.defaultKey ?? ''
}

/** Actualiza la tecla de un hotkey configurable */
export function setHotkeyKey(id: string, key: string): void {
  const custom = loadCustomKeys()
  const def = DEFAULT_HOTKEYS.find(h => h.id === id)
  if (!def?.configurable) return
  if (key === def.defaultKey) {
    delete custom[id]  // restaurar default
  } else {
    custom[id] = key
  }
  saveCustomKeys(custom)
  window.dispatchEvent(new Event('from:hotkeys-changed'))
}

/** Restaurar todos los hotkeys a sus valores por defecto */
export function resetAllHotkeys(): void {
  localStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new Event('from:hotkeys-changed'))
}

/** Devuelve todos los hotkeys con sus valores actuales */
export function getAllHotkeys(): (HotkeyDef & { currentKey: string; isCustom: boolean })[] {
  const custom = loadCustomKeys()
  return DEFAULT_HOTKEYS.map(def => ({
    ...def,
    currentKey: custom[def.id] ?? def.defaultKey,
    isCustom: !!custom[def.id],
  }))
}

/** Formatea el display de un hotkey (e.g. '⌘⇧K') */
export function formatHotkeyDisplay(def: HotkeyDef & { currentKey?: string }): string {
  const key = def.currentKey ?? def.defaultKey
  const mods = def.modifiers ?? []
  const parts: string[] = []
  if (mods.includes('meta'))  parts.push('⌘')
  if (mods.includes('ctrl'))  parts.push('⌃')
  if (mods.includes('shift')) parts.push('⇧')
  if (mods.includes('alt'))   parts.push('⌥')
  const displayKey = key === 'Enter' ? '↵' : key === 'Tab' ? '⇥' : key === 'Escape' ? 'Esc' : key === 'Backspace' ? '⌫' : key === 'Space' ? '␣ Espacio' : key.toUpperCase()
  parts.push(displayKey)
  return parts.join('')
}

/** Comprueba si un KeyboardEvent coincide con un hotkey por ID */
export function matchesHotkey(e: KeyboardEvent, id: string): boolean {
  const key = getHotkeyKey(id)
  const def = DEFAULT_HOTKEYS.find(h => h.id === id)
  if (!def) return false
  const mods = def.modifiers ?? []
  const needsMeta  = mods.includes('meta')
  const needsShift = mods.includes('shift')
  const needsCtrl  = mods.includes('ctrl')
  const needsAlt   = mods.includes('alt')
  return (
    e.key.toLowerCase() === key.toLowerCase() &&
    !!(e.metaKey || e.ctrlKey) === needsMeta &&
    !!e.shiftKey === needsShift &&
    !!e.ctrlKey === needsCtrl &&
    !!e.altKey === needsAlt
  )
}
