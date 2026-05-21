import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { store } from '../../store/nodeStore'
import type { Node } from '../../types'
import MoveNodeModal from '../modals/MoveNodeModal'

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
function isTemporalNode(node: Node): boolean {
  const t = node.text || ''
  return /^\d{4}$/.test(t) ||
    MONTHS_ES.some(m => m.toLowerCase() === t.toLowerCase()) ||
    /^Semana \d+$/i.test(t)
}

interface Props {
  node: Node
  x: number
  y: number
  onClose: () => void
  onNavigate: (id: string) => void
  onSelect: (id: string) => void
}

export default function NodeContextMenu({ node, x, y, onClose, onNavigate, onSelect }: Props) {
  const [showMove, setShowMove] = useState(false)
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

  const [showPriorityMenu, setShowPriorityMenu] = useState(false)

  const isBucle = node.types?.includes('bucle')
  const isTask = node.status !== null
  const isFav = node.isFavorite
  const isEvent = node.isEvent

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

  function toggleEvent() {
    store.updateNode(node.id, { isEvent: !isEvent })
  }

  function addDueToday() {
    if (!node.due) {
      const today = new Date()
      today.setHours(23, 59, 59, 0)
      store.updateNode(node.id, { due: today.toISOString() })
    }
  }

  function setPriority(p: 'high' | 'medium' | 'low' | null) {
    store.updateNode(node.id, { priority: p })
  }

  function copyText() {
    navigator.clipboard.writeText(node.text || '')
  }

  function copyLink() {
    const url = `${window.location.origin}/app/node/${node.id}`
    navigator.clipboard.writeText(url)
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

  const portal = createPortal(
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
        <button className="context-menu-item" onClick={(e) => { e.preventDefault(); setShowMove(true) }}>
          <span className="context-menu-icon">→</span> Mover a...
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
        <button className="context-menu-item" onClick={action(toggleEvent)}>
          <span className="context-menu-icon">📅</span>
          {isEvent ? 'Quitar evento' : 'Convertir en evento'}
        </button>
        <button className="context-menu-item" onClick={action(addDueToday)} style={{ opacity: node.due ? 0.4 : 1 }}>
          <span className="context-menu-icon">⌛</span> Añadir fecha de hoy
        </button>
        <div className="context-menu-item context-menu-item--submenu" onMouseEnter={() => setShowPriorityMenu(true)} onMouseLeave={() => setShowPriorityMenu(false)}>
          <span className="context-menu-icon">⬆</span> Añadir prioridad
          <span className="context-menu-arrow">›</span>
          {showPriorityMenu && (
            <div className="context-menu context-menu--sub">
              <button className="context-menu-item" onClick={action(() => setPriority('high'))}>
                <span className="context-menu-icon">🔴</span> Alta {node.priority === 'high' && '✓'}
              </button>
              <button className="context-menu-item" onClick={action(() => setPriority('medium'))}>
                <span className="context-menu-icon">🟡</span> Media {node.priority === 'medium' && '✓'}
              </button>
              <button className="context-menu-item" onClick={action(() => setPriority('low'))}>
                <span className="context-menu-icon">🟢</span> Baja {node.priority === 'low' && '✓'}
              </button>
              <div className="context-menu-separator" />
              <button className="context-menu-item" onClick={action(() => setPriority(null))}>
                <span className="context-menu-icon">✕</span> Ninguna {node.priority === null && '✓'}
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="context-menu-separator" />
      <div className="context-menu-section">
        <button className="context-menu-item" onClick={action(copyText)}>
          <span className="context-menu-icon">⎘</span> Copiar texto
        </button>
        <button className="context-menu-item" onClick={action(copyLink)}>
          <span className="context-menu-icon">🔗</span> Copiar enlace
        </button>
      </div>
      <div className="context-menu-separator" />
      <div className="context-menu-section">
        <div className="context-menu-section-label">Plantilla rápida</div>
        {[
          { label: '📋 Reunión', body: '## Objetivo\n\n## Asistentes\n\n## Notas\n\n## Próximos pasos' },
          { label: '🚀 Proyecto', body: '## Objetivo\n\n## Alcance\n\n## Tareas clave\n\n## Notas' },
          { label: '💡 Idea', body: '## Descripción\n\n## Ventajas\n\n## Siguiente paso' },
        ].map(template => (
          <button
            key={template.label}
            className="context-menu-item"
            onClick={() => {
              store.updateNode(node.id, { body: template.body })
              onClose()
            }}
          >
            {template.label}
          </button>
        ))}
      </div>
      {/* Notas temporales (año/mes/semana) y diarios no se pueden eliminar */}
      {!node.isDiaryEntry && !isTemporalNode(node) && (
        <>
          <div className="context-menu-separator" />
          <div className="context-menu-section">
            <button className="context-menu-item context-menu-item--danger" onClick={action(deleteNode)}>
              <span className="context-menu-icon">🗑</span> Eliminar
            </button>
          </div>
        </>
      )}
    </div>,
    document.body
  )

  return (
    <>
      {portal}
      {showMove && (
        <MoveNodeModal
          node={node}
          onClose={() => { setShowMove(false); onClose() }}
        />
      )}
    </>
  )
}
