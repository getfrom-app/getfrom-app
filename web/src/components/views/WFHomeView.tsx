/**
 * WFHomeView — Vista raíz estilo Workflowy
 *
 * Sin filtro: árbol normal con nodos raíz.
 * Con filtro smart (tarea, pendiente, hoy…): lista PLANA de resultados,
 * igual que Workflowy. No se expande el árbol completo, lo que evita
 * renderizar miles de nodos y bloquear el hilo principal.
 */
import { useMemo, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Outliner from '../outliner/Outliner'
import { useStore, store } from '../../store/nodeStore'
import { applyWFFilter, isSmartQuery } from '../../utils/wfFilter'
import type { Node } from '../../types'

const WF_COLLAPSE_DONE_KEY = 'from_wf_initial_collapse_done'

interface Props {
  filterText?: string
}

/** Resultado individual en la lista plana de filtro */
function FilterResultRow({ node }: { node: Node }) {
  const navigate = useNavigate()
  const parent = node.parentId ? store.getNode(node.parentId) : null
  const isTask = node.status !== null
  const isDone = node.status === 'done'

  return (
    <div
      className="wf-filter-row"
      onClick={() => navigate(`/node/${node.id}`)}
    >
      <span className="wf-filter-row-bullet">
        {isTask ? (isDone ? '✓' : '○') : '•'}
      </span>
      <div className="wf-filter-row-content">
        <span className="wf-filter-row-text" style={{ textDecoration: isDone ? 'line-through' : undefined, opacity: isDone ? 0.5 : 1 }}>
          {node.text || 'Sin título'}
        </span>
        {parent && (
          <span className="wf-filter-row-parent">
            {parent.text}
          </span>
        )}
        {node.due && (
          <span className="wf-filter-row-due">
            {new Date(node.due).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>
    </div>
  )
}

export default function WFHomeView({ filterText }: Props) {
  const s = useStore()

  // ── Loading gate ───────────────────────────────────────────────────────
  const [storeReady, setStoreReady] = useState(() => store.isLoaded)

  useEffect(() => {
    if (storeReady) return
    const unsub = store.subscribe(() => {
      if (store.isLoaded) setStoreReady(true)
    })
    return () => unsub()
  }, [storeReady])

  // ── Colapsar root nodes al primer arranque ─────────────────────────────
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
  // Usamos s.nodes.size (número) en lugar de s.nodes (misma referencia Map)
  // para que el memo detecte cambios reales cuando el store se actualiza.
  const filterResult = useMemo(() => {
    if (!filterText?.trim()) return null
    if (!isSmartQuery(filterText)) return null
    return applyWFFilter(s.nodes, filterText)
  }, [filterText, s.nodes.size]) // eslint-disable-line react-hooks/exhaustive-deps

  const isFiltering = !!filterText?.trim()

  if (!storeReady) return <div className="wf-home-view" />

  // ── Vista con filtro smart → lista PLANA ──────────────────────────────
  // En lugar de expandir el árbol completo (que puede bloquear el hilo
  // con miles de nodos), renderizamos solo los resultados como lista plana.
  if (filterResult?.hasFilter) {
    const matchNodes = Array.from(filterResult.matchIds)
      .map(id => store.getNode(id))
      .filter((n): n is Node => !!n && !n.deletedAt)

    return (
      <div className="wf-home-view">
        <div className="wf-filter-results-hint">
          {matchNodes.length === 0
            ? <>Sin resultados para <strong>"{filterText}"</strong></>
            : <>{matchNodes.length} resultado{matchNodes.length !== 1 ? 's' : ''} · <button className="wf-filter-clear-btn" onClick={() => window.dispatchEvent(new CustomEvent('wf:clear-filter'))}>Limpiar</button></>
          }
        </div>
        <div className="wf-filter-flat-list">
          {matchNodes.map(node => (
            <FilterResultRow key={node.id} node={node} />
          ))}
        </div>
      </div>
    )
  }

  // ── Vista normal → árbol ──────────────────────────────────────────────
  return (
    <div className="wf-home-view">
      <Outliner
        parentId={null}
        autoFocusEmpty={false}
        placeholder="Escribe algo… o pulsa Enter para crear un nodo"
        filterText={isFiltering ? filterText : undefined}
        excludeDiaryEntries
      />
    </div>
  )
}
