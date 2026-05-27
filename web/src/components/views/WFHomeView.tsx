/**
 * WFHomeView — Vista raíz estilo Workflowy
 * Sin filtro: árbol normal. Con filtro: vista árbol / lista plana / calendario.
 */
import { useMemo, useEffect, useState } from 'react'
import Outliner from '../outliner/Outliner'
import { useStore, store } from '../../store/nodeStore'
import { applyWFFilter, isSmartQuery } from '../../utils/wfFilter'
import { FilterViewSwitcher, TableView, KanbanView, CalendarView } from './FilterResultsView'
import type { FilterView } from './FilterResultsView'

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

  // ── Colapsar root nodes al primer arranque ─────────────────────────────────
  useEffect(() => {
    if (!storeReady) return
    if (localStorage.getItem(WF_COLLAPSE_DONE_KEY)) return
    const roots = store.children(null).filter(n => !n.deletedAt)
    if (roots.length === 0) return
    roots.forEach(root => {
      const kids = store.children(root.id).filter(n => !n.deletedAt)
      if (kids.length > 0 && !root.isCollapsed) store.updateNode(root.id, { isCollapsed: true })
    })
    localStorage.setItem(WF_COLLAPSE_DONE_KEY, '1')
  }, [storeReady]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filtro inteligente ─────────────────────────────────────────────────────
  const filterResult = useMemo(() => {
    if (!filterText?.trim()) return null
    if (!isSmartQuery(filterText)) return null
    return applyWFFilter(s.nodes, filterText)
  }, [filterText, s.nodes.size]) // eslint-disable-line react-hooks/exhaustive-deps

  const isFiltering = !!filterText?.trim()
  const matchCount = filterResult?.matchIds.size ?? 0

  if (!storeReady) return <div className="wf-home-view" />

  return (
    <div className="wf-home-view">
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
          parentId={null}
          autoFocusEmpty={false}
          placeholder="Escribe algo… o pulsa Enter para crear un nodo"
          filterText={filterResult ? undefined : (isFiltering ? filterText : undefined)}
          filterMatchIds={filterResult?.matchIds}
          filterAncestorIds={filterResult?.ancestorIds}
          excludeDiaryEntries
        />
      </div>
    </div>
  )
}
