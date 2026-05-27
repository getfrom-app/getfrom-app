/**
 * WFHomeView — Vista raíz estilo Workflowy
 * Muestra los nodos raíz (parentId = null) como outliner puro.
 * Al primer arranque en WF mode, colapsa todos los nodos raíz.
 */
import { useMemo, useEffect } from 'react'
import Outliner from '../outliner/Outliner'
import { useStore, store } from '../../store/nodeStore'
import { applyWFFilter, isSmartQuery } from '../../utils/wfFilter'
import { ensureDayPath } from '../../utils/agendaHelper'

const WF_COLLAPSE_DONE_KEY = 'from_wf_initial_collapse_done'
const WF_AGENDA_INIT_KEY   = 'from_wf_agenda_initialized'

interface Props {
  filterText?: string
}

export default function WFHomeView({ filterText }: Props) {
  const s = useStore()

  // ── Auto-inicializar Agenda: crea nota de hoy al primer arranque ────────
  useEffect(() => {
    if (localStorage.getItem(WF_AGENDA_INIT_KEY)) return
    // Esperar a que el store cargue
    const tryInit = () => {
      if (store.children(null).filter(n => !n.deletedAt).length === 0) return false
      // Solo inicializar si no existe ya ninguna diary entry de hoy
      const today = store.todayDiary()
      if (!today) {
        ensureDayPath(new Date())  // crea Agenda → Año → Mes → Día
      }
      localStorage.setItem(WF_AGENDA_INIT_KEY, '1')
      return true
    }
    if (!tryInit()) {
      const unsub = store.subscribe(() => {
        if (tryInit()) unsub()
      })
      return unsub
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Colapsar root nodes al primer arranque en WF mode ──────────────────
  useEffect(() => {
    if (localStorage.getItem(WF_COLLAPSE_DONE_KEY)) return
    // Esperar a que el store cargue (nodes > 0)
    const check = () => {
      const roots = store.children(null).filter(n => !n.deletedAt)
      if (roots.length === 0) return
      // Colapsar todos los root nodes que tengan hijos
      roots.forEach(root => {
        const kids = store.children(root.id).filter(n => !n.deletedAt)
        if (kids.length > 0 && !root.isCollapsed) {
          store.updateNode(root.id, { isCollapsed: true })
        }
      })
      localStorage.setItem(WF_COLLAPSE_DONE_KEY, '1')
    }
    // Si el store ya tiene datos, colapsar ahora
    if (store.children(null).filter(n => !n.deletedAt).length > 0) {
      check()
    } else {
      // Esperar la carga inicial
      const unsub = store.subscribe(() => {
        if (store.children(null).filter(n => !n.deletedAt).length > 0) {
          check()
          unsub()
        }
      })
      return unsub
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filtro inteligente ─────────────────────────────────────────────────
  const filterResult = useMemo(() => {
    if (!filterText?.trim()) return null
    if (!isSmartQuery(filterText)) return null
    return applyWFFilter(s.nodes, filterText)
  }, [filterText, s.nodes])

  const isFiltering = !!filterText?.trim()

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
      />
    </div>
  )
}
