import { useState, useCallback, useEffect } from 'react'
import { store, useStore } from '../../store/nodeStore'
import OutlinerNode from './OutlinerNode'
import type { Node } from '../../types'

interface Props {
  parentId: string | null
  autoFocusEmpty?: boolean
  placeholder?: string
  className?: string
  filterText?: string
}

export default function Outliner({ parentId, autoFocusEmpty, placeholder, className, filterText }: Props) {
  const s = useStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const nodes = s.children(parentId)

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
      <div
        className={`outliner-container ${className || ''}`}
        onClick={handleContainerClick}
      >
        {nodes.length === 0 && placeholder && (
          <div className="outliner-placeholder">{placeholder}</div>
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
            filterText={filterText}
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
