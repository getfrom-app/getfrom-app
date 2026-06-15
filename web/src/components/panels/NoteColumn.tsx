// NoteColumn — columna derecha de una nota NORMAL (no diaria). Muestra el bloque
// «Movidos»: nodos que se han movido a esta nota y aún no se han colocado en el
// lienzo. Se arrastran al lienzo para colocarlos (al fijarlos, salen de aquí).

import { useNavigate } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'
import { renderInline } from '../outliner/InlineRenderer'
import { isMovedNode, nodeHasPin } from '../../utils/dayColumn'
import { trashNode } from '../../utils/papeleraHelper'

const TrashIcon = (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10" />
  </svg>
)

export default function NoteColumn({ node }: { node: Node }) {
  useStore()
  const navigate = useNavigate()

  // Movidos = hijos marcados `_moved` y aún sin colocar en el lienzo.
  const moved = store.children(node.id).filter(c => isMovedNode(c) && !nodeHasPin(c))

  return (
    <div className="dc-group">
      <div className="dc-group-label">Movidos</div>
      {moved.length === 0 ? (
        <div style={{ padding: '4px 10px 8px', fontSize: 12, color: 'var(--text-tertiary, #aaa)' }}>
          Mueve nodos a esta nota y aparecerán aquí.
        </div>
      ) : moved.map(c => (
        <div
          key={c.id}
          className="dc-row dc-row--capture"
          data-node-id={c.id}
          draggable
          onDragStart={e => { e.dataTransfer.setData('text/plain', c.id); e.dataTransfer.effectAllowed = 'copy' }}
          onClick={() => navigate(`/node/${c.id}`)}
          onContextMenu={e => { e.preventDefault(); e.stopPropagation(); trashNode(c.id) }}
          title="Arrastra al lienzo para colocarlo"
        >
          <span className="dc-capture-grip">⠿</span>
          <span className="dc-text">{c.text ? renderInline(c.text) : 'Nodo'}</span>
          <button className="dc-del" title="Eliminar" onClick={e => { e.stopPropagation(); trashNode(c.id) }}>{TrashIcon}</button>
        </div>
      ))}
    </div>
  )
}
