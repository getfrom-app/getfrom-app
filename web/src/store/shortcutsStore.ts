/**
 * shortcutsStore — modelo unificado de atajos para experiment/workflowy
 *
 * Un atajo puede ser:
 *   - type: 'node'   → apunta a un nodo específico (antes isFavorite)
 *   - type: 'filter' → apunta a un filtro guardado (antes "panel")
 *
 * Creados con ⭐ desde cualquier contexto.
 * Almacenados en localStorage como lista ordenada manualmente.
 */

export type WFShortcut = {
  id: string          // uuid local
  type: 'node' | 'filter'
  name: string        // label visible
  // node shortcuts
  nodeId?: string
  // filter shortcuts
  query?: string
  createdAt: string
}

const KEY = 'from_wf_shortcuts'

// IDs de atajos legacy que deben eliminarse automáticamente
const LEGACY_IDS = new Set(['__today_tasks__'])

const DEFAULT_SHORTCUTS: WFShortcut[] = [
  {
    id: '__pending__',
    type: 'filter',
    name: 'Pendientes',
    query: 'pendiente',
    createdAt: '',
  },
  {
    id: '__this_week__',
    type: 'filter',
    name: 'Esta semana',
    query: 'semana',
    createdAt: '',
  },
]

export function getShortcuts(): WFShortcut[] {
  try {
    const raw = localStorage.getItem(KEY)
    const saved: WFShortcut[] = raw ? JSON.parse(raw) : []

    // Eliminar atajos legacy + añadir defaults que falten
    const filtered = saved.filter(s => !LEGACY_IDS.has(s.id))
    const withDefaults = [
      ...DEFAULT_SHORTCUTS.filter(d => !filtered.some(s => s.id === d.id)),
      ...filtered,
    ]

    // Guardar si hubo cambios (legacy eliminado o defaults añadidos)
    if (withDefaults.length !== saved.length || !raw) {
      saveShortcuts(withDefaults)
    }
    return withDefaults
  } catch {
    return DEFAULT_SHORTCUTS
  }
}

export function saveShortcuts(shortcuts: WFShortcut[]) {
  localStorage.setItem(KEY, JSON.stringify(shortcuts))
}

/** Migra datos legacy (from_panels + favoritos del store) en el primer arranque */
function migrateAndSave(): WFShortcut[] {
  const shortcuts: WFShortcut[] = [...DEFAULT_SHORTCUTS]

  // Migrar paneles guardados
  try {
    const panels = JSON.parse(localStorage.getItem('from_panels') || '[]') as Array<{
      id: string; name: string; query: string; createdAt: string
    }>
    for (const p of panels) {
      if (shortcuts.find(s => s.id === p.id)) continue
      shortcuts.push({
        id: p.id,
        type: 'filter',
        name: p.name,
        query: p.query,
        createdAt: p.createdAt,
      })
    }
  } catch { /* ok */ }

  saveShortcuts(shortcuts)
  return shortcuts
}

export function addNodeShortcut(nodeId: string, name: string): WFShortcut[] {
  const shortcuts = getShortcuts()
  if (shortcuts.find(s => s.nodeId === nodeId)) return shortcuts
  const updated = [...shortcuts, {
    id: `node_${nodeId}`,
    type: 'node' as const,
    name,
    nodeId,
    createdAt: new Date().toISOString(),
  }]
  saveShortcuts(updated)
  return updated
}

export function removeNodeShortcut(nodeId: string): WFShortcut[] {
  const shortcuts = getShortcuts().filter(s => s.nodeId !== nodeId)
  saveShortcuts(shortcuts)
  return shortcuts
}

export function isNodeShortcut(nodeId: string): boolean {
  return getShortcuts().some(s => s.nodeId === nodeId)
}

export function addFilterShortcut(name: string, query: string): WFShortcut[] {
  const shortcuts = getShortcuts()
  if (shortcuts.find(s => s.query === query)) return shortcuts
  const updated = [...shortcuts, {
    id: `filter_${Date.now()}`,
    type: 'filter' as const,
    name,
    query,
    createdAt: new Date().toISOString(),
  }]
  saveShortcuts(updated)
  return updated
}

export function removeShortcut(id: string): WFShortcut[] {
  const shortcuts = getShortcuts().filter(s => s.id !== id)
  saveShortcuts(shortcuts)
  return shortcuts
}

export function reorderShortcuts(shortcuts: WFShortcut[]) {
  saveShortcuts(shortcuts)
}
