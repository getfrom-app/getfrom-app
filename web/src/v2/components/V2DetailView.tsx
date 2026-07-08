// Vista de detalle de Fromly 2.0 — abre un elemento en la columna derecha con el
// visor/editor REAL de la v1 según su tipo: PDF/imagen (ResourcePanel), audio
// (AudioPanel), documento/texto (DocEditor editable) y, si es una nota/tarea con
// contenido, el Outliner. Se abre al hacer clic en un elemento o cuando la IA crea algo.
import type { ReactNode } from 'react'
import { store, useStore } from '../../store/nodeStore'
import { isDocNode } from '../../utils/docNode'
import { parseExtraData } from '../../utils/papeleraHelper'
import ResourcePanel from '../../components/panels/ResourcePanel'
import AudioPanel from '../../components/panels/AudioPanel'
import DocEditor from '../../components/views/DocEditor'
import Outliner from '../../components/outliner/Outliner'

interface Props {
  nodeId: string
  onClose: () => void
}

export default function V2DetailView({ nodeId, onClose }: Props) {
  useStore()
  const node = store.getNode(nodeId)

  const title = (() => {
    if (!node) return 'Elemento'
    return (node.text || 'Sin título').replace(/^✦\s*/, '') || 'Sin título'
  })()

  const hasAudio = node ? Array.isArray(parseExtraData(node.extraData)._audios) : false

  let body: ReactNode
  if (!node) {
    body = <div className="v2-right-empty">Elemento no encontrado.</div>
  } else if (hasAudio || (node.resourceType || '').toLowerCase().includes('audio')) {
    body = <AudioPanel nodeId={node.id} />
  } else if (node.isResource || node.resourceType) {
    body = <ResourcePanel node={node} />
  } else if (isDocNode(node)) {
    body = <DocEditor node={node} compact />
  } else {
    // Nota o tarea: contenido editable (Outliner real de v1).
    body = <Outliner parentId={node.id} autoFocusEmpty placeholder="Escribe aquí…" />
  }

  return (
    <aside className="v2-col v2-right">
      <div className="v2-detail-head">
        <button className="v2-iconbtn" onClick={onClose} title="Cerrar">‹</button>
        <span className="v2-center-title" style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
      </div>
      <div className="v2-detail-body">
        {body}
      </div>
    </aside>
  )
}
