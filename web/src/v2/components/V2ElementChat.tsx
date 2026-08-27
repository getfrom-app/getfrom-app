// Chat asociado a UN elemento (documento/tarea/recurso/agente/prompt) abierto
// en el centro — SIEMPRE la misma conversación, nunca una nueva aislada cada
// vez que se abre esta tab (Alberto, 30 jul: "cada documento tenga un chat en
// el que poder hablar de ese elemento" — no un elemento nuevo desconectado
// del documento del que habla). `aiChatStore.getOrCreateElementSession`
// resuelve: la sesión que lo creó si nació de un chat, la que ya se enlazó la
// última vez que se habló de él, o una nueva la primera vez — y la deja
// cargada en `aiChatStore.sessionId`.
import { store, useStore } from '../../store/nodeStore'
import { elementDisplayTitle } from '../../utils/docNode'
import V2Chat from './V2Chat'

export default function V2ElementChat({ nodeId, onFilesDropped }: { nodeId: string; onFilesDropped: (files: File[]) => void }) {
  useStore()
  // El hilo del chat del elemento lo lleva ENTERO assistantStore (V2Chat con
  // currentNodeId → threadKey por nodo). La llamada antigua a
  // `aiChatStore.getOrCreateElementSession(nodeId)` era un resto del motor
  // viejo: creaba un nodo "Conversación" (_aiSession) REAL en el árbol cada
  // vez que se abría esta tab — los elementos fantasma duplicados que se veían
  // en Elementos (auditoría 28 ago 2026). Eliminada.
  const node = store.getNode(nodeId)
  const title = elementDisplayTitle(node).replace(/^✦\s*/, '').trim()

  return (
    <V2Chat
      embedded
      currentNodeId={nodeId}
      contextLabel={title}
      onFilesDropped={onFilesDropped}
    />
  )
}
