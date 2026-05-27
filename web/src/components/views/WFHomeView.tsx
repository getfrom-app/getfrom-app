/**
 * WFHomeView — Vista raíz estilo Workflowy
 * Muestra los nodos raíz (parentId = null) como outliner puro.
 * Al primer arranque en WF mode, colapsa todos los nodos raíz.
 *
 * Loading gate: no renderiza el Outliner hasta que store.isLoaded === true,
 * evitando el flash del nodo diario que se crea en root durante initialLoad().
 */
import { useMemo, useEffect, useState } from 'react'
import Outliner from '../outliner/Outliner'
import { useStore, store } from '../../store/nodeStore'
import { applyWFFilter, isSmartQuery } from '../../utils/wfFilter'

const WF_COLLAPSE_DONE_KEY = 'from_wf_initial_collapse_done'

interface Props {
  filterText?: string
}

export default function WFHomeView({ filterText }: Props) {
  const s = useStore()

  // ── Loading gate ───────────────────────────────────────────────────────
  // No renderizamos el Outliner hasta que initialLoad() haya terminado.
  // Nota: excludeDiaryEntries en el Outliner garantiza que los diarios
  // nunca aparezcan en root aunque haya un render temprano.
  const [storeReady, setStoreReady] = useState(() => store.isLoaded)

  useEffect(() => {
    if (storeReady) return
    const unsub = store.subscribe(() => {
      if (store.isLoaded) setStoreReady(true)
    })
    return () => unsub()
  }, [storeReady])

  // ── Colapsar root nodes al primer arranque en WF mode ──────────────────
  useEffect(() => {
    if (!storeReady) return
    if (localStorage.getItem(WF_COLLAPSE_DONE_KEY)) return
    const roots = store.children(null).filter(n => !n.deletedAt)
    if (roots.length === 0) return
    roots.forEach(root => {
      const kids = store.children(root.id).filter(n => !n.deletedAt)
      if (kids.length > 0 && !root.isCollapsed) {
        store.updateNode(root.id, { isCollapsed: true })
      }
    })
    localStorage.setItem(WF_COLLAPSE_DONE_KEY, '1')
  }, [storeReady]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filtro inteligente ─────────────────────────────────────────────────
  // s.nodes es la misma referencia Map en cada render (mutada in-place), así
  // que usamos s.nodes.size como dep numérica para detectar cambios reales.
  // El propio applyWFFilter es O(n) — seguro para colecciones de tamaño normal.
  const filterResult = useMemo(() => {
    if (!filterText?.trim()) return null
    if (!isSmartQuery(filterText)) return null
    return applyWFFilter(s.nodes, filterText)
  }, [filterText, s.nodes.size]) // eslint-disable-line react-hooks/exhaustive-deps

  const isFiltering = !!filterText?.trim()

  // No renderizar hasta que el store esté listo
  if (!storeReady) return <div className="wf-home-view" />

  return (
    <div className="wf-home-view">
      {filterResult?.hasFilter && filterResult.matchIds.size === 0 && (
        <div className="wf-filter-empty">
          Sin resultados para <strong>"{filterText}"</strong>
        </div>
      )}
      {filterResult?.hasFilter && filterResult.matchIds.size > 0 && (
        <div className="wf-filter-results-hint">
          {filterResult.matchIds.size} resultado{filterResult.matchIds.size !== 1 ? 's' : ''}
          {' '}· <button
            className="wf-filter-clear-btn"
            onClick={() => window.dispatchEvent(new CustomEvent('wf:clear-filter'))}
          >Limpiar</button>
        </div>
      )}

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
  )
}
