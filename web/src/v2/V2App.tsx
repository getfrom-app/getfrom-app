// ══════════════════════════════════════════════════════════════════════
// Fromly 2.0 — shell chat-first (beta aislada en /app/v2)
// No toca la v1. Monta sobre el MISMO motor (stores, sync, auth) de v1.
// El chat es el centro; la columna derecha reacciona; los contextos = proyectos.
// ══════════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react'
import { store, useStore } from '../store/nodeStore'
import { userStore } from '../store/userStore'
import { aiChatStore } from '../store/aiChatStore'
import V2Sidebar from './components/V2Sidebar'
import V2Chat from './components/V2Chat'
import V2RightColumn, { RightMode } from './components/V2RightColumn'
import './styles/v2.css'

export const V2_VERSION = 'v2.0.0-beta.1'

export default function V2App() {
  useStore()
  const [ready, setReady] = useState(store.isLoaded)
  const [selectedCtxId, setSelectedCtxId] = useState<string | null>(null)
  const [rightMode, setRightMode] = useState<RightMode>('contexto')
  const [droppedFiles, setDroppedFiles] = useState<File[]>([])

  // Arranque del motor SOLO si la v1 no lo cargó ya en esta sesión SPA.
  // NO re-ejecutamos las migraciones estructurales de v1 (algunas destructivas):
  // la v2 es cliente de lectura/chat sobre el mismo árbol.
  useEffect(() => {
    userStore.fetchMe().catch(() => {})
    if (store.isLoaded) { setReady(true); return }
    store.isGuest = false
    store.initialLoad()
      .then(() => {
        try { store.setLoaded() } catch { /* idempotente */ }
        try { store.startRemotePolling() } catch { /* ya activo */ }
        setReady(true)
      })
      .catch(() => setReady(true)) // no bloquear el shell aunque falle la carga
  }, [])

  // Al elegir un contexto, la columna derecha salta a su ficha.
  const onSelectCtx = (id: string | null) => {
    setSelectedCtxId(id)
    setRightMode('contexto')
  }

  const onNewChat = () => {
    aiChatStore.startNewSession()
  }

  const onFilesDropped = (files: File[]) => {
    setDroppedFiles(prev => [...prev, ...files])
    setRightMode('elementos')
  }

  const onOpenNode = (id: string) => {
    // La v2 aún no tiene vista de detalle propia → abre el nodo en la v1 en otra pestaña.
    window.open(`/app/node/${id}`, '_blank', 'noopener')
  }

  const ctxNode = selectedCtxId ? store.getNode(selectedCtxId) : null
  const contextLabel = ctxNode?.text || 'General'

  if (!ready) {
    return <div className="v2-loading">Cargando Fromly 2.0…</div>
  }

  return (
    <div className="v2-root">
      <V2Sidebar selectedCtxId={selectedCtxId} onSelectCtx={onSelectCtx} onNewChat={onNewChat} />
      <V2Chat currentNodeId={selectedCtxId} contextLabel={contextLabel} onFilesDropped={onFilesDropped} />
      <V2RightColumn
        mode={rightMode}
        onMode={setRightMode}
        selectedCtxId={selectedCtxId}
        droppedFiles={droppedFiles}
        onOpenNode={onOpenNode}
      />
      <div className="v2-beta-bar">Fromly {V2_VERSION} — beta<a href="/app/">volver a v1</a></div>
    </div>
  )
}
