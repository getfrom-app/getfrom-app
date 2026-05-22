import { useState, useCallback, useEffect, useRef } from 'react'
import { store, useStore } from '../../store/nodeStore'
import OutlinerNode from './OutlinerNode'
import type { Node } from '../../types'

// ── Helpers para drag-to-select ──────────────────────────────────────────────
function getNodeIdFromEl(el: Element | null): string | null {
  return el?.closest('[data-node-id]')?.getAttribute('data-node-id') ?? null
}
function isInteractiveEl(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false
  return !!(
    target.getAttribute('contenteditable') === 'true' ||
    target.closest('[contenteditable="true"]') ||
    (target as HTMLElement).tagName === 'BUTTON' ||
    (target as HTMLElement).tagName === 'INPUT' ||
    (target as HTMLElement).tagName === 'TEXTAREA'
  )
}

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
  // Drag-to-select state
  const [isDragSelecting, setIsDragSelecting] = useState(false)
  const dragAnchorId = useRef<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
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
      // Nota vacía: crear primer nodo y enfocarlo
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

  // IDs de todos los nodos visibles en orden (incluyendo hijos)
  function flatVisibleIds(): string[] {
    return flatVisible(nodes).map(n => n.id)
  }

  // Rango inclusivo entre dos nodo IDs
  function getRangeIds(id1: string, id2: string): Set<string> {
    const flat = flatVisibleIds()
    const i1 = flat.indexOf(id1), i2 = flat.indexOf(id2)
    if (i1 === -1 || i2 === -1) return new Set([id1, id2])
    const [lo, hi] = i1 < i2 ? [i1, i2] : [i2, i1]
    return new Set(flat.slice(lo, hi + 1))
  }

  // ── Drag-to-select: mouse events ──────────────────────────────────────────
  // dragAnchorPos: posición Y del mousedown para detectar dirección del arrastre
  const dragAnchorPos = useRef<number>(0)

  function handleContainerMouseDown(e: React.MouseEvent) {
    if (isInteractiveEl(e.target)) return
    const id = getNodeIdFromEl(e.target as Element)
    dragAnchorPos.current = e.clientY
    if (id) {
      dragAnchorId.current = id
    } else if (nodes.length > 0) {
      // Click en espacio vacío (debajo/encima de todos los nodos):
      // usar el nodo más cercano en Y como ancla para permitir arrastrar hacia arriba
      dragAnchorId.current = '__empty__'
    }
  }

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragAnchorId.current) return
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const hoveredId = getNodeIdFromEl(el)

      // Si el ancla es espacio vacío, activamos drag-select cuando hay movimiento
      // y el cursor pasa sobre algún nodo
      if (dragAnchorId.current === '__empty__') {
        if (!hoveredId) return
        // El ancla real es el primer o último nodo según dirección del arrastre
        const flat = flatVisibleIds()
        const isUpward = e.clientY < dragAnchorPos.current
        const anchorId = isUpward ? flat[flat.length - 1] : flat[0]
        if (!anchorId) return
        dragAnchorId.current = anchorId
        setIsDragSelecting(true)
        setSelectedId(null)
        setSelectedIds(getRangeIds(anchorId, hoveredId))
        return
      }

      if (!hoveredId || hoveredId === dragAnchorId.current) {
        if (!isDragSelecting) return
      }
      if (!isDragSelecting) {
        setIsDragSelecting(true)
        setSelectedId(null)
      }
      if (hoveredId) {
        setSelectedIds(getRangeIds(dragAnchorId.current, hoveredId))
      }
    }
    function onUp() {
      dragAnchorId.current = null
      setIsDragSelecting(false)
    }
    // Si empieza HTML5 DnD (reordenar nodos), cancelar drag-select
    function onDragStart() {
      dragAnchorId.current = null
      setIsDragSelecting(false)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.addEventListener('dragstart', onDragStart)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.removeEventListener('dragstart', onDragStart)
    }
  }, [isDragSelecting, nodes]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Teclado sobre multi-selección ─────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (selectedIds.size === 0) return
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        e.stopPropagation()
        for (const id of selectedIds) store.deleteNode(id)
        setSelectedIds(new Set())
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        const flat = flatVisibleIds()
        const texts = flat
          .filter(id => selectedIds.has(id))
          .map(id => store.getNode(id)?.text || '')
          .filter(Boolean)
          .join('\n')
        navigator.clipboard.writeText(texts).catch(() => {})
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        e.stopPropagation()
        const flat = flatVisibleIds()
        const selected = flat.filter(id => selectedIds.has(id))
        if (e.shiftKey) {
          // Desindentar: mover al padre del padre actual
          for (const id of selected) {
            const n = store.getNode(id)
            if (!n || !n.parentId || n.parentId === parentId) continue
            const grandParent = store.getNode(n.parentId)
            if (!grandParent) continue
            const newParentId = grandParent.parentId ?? parentId
            const siblings = store.children(newParentId || null)
            const gpIdx = siblings.findIndex(s => s.id === n.parentId)
            store.updateNode(id, { parentId: newParentId, siblingOrder: (siblings[gpIdx]?.siblingOrder ?? 0) + 0.5 })
          }
        } else {
          // Indentar: mover como hijo del nodo anterior
          for (const id of selected) {
            const n = store.getNode(id)
            if (!n) continue
            const siblings = store.children(n.parentId || null)
            const idx = siblings.findIndex(s => s.id === id)
            if (idx <= 0) continue
            const prev = siblings[idx - 1]
            const prevChildren = store.children(prev.id)
            const newOrder = prevChildren.length > 0
              ? prevChildren[prevChildren.length - 1].siblingOrder + 1
              : 1
            store.updateNode(id, { parentId: prev.id, siblingOrder: newOrder })
          }
        }
      }
      if (e.key === 'Escape') {
        setSelectedIds(new Set())
      }
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [selectedIds, nodes]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectNext = useCallback((id: string, dir: 'up' | 'down') => {
    const flat = flatVisible(nodes)
    const idx = flat.findIndex(n => n.id === id)
    if (dir === 'up' && idx > 0) setSelectedId(flat[idx - 1].id)
    if (dir === 'down' && idx < flat.length - 1) setSelectedId(flat[idx + 1].id)
  }, [nodes]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleContainerClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement
    // Ignorar clicks en nodos, botones, inputs y controles de UI
    if (
      target.closest('[data-node-id]') ||
      target.closest('button') ||
      target.closest('input') ||
      target.closest('.outliner-filter-bar') ||
      target.closest('.outliner-toolbar') ||
      target.closest('.outliner-empty-state')
    ) return

    // Click en espacio vacío (debajo del último nodo o en el padding del contenedor):
    // Si el último nodo está vacío → focusarlo. Si no → crear uno nuevo y focusarlo.
    const last = nodes.length > 0 ? nodes[nodes.length - 1] : null
    if (last && !(last.text || '').trim()) {
      // Ya existe un nodo vacío al final — solo focusarlo
      setSelectedId(last.id)
    } else {
      const n = store.createNode({
        text: '',
        parentId,
        siblingOrder: last ? last.siblingOrder + 1 : Date.now(),
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
    for (const id of selectedIds) store.deleteNode(id)
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
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 14, padding: '0 4px' }}
            onClick={() => { setLocalFilterOpen(false); setLocalFilterText('') }}
            title="Cerrar filtro (Escape)"
          >
            ×
          </button>
        </div>
      )}
      <div
        ref={containerRef}
        className={`outliner-container ${className || ''} ${compact ? 'outliner-container--compact' : ''} ${isDragSelecting ? 'is-drag-selecting' : ''}`}
        onClick={handleContainerClick}
        onMouseDown={handleContainerMouseDown}
        onContextMenu={selectedIds.size > 0 ? (e) => {
          e.preventDefault()
          const flat = flatVisibleIds()
          const texts = flat.filter(id => selectedIds.has(id)).map(id => store.getNode(id)?.text || '').filter(Boolean)
          if (texts.length === 0) return
          // Crear nota con los nodos seleccionados
          const title = texts[0]
          const newNode = store.createNode({ text: title, parentId: null })
          for (let i = 1; i < texts.length; i++) {
            store.createNode({ text: texts[i], parentId: newNode.id, siblingOrder: i })
          }
          setSelectedIds(new Set())
          // Navegar a la nueva nota
          window.location.href = `/app/node/${newNode.id}`
        } : undefined}
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
        {nodes.map((node, idx) => (
          <OutlinerNode
            key={node.id}
            node={node}
            depth={0}
            isSelected={selectedId === node.id}
            selectedId={selectedId}
            isMultiSelected={selectedIds.has(node.id)}
            onSelect={setSelectedId}
            onSelectNext={handleSelectNext}
            onShiftSelect={handleShiftSelect}
            filterText={effectiveFilter}
            isFirstEmpty={idx === 0 && nodes.length === 1 && !(node.text || '').trim()}
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
            className="multi-select-action"
            onClick={() => {
              const flat = flatVisibleIds()
              const selected = flat.filter(id => selectedIds.has(id))
              for (const id of selected) {
                const n = store.getNode(id)
                if (!n) continue
                const siblings = store.children(n.parentId || null)
                const idx = siblings.findIndex(s => s.id === id)
                if (idx <= 0) continue
                const prev = siblings[idx - 1]
                const prevChildren = store.children(prev.id)
                const newOrder = prevChildren.length > 0 ? prevChildren[prevChildren.length - 1].siblingOrder + 1 : 1
                store.updateNode(id, { parentId: prev.id, siblingOrder: newOrder })
              }
            }}
            title="Indentar (Tab)"
          >
            → Indentar
          </button>
          <button
            className="multi-select-action"
            onClick={() => {
              const flat = flatVisibleIds()
              const selected = flat.filter(id => selectedIds.has(id))
              for (const id of selected) {
                const n = store.getNode(id)
                if (!n || !n.parentId || n.parentId === parentId) continue
                const grandParent = store.getNode(n.parentId)
                if (!grandParent) continue
                const newParentId = grandParent.parentId ?? parentId
                const siblings = store.children(newParentId || null)
                const gpIdx = siblings.findIndex(s => s.id === n.parentId)
                store.updateNode(id, { parentId: newParentId, siblingOrder: (siblings[gpIdx]?.siblingOrder ?? 0) + 0.5 })
              }
            }}
            title="Desindentar (Shift+Tab)"
          >
            ← Desindentar
          </button>
          <button
            className="multi-select-action"
            onClick={() => {
              const flat = flatVisibleIds()
              const texts = flat
                .filter(id => selectedIds.has(id))
                .map(id => store.getNode(id)?.text || '')
                .filter(Boolean)
              if (texts.length === 0) return
              const title = texts[0]
              const newNode = store.createNode({ text: title, parentId: null })
              for (let i = 1; i < texts.length; i++) {
                store.createNode({ text: texts[i], parentId: newNode.id, siblingOrder: i })
              }
              setSelectedIds(new Set())
            }}
            title="Crear nota con la selección"
          >
            ✦ Crear nota
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
