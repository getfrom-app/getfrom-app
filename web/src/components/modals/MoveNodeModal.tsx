import { createPortal } from 'react-dom'
import { useState, useRef, useEffect, useMemo } from 'react'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'

interface Props {
  node: Node
  onClose: () => void
}

function getAncestorPath(nodeId: string): string {
  const parts: string[] = []
  let cur = store.getNode(nodeId)
  while (cur?.parentId) {
    const parent = store.getNode(cur.parentId)
    if (!parent) break
    parts.unshift(parent.text || 'Sin título')
    cur = parent
  }
  return parts.slice(-2).join(' / ')
}

function getNodeIcon(n: Node): string {
  if (n.isEvent) return '📅'
  if (n.status === 'pending') return '○'
  if (n.status === 'done') return '✓'
  if ((n.types || []).includes('bucle')) return '↺'
  if (n.isFavorite) return '★'
  if (n.isDiaryEntry) return '📓'
  return '📄'
}

export default function MoveNodeModal({ node, onClose }: Props) {
  const s = useStore()
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Collect all descendants of the node (cannot move into self or descendants)
  const descendants = useMemo(() => {
    const set = new Set<string>()
    const queue = [node.id]
    while (queue.length) {
      const id = queue.shift()!
      set.add(id)
      store.children(id).forEach(c => queue.push(c.id))
    }
    return set
  }, [node.id])

  const candidates = useMemo(() => {
    const base = s.allActive().filter(n => {
      if (descendants.has(n.id)) return false
      if (n.deletedAt) return false
      if (n.isDiaryEntry) return false
      return true
    })

    if (query.trim()) {
      const q = query.toLowerCase()
      return base
        .filter(n => (n.text || '').toLowerCase().includes(q))
        .sort((a, b) => {
          const aStart = a.text.toLowerCase().startsWith(q) ? 0 : 1
          const bStart = b.text.toLowerCase().startsWith(q) ? 0 : 1
          return aStart - bStart || b.updatedAt.localeCompare(a.updatedAt)
        })
        .slice(0, 15)
    }

    // No query: show root nodes + recently updated
    const roots = base.filter(n => !n.parentId).slice(0, 6)
    const recent = base
      .filter(n => n.parentId) // has parent (not root)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 6)
    const seen = new Set(roots.map(n => n.id))
    const combined = [...roots]
    for (const r of recent) {
      if (!seen.has(r.id)) { combined.push(r); seen.add(r.id) }
    }
    return combined.slice(0, 12)
  }, [query, s, descendants])

  // All items including root option
  const allItems: Array<{ id: string | null; text: string; icon: string; path: string }> = [
    { id: null, text: 'Raíz (sin padre)', icon: '🏠', path: '' },
    ...candidates.map(n => ({
      id: n.id,
      text: n.text || 'Sin título',
      icon: getNodeIcon(n),
      path: getAncestorPath(n.id),
    })),
  ]

  useEffect(() => { setActiveIdx(0) }, [query])

  function moveTo(targetId: string | null) {
    const siblings = store.children(targetId)
    const maxOrder = siblings.reduce((max, n) => Math.max(max, n.siblingOrder), 0)
    store.updateNode(node.id, {
      parentId: targetId,
      siblingOrder: maxOrder + 1000,
    })
    onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, allItems.length - 1))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const item = allItems[activeIdx]
      if (item) moveTo(item.id)
    }
  }

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const active = list.querySelector('.move-node-item--active') as HTMLElement | null
    active?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card move-node-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-icon">⇢</span>
          <h2>Mover nota</h2>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>
        <div className="move-node-info">
          Moviendo: <strong>{node.text || 'Sin título'}</strong>
        </div>
        <div className="move-node-search">
          <input
            ref={inputRef}
            type="text"
            className="modal-input"
            placeholder="Buscar destino..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div ref={listRef} className="move-node-results">
          {allItems.map((item, idx) => (
            <div
              key={item.id ?? '__root__'}
              className={`move-node-item ${idx === activeIdx ? 'move-node-item--active' : ''}`}
              onClick={() => moveTo(item.id)}
              onMouseEnter={() => setActiveIdx(idx)}
            >
              <span className="move-node-icon">{item.icon}</span>
              <div className="move-node-info-row">
                <span className="move-node-text">{item.text}</span>
                {item.path && <span className="move-node-path">{item.path}</span>}
              </div>
            </div>
          ))}
          {allItems.length === 1 && query && (
            <div className="move-node-empty">Sin resultados para "{query}"</div>
          )}
        </div>
        <div className="move-node-hint">↑↓ navegar · Enter mover · Esc cancelar</div>
      </div>
    </div>,
    document.body
  )
}
