import { useState, useCallback, useEffect, useRef } from 'react'
import { store, useStore } from '../../store/nodeStore'
import OutlinerNode from './OutlinerNode'
import type { Node } from '../../types'

interface Props {
  parentId: string | null
  autoFocusEmpty?: boolean
  placeholder?: string
  className?: string
  filterText?: string
  compact?: boolean
}

type SortMode = 'none' | 'alpha' | 'due' | 'priority' | 'status'

const SORT_LABELS: Record<SortMode, string> = {
  none: 'Sin orden',
  alpha: 'A-Z',
  due: 'Por fecha',
  priority: 'Por prioridad',
  status: 'Por estado',
}

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

export default function Outliner({ parentId, autoFocusEmpty, placeholder, className, filterText, compact }: Props) {
  const s = useStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [localFilterOpen, setLocalFilterOpen] = useState(false)
  const [localFilterText, setLocalFilterText] = useState('')
  const localFilterRef = useRef<HTMLInputElement>(null)
  const [sortMode, setSortMode] = useState<SortMode>('none')
  const rawNodes = s.children(parentId)

  // Apply visual sort without modifying siblingOrder
  const nodes = (() => {
    if (sortMode === 'none') return rawNodes
    const sorted = [...rawNodes]
    if (sortMode === 'alpha') {
      sorted.sort((a, b) => (a.text || '').localeCompare(b.text || '', 'es', { sensitivity: 'base' }))
    } else if (sortMode === 'due') {
      sorted.sort((a, b) => {
        if (!a.due && !b.due) return 0
        if (!a.due) return 1
        if (!b.due) return -1
        return a.due < b.due ? -1 : 1
      })
    } else if (sortMode === 'priority') {
      sorted.sort((a, b) => {
        const pa = PRIORITY_ORDER[a.priority || ''] ?? 3
        const pb = PRIORITY_ORDER[b.priority || ''] ?? 3
        return pa - pb
      })
    } else if (sortMode === 'status') {
      sorted.sort((a, b) => {
        // pending first, then null (notes), then done
        const order = (s: string | null) => s === 'pending' ? 0 : s === null ? 1 : 2
        return order(a.status) - order(b.status)
      })
    }
    return sorted
  })()

  // Effective filter: prefer external prop, fall back to local
  const effectiveFilter = filterText !== undefined ? filterText : (localFilterOpen ? localFilterText : undefined)

  // Cmd+F opens local filter when no external filterText prop is provided
  useEffect(() => {
    if (filterText !== undefined) return // external filter manages this
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        setLocalFilterOpen(true)
        setTimeout(() => localFilterRef.current?.focus(), 0)
      }
      if (e.key === 'Escape' && localFilterOpen) {
        setLocalFilterOpen(false)
        setLocalFilterText('')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filterText, localFilterOpen])

  // Auto-focus or create first node
  useEffect(() => {
    if (autoFocusEmpty && nodes.length === 0) {
      const n = store.createNode({ text: '', parentId, siblingOrder: 1 })
      setSelectedId(n.id)
    } else if (autoFocusEmpty && nodes.length > 0 && !selectedId) {
      setSelectedId(nodes[0].id)
    }
  }, [autoFocusEmpty, parentId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Flat visible order (respecting collapse) for arrow navigation
  function flatVisible(nodeList: Node[], depth = 0): Node[] {
    const result: Node[] = []
    for (const n of nodeList) {
      result.push(n)
      if (!n.isCollapsed) {
        result.push(...flatVisible(store.children(n.id), depth + 1))
      }
    }
    return result
  }

  const handleSelectNext = useCallback((id: string, dir: 'up' | 'down') => {
    const flat = flatVisible(nodes)
    const idx = flat.findIndex(n => n.id === id)
    if (dir === 'up' && idx > 0) setSelectedId(flat[idx - 1].id)
    if (dir === 'down' && idx < flat.length - 1) setSelectedId(flat[idx + 1].id)
  }, [nodes]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleContainerClick(e: React.MouseEvent) {
    // Click below all nodes → create new node
    if ((e.target as HTMLElement).classList.contains('outliner-container')) {
      const n = store.createNode({
        text: '',
        parentId,
        siblingOrder: nodes.length > 0 ? nodes[nodes.length - 1].siblingOrder + 1 : Date.now(),
      })
      setSelectedId(n.id)
    }
  }

  // Shift+click adds/removes from multi-selection set
  const handleShiftSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  // Multi-select actions
  function handleDeleteSelected() {
    if (!window.confirm(`¿Borrar los ${selectedIds.size} nodos seleccionados?`)) return
    for (const id of selectedIds) {
      store.deleteNode(id)
    }
    setSelectedIds(new Set())
  }

  function handleMarkAsTask() {
    for (const id of selectedIds) {
      const n = store.getNode(id)
      if (n && n.status === null) {
        store.updateNode(id, { status: 'pending' })
      }
    }
    setSelectedIds(new Set())
  }

  return (
    <>
      {localFilterOpen && filterText === undefined && (
        <div className="outliner-filter-bar">
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>🔍</span>
          <input
            ref={localFilterRef}
            className="outliner-filter-input"
            type="text"
            placeholder="Filtrar notas..."
            value={localFilterText}
            onChange={e => setLocalFilterText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') {
                setLocalFilterOpen(false)
                setLocalFilterText('')
              }
            }}
          />
          <select
            className="outliner-sort-select"
            value={sortMode}
            onChange={e => setSortMode(e.target.value as SortMode)}
            title="Ordenar hijos"
            style={{ fontSize: 12, border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            {(Object.keys(SORT_LABELS) as SortMode[]).map(m => (
              <option key={m} value={m}>{SORT_LABELS[m]}</option>
            ))}
          </select>
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 14, padding: '0 4px' }}
            onClick={() => { setLocalFilterOpen(false); setLocalFilterText('') }}
            title="Cerrar filtro (Escape)"
          >
            ×
          </button>
        </div>
      )}
      {!localFilterOpen && filterText === undefined && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 4px 2px' }}>
          <select
            className="outliner-sort-select"
            value={sortMode}
            onChange={e => setSortMode(e.target.value as SortMode)}
            title="Ordenar hijos"
            style={{ fontSize: 11, border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', opacity: sortMode !== 'none' ? 1 : 0.4 }}
          >
            {(Object.keys(SORT_LABELS) as SortMode[]).map(m => (
              <option key={m} value={m}>{SORT_LABELS[m]}</option>
            ))}
          </select>
        </div>
      )}
      <div
        className={`outliner-container ${className || ''} ${compact ? 'outliner-container--compact' : ''}`}
        onClick={handleContainerClick}
      >
        {nodes.length === 0 && placeholder && (
          <div className="outliner-placeholder">{placeholder}</div>
        )}
        {nodes.length === 0 && !placeholder && (
          <div className="outliner-empty-state" onClick={() => {
            const n = store.createNode({ text: '', parentId, siblingOrder: 1 })
            setSelectedId(n.id)
          }}>
            <div className="outliner-empty-icon">✎</div>
            <div className="outliner-empty-title">Nota vacía</div>
            <div className="outliner-empty-hint">
              Haz clic aquí o pulsa Enter para empezar a escribir
              <br />
              <span style={{ opacity: 0.6 }}>/ para comandos · # para tags · @ para menciones</span>
            </div>
          </div>
        )}
        {nodes.map(node => (
          <OutlinerNode
            key={node.id}
            node={node}
            depth={0}
            isSelected={selectedId === node.id}
            isMultiSelected={selectedIds.has(node.id)}
            onSelect={setSelectedId}
            onSelectNext={handleSelectNext}
            onShiftSelect={handleShiftSelect}
            filterText={effectiveFilter}
          />
        ))}
      </div>

      {/* Multi-select action bar */}
      {selectedIds.size > 0 && (
        <div className="multi-select-bar">
          <span className="multi-select-count">
            {selectedIds.size} {selectedIds.size === 1 ? 'seleccionado' : 'seleccionados'}
          </span>
          <div className="multi-select-divider" />
          <button
            className="multi-select-action"
            onClick={handleMarkAsTask}
            title="Convertir en tarea"
          >
            ○ Marcar como tarea
          </button>
          <button
            className="multi-select-action"
            onClick={() => {
              for (const id of selectedIds) {
                const n = store.getNode(id)
                if (n) store.updateNode(id, { status: n.status === 'done' ? 'pending' : (n.status === 'pending' ? 'done' : 'pending') })
              }
              setSelectedIds(new Set())
            }}
            title="Toggle done"
          >
            ✓ Toggle done
          </button>
          <button
            className="multi-select-action"
            onClick={() => {
              for (const id of selectedIds) {
                const n = store.getNode(id)
                if (n) store.updateNode(id, { isFavorite: !n.isFavorite })
              }
              setSelectedIds(new Set())
            }}
            title="Toggle favorito"
          >
            ★ Favorito
          </button>
          <button
            className="multi-select-action multi-select-action--danger"
            onClick={handleDeleteSelected}
            title="Borrar seleccionados"
          >
            ✕ Borrar
          </button>
          <div className="multi-select-divider" />
          <button
            className="multi-select-clear"
            onClick={() => setSelectedIds(new Set())}
            title="Deseleccionar todo"
          >
            ×
          </button>
        </div>
      )}
    </>
  )
}
