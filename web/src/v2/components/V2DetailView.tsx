// Cuerpo de la vista de detalle de Fromly 2.0 — enruta al visor/editor REAL de v1
// según el tipo. La cabecera (título + volver) y las tabs las pone V2RightColumn,
// para que las tabs sigan visibles con un elemento abierto.
import { useState } from 'react'
import { store, useStore } from '../../store/nodeStore'
import { isDocNode } from '../../utils/docNode'
import { parseExtraData } from '../../utils/papeleraHelper'
import ResourcePanel from '../../components/panels/ResourcePanel'
import AudioPanel from '../../components/panels/AudioPanel'
import LienzoDocPanel from '../../components/panels/LienzoDocPanel'
import Outliner from '../../components/outliner/Outliner'
import PizarraView from '../../components/views/PizarraView'
import type { Node } from '../../types'

// Nota o documento: se puede ver como TEXTO o como LIENZO (mismo nodo). El toggle
// persiste en extraData (_v2canvas) para que reabra en la misma vista. En lienzo se
// monta la PizarraView REAL de v1 (dibujo a mano, formas, tarjetas, su barra flotante).
function V2NoteBody({ node }: { node: Node }) {
  const ed = parseExtraData(node.extraData)
  const [canvas, setCanvas] = useState(ed._v2canvas === '1')

  const setView = (c: boolean) => {
    setCanvas(c)
    const e = parseExtraData(node.extraData)
    if (c) e._v2canvas = '1'; else delete e._v2canvas
    store.updateNode(node.id, { extraData: JSON.stringify(e) })
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div className="v2-view-toggle">
        <button className={!canvas ? 'active' : ''} onClick={() => setView(false)}>📝 Nota</button>
        <button className={canvas ? 'active' : ''} onClick={() => setView(true)}>🎨 Lienzo</button>
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: canvas ? 'hidden' : 'auto' }}>
        {canvas
          ? <PizarraView parentId={node.id} flowUnpositioned globalCanvas={false} />
          : isDocNode(node)
            ? <LienzoDocPanel nodeId={node.id} />
            : <Outliner parentId={node.id} autoFocusEmpty placeholder="Escribe aquí…" />}
      </div>
    </div>
  )
}

export default function V2DetailView({ nodeId }: { nodeId: string }) {
  useStore()
  const node = store.getNode(nodeId)
  if (!node) return <div className="v2-right-empty">Elemento no encontrado.</div>

  const hasAudio = Array.isArray(parseExtraData(node.extraData)._audios)
  const rt = (node.resourceType || '').toLowerCase()

  if (hasAudio || rt.includes('audio')) return <AudioPanel nodeId={node.id} />
  if (node.isResource || node.resourceType) return <ResourcePanel node={node} />
  // Nota / documento → cuerpo editable con toggle Nota ⇄ Lienzo.
  return <V2NoteBody node={node} />
}
