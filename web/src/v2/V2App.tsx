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
import { isMarkedContext, isRootContext, firstContextOf } from '../utils/cajones'
import { applyTemplate } from '../utils/tagsHelper'
import { createMarkdownNode } from '../utils/importMarkdown'
import { uploadFile } from '../api/client'
import { useV2Recorder } from './useV2Recorder'
import V2Sidebar from './components/V2Sidebar'
import V2Chat from './components/V2Chat'
import V2RightColumn, { RightMode } from './components/V2RightColumn'
import RightColMenu from '../components/panels/RightColMenu'
import UnifiedCapture from '../components/modals/UnifiedCapture'
import { ToastProvider } from '../components/Toast'
import './styles/v2.css'

export const V2_VERSION = 'v2.0.0-beta.1'

// La conversación que creó un nodo (si la hay): las acciones de escritura de la IA
// parentan lo creado bajo la sesión (`aiChatExecutor.ts`), así que basta subir por
// `parentId` hasta encontrar el nodo `_aiSession`. Tope de 10 niveles por seguridad.
function findOriginSession(id: string): string | null {
  let cur = store.getNode(id)
  let guard = 0
  while (cur && guard++ < 10) {
    if (parseExtraData(cur.extraData)._aiSession === '1') return cur.id
    cur = cur.parentId ? store.getNode(cur.parentId) : undefined
  }
  return null
}

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
  const [importDragOver, setImportDragOver] = useState(false) // arrastrando un archivo sobre la columna de contextos
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
    // Cambiar de contexto RESETEA el chat: la conversación activa NO se arrastra al nuevo
    // contexto — queda guardada en el suyo (Historial) y la pantalla vuelve a vacío.
    aiChatStore.startNewSession()
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

  const isTextFile = (f: File) => /\.(md|markdown|txt)$/i.test(f.name) || f.type === 'text/markdown' || f.type === 'text/plain'

  // Sube un archivo a R2 y crea su nodo-recurso bajo `parentId`. Devuelve el id o null.
  const uploadResourceNode = async (f: File, parentId: string | null): Promise<string | null> => {
    const node = store.createNode({ text: f.name.replace(/\.[^.]+$/, ''), parentId })
    try {
      const { key, publicUrl } = await uploadFile(f)
      const resourceType = f.type.startsWith('image/') ? 'image' : f.type === 'application/pdf' ? 'pdf' : 'file'
      store.updateNode(node.id, { isResource: true, extraData: JSON.stringify({ _resourceUrl: publicUrl, _resourceKey: key, _resourceType: resourceType }) })
      return node.id
    } catch {
      store.deleteNode(node.id)
      toast(`No se pudo subir ${f.name}`, 'error')
      return null
    }
  }

  // Importa archivos a Fromly bajo `parentId` SIN crear conversación (.md → nota; resto →
  // recurso). Se usa al soltar sobre la columna de contextos (o sobre el chat sin conversación).
  const importFilesToFromly = async (files: File[], parentId: string | null): Promise<string | null> => {
    let lastId: string | null = null
    for (const f of files) {
      if (isTextFile(f)) {
        try { const note = createMarkdownNode(parentId, await f.text(), f.name, false); if (note) lastId = note.id } catch { /* */ }
      } else {
        const id = await uploadResourceNode(f, parentId)
        if (id) { lastId = id; toast(`📥 ${f.name} importado a Fromly`) }
      }
    }
    return lastId
  }

  // Soltar sobre el CHAT: con conversación activa → se adjunta a ella (RAG + aviso en el
  // chat). SIN conversación → NO se crea una: se importa a Fromly y se abre el elemento.
  const onFilesDropped = async (files: File[]) => {
    const textFiles = files.filter(isTextFile)
    const otherFiles = files.filter(f => !isTextFile(f))

    // Notas de texto: siempre se importan como documento.
    let lastNote: string | null = null
    for (const f of textFiles) {
      try { const note = createMarkdownNode(captureParentId(), await f.text(), f.name, false); if (note) lastNote = note.id } catch { /* */ }
    }
    if (lastNote) { setDetailNodeId(lastNote); setRightMode('contexto') }

    if (!otherFiles.length) return

    if (aiChatStore.sessionId) {
      // Hay conversación → adjuntar a ella.
      const sid = aiChatStore.sessionId
      setDetailNodeId(null); setViewingCtxFicha(false); setRightMode('contexto')
      let ok = 0
      for (const f of otherFiles) { if (await uploadResourceNode(f, sid)) { ok++; toast(`📎 ${f.name} adjuntado a la conversación`) } }
      if (ok > 0) {
        const label = ok === 1 ? `**${otherFiles[0].name}**` : `${ok} archivos`
        aiChatStore.addNotice(`He incorporado ${label} a esta conversación. Ya puedes preguntarme sobre su contenido.`)
      }
    } else {
      // Sin conversación → importar a Fromly (RAG), sin iniciar chat.
      const id = await importFilesToFromly(otherFiles, captureParentId())
      if (id) { setDetailNodeId(id); setViewingCtxFicha(false); setRightMode('contexto') }
    }
  }

  // Soltar sobre la columna de CONTEXTOS (izquierda) → importar a Fromly (al contexto sobre
  // el que se suelta, o al diario de hoy), nunca a la conversación.
  const onImportToContext = async (files: File[], ctxId: string | null) => {
    const parent = ctxId ?? captureParentId()
    const id = await importFilesToFromly(files, parent)
    if (id) { setSelectedCtxId(ctxId); setDetailNodeId(id); setViewingCtxFicha(false); setRightMode('contexto') }
  }

  // Toast unificado (mismo canal que el resto de la app).
  const toast = (message: string, type: 'success' | 'error' = 'success') =>
    window.dispatchEvent(new CustomEvent('from:toast', { detail: { message, type } }))

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
    // Un CONTEXTO (marcado o área raíz) siempre abre su FICHA completa (tareas +
    // elementos + «Archivar» + «Lo que Fromly sabe»), sea cual sea la ruta de entrada
    // (sidebar, cockpit «Hoy», chip de contexto…). Antes solo la sidebar llegaba a
    // `onSelectCtx`; el resto caía en el detalle genérico (V2NoteBody) y perdía Archivar.
    const node = store.getNode(id)
    if (isMarkedContext(node) || isRootContext(id)) { onSelectCtx(id); return }

    // Elemento normal: las 3 columnas se sincronizan con él. (1) Si nació dentro de
    // una conversación, esa conversación pasa al CENTRO (sustituye la actual — igual
    // que clicar la conversación en Historial). (2) Si pertenece a un contexto, la
    // IZQUIERDA lo selecciona (V2Sidebar hace drill-down solo hasta él por su propio
    // efecto sobre `selectedCtxId`). Ninguna de las dos cosas reinicia sesión de chat
    // (a diferencia de `onSelectCtx`, pensado para clics explícitos en la sidebar).
    const originSession = node ? findOriginSession(id) : null
    if (originSession && originSession !== chat.sessionId) {
      aiChatStore.loadSession(originSession)
      setFocusNodeId(null)
      setViewingCtxFicha(false)
    }
    const ctx = node ? firstContextOf(node) : null
    if (ctx) setSelectedCtxId(ctx.id)

    // Elemento normal: se abre en la columna derecha (visor/editor según su tipo).
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

  // Cerrar el detalle cuando un panel lo pide (p.ej. al ELIMINAR el elemento abierto).
  useEffect(() => {
    const h = () => setDetailNodeId(null)
    window.addEventListener('from:close-detail', h)
    return () => window.removeEventListener('from:close-detail', h)
  }, [])

  // Subrayar en un PDF → «Guardar» crea un HIGHLIGHT: nodo-cita buscable con `_pdfSelection`,
  // hijo del PDF de origen, que se lista como tipo propio en Elementos. (En el lienzo v1 esto
  // lo hace PizarraView; en v2 no hay lienzo montado, así que lo maneja el shell.)
  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent<{ text?: string; sourceNodeId?: string; page?: number | null }>).detail
      const text = (d?.text || '').trim()
      const sourceId = d?.sourceNodeId
      if (!text || !sourceId) return
      const src = store.getNode(sourceId)
      if (!src) return
      const extra: Record<string, string> = { _doc: '1', _ctext: '1', _pdfSelection: '1', _pdfSourceId: sourceId }
      if (d?.page != null) extra._pdfPage = String(d.page)
      const quote = store.createNode({ text: '', parentId: sourceId, extraData: extra })
      const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      store.updateNode(quote.id, { body: `<blockquote><p>${esc(text)}</p></blockquote>` })
      toast('Subrayado guardado')
    }
    window.addEventListener('from:pdf-send-to-canvas', h as EventListener)
    return () => window.removeEventListener('from:pdf-send-to-canvas', h as EventListener)
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
      <V2Sidebar selectedCtxId={selectedCtxId} onSelectCtx={onSelectCtx} onNewChat={onNewChat} onNewChatInCtx={onNewChatInCtx} onImportFiles={onImportToContext} onDragStateChange={setImportDragOver} />
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
        onOpenNode={onOpenNode}
        onStartAbout={onStartAbout}
        onSelectCtx={onSelectCtx}
        detailNodeId={detailNodeId}
        onCloseDetail={() => setDetailNodeId(null)}
        onResize={setRightWidth}
        activeSessionId={chat.sessionId}
        onOpenConversation={onOpenConversation}
        viewingCtxFicha={viewingCtxFicha}
        importDragOver={importDragOver}
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
