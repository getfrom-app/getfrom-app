import { store } from '../store/nodeStore'

const ATAJOS_NAME = '📊 Paneles'

export function getAtajosNode() {
  // Buscar en TODOS los nodos activos (no solo children de null)
  // para evitar problemas si parentId no está indexado aún al inicio
  return store.allActive().find(n => n.text === ATAJOS_NAME && n.parentId === null)
}

export function ensureAtajosNode() {
  // Buscar duplicados — si hay más de uno con este nombre, dejar solo el más antiguo
  const all = store.allActive().filter(n => n.text === ATAJOS_NAME && n.parentId === null)
  if (all.length > 1) {
    // Ordenar por fecha de creación, mantener el más antiguo
    all.sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime())
    for (let i = 1; i < all.length; i++) {
      store.deleteNode(all[i].id)
    }
  }
  const existing = all[0]
  if (existing) return existing

  // Solo crear si el store tiene nodos cargados (evita crear en estado vacío)
  if (store.allActive().length < 3) {
    // Store no inicializado aún — devolver null silenciosamente
    return null as unknown as ReturnType<typeof store.getNode> extends null ? never : NonNullable<ReturnType<typeof store.getNode>>
  }

  const node = store.createNode({ text: ATAJOS_NAME, parentId: null, siblingOrder: 9998 })
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

// Create a filter panel node under 📊 Paneles
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
