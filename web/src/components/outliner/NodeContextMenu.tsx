import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { store } from '../../store/nodeStore'
import type { Node } from '../../types'

interface Props {
  node: Node
  x: number
  y: number
  onClose: () => void
  onNavigate: (id: string) => void
  onSelect: (id: string) => void
}

export default function NodeContextMenu({ node, x, y, onClose, onNavigate, onSelect }: Props) {
  const menuRef = useRef<HTMLDivElement>(null)

  // Cerrar al click fuera
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as globalThis.Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  // Ajustar posición para no salir de la pantalla
  const menuW = 200, menuH = 300
  const adjustedX = Math.min(x, window.innerWidth - menuW - 8)
  const adjustedY = Math.min(y, window.innerHeight - menuH - 8)

  const isBucle = node.types?.includes('bucle')
  const isTask = node.status !== null
  const isFav = node.isFavorite

  function action(fn: () => void) {
    return (e: React.MouseEvent) => {
      e.preventDefault()
      fn()
      onClose()
    }
  }

  function duplicate() {
    const dup = store.createNode({
      text: node.text,
      parentId: node.parentId,
      siblingOrder: node.siblingOrder + 0.25,
      isTask: node.status !== null,
      types: node.types,
    })
    // Copiar propiedades adicionales post-creación
    store.updateNode(dup.id, {
      priority: node.priority,
      status: node.status,
    })
    onSelect(dup.id)
  }

  function toggleTask() {
    if (!isTask) {
      store.updateNode(node.id, { status: 'pending' })
    } else {
      store.updateNode(node.id, { status: null })
    }
  }

  function toggleBucle() {
    if (isBucle) {
      const newTypes = (node.types || []).filter(t => t !== 'bucle')
      store.updateNode(node.id, { types: newTypes })
    } else {
      const newTypes = [...(node.types || []), 'bucle']
      store.updateNode(node.id, { status: 'pending', types: newTypes })
    }
  }

  function toggleFavorite() {
    store.updateNode(node.id, { isFavorite: !isFav })
  }

  function deleteNode() {
    store.deleteNode(node.id)
  }

  function toggleDone() {
    if (node.status === 'done') {
      store.updateNode(node.id, { status: 'pending' })
    } else {
      store.updateNode(node.id, { status: 'done' })
    }
  }

  return createPortal(
    <div
      ref={menuRef}
      className="context-menu"
      style={{ position: 'fixed', top: adjustedY, left: adjustedX, zIndex: 2000 }}
      onContextMenu={e => e.preventDefault()}
    >
      <div className="context-menu-section">
        <button className="context-menu-item" onClick={action(() => onNavigate(node.id))}>
          <span className="context-menu-icon">↗</span> Abrir nota
        </button>
        <button className="context-menu-item" onClick={action(duplicate)}>
          <span className="context-menu-icon">⧉</span> Duplicar <span className="context-menu-shortcut">⌘D</span>
        </button>
      </div>
      <div className="context-menu-separator" />
      <div className="context-menu-section">
        <button className="context-menu-item" onClick={action(toggleTask)}>
          <span className="context-menu-icon">{isTask ? '◯' : '☑'}</span>
          {isTask ? 'Quitar tarea' : 'Convertir en tarea'}
        </button>
        {isTask && (
          <button className="context-menu-item" onClick={action(toggleDone)}>
            <span className="context-menu-icon">{node.status === 'done' ? '↺' : '✓'}</span>
            {node.status === 'done' ? 'Marcar pendiente' : 'Marcar como hecha'}
          </button>
        )}
        <button className="context-menu-item" onClick={action(toggleBucle)}>
          <span className="context-menu-icon">↺</span>
          {isBucle ? 'Quitar bucle' : 'Convertir en bucle'}
        </button>
      </div>
      <div className="context-menu-separator" />
      <div className="context-menu-section">
        <button className="context-menu-item" onClick={action(toggleFavorite)}>
          <span className="context-menu-icon">{isFav ? '★' : '☆'}</span>
          {isFav ? 'Quitar de fijados' : 'Fijar'}
        </button>
      </div>
      <div className="context-menu-separator" />
      <div className="context-menu-section">
        <button className="context-menu-item context-menu-item--danger" onClick={action(deleteNode)}>
          <span className="context-menu-icon">🗑</span> Eliminar
        </button>
      </div>
    </div>,
    document.body
  )
}
