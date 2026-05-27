/**
 * WFHomeView — Vista raíz estilo Workflowy
 * Muestra los nodos raíz (parentId = null) como outliner puro.
 * Reemplaza DiaryRedirect en la rama experiment/workflowy.
 */
import Outliner from '../outliner/Outliner'
import { useStore } from '../../store/nodeStore'
import { applyWFFilter } from '../../utils/wfFilter'

interface Props {
  filterText?: string
}

export default function WFHomeView({ filterText }: Props) {
  const s = useStore()

  const filterResult = filterText
    ? applyWFFilter(s.nodes, filterText)
    : null

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
        </div>
      )}
      <Outliner
        parentId={null}
        autoFocusEmpty={false}
        placeholder="Escribe algo… o pulsa Enter para crear un nodo"
        filterText={filterText}
      />
    </div>
  )
}
