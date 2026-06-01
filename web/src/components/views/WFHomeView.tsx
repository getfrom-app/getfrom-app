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
}

export default function WFHomeView({ filterText }: Props) {
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
  const filterResult = useMemo(() => {
    if (!filterText?.trim()) return null
    // Normalizar sinónimos internamente — el usuario ve su texto original
    const effective = normalizeSynonyms(filterText) ?? filterText
    if (!isSmartQuery(effective)) return null
    return applyWFFilter(s.nodes, effective)
  }, [filterText, s.nodes.size]) // eslint-disable-line react-hooks/exhaustive-deps

  const isFiltering = !!filterText?.trim()
  const matchCount = filterResult?.matchIds.size ?? 0

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
      {filterResult?.hasFilter && matchCount === 0 && (
        <div className="wf-filter-empty">
          Sin resultados para <strong>"{filterText}"</strong>
        </div>
      )}
      {filterResult?.hasFilter && matchCount > 0 && (
        <FilterViewSwitcher
          view={filterView}
          onChange={changeFilterView}
          count={matchCount}
          onClear={() => window.dispatchEvent(new CustomEvent('wf:clear-filter'))}
        />
      )}

      {/* Vistas alternativas cuando hay filtro activo */}
      {filterResult?.hasFilter && matchCount > 0 && filterView === 'tabla' && (
        <TableView matchIds={filterResult.matchIds} />
      )}
      {filterResult?.hasFilter && matchCount > 0 && filterView === 'kanban' && (
        <KanbanView matchIds={filterResult.matchIds} />
      )}
      {filterResult?.hasFilter && matchCount > 0 && filterView === 'calendario' && (
        <CalendarView matchIds={filterResult.matchIds} />
      )}

      {/* Árbol — vista lista (default) o sin filtro */}
      <div style={{ display: (filterResult?.hasFilter && matchCount > 0 && filterView !== 'lista') ? 'none' : 'block' }}>
        <Outliner
          parentId={agendaId}
          autoFocusEmpty={false}
          placeholder="Escribe algo… o pulsa Enter para crear un nodo"
          filterText={filterResult ? undefined : (isFiltering ? filterText : undefined)}
          filterMatchIds={filterResult?.matchIds}
          filterAncestorIds={filterResult?.ancestorIds}
          disableLocalFilter
        />
      </div>
    </div>
  )
}
