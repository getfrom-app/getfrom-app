// Chat asociado a UN elemento (documento/tarea/recurso/agente/prompt) abierto
// en el centro — SIEMPRE la misma conversación, nunca una nueva aislada cada
// vez que se abre esta tab (Alberto, 30 jul: "cada documento tenga un chat en
// el que poder hablar de ese elemento" — no un elemento nuevo desconectado
// del documento del que habla). `aiChatStore.getOrCreateElementSession`
// resuelve: la sesión que lo creó si nació de un chat, la que ya se enlazó la
// última vez que se habló de él, o una nueva la primera vez — y la deja
// cargada en `aiChatStore.sessionId`.
import { useLayoutEffect } from 'react'
import { store, useStore } from '../../store/nodeStore'
import { aiChatStore } from '../../store/aiChatStore'
import { elementDisplayTitle } from '../../utils/docNode'
import V2Chat from './V2Chat'

export default function V2ElementChat({ nodeId, onFilesDropped }: { nodeId: string; onFilesDropped: (files: File[]) => void }) {
  useStore()
  // useLayoutEffect (no useEffect): resuelve/crea la sesión ANTES de pintar, para
  // no enseñar un instante el composer/mensajes de la conversación anterior al
  // cambiar de elemento (el padre ya monta esto con key={nodeId}, así que en cada
  // nodo nuevo es un montaje limpio) — useAIChat() se suscribe en un useEffect
  // normal (después del commit), pero React no pinta hasta que los layout
  // effects y los re-renders síncronos que disparan terminan, así que el
  // cambio de sesión de aquí nunca llega a verse en pantalla.
  useLayoutEffect(() => { aiChatStore.getOrCreateElementSession(nodeId) }, [nodeId])

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
