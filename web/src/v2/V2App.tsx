// ══════════════════════════════════════════════════════════════════════
// Fromly 2.0 — shell chat-first (beta aislada en /app/v2)
// No toca la v1. Monta sobre el MISMO motor (stores, sync, auth) de v1.
// El chat es el centro; la columna derecha reacciona; los contextos = proyectos.
// ══════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react'
import { store, useStore } from '../store/nodeStore'
import { userStore } from '../store/userStore'
import { aiChatStore, useAIChat } from '../store/aiChatStore'
import { isDocNode } from '../utils/docNode'
import { getTodayDiaryUnderAgenda } from '../utils/agendaHelper'
import { useV2Recorder } from './useV2Recorder'
import V2Sidebar from './components/V2Sidebar'
import V2Chat from './components/V2Chat'
import V2RightColumn, { RightMode } from './components/V2RightColumn'
import { ToastProvider } from '../components/Toast'
import './styles/v2.css'

export const V2_VERSION = 'v2.0.0-beta.1'

export default function V2App() {
  useStore()
  const chat = useAIChat()
  const [ready, setReady] = useState(store.isLoaded)
  const [selectedCtxId, setSelectedCtxId] = useState<string | null>(null)
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null) // conversación centrada en un nodo concreto
  const [rightMode, setRightMode] = useState<RightMode>('hoy')
  const [droppedFiles, setDroppedFiles] = useState<File[]>([])
  const [detailNodeId, setDetailNodeId] = useState<string | null>(null) // elemento abierto en la columna derecha

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

  // Al elegir un contexto, la columna derecha muestra SIEMPRE su ficha completa
  // (vista de contexto): contenido agrupado + qué sabe Fromly + archivar.
  const onSelectCtx = (id: string | null) => {
    setSelectedCtxId(id)
    setFocusNodeId(null)
    setDetailNodeId(null)
    setRightMode(id ? 'contexto' : 'hoy')
  }

  const onNewChat = () => {
    setFocusNodeId(null)
    setDetailNodeId(null)
    aiChatStore.startNewSession()
  }

  // «Empezar una conversación a partir de un contenido existente»: nueva sesión
  // centrada en ese nodo (buildPayload le inyecta ese nodo como contexto).
  const onStartAbout = (nodeId: string) => {
    setFocusNodeId(nodeId)
    aiChatStore.startNewSession()
  }

  const onFilesDropped = (files: File[]) => {
    setDroppedFiles(prev => [...prev, ...files])
    setRightMode('elementos')
  }

  // Dónde nace el contenido creado desde el centro: el contexto activo o el diario de hoy.
  const captureParentId = (): string | null => {
    if (selectedCtxId) return selectedCtxId
    try { return getTodayDiaryUnderAgenda().id } catch { return null }
  }

  // Crear un DOCUMENTO (nota de texto _doc) desde el centro → se abre editable a la derecha.
  const onNewDocument = () => {
    const parentId = captureParentId()
    if (!parentId) return
    const n = store.createNode({ text: '', parentId, extraData: { _doc: '1' } })
    store.updateNode(n.id, { body: '<p></p>' })
    setDetailNodeId(n.id)
  }

  // Guardar una nota de voz grabada en el centro → se abre en el reproductor a la derecha.
  const onAudioSaved = (r: { audioKey: string; durationSec: number; transcript: string }) => {
    const parentId = captureParentId()
    if (!parentId || !r.audioKey) return
    const title = (r.transcript || '').trim().slice(0, 60) || 'Nota de voz'
    const n = store.createNode({ text: title, parentId })
    store.updateNode(n.id, {
      extraData: JSON.stringify({ _audios: [{ audioKey: r.audioKey, durationSec: r.durationSec, transcript: r.transcript }] }),
    })
    setDetailNodeId(n.id)
  }
  const recorder = useV2Recorder(onAudioSaved)

  const onOpenNode = (id: string) => {
    // Abre el elemento en la columna derecha (visor/editor según su tipo).
    setDetailNodeId(id)
  }

  // Artifacts: cuando la IA crea un documento/nota/recurso en una conversación,
  // se abre solo en la columna derecha (como Claude). Detecta el fin del turno.
  const prevStreaming = useRef(false)
  useEffect(() => {
    if (prevStreaming.current && !chat.isStreaming) {
      try {
        const last = [...chat.messages].reverse().find(m => m.role === 'assistant' && m.actions && m.actions.length > 0)
        const ids: string[] = last ? last.actions.flatMap((a: { createdIds?: string[] }) => a.createdIds || []) : []
        // Prioriza documentos/recursos; si no, la primera nota creada (no tareas sueltas).
        const nodes = ids.map(id => store.getNode(id)).filter(Boolean) as ReturnType<typeof store.getNode>[]
        const artifact = nodes.find(n => !!n && (isDocNode(n) || !!n.isResource))
          || nodes.find(n => !!n && n.status == null && !n.isEvent)
        if (artifact) setDetailNodeId(artifact.id)
      } catch { /* noop */ }
    }
    prevStreaming.current = chat.isStreaming
  }, [chat.isStreaming])  // eslint-disable-line react-hooks/exhaustive-deps

  // El ElementsPanel de v1 abre nodos disparando `from:open-detail` (en vez de navegar).
  // Lo escuchamos aquí para abrir el elemento desde el buscador universal.
  useEffect(() => {
    const h = (e: Event) => {
      const id = (e as CustomEvent).detail?.nodeId
      if (id) onOpenNode(id)
    }
    window.addEventListener('from:open-detail', h as EventListener)
    return () => window.removeEventListener('from:open-detail', h as EventListener)
  }, [])

  // El chat se centra en el nodo enfocado (si hay) o en el contexto seleccionado.
  const currentNodeId = focusNodeId || selectedCtxId
  const focusNode = focusNodeId ? store.getNode(focusNodeId) : null
  const ctxNode = selectedCtxId ? store.getNode(selectedCtxId) : null
  const contextLabel = focusNode?.text || ctxNode?.text || 'General'

  if (!ready) {
    return <div className="v2-loading">Cargando Fromly 2.0…</div>
  }

  return (
    <ToastProvider>
    <div className="v2-root">
      <V2Sidebar selectedCtxId={selectedCtxId} onSelectCtx={onSelectCtx} onNewChat={onNewChat} />
      <V2Chat
        currentNodeId={currentNodeId}
        contextLabel={contextLabel}
        onFilesDropped={onFilesDropped}
        onNewDocument={onNewDocument}
        recorder={recorder}
      />
      <V2RightColumn
        mode={rightMode}
        onMode={setRightMode}
        selectedCtxId={selectedCtxId}
        droppedFiles={droppedFiles}
        onOpenNode={onOpenNode}
        onStartAbout={onStartAbout}
        onSelectCtx={onSelectCtx}
        detailNodeId={detailNodeId}
        onCloseDetail={() => setDetailNodeId(null)}
      />
      <div className="v2-beta-bar">Fromly {V2_VERSION} — beta<a href="/app/">volver a v1</a></div>
    </div>
    </ToastProvider>
  )
}
