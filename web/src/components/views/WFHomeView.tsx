/**
 * WFHomeView — Vista raíz estilo Workflowy
 * Sin filtro: árbol normal. Con filtro: vista árbol / lista plana / calendario.
 */
import { useMemo, useEffect, useState, useCallback } from 'react'
import Outliner from '../outliner/Outliner'
import { useStore, store } from '../../store/nodeStore'
import { applyWFFilter, isSmartQuery } from '../../utils/wfFilter'
import { normalizeSynonyms } from '../../utils/filterInterpreter'
import { FilterViewSwitcher, TableView, KanbanView, CalendarView } from './FilterResultsView'
import type { FilterView } from './FilterResultsView'
import { getPresignedUpload } from '../../api/client'
import { AGENDA_ROOT_NAME } from '../../utils/agendaHelper'

const WF_COLLAPSE_DONE_KEY = 'from_wf_initial_collapse_done'
const FILTER_VIEW_KEY = 'from_wf_filter_view'

interface Props {
  filterText?: string
  contextFilterId?: string | null
}

// Convierte el texto de un nodo contexto al slug usado en node.types
function ctxTextToSlug(text: string) {
  return text.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-\/]/g, '')
}

// Construye filterMatchIds + ancestorIds para filtrar por contexto.
// Los contextos pueden estar guardados como:
//   1. ID del nodo contexto (vía @ picker en el outliner)
//   2. Slug del texto (vía texto manual @Nombre → auto-sync)
function buildContextFilter(contextNodeId: string): { matchIds: Set<string>; ancestorIds: Set<string> } | null {
  const ctxNode = store.getNode(contextNodeId)
  if (!ctxNode) return null
  const slug = ctxTextToSlug(ctxNode.text)
  const matchIds = new Set<string>()
  const ancestorIds = new Set<string>()
  store.allActive().forEach(n => {
    if (n.deletedAt) return
    const types = n.types || []
    // Buscar por ID del nodo (@ picker) O por slug de texto (escritura manual)
    if (types.includes(contextNodeId) || types.includes(slug)) matchIds.add(n.id)
  })
  // Recoger todos los ancestros para que el árbol muestre el camino
  matchIds.forEach(id => {
    let cur = store.getNode(id)
    while (cur?.parentId) {
      ancestorIds.add(cur.parentId)
      cur = store.getNode(cur.parentId)
    }
  })
  return { matchIds, ancestorIds }
}

export default function WFHomeView({ filterText, contextFilterId }: Props) {
  const s = useStore()

  // ── Loading gate ──────────────────────────────────────────────────────────
  const [storeReady, setStoreReady] = useState(() => store.isLoaded)
  useEffect(() => {
    if (storeReady) return
    const unsub = store.subscribe(() => { if (store.isLoaded) setStoreReady(true) })
    return () => unsub()
  }, [storeReady])

  // ── Vista activa del filtro ───────────────────────────────────────────────
  const [filterView, setFilterView] = useState<FilterView>(
    () => (localStorage.getItem(FILTER_VIEW_KEY) as FilterView) || 'lista'
  )
  function changeFilterView(v: FilterView) {
    setFilterView(v)
    localStorage.setItem(FILTER_VIEW_KEY, v)
  }

  // ── Nodo Agenda — la vista raíz muestra sus hijos directamente ───────────
  const agendaNode = useMemo(() => {
    if (!storeReady) return null
    return store.children(null).find(n => !n.deletedAt && n.text === AGENDA_ROOT_NAME) ?? null
  }, [storeReady, s.nodes.size]) // eslint-disable-line react-hooks/exhaustive-deps

  const agendaId = agendaNode?.id ?? null

  // ── Colapsar root nodes al primer arranque ─────────────────────────────────
  useEffect(() => {
    if (!storeReady || !agendaId) return
    if (localStorage.getItem(WF_COLLAPSE_DONE_KEY)) return
    const roots = store.children(agendaId).filter(n => !n.deletedAt)
    if (roots.length === 0) return
    roots.forEach(root => {
      const kids = store.children(root.id).filter(n => !n.deletedAt)
      if (kids.length > 0 && !root.isCollapsed) store.updateNode(root.id, { isCollapsed: true })
    })
    localStorage.setItem(WF_COLLAPSE_DONE_KEY, '1')
  }, [storeReady, agendaId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filtro inteligente ─────────────────────────────────────────────────────
  // ── Filtro por contexto (sidebar) ─────────────────────────────────────────
  const contextFilter = useMemo(() => {
    if (!contextFilterId) return null
    return buildContextFilter(contextFilterId)
  }, [contextFilterId, s.nodes.size]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filtro por texto ───────────────────────────────────────────────────────
  const filterResult = useMemo(() => {
    if (contextFilter) return null // el filtro de contexto tiene prioridad
    if (!filterText?.trim()) return null
    const effective = normalizeSynonyms(filterText) ?? filterText
    if (!isSmartQuery(effective)) return null
    return applyWFFilter(s.nodes, effective)
  }, [filterText, contextFilter, s.nodes.size]) // eslint-disable-line react-hooks/exhaustive-deps

  const isFiltering = !!filterText?.trim() || !!contextFilter
  const matchCount = contextFilter?.matchIds.size ?? filterResult?.matchIds.size ?? 0

  // Los ids activos (ya sea de contexto o de texto)
  const activeMatchIds = contextFilter?.matchIds ?? filterResult?.matchIds
  const activeAncestorIds = contextFilter?.ancestorIds ?? filterResult?.ancestorIds

  // ── Drag & drop de archivos desde el Finder → crear nodos ─────────────────
  const [isDragOver, setIsDragOver] = useState(false)

  const uploadFileAsNode = useCallback(async (file: File, parentId: string | null = null) => {
    // Crear nodo con el nombre del archivo
    const siblings = store.children(parentId)
    const maxOrder = siblings.length > 0 ? Math.max(...siblings.map(s => s.siblingOrder)) : 0
    const newNode = store.createNode({
      text: file.name.replace(/\.[^.]+$/, ''), // nombre sin extensión
      parentId,
      siblingOrder: maxOrder + 1,
    })
    try {
      const { uploadUrl, publicUrl } = await getPresignedUpload(file.name, file.type || 'application/octet-stream')
      await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } })
      const resourceType = file.type.startsWith('image/') ? 'image'
        : file.type === 'application/pdf' ? 'pdf' : 'file'
      store.updateNode(newNode.id, {
        isResource: true,
        extraData: JSON.stringify({ _resource: true, _resourceUrl: publicUrl, _resourceType: resourceType }),
      })
    } catch (e) {
      console.error('Upload failed', e)
    }
  }, [])

  function handleDragOver(e: React.DragEvent) {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      setIsDragOver(true)
    }
  }
  function handleDragLeave() { setIsDragOver(false) }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    if (!store.isLoaded) return
    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return
    files.forEach(file => uploadFileAsNode(file, agendaId))
  }

  if (!storeReady) return <div className="wf-home-view" />

  return (
    <div
      className={`wf-home-view${isDragOver ? ' wf-home-view--drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Barra de resultados con selector de vista */}
      {isFiltering && matchCount === 0 && (
        <div className="wf-filter-empty">
          {contextFilter
            ? 'Sin nodos con este contexto'
            : <>Sin resultados para <strong>"{filterText}"</strong></>}
        </div>
      )}
      {!contextFilter && filterResult?.hasFilter && matchCount > 0 && (
        <FilterViewSwitcher
          view={filterView}
          onChange={changeFilterView}
          count={matchCount}
          onClear={() => window.dispatchEvent(new CustomEvent('wf:clear-filter'))}
        />
      )}

      {/* Vistas alternativas cuando hay filtro de texto activo */}
      {!contextFilter && filterResult?.hasFilter && matchCount > 0 && filterView === 'tabla' && (
        <TableView matchIds={filterResult.matchIds} />
      )}
      {!contextFilter && filterResult?.hasFilter && matchCount > 0 && filterView === 'kanban' && (
        <KanbanView matchIds={filterResult.matchIds} />
      )}
      {!contextFilter && filterResult?.hasFilter && matchCount > 0 && filterView === 'calendario' && (
        <CalendarView matchIds={filterResult.matchIds} />
      )}

      {/* Árbol — vista lista (default) o sin filtro */}
      <div style={{ display: (!contextFilter && filterResult?.hasFilter && matchCount > 0 && filterView !== 'lista') ? 'none' : 'block' }}>
        <Outliner
          parentId={agendaId}
          autoFocusEmpty={false}
          placeholder="Escribe algo… o pulsa Enter para crear un nodo"
          filterText={activeMatchIds ? undefined : (isFiltering ? filterText : undefined)}
          filterMatchIds={activeMatchIds}
          filterAncestorIds={activeAncestorIds}
          disableLocalFilter
        />
      </div>
    </div>
  )
}
