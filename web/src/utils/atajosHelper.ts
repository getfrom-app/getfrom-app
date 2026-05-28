import { store } from '../store/nodeStore'

const ATAJOS_NAME = '📌 Atajos'

export function getAtajosNode() {
  return store.children(null).find(n => !n.deletedAt && n.text === ATAJOS_NAME)
}

export function ensureAtajosNode() {
  const existing = getAtajosNode()
  if (existing) {
    // Migración: quitar _system si lo tenía (ahora es visible en el árbol)
    try {
      const ed = JSON.parse(existing.extraData || '{}')
      if (ed._system) {
        delete ed._system
        store.updateNode(existing.id, { extraData: JSON.stringify(ed) })
      }
    } catch { /* ignore */ }
    return existing
  }
  const node = store.createNode({ text: ATAJOS_NAME, parentId: null, siblingOrder: 9998 })
  // Sin _system — visible en el árbol como el resto de nodos de sistema
  return store.getNode(node.id)!
}

// Check if node is a shortcut (has _shortcutQuery or _shortcutNodeId)
export function isShortcutNode(nodeId: string): boolean {
  const n = store.getNode(nodeId)
  if (!n) return false
  try {
    const ed = JSON.parse(n.extraData || '{}')
    return !!(ed._shortcutQuery !== undefined || ed._shortcutNodeId)
  } catch { return false }
}

// Create a filter shortcut node under 📌 Atajos
export function createFilterShortcut(name: string, query: string, view?: string): string {
  const parent = ensureAtajosNode()
  const siblings = store.children(parent.id)
  const maxOrder = siblings.length > 0 ? Math.max(...siblings.map(s => s.siblingOrder)) : 0
  const node = store.createNode({ text: name, parentId: parent.id, siblingOrder: maxOrder + 1 })
  store.updateNode(node.id, { extraData: JSON.stringify({ _shortcutQuery: query, _shortcutView: view || 'list' }) })
  window.dispatchEvent(new Event('wf:shortcuts-changed'))
  return node.id
}

// Create a node shortcut under 📌 Atajos
export function createNodeShortcut(nodeId: string, name: string): string {
  const parent = ensureAtajosNode()
  const siblings = store.children(parent.id)
  const maxOrder = siblings.length > 0 ? Math.max(...siblings.map(s => s.siblingOrder)) : 0
  const node = store.createNode({ text: name, parentId: parent.id, siblingOrder: maxOrder + 1 })
  // Store both nodeId (for icon fallback) AND the combined query that shows
  // structural descendants + nodes that reference this node by @slug
  store.updateNode(node.id, {
    extraData: JSON.stringify({
      _shortcutNodeId: nodeId,
      _shortcutQuery: `node:${nodeId}`,
      _shortcutView: 'lista',
    })
  })
  window.dispatchEvent(new Event('wf:shortcuts-changed'))
  return node.id
}

// Get shortcut data from a node
export function getShortcutData(nodeId: string): { query?: string; view?: string; nodeId?: string } | null {
  const n = store.getNode(nodeId)
  if (!n) return null
  try {
    const ed = JSON.parse(n.extraData || '{}')
    if (ed._shortcutQuery !== undefined) return { query: ed._shortcutQuery, view: ed._shortcutView, nodeId: ed._shortcutNodeId }
    if (ed._shortcutNodeId) return { nodeId: ed._shortcutNodeId }
  } catch {}
  return null
}

// Migrate from localStorage shortcuts (one-time)
export function migrateLocalStorageShortcuts() {
  const KEY = 'from_wf_shortcuts'  // clave real del shortcutsStore
  const raw = localStorage.getItem(KEY)
  if (!raw) return
  try {
    const list = JSON.parse(raw)
    if (!Array.isArray(list) || list.length === 0) return
    const parent = ensureAtajosNode()
    const existingChildren = store.children(parent.id)
    if (existingChildren.length > 0) return // already migrated
    list.forEach((sc: Record<string, unknown>, i: number) => {
      const node = store.createNode({ text: (sc.name as string) || (sc.query as string) || 'Atajo', parentId: parent.id, siblingOrder: i + 1 })
      if (sc.type === 'filter' || sc.query) {
        store.updateNode(node.id, { extraData: JSON.stringify({ _shortcutQuery: sc.query || '', _shortcutView: 'list' }) })
      } else if (sc.nodeId) {
        store.updateNode(node.id, { extraData: JSON.stringify({ _shortcutNodeId: sc.nodeId }) })
      }
    })
    localStorage.removeItem(KEY)
  } catch {}
}
