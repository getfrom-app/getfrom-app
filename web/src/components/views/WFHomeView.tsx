/**
 * WFHomeView — Vista raíz estilo Workflowy
 * Muestra los nodos raíz (parentId = null) como outliner puro.
 * Reemplaza DiaryRedirect en la rama experiment/workflowy.
 */
import Outliner from '../outliner/Outliner'

interface Props {
  filterText?: string
}

export default function WFHomeView({ filterText }: Props) {
  return (
    <div className="wf-home-view">
      <Outliner
        parentId={null}
        autoFocusEmpty={false}
        placeholder="Escribe algo… o pulsa Enter para crear un nodo"
        filterText={filterText}
      />
    </div>
  )
}
