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
import { parseExtraData } from '../utils/papeleraHelper'
import { getTodayDiaryUnderAgenda } from '../utils/agendaHelper'
import { applyTemplate } from '../utils/tagsHelper'
import { useV2Recorder } from './useV2Recorder'
import V2Sidebar from './components/V2Sidebar'
import V2Chat from './components/V2Chat'
import V2RightColumn, { RightMode } from './components/V2RightColumn'
import RightColMenu from '../components/panels/RightColMenu'
import UnifiedCapture from '../components/modals/UnifiedCapture'
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
  // ¿La tab Contexto muestra la FICHA del contexto (true) o el panel de la
  // CONVERSACIÓN activa (false)? Al hablar manda la conversación; al entrar a un
  // contexto para verlo, manda su ficha.
  const [viewingCtxFicha, setViewingCtxFicha] = useState(false)
  const [droppedFiles, setDroppedFiles] = useState<File[]>([])
  const [detailNodeId, setDetailNodeId] = useState<string | null>(null) // elemento abierto en la columna derecha
  const [rightWidth, setRightWidth] = useState(() => {
    const v = Number(localStorage.getItem('v2_right_w'))
    return v >= 320 && v <= 900 ? v : 440
  })
  useEffect(() => { localStorage.setItem('v2_right_w', String(rightWidth)) }, [rightWidth])

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
    setViewingCtxFicha(!!id)  // clic en un contexto = ver su ficha
    setRightMode(id ? 'contexto' : 'hoy')
  }

  // Botón «Nueva conversación» (barra izquierda) → SIEMPRE sin contexto (General).
  const onNewChat = () => {
    setSelectedCtxId(null)
    setFocusNodeId(null)
    setDetailNodeId(null)
    setViewingCtxFicha(false)
    setRightMode('contexto') // durante una conversación, la derecha muestra su panel
    aiChatStore.startNewSession()
  }

  // «＋» al pasar el ratón sobre un contexto → nueva conversación DENTRO de ese contexto.
  // Al escribir el 1er mensaje, send() la vincula al contexto (assignContext) → sale en
  // su Historial y su ficha.
  const onNewChatInCtx = (id: string) => {
    setSelectedCtxId(id)
    setFocusNodeId(null)
    setDetailNodeId(null)
    setViewingCtxFicha(false)  // se está iniciando una conversación, no viendo la ficha
    setRightMode('contexto')
    aiChatStore.startNewSession()
  }

  // Abrir una conversación: chat al CENTRO + su(s) elemento(s) en la DERECHA a la vez.
  // 1 elemento → se abre en detalle; varios → listados en la tab Contexto (panel de conversación).
  const onOpenConversation = (id: string) => {
    aiChatStore.loadSession(id)
    setSelectedCtxId(null)
    setFocusNodeId(null)
    setViewingCtxFicha(false)
    const content = store.children(id).filter(n => {
      if (n.deletedAt || !n.text) return false
      const ed = parseExtraData(n.extraData)
      if (ed._aiTranscript === '1' || ed._aiMsgRole) return false
      if (n.status != null || (n.types || []).includes('tarea')) return false
      if ((n.types || []).includes('evento') || n.isEvent) return false
      return true
    })
    setRightMode('contexto')
    setDetailNodeId(content.length === 1 ? content[0].id : null)
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

  // Crear un DOCUMENTO (nota de texto _doc) desde el centro → se abre editable a la
  // derecha. Si se pasa una plantilla, se aplica su contenido al nuevo documento.
  const onNewDocument = (templateId?: string) => {
    const parentId = captureParentId()
    if (!parentId) return
    const n = store.createNode({ text: '', parentId, extraData: { _doc: '1' } })
    store.updateNode(n.id, { body: '<p></p>' })
    if (templateId) { try { applyTemplate(templateId, n.id) } catch { /* noop */ } }
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

  // Al aparecer el PRIMER mensaje de usuario de una conversación, la columna derecha
  // va sola a «Contexto» → se ve el panel de conversación con el bloque «Relacionado»
  // (push) sin cambiar de tab a mano. Se dispara por mensaje (no por sessionId, que
  // puede venir persistido del reload), una sola vez por sesión, y solo desde la tab
  // por defecto «Hoy» para no pisar una elección deliberada (Elementos/Historial).
  const switchedFor = useRef<string | null>(null)
  useEffect(() => {
    const sid = chat.sessionId
    if (!sid || detailNodeId || selectedCtxId) return
    if (switchedFor.current === sid || rightMode !== 'hoy') return
    if (chat.messages.some(m => m.role === 'user')) {
      switchedFor.current = sid
      setRightMode('contexto')
    }
  }, [chat.sessionId, chat.messages.length])  // eslint-disable-line react-hooks/exhaustive-deps

  // Al ENVIARSE/LLEGAR un mensaje (la conversación crece), la tab Contexto pasa a
  // mostrar el panel de la CONVERSACIÓN (Relacionado/Tareas/Elementos) aunque haya un
  // contexto seleccionado. No se dispara solo por tener una sesión vieja cargada: solo
  // cuando el nº de mensajes aumenta (actividad real).
  const prevMsgCount = useRef(0)
  useEffect(() => {
    if (chat.messages.length > prevMsgCount.current && chat.messages.length > 0) {
      setViewingCtxFicha(false)
    }
    prevMsgCount.current = chat.messages.length
  }, [chat.messages.length])

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

  // Menú contextual (clic derecho) de cualquier fila/elemento → RightColMenu de la v1.
  // Las filas disparan `from:open-rowmenu` con { nodeId, x, y }.
  const [rowMenu, setRowMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null)
  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent).detail
      if (d?.nodeId) setRowMenu({ nodeId: d.nodeId, x: d.x, y: d.y })
    }
    window.addEventListener('from:open-rowmenu', h as EventListener)
    return () => window.removeEventListener('from:open-rowmenu', h as EventListener)
  }, [])

  // Quick capture (como en v1): BARRA ESPACIADORA lo lanza cuando no estás escribiendo
  // en un campo. Abre el UnifiedCapture real (ghost text, @contextos, -t/-e/-n, voz).
  const [showCapture, setShowCapture] = useState(false)
  useEffect(() => {
    const isTyping = (el: Element | null) => {
      if (!el) return false
      const tag = el.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement).isContentEditable
    }
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      const typing = isTyping(document.activeElement)
      // ⌘K / Ctrl+K → paleta de captura/búsqueda (funciona aunque estés escribiendo).
      if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault(); setShowCapture(v => !v); return
      }
      // ⌘, → Ajustes.
      if (mod && e.key === ',') {
        e.preventDefault(); window.dispatchEvent(new Event('from:open-settings')); return
      }
      // ⌘Z / ⌘⇧Z / ⌘Y → deshacer/rehacer del árbol (solo FUERA de un campo de texto,
      // para no pisar el deshacer del editor/outliner).
      if (mod && !typing && e.key.toLowerCase() === 'z') {
        e.preventDefault(); if (e.shiftKey) store.redo?.(); else store.undo?.(); return
      }
      if (mod && !typing && e.key.toLowerCase() === 'y') {
        e.preventDefault(); store.redo?.(); return
      }
      // Barra espaciadora → captura rápida (solo si NO estás en un campo de texto).
      if (e.code === 'Space' && !mod && !e.altKey && !e.repeat) {
        if (showCapture || typing) return
        e.preventDefault(); setShowCapture(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showCapture])

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
    <div className="v2-root" style={{ ['--v2-right' as string]: `${rightWidth}px` }}>
      <V2Sidebar selectedCtxId={selectedCtxId} onSelectCtx={onSelectCtx} onNewChat={onNewChat} onNewChatInCtx={onNewChatInCtx} />
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
        onResize={setRightWidth}
        activeSessionId={chat.sessionId}
        onOpenConversation={onOpenConversation}
        viewingCtxFicha={viewingCtxFicha}
      />
      {rowMenu && <RightColMenu nodeId={rowMenu.nodeId} x={rowMenu.x} y={rowMenu.y} onClose={() => setRowMenu(null)} />}
      {showCapture && (
        <UnifiedCapture
          onClose={() => setShowCapture(false)}
          onSelectContext={id => { onSelectCtx(id); setShowCapture(false) }}
        />
      )}
    </div>
    </ToastProvider>
  )
}
