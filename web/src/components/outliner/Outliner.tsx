import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { store, useStore } from '../../store/nodeStore'
import OutlinerNode, { getDraggedIds, getDraggedId } from './OutlinerNode'
import type { Node } from '../../types'
import { trashNode } from '../../utils/papeleraHelper'
import { useNavigate } from 'react-router-dom'
import NodeContextMenu from './NodeContextMenu'
import { VirtualOutlinerList, isVirtualizedOutliner, VIRTUALIZE_THRESHOLD } from './VirtualOutlinerList'
import { flattenVisibleTree } from './flattenTree'

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
// Root outliner del drag activo — usado para scopear las queries DOM
// y evitar mezclar nodos de paneles distintos (sidebar, content, etc.)
let _activeDragRoot: HTMLElement | null = null

// ── Selección global compartida entre instancias ──────────────────────────────
// Permite que el drag-to-select funcione entre niveles distintos del árbol.
let _gSelectedIds: Set<string> = new Set()
const _gSelectionListeners = new Set<() => void>()

function gSetSelected(ids: Set<string>) {
  _gSelectedIds = ids
  _gSelectionListeners.forEach(fn => fn())
}

function gClearSelected() {
  gSetSelected(new Set())
}

/** Exportado: obtener todos los IDs seleccionados actualmente */
export function getGlobalSelectedIds(): Set<string> { return _gSelectedIds }

/** Exportado: limpiar toda la selección */
export function clearGlobalSelection() {
  gClearSelected()
  _selMenuPos = null
  _selMenuListeners.forEach(fn => fn())
}

// ── Menú flotante de selección múltiple ─────────────────────────────────────
let _selMenuPos: { x: number; y: number } | null = null
const _selMenuListeners = new Set<() => void>()

export function openSelectionMenu(pos: { x: number; y: number }) {
  _selMenuPos = pos
  _selMenuListeners.forEach(fn => fn())
}

function useSelectionMenuPos() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(_selMenuPos)
  useEffect(() => {
    const cb = () => setPos(_selMenuPos ? { ..._selMenuPos } : null)
    _selMenuListeners.add(cb)
    return () => { _selMenuListeners.delete(cb) }
  }, [])
  return pos
}

/** Exportado: toggle selección de un nodo + todos sus descendientes */
export function toggleNodeSelection(nodeId: string, storeInstance: { children: (id: string) => Array<{ id: string; deletedAt?: string | null }> }) {
  function collectIds(id: string, out: Set<string>) {
    out.add(id)
    for (const child of storeInstance.children(id)) {
      if (!child.deletedAt) collectIds(child.id, out)
    }
  }
  const ids = new Set(_gSelectedIds)
  if (ids.has(nodeId)) {
    const toRemove = new Set<string>()
    collectIds(nodeId, toRemove)
    toRemove.forEach(id => ids.delete(id))
  } else {
    collectIds(nodeId, ids)
  }
  gSetSelected(ids)
}

export function useGlobalSelection(): Set<string> {
  const [ids, setIds] = useState<Set<string>>(_gSelectedIds)
  useEffect(() => {
    const cb = () => setIds(new Set(_gSelectedIds))
    _gSelectionListeners.add(cb)
    return () => { _gSelectionListeners.delete(cb) }
  }, [])
  return ids
}

// Sube por el DOM hasta encontrar el outliner-container más alto.
// Esto acota las queries al contexto visual activo (evita mezclar con
// otros paneles que puedan renderizar los mismos data-node-id).
function findRootOutlinerContainer(el: HTMLElement): HTMLElement {
  let root: HTMLElement = el
  let cur: HTMLElement | null = el.parentElement
  while (cur) {
    if (cur.classList.contains('outliner-container')) root = cur
    cur = cur.parentElement
  }
  return root
}

// Devuelve el rect de la fila propia del nodo (no incluye hijos expandidos).
// Busca solo dentro del scope dado para no confundir con otros paneles.
function getOwnRowRect(nodeId: string, scope: HTMLElement): DOMRect | null {
  // Buscamos el elemento cuyo data-node-id coincide Y está dentro del scope
  const candidates = scope.querySelectorAll(`[data-node-id="${nodeId}"]`)
  for (const el of candidates) {
    const rowEl = el.querySelector(':scope > .node-row') as HTMLElement | null
             ?? el.querySelector('.node-row') as HTMLElement | null
    const rect = (rowEl ?? el as HTMLElement).getBoundingClientRect()
    if (rect.height > 0) return rect  // visible → es el que queremos
  }
  return null
}

// Calcula la selección usando el DOM real, restringido al root outliner
// del drag activo para no mezclar nodos de paneles distintos.
function computeGlobalSelection(
  anchorId: string,
  anchorMidY: number,  // midY de la fila del nodo ancla
  currentY: number     // Y actual del cursor
): Set<string> {
  // Usar el root outliner activo, o el documento completo como fallback
  const scope = _activeDragRoot ?? document.body

  const rows: { id: string; midY: number }[] = []
  const seen = new Set<string>()  // evitar duplicados si el mismo ID aparece varias veces

  scope.querySelectorAll('[data-node-id]').forEach(el => {
    const id = (el as HTMLElement).dataset.nodeId
    if (!id || seen.has(id)) return
    const rowEl = (el.querySelector(':scope > .node-row') ??
                   el.querySelector('.node-row')) as HTMLElement | null
    const rect = (rowEl ?? el as HTMLElement).getBoundingClientRect()
    if (rect.height === 0) return  // invisible (nodo colapsado, fuera del viewport, etc.)
    seen.add(id)
    rows.push({ id, midY: rect.top + rect.height / 2 })
  })

  rows.sort((a, b) => a.midY - b.midY)

  // La selección abarca desde anchorMidY hasta currentY (inclusive midpoints)
  const minY = Math.min(anchorMidY, currentY)
  const maxY = Math.max(anchorMidY, currentY)

  const result = new Set<string>([anchorId])  // ancla siempre incluida
  for (const { id, midY } of rows) {
    if (midY >= minY && midY <= maxY) result.add(id)
  }
  return result
}

// ── Drop trailer — zona de drop al final de cada lista de nodos ─────────────
// Sin esto, no se puede arrastrar un nodo para colocarlo DESPUÉS del último elemento.
interface DropTrailerProps {
  parentId: string | null
  lastSiblingOrder: number
}
function DropTrailer({ parentId, lastSiblingOrder }: DropTrailerProps) {
  const [over, setOver] = useState(false)
  return (
    <div
      style={{
        minHeight: 28,
        borderTop: over ? '2px solid var(--accent)' : '2px solid transparent',
        transition: 'border-color 0.1s',
      }}
      onDragOver={e => {
        const id = getDraggedId()
        if (!id) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={e => {
        e.preventDefault()
        setOver(false)
        const ids = getDraggedIds()
        const fallback = getDraggedId() || e.dataTransfer.getData('text/plain')
        const nodesToMove = ids.length > 0 ? ids : (fallback ? [fallback] : [])
        if (!nodesToMove.length) return
        nodesToMove.forEach((id, i) => {
          store.updateNode(id, {
            parentId,
            siblingOrder: lastSiblingOrder + (i + 1) * 1000,
          })
        })
        gClearSelected()
      }}
    />
  )
}

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
  /** Si true, deshabilita el filtro local (Cmd+F) — el padre gestiona el filtro globalmente */
  disableLocalFilter?: boolean
  /** IDs a ocultar de la raíz (p.ej. eventos GCal que se muestran en su propio bloque) */
  excludeIds?: Set<string>
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

export default function Outliner({ parentId, autoFocusEmpty, placeholder, className, filterText, filterMatchIds, filterAncestorIds, temporalSort, compact, excludeDiaryEntries, disableLocalFilter, excludeIds }: Props) {
  const s = useStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedIds = useGlobalSelection()
  // Refs estables para drag-to-select (declaradas aquí antes de nodes/flatVisibleIds)
  const ownNodeIdsRef      = useRef<Set<string>>(new Set())
  const flatVisibleIdsRef  = useRef<() => string[]>(() => [])
  // Drag-to-select state
  // isDragSelectingRef es el valor síncrono (evita stale closure en onMove).
  // isDragSelecting es el state para React (CSS, renders).
  const [isDragSelecting, setIsDragSelecting] = useState(false)
  const isDragSelectingRef = useRef(false)
  const didDragSelectRef   = useRef(false)  // true si el drag activó node-select (no solo clic)
  function startDragSelect() { isDragSelectingRef.current = true; didDragSelectRef.current = true; setIsDragSelecting(true) }
  function stopDragSelect()  { isDragSelectingRef.current = false; setIsDragSelecting(false) }
  const dragAnchorId = useRef<string | null>(null)
  const dragAnchorMidY = useRef<number>(0)  // midY del nodo ancla para computeGlobalSelection
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const selMenuPos = useSelectionMenuPos()
  const [localFilterOpen, setLocalFilterOpen] = useState(false)
  const [localFilterText, setLocalFilterText] = useState('')
  const localFilterRef = useRef<HTMLInputElement>(null)
  const [sortMode, setSortMode] = useState<SortMode>('none')
  const rawNodes = (() => {
    const all = s.children(parentId)
    // En WFHomeView (root), los diarios viven bajo 📅 Agenda — nunca en root
    // Excluir siempre nodos sistema (_system: true) del árbol visible
    let list = all.filter(n => { try { return !JSON.parse(n.extraData || '{}')._system } catch { return true } })
    list = excludeDiaryEntries ? list.filter(n => !n.isDiaryEntry) : list
    if (excludeIds && excludeIds.size > 0) list = list.filter(n => !excludeIds.has(n.id))
    // Con filtro activo: solo mostrar nodos que son match o ancestros de match.
    // Esto evita renderizar miles de nodos hermanos irrelevantes.
    if (filterMatchIds && filterMatchIds.size > 0) {
      list = list.filter(n => filterMatchIds.has(n.id) || filterAncestorIds?.has(n.id))
    }
    return list
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

  // Virtualización (ON por defecto). Solo el caso NORMAL: sin sort efímero, sin
  // temporalSort y sin filtro (el aplanado no replica esos; el filtrado tiene su
  // propio path). Y SOLO si el árbol es grande (> umbral): para árboles pequeños
  // el render recursivo clásico (probado, sin limitaciones de drag) va de sobra.
  const canVirtualizeBase = isVirtualizedOutliner()
    && sortMode === 'none' && !temporalSort
    && !filterMatchIds && !effectiveFilter
    && !(excludeIds && excludeIds.size > 0)
  const flatRows = useMemo(
    () => canVirtualizeBase ? flattenVisibleTree(s, parentId, { excludeDiaryEntries }) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canVirtualizeBase, parentId, excludeDiaryEntries, s.nodesVersion],
  )
  const useVirtual = canVirtualizeBase && flatRows.length > VIRTUALIZE_THRESHOLD

  // Actualizar refs de drag en cada render (sin re-registrar listeners)
  ownNodeIdsRef.current = new Set(nodes.map(n => n.id))
  flatVisibleIdsRef.current = flatVisibleIds

  // Cmd+Shift+F opens local filter when no external filterText prop is provided and local filter is not disabled
  // (Cmd+F alone abre el panel de filtro global en MainLayout)
  useEffect(() => {
    if (filterText !== undefined) return // external filter manages this
    if (disableLocalFilter) return // parent manages filtering globally (e.g. WFTopBar)
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'F') {
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
  }, [filterText, localFilterOpen, disableLocalFilter])

  // Auto-focus or create first node
  useEffect(() => {
    if (autoFocusEmpty && nodes.length === 0) {
      const n = store.createNode({ text: '', parentId, siblingOrder: 1 })
      setSelectedId(n.id)
    } else if (autoFocusEmpty && nodes.length > 0 && !selectedId) {
      setSelectedId(nodes[0].id)
    }
  }, [autoFocusEmpty, parentId]) // eslint-disable-line react-hooks/exhaustive-deps

  // N → crear hijo en el diario de hoy
  // El evento 'wf:new-child-today' lo despacha MainLayout cuando el usuario pulsa N.
  // Solo actúa el Outliner cuyo parentId coincide con el diario de hoy.
  useEffect(() => {
    function handleNewChild(e: Event) {
      const detail = (e as CustomEvent).detail as { parentId: string }
      if (detail?.parentId !== parentId) return
      const last = nodes[nodes.length - 1]
      // Si ya hay un nodo vacío al final (p.ej. creado por autoFocusEmpty),
      // solo focalizarlo — no crear uno nuevo (evita el doble nodo de Shift+Enter)
      if (last && !(last.text || '').trim()) {
        setSelectedId(last.id)
        return
      }
      // Crear nodo vacío al final
      const newOrder = last ? last.siblingOrder + 1 : Date.now()
      const n = store.createNode({ text: '', parentId, siblingOrder: newOrder })
      setSelectedId(n.id)
    }
    window.addEventListener('wf:new-child-today', handleNewChild)
    return () => window.removeEventListener('wf:new-child-today', handleNewChild)
  }, [parentId, nodes]) // eslint-disable-line react-hooks/exhaustive-deps

  // Foco en nodo específico tras mover una tarea (espejo queda en origen)
  useEffect(() => {
    function handleFocusNode(e: Event) {
      const { nodeId } = (e as CustomEvent).detail as { nodeId: string }
      // Solo actuar si el nodo es hijo de este Outliner (directo o a través del árbol)
      const target = store.getNode(nodeId)
      if (!target) return
      // Buscar si el nodo está en nuestra jerarquía
      const isOurs = (id: string): boolean => {
        if (id === parentId) return true
        const p = store.getNode(id)
        return p?.parentId ? isOurs(p.parentId) : false
      }
      if (isOurs(target.parentId || '')) setSelectedId(nodeId)
    }
    window.addEventListener('wf:focus-node', handleFocusNode)
    return () => window.removeEventListener('wf:focus-node', handleFocusNode)
  }, [parentId]) // eslint-disable-line react-hooks/exhaustive-deps

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


  // React onMouseDown — preventDefault salvo en drag handles.
  // Si el click viene del handle ⋮⋮ (node-drag-handle), NO prevenimos
  // para que HTML5 drag-and-drop pueda iniciarse (arrastrar al planificador).
  function handleContainerMouseDown(_e: React.MouseEvent) {
    // Sin preventDefault: el browser coloca el cursor naturalmente.
    // La selección de nodos durante drag se bloquea via onSelectStart + user-select:none.
  }

  // ── useEffect con deps [] ─────────────────────────────────────────────────
  // Los listeners se registran UNA SOLA VEZ al montar y se eliminan al desmontar.
  // Las variables que cambian entre renders (ownNodeIds, flatVisibleIds) se leen
  // desde refs estables (ownNodeIdsRef, flatVisibleIdsRef) para evitar stale closures.
  // Esto es CRÍTICO: si el effect dependiera de [nodes], se re-ejecutaría en cada
  // render (gSetSelected → re-render → nodes nuevo array → cleanup → _activeDragContainer=null).
  useEffect(() => {
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
      if (id && !ownNodeIdsRef.current.has(id)) return  // nodo de otro nivel → ignorar (usa ref)

      // Reclamar este drag para esta instancia
      _activeDragContainer = myContainer.current
      // Establecer el root outliner (para scopear las queries DOM)
      _activeDragRoot = myContainer.current ? findRootOutlinerContainer(myContainer.current) : null

      dragAnchorPos.current = e.clientY
      lastMouseY.current = e.clientY
      dragFromText.current = isDirectTextEl(target)
      dragAnchorId.current = id ?? (ownNodeIdsRef.current.size > 0 ? '__empty__' : null)

      if (id) {
        // Calcular el midY del nodo ancla usando el scope correcto
        // (evita coger el elemento de otro panel con el mismo data-node-id)
        const scope = _activeDragRoot ?? myContainer.current ?? document.body
        const anchorRect = getOwnRowRect(id, scope as HTMLElement)
        dragAnchorMidY.current = anchorRect
          ? anchorRect.top + anchorRect.height / 2
          : e.clientY
      }

      // NO llamamos e.preventDefault() — dejamos que el browser coloque el cursor
      // naturalmente en clicks simples. El bloqueo de text-selection (clase
      // outliner-drag-active + user-select:none + onSelectStart) SOLO se aplica cuando
      // el gesto NO empieza sobre texto editable. Si empieza sobre texto, conservamos
      // el comportamiento nativo: caret al hacer clic, doble-clic = palabra, y selección
      // de texto al arrastrar. El drag-select de nodos se inicia desde bullets/gutter/vacío.
      if (!dragFromText.current) {
        document.body.classList.add('outliner-drag-active')
        document.body.style.userSelect = 'none'
        ;(document.body.style as unknown as Record<string,string>).webkitUserSelect = 'none'
      }
      // Si había una drag-select activa de antes, limpiar al iniciar nuevo click
      if (_gSelectedIds.size > 0) gClearSelected()
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
        const flat = flatVisibleIdsRef.current()
        const anchorId = e.clientY < dragAnchorPos.current ? flat[flat.length - 1] : flat[0]
        if (!anchorId) return
        dragAnchorId.current = anchorId
        dragFromText.current = false
        // Calcular midY del ancla para que computeGlobalSelection funcione correctamente
        const scope = _activeDragRoot ?? myContainer.current ?? document.body
        const anchorRect = getOwnRowRect(anchorId, scope as HTMLElement)
        dragAnchorMidY.current = anchorRect
          ? anchorRect.top + anchorRect.height / 2
          : dragAnchorPos.current
        startDragSelect(); setSelectedId(null)
        gSetSelected(new Set([anchorId]))
        return
      }

      // Gesto iniciado sobre texto editable → selección de texto nativa del browser,
      // NO drag-select de nodos. El usuario que arrastra sobre texto está seleccionando
      // texto; el drag-select de nodos se hace desde bullet/gutter/espacio vacío.
      if (dragFromText.current) return

      const anchorId = dragAnchorId.current!

      // ── Drag de nodos (bullet / gutter / espacio vacío) ─────────────────────
      // El gesto NO empezó sobre texto, así que bloqueamos text-selection y
      // convertimos el arrastre vertical en selección de nodos.
      // Umbral de 5px para distinguir clic de drag.
      if (!isDragSelectingRef.current && Math.abs(e.clientY - dragAnchorPos.current) <= 4) return
      if (!isDragSelectingRef.current) {
        startDragSelect(); setSelectedId(null)
        gSetSelected(new Set([anchorId]))
      }
      gSetSelected(computeGlobalSelection(anchorId, dragAnchorMidY.current, e.clientY))
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
    function onUp(e: MouseEvent) {
      const wasDrag = didDragSelectRef.current
      didDragSelectRef.current = false

      // Restaurar user-select y clase de drag
      document.body.classList.remove('outliner-drag-active')
      document.body.style.userSelect = ''
      ;(document.body.style as unknown as Record<string,string>).webkitUserSelect = ''

      if (_activeDragContainer === myContainer.current) {
        _activeDragContainer = null
        _activeDragRoot = null
      }
      dragAnchorId.current = null
      dragFromText.current = false
      stopDragSelect()

      if (!wasDrag) {
        // Click simple: limpiar selección, EXCEPTO:
        // - handle ⋮⋮: gestiona su propio toggle
        // - context-menu: las acciones del menú necesitan la selección activa
        const upTarget = e.target as HTMLElement
        if (
          !upTarget.closest?.('.node-drag-handle') &&
          !upTarget.closest?.('.context-menu') &&
          !upTarget.closest?.('.modal-overlay')   // MoveNodeModal y otros modales
        ) {
          gClearSelected()
        }
      }
    }

    // ── selectstart — prevenir selección de texto nativa durante node-drag ──
    // Bloqueamos SOLO cuando el gesto NO empezó sobre texto editable (ancla activa
    // + !dragFromText). Así el drag-select de nodos (desde bullet/gutter/vacío) no
    // deja que el browser robe los mousemove para text-selection, mientras que los
    // gestos sobre texto conservan caret, doble-clic (palabra) y selección nativa.
    function onSelectStart(e: Event) {
      if (dragAnchorId.current && !dragFromText.current) e.preventDefault()
    }

    document.addEventListener('mousedown',   onDown, { capture: true })
    document.addEventListener('mousemove',   onMove)
    document.addEventListener('dragstart',   onDragStart)
    document.addEventListener('mouseup',     onUp)
    document.addEventListener('selectstart', onSelectStart)
    return () => {
      if (_activeDragContainer === myContainer.current) {
        _activeDragContainer = null
        _activeDragRoot = null
      }
      document.removeEventListener('mousedown',   onDown, { capture: true })
      document.removeEventListener('mousemove',   onMove)
      document.removeEventListener('dragstart',   onDragStart)
      document.removeEventListener('mouseup',     onUp)
      document.removeEventListener('selectstart', onSelectStart)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps — deps [] intencional: registrar una sola vez y leer valores dinámicos via refs

  // ── Teclado sobre multi-selección ─────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // ⌘A — seleccionar todos los nodos visibles (independiente de si hay selección activa)
      if ((e.metaKey || e.ctrlKey) && e.key === 'a' && !e.shiftKey) {
        const active = document.activeElement as HTMLElement | null
        const isInputFocused = active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA' || active?.isContentEditable
        if (!isInputFocused) {
          e.preventDefault()
          e.stopPropagation()
          gSetSelected(new Set(flatVisibleIdsRef.current()))
          return
        }
      }
      if (_gSelectedIds.size === 0) return
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        e.stopPropagation()
        const ids = [..._gSelectedIds] // snapshot antes de mutar (trashNode notifica)
        gClearSelected()
        for (const id of ids) trashNode(id)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        const flat = flatVisibleIdsRef.current()
        const texts = flat
          .filter(id => _gSelectedIds.has(id))
          .map(id => store.getNode(id)?.text || '')
          .filter(Boolean)
          .join('\n')
        navigator.clipboard.writeText(texts).catch(() => {})
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        e.stopPropagation()
        const flat = flatVisibleIdsRef.current()
        const selected = flat.filter(id => _gSelectedIds.has(id))
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
        gClearSelected()
      }
      if (e.key === 'Escape') {
        if (_gSelectedIds.size > 0) {
          // Hay selección activa: limpiarla y consumir el evento
          // para que MainLayout no navegue hacia arriba
          e.stopPropagation()
          e.preventDefault()
          gClearSelected()
        }
      }
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps — deps [] intencional: leer _gSelectedIds y flatVisibleIdsRef directamente

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

  // Shift+click: range-select desde el último nodo seleccionado/enfocado hasta el clickeado.
  // Si no hay selección previa, simplemente añade/quita el nodo.
  const handleShiftSelect = useCallback((id: string) => {
    const flat = flatVisibleIds()
    const clickedIdx = flat.indexOf(id)
    if (clickedIdx === -1) return

    // Si hay exactamente un nodo ya seleccionado o hay un selectedId,
    // hacer range-select entre ese ancla y el clickeado.
    const anchor = selectedId ?? (_gSelectedIds.size === 1 ? [..._gSelectedIds][0] : null)
    if (anchor && anchor !== id) {
      const anchorIdx = flat.indexOf(anchor)
      if (anchorIdx !== -1) {
        const lo = Math.min(anchorIdx, clickedIdx)
        const hi = Math.max(anchorIdx, clickedIdx)
        gSetSelected(new Set(flat.slice(lo, hi + 1)))
        return
      }
    }

    // Sin ancla clara: toggle individual
    const next = new Set(_gSelectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    gSetSelected(next)
  }, [selectedId, flatVisibleIds]) // eslint-disable-line react-hooks/exhaustive-deps

  // Multi-select: borrar seleccionados (también usado por teclado)
  function handleDeleteSelected() {
    for (const id of selectedIds) trashNode(id)
    gClearSelected()
  }

  return (
    <>
      {localFilterOpen && filterText === undefined && !disableLocalFilter && (
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
          <div className="outliner-placeholder" style={{ cursor: 'text' }} onClick={() => {
            const n = store.createNode({ text: '', parentId, siblingOrder: 1 })
            setSelectedId(n.id)
          }}>{placeholder}</div>
        )}
        {nodes.length === 0 && !placeholder && !autoFocusEmpty && (
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
        {useVirtual ? (
          <VirtualOutlinerList
            rows={flatRows}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            handleSelectNext={handleSelectNext}
            handleShiftSelect={handleShiftSelect}
            selectedIds={selectedIds}
            effectiveFilter={effectiveFilter}
          />
        ) : (
          <>
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
            {/* Zona de drop al final — permite arrastrar después del último nodo */}
            {nodes.length > 0 && (
              <DropTrailer
                parentId={parentId}
                lastSiblingOrder={Math.max(...nodes.map(n => n.siblingOrder))}
              />
            )}
          </>
        )}
      </div>

      {/* WF-style: no hay barra inferior. La multi-selección se opera
          solo con el teclado: Delete borrar · Tab indentar · Shift+Tab
          desindentar · ⌘C copiar · Escape limpiar.
          Los nodos seleccionados se resaltan con fondo azul via CSS. */}

      {/* Menú flotante de selección — se abre al hacer clic en cualquier handle */}
      {selMenuPos && selectedIds.size > 0 && (() => {
        const firstId = [...selectedIds][0]
        const firstNode = store.getNode(firstId)
        if (!firstNode) return null
        return (
          <NodeContextMenu
            node={firstNode}
            x={selMenuPos.x}
            y={selMenuPos.y}
            selectedIds={selectedIds}
            onClose={() => {
              _selMenuPos = null
              _selMenuListeners.forEach(fn => fn())
              gClearSelected()
            }}
            onNavigate={navigate}
            onSelect={setSelectedId}
          />
        )
      })()}
    </>
  )
}
