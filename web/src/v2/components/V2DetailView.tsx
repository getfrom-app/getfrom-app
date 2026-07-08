// Cuerpo de la vista de detalle de Fromly 2.0 — enruta al visor/editor REAL de v1
// según el tipo. La cabecera (título + volver) y las tabs las pone V2RightColumn,
// para que las tabs sigan visibles con un elemento abierto.
import { store, useStore } from '../../store/nodeStore'
import { isDocNode } from '../../utils/docNode'
import { parseExtraData } from '../../utils/papeleraHelper'
import ResourcePanel from '../../components/panels/ResourcePanel'
import AudioPanel from '../../components/panels/AudioPanel'
import LienzoDocPanel from '../../components/panels/LienzoDocPanel'
import Outliner from '../../components/outliner/Outliner'

export default function V2DetailView({ nodeId }: { nodeId: string }) {
  useStore()
  const node = store.getNode(nodeId)
  if (!node) return <div className="v2-right-empty">Elemento no encontrado.</div>

  const hasAudio = Array.isArray(parseExtraData(node.extraData)._audios)
  const rt = (node.resourceType || '').toLowerCase()

  if (hasAudio || rt.includes('audio')) return <AudioPanel nodeId={node.id} />
  if (node.isResource || node.resourceType) return <ResourcePanel node={node} />
  // Documento: editor v1 COMPLETO — barra de estilos (DocInspector) + MD/HTML/PDF +
  // compartir (PublishButton) + favorito/eliminar.
  if (isDocNode(node)) return <LienzoDocPanel nodeId={node.id} />
  // Nota/tarea: contenido editable (Outliner real).
  return <Outliner parentId={node.id} autoFocusEmpty placeholder="Escribe aquí…" />
}
