import { useState, useCallback, useEffect, useRef } from 'react'
import { store, useStore } from '../../store/nodeStore'
import OutlinerNode from './OutlinerNode'
import type { Node } from '../../types'

// ── Helpers para drag-to-select ──────────────────────────────────────────────
function getNodeIdFromEl(el: Element | null): string | null {
  return el?.closest('[data-node-id]')?.getAttribute('data-node-id') ?? null
}

// ── Coordinación entre instancias de Outliner ─────────────────────────────────
// Hay múltiples instancias de Outliner anidadas (una por nivel del árbol).
// Cuando el usuario inicia un drag, solo la instancia responsable de ese nodo
// debe gestionar la selección. Las demás deben ignorar los eventos.
// Este ref a nivel de módulo garantiza que solo UNA instancia esté activa.
let _activeDragContainer: HTMLElement | null = null

// Devuelve true SOLO si el target ES el propio elemento de texto/input
// (no si es un padre que contiene un contenteditable).
// Esto permite iniciar drag-select desde los márgenes o padding del nodo,
// pero no desde dentro del texto editable.
function isDirectTextEl(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false
  const el = target as HTMLElement
  return (
    el.getAttribute('contenteditable') === 'true' ||
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA'
  )
}

// Botones y controles de UI que no deben iniciar drag-select
function isControlEl(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false
  const el = target as HTMLElement
  return !!(el.tagName === 'BUTTON' || el.closest('button') ||
            el.tagName === 'SELECT' || el.tagName === 'A')
}

interface Props {
  parentId: string | null
  autoFocusEmpty?: boolean
  placeholder?: string
  className?: string
  filterText?: string
  filterMatchIds?: Set<string>    // WF smart filter: IDs que coinciden
  filterAncestorIds?: Set<string> // WF smart filter: ancestros de coincidencias (evita O(n²) getAllDescendants)
  temporalSort?: 'year' | 'month'  // WF: orden por mes (dentro de año) o por día (dentro de mes)
  compact?: boolean
  /** Si true, oculta nodos isDiaryEntry de la lista (usados en WFHomeView para que
   *  los diarios no aparezcan en root — viven bajo 📅 Agenda) */
  excludeDiaryEntries?: boolean
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

const MONTHS_ES_ORDER = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function getMonthIndex(text: string): number {
  return MONTHS_ES_ORDER.findIndex(m => m.toLowerCase() === (text || '').toLowerCase())
}

function getDayNumber(node: Node): number {
  if (node.diaryDate) return new Date(node.diaryDate).getDate()
  // Intentar extraer número del texto si no hay diaryDate
  const m = (node.text || '').match(/\b(\d{1,2})\b/)
  return m ? parseInt(m[1]) : 999
}

export default function Outliner({ parentId, autoFocusEmpty, placeholder, className, filterText, filterMatchIds, filterAncestorIds, temporalSort, compact, excludeDiaryEntries }: Props) {
  const s = useStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  // Drag-to-select state
  // isDragSelectingRef es el valor síncrono (evita stale closure en onMove).
  // isDragSelecting es el state para React (CSS, renders).
  const [isDragSelecting, setIsDragSelecting] = useState(false)
  const isDragSelectingRef = useRef(false)
  const didDragSelectRef   = useRef(false)  // true si el drag activó node-select (no solo clic)
  function startDragSelect() { isDragSelectingRef.current = true; didDragSelectRef.current = true; setIsDragSelecting(true) }
  function stopDragSelect()  { isDragSelectingRef.current = false; setIsDragSelecting(false) }
  const dragAnchorId = useRef<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [localFilterOpen, setLocalFilterOpen] = useState(false)
  const [localFilterText, setLocalFilterText] = useState('')
  const localFilterRef = useRef<HTMLInputElement>(null)
  const [sortMode, setSortMode] = useState<SortMode>('none')
  const rawNodes = (() => {
    const all = s.children(parentId)
    // En WFHomeView (root), los diarios viven bajo 📅 Agenda — nunca en root
    if (excludeDiaryEntries) return all.filter(n => !n.isDiaryEntry)
    return all
  })()

  // Apply visual sort without modifying siblingOrder
  const nodes = (() => {
    // WF temporal sort: mes dentro de año → por índice de mes; día dentro de mes → por número de día
    if (temporalSort === 'year') {
      const sorted = [...rawNodes]
      sorted.sort((a, b) => {
        const ai = getMonthIndex(a.text || '')
        const bi = getMonthIndex(b.text || '')
        // Nodos que NO son meses van al final (mantienen su orden relativo)
        if (ai === -1 && bi === -1) return a.siblingOrder - b.siblingOrder
        if (ai === -1) return 1
        if (bi === -1) return -1
        return ai - bi
      })
      return sorted
    }
    if (temporalSort === 'month') {
      const sorted = [...rawNodes]
      sorted.sort((a, b) => {
        const ad = getDayNumber(a)
        const bd = getDayNumber(b)
        if (ad === 999 && bd === 999) return a.siblingOrder - b.siblingOrder
        if (ad === 999) return 1
        if (bd === 999) return -1
        return ad - bd
      })
      return sorted
    }
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

  // ── Drag-to-select ────────────────────────────────────────────────────────
  const dragAnchorPos = useRef<number>(0)   // Y del mousedown
  const lastMouseY   = useRef<number>(0)    // Y más reciente del cursor
  const dragFromText = useRef(false)        // ¿el drag empezó en un contenteditable?

  // Devuelve el rect de la FILA del nodo (div.node-row), no del contenedor
  // completo (div.outliner-node) que incluye hijos expandidos.
  function getNodeRowRect(id: string): DOMRect | null {
    const nodeEl = containerRef.current?.querySelector(`[data-node-id="${id}"]`)
    if (!nodeEl) return null
    const rowEl = nodeEl.querySelector('.node-row') as HTMLElement | null
    return (rowEl ?? nodeEl as HTMLElement).getBoundingClientRect()
  }

  // Heurística del 50%: incluye el nodo ancla siempre, y nodos adicionales
  // cuando el cursor ha cruzado su punto medio vertical.
  function computeSelectedWithMidpoint(anchorId: string, cursorY: number): Set<string> {
    const flat = flatVisibleIds()
    const ai = flat.indexOf(anchorId)
    if (ai === -1) return new Set([anchorId])
    const goingDown = cursorY > dragAnchorPos.current
    const result = new Set<string>([anchorId])
    if (goingDown) {
      for (let i = ai + 1; i < flat.length; i++) {
        const rect = getNodeRowRect(flat[i])
        if (!rect) continue
        if (cursorY >= rect.top + rect.height / 2) result.add(flat[i]); else break
      }
    } else {
      for (let i = ai - 1; i >= 0; i--) {
        const rect = getNodeRowRect(flat[i])
        if (!rect) continue
        if (cursorY <= rect.top + rect.height / 2) result.add(flat[i]); else break
      }
    }
    return result
  }

  // React onMouseDown — previene text-selection cuando el drag no empieza en texto
  function handleContainerMouseDown(e: React.MouseEvent) {
    if (isControlEl(e.target)) return
    const id = getNodeIdFromEl(e.target as Element)
    if (id && !isDirectTextEl(e.target)) e.preventDefault()
  }

  useEffect(() => {
    // Conjunto de IDs que pertenecen a ESTE nivel del Outliner
    const ownNodeIds = new Set(nodes.map(n => n.id))

    // ── mousedown nativo (capture) ────────────────────────────────────────
    // Cada instancia de Outliner (una por nivel) escucha todos los mousedowns,
    // pero SOLO actúa si el nodo clickado pertenece a su propio nivel.
    // Solo una instancia de Outliner puede estar activa al mismo tiempo.
    // _activeDragContainer (módulo-level) indica cuál está manejando el drag.
    const myContainer = containerRef  // ref estable para este Outliner

    function onDown(e: MouseEvent) {
      const target = e.target as Element
      if (isControlEl(target) || !myContainer.current?.contains(target)) return
      if ((target as HTMLElement).closest('.node-drag-handle')) return

      const id = getNodeIdFromEl(target)
      if (id && !ownNodeIds.has(id)) return  // nodo de otro nivel → ignorar

      // Reclamar este drag para esta instancia
      _activeDragContainer = myContainer.current

      dragAnchorPos.current = e.clientY
      lastMouseY.current = e.clientY
      dragFromText.current = isDirectTextEl(target)
      dragAnchorId.current = id ?? (nodes.length > 0 ? '__empty__' : null)
      if (id && !dragFromText.current) e.preventDefault()
    }

    // ── mousemove ─────────────────────────────────────────────────────────
    function onMove(e: MouseEvent) {
      lastMouseY.current = e.clientY
      // Solo actuar si ESTA instancia es la que controla el drag actual
      if (_activeDragContainer !== myContainer.current) return
      if (!dragAnchorId.current) return

      // ── Espacio vacío ──────────────────────────────────────────────────
      if (dragAnchorId.current === '__empty__') {
        const hoveredId = getNodeIdFromEl(document.elementFromPoint(e.clientX, e.clientY))
        if (!hoveredId) return
        const flat = flatVisibleIds()
        const anchorId = e.clientY < dragAnchorPos.current ? flat[flat.length - 1] : flat[0]
        if (!anchorId) return
        dragAnchorId.current = anchorId
        dragFromText.current = false
        startDragSelect(); setSelectedId(null)
        setSelectedIds(new Set([anchorId]))
        return
      }

      const anchorId = dragAnchorId.current!

      // ── Drag desde texto: bounding rect de .node-row ───────────────────
      if (dragFromText.current && !isDragSelectingRef.current) {
        const nodeEl = myContainer.current?.querySelector(`[data-node-id="${anchorId}"]`)
        const rowEl  = nodeEl?.querySelector('.node-row') as HTMLElement | null
        const rect   = (rowEl ?? nodeEl as HTMLElement | null)?.getBoundingClientRect()
        if (rect && (e.clientY < rect.top || e.clientY > rect.bottom)) {
          window.getSelection()?.removeAllRanges()
          startDragSelect(); setSelectedId(null)
          dragFromText.current = false
          setSelectedIds(computeSelectedWithMidpoint(anchorId, e.clientY))
        }
        return
      }

      // ── Drag desde zona no-texto ───────────────────────────────────────
      if (!dragFromText.current) {
        if (!isDragSelectingRef.current && Math.abs(e.clientY - dragAnchorPos.current) <= 4) return
        if (!isDragSelectingRef.current) {
          startDragSelect(); setSelectedId(null)
          setSelectedIds(new Set([anchorId]))
        }
        setSelectedIds(computeSelectedWithMidpoint(anchorId, e.clientY))
      }
    }

    // ── dragstart ─────────────────────────────────────────────────────────
    function onDragStart(e: Event) {
      if (_activeDragContainer !== myContainer.current) return
      if (dragFromText.current || isDragSelectingRef.current) {
        e.preventDefault()
      } else {
        _activeDragContainer = null
        dragAnchorId.current = null
        dragFromText.current = false
        stopDragSelect()
      }
    }

    // ── mouseup ───────────────────────────────────────────────────────────
    function onUp() {
      const wasDrag = didDragSelectRef.current
      didDragSelectRef.current = false

      if (_activeDragContainer === myContainer.current) {
        _activeDragContainer = null
      }
      dragAnchorId.current = null
      dragFromText.current = false
      stopDragSelect()

      // Clic simple (sin drag) → limpiar selección múltiple
      // igual que en cualquier editor: clic = mover cursor y deseleccionar
      if (!wasDrag) {
        setSelectedIds(new Set())
      }
    }

    document.addEventListener('mousedown', onDown, { capture: true })
    document.addEventListener('mousemove', onMove)
    document.addEventListener('dragstart', onDragStart)
    document.addEventListener('mouseup',   onUp)
    return () => {
      if (_activeDragContainer === myContainer.current) _activeDragContainer = null
      document.removeEventListener('mousedown', onDown, { capture: true })
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('dragstart', onDragStart)
      document.removeEventListener('mouseup',   onUp)
    }
  }, [nodes]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Multi-select: borrar seleccionados (también usado por teclado)
  function handleDeleteSelected() {
    for (const id of selectedIds) store.deleteNode(id)
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
            filterMatchIds={filterMatchIds}
            filterAncestorIds={filterAncestorIds}
            isFirstEmpty={idx === 0 && nodes.length === 1 && !(node.text || '').trim()}
          />
        ))}
      </div>

      {/* WF-style: no hay barra inferior. La multi-selección se opera
          solo con el teclado: Delete borrar · Tab indentar · Shift+Tab
          desindentar · ⌘C copiar · Escape limpiar.
          Los nodos seleccionados se resaltan con fondo azul via CSS. */}
    </>
  )
}
