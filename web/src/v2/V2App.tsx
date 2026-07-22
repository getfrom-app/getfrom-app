// ══════════════════════════════════════════════════════════════════════
// Fromly 2.0 — shell chat-first (beta aislada en /app/v2)
// No toca la v1. Monta sobre el MISMO motor (stores, sync, auth) de v1.
// El chat es el centro; la columna derecha reacciona; los contextos = proyectos.
// ══════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../store/nodeStore'
import { userStore } from '../store/userStore'
import { aiChatStore, useAIChat } from '../store/aiChatStore'
import { isDocNode } from '../utils/docNode'
import { parseExtraData } from '../utils/papeleraHelper'
import { getTodayDiaryUnderAgenda } from '../utils/agendaHelper'
import { isMarkedContext, isRootContext, firstContextOf, maybeUpdateContextKnowledge, contextParent, mostRecentConversationOf } from '../utils/cajones'
import { darkenHex, lightenHex, hexToRgba } from '../utils/color'
import { htmlToMarkdown } from '../utils/htmlMarkdown'
import { createMarkdownNode } from '../utils/importMarkdown'
import { uploadFile } from '../api/client'
import { pickAndImportDriveFile } from '../utils/googleDrivePicker'
import type { DriveImportResult } from '../api/googleDrive'
import { useV2Recorder } from './useV2Recorder'
import V2Sidebar from './components/V2Sidebar'
import V2Chat from './components/V2Chat'
import V2ProfileView from './components/V2ProfileView'
import V2ElementView from './components/V2ElementView'
import V2RightColumn, { RightMode } from './components/V2RightColumn'
import V2SettingsNav from './components/V2SettingsNav'
import { SettingsPaneContent } from '../components/views/SettingsView'
import type { Tab as SettingsTab } from '../components/views/settingsNav'
import type { ElemKind } from '../components/panels/ElementsPanel'
import V2Onboarding from './components/V2Onboarding'
import RightColMenu from '../components/panels/RightColMenu'
import UnifiedCapture from '../components/modals/UnifiedCapture'
import { ToastProvider } from '../components/Toast'
import { WEB_VERSION } from '../components/layout/StatusBar'
import { runStartupMigrations } from '../utils/appInit'
import PaywallModal from '../components/paywall/PaywallModal'
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

// Color de acento PROPIO de un contexto (sube por la cadena de padres) — a
// diferencia de `contextColor()` de cajones.ts, NO cae al acento del tema si
// nadie en la cadena tiene `_tagColor`: null significa "usa el tema normal".
function resolveOwnAccentColor(nodeId: string | null): string | null {
  let cur = nodeId
  let guard = 0
  while (cur && guard++ < 40) {
    const n = store.getNode(cur)
    if (!n) return null
    try {
      const ed = JSON.parse(n.extraData || '{}')
      if (typeof ed._tagColor === 'string' && ed._tagColor) return ed._tagColor
    } catch { /* extraData no-JSON */ }
    const p = contextParent(cur)
    cur = p ? p.id : null
  }
  return null
}

export default function V2App() {
  useStore()
  const { t } = useTranslation()
  const chat = useAIChat()
  const [ready, setReady] = useState(store.isLoaded)
  const [selectedCtxId, setSelectedCtxId] = useState<string | null>(null)

  // Acento dinámico: si el contexto abierto (o alguno de sus padres) tiene un color
  // propio (menú de clic derecho en la sidebar), TODA la app cambia a ese acento
  // mientras esté abierto — botones, líneas, chips… (todo lee var(--accent)/-soft/
  // -hover/text-accent). `useStore()` re-renderiza al editar el color en vivo.
  const ownAccent = selectedCtxId ? resolveOwnAccentColor(selectedCtxId) : null
  useEffect(() => {
    const root = document.documentElement
    if (ownAccent) {
      const isDark = root.getAttribute('data-theme') === 'dark'
      root.style.setProperty('--accent', ownAccent)
      root.style.setProperty('--accent-hover', darkenHex(ownAccent, 0.22))
      root.style.setProperty('--accent-soft', hexToRgba(ownAccent, 0.12))
      root.style.setProperty('--text-accent', isDark ? lightenHex(ownAccent, 0.35) : darkenHex(ownAccent, 0.22))
    } else {
      root.style.removeProperty('--accent')
      root.style.removeProperty('--accent-hover')
      root.style.removeProperty('--accent-soft')
      root.style.removeProperty('--text-accent')
    }
    return () => {
      root.style.removeProperty('--accent')
      root.style.removeProperty('--accent-hover')
      root.style.removeProperty('--accent-soft')
      root.style.removeProperty('--text-accent')
    }
  }, [ownAccent])
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null) // conversación centrada en un nodo concreto
  const [rightMode, setRightMode] = useState<RightMode>('hoy')
  // Recuerda la última tab que NO era «detalles», para poder volver a ella al
  // cerrar el detalle con «‹» — antes onCloseDetail solo vaciaba detailNodeId y
  // rightMode se quedaba en 'detalles' (o saltaba a 'contexto' si el elemento
  // tenía contexto, vía setSelectedCtxId en onOpenNode), así que «atrás» nunca
  // devolvía a Elementos/Agenda, la tab desde la que se abrió el elemento
  // (Alberto, 22 jul: "al darle atrás debería volver a la tab anterior... pero
  // vuelve al detalle del contexto").
  const lastNonDetailModeRef = useRef<RightMode>('hoy')
  useEffect(() => {
    if (rightMode !== 'detalles') lastNonDetailModeRef.current = rightMode
  }, [rightMode])
  const [importDragOver, setImportDragOver] = useState(false) // arrastrando un archivo sobre la columna de contextos
  const [detailNodeId, setDetailNodeId] = useState<string | null>(null) // artifact de la conversación activa, en la columna derecha
  // Elemento abierto en el ESPACIO CENTRAL (sustituye al chat, mismo patrón que
  // showProfile) — Alberto, 22 jul: "los elementos deberían poder abrirse igual
  // que el chat en el espacio principal... es más cómodo trabajar con un
  // documento o un lienzo en el espacio grande". Distinto de `detailNodeId`:
  // ese sigue siendo solo para el artifact que la conversación activa está
  // creando/usando (la excepción explícita que pidió mantener en la columna
  // derecha).
  const [centerElementId, setCenterElementId] = useState<string | null>(null)
  // Ir a la tab Agenda siempre reabre el planificador en el centro, aunque
  // hubiera un elemento abierto (p.ej. la nota del día) — la navegación es de
  // SUSTITUCIÓN, no de pila (Alberto, 22 jul: "cada vez que se abre algo, se
  // sustituye lo que había... estando la nota del día abierta, cuando vuelvo
  // a la tab agenda, debería volverse a abrir el planner").
  useEffect(() => {
    if (rightMode === 'hoy') setCenterElementId(null)
  }, [rightMode])
  // Ajustes a pantalla completa: null = modo normal; si no, la pestaña activa.
  // Sustituye al modal — nav a la izquierda (donde van los contextos), contenido
  // al centro, columna derecha vacía.
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null)
  const [showProfile, setShowProfile] = useState(false)
  const [elementsFilter, setElementsFilter] = useState<ElemKind | 'all' | 'favorite' | null>(null) // filtro inicial pedido para la tab Elementos (p.ej. «← Agentes»)
  const [rightWidth, setRightWidth] = useState(() => {
    const v = Number(localStorage.getItem('v2_right_w'))
    return v >= 320 && v <= 900 ? v : 440
  })
  useEffect(() => { localStorage.setItem('v2_right_w', String(rightWidth)) }, [rightWidth])

  // Auto-actualizar «Lo que Fromly sabe» del contexto al GUARDAR un elemento (nota/
  // tarea/documento): se dispara al SALIR del detalle (cerrar o abrir otro), no en
  // cada tecla — compara el snapshot de apertura vs. el de cierre y solo llama a la
  // IA si el contenido cambió de verdad. La IA decide si aporta algo significativo
  // y duradero (puede acotar/reescribir/fusionar, no solo añadir al final) — si no
  // aporta nada, no toca el documento. Alberto: "cada vez que se guarda un
  // elemento, si es significativo, debe aportar algo... si no, no hace nada".
  // Reactivado 14 jul tras encontrar y arreglar la causa raíz real (opsClient.ts +
  // cajones.ts/agentesHelper.ts — ver commit 5cbda04d): la reescritura por IA
  // nunca fue la causa, era la migración destructiva del documento cuando el
  // flag `_doc` no se reconocía por el shadow incompleto.
  // Descarta CUALQUIER documento completamente vacío (sin título, sin cuerpo, sin hijos)
  // al cerrar su detalle — el botón "+Nota" crea y abre una nota en blanco al vuelo, y si
  // el usuario no escribe nada se queda huérfana como "Sin título" para siempre (Alberto,
  // 14 jul: primero 12 bajo Casa Alicante, luego más bajo Documentos personales pese a un
  // primer intento de arreglo). Ese primer intento solo rastreaba ids creados por
  // onNewDocument en ESTA sesión (un Set en un ref) y algunas se le seguían escapando —
  // esta versión no rastrea nada: por construcción, solo un documento nunca tocado tiene
  // título Y cuerpo vacíos a la vez (agentes/prompts/lienzos/"Lo que Fromly sabe" siempre
  // tienen texto), así que descartarlo al cerrar es seguro sin importar cuándo se creó.
  // No toca lienzos (`_v2canvas`): su "vacío" es JSON de pizarra, no `<p></p>`.
  useEffect(() => {
    if (!detailNodeId) return
    const id = detailNodeId
    return () => {
      const node = store.getNode(id)
      if (!node || node.deletedAt) return
      const ed = parseExtraData(node.extraData)
      if (ed._doc !== '1' || ed._v2canvas === '1') return
      const blank = !(node.text || '').trim() && (!node.body || node.body === '<p></p>' || !htmlToMarkdown(node.body).trim())
      if (blank && store.children(id).every(c => c.deletedAt)) store.deleteNode(id)
    }
  }, [detailNodeId])

  // maybeUpdateContextKnowledge (cajones.ts) — compartida con aiChatExecutor.ts, que la
  // dispara también al crear contenido por chat (antes SOLO se disparaba aquí, al cerrar
  // una nota editada a mano; la mayoría del contenido de un producto chat-first se crea
  // por chat, así que la memoria del contexto casi nunca se alimentaba).
  useEffect(() => {
    if (!detailNodeId) return
    const id = detailNodeId
    const openNode = store.getNode(id)
    const snapshot = { text: openNode?.text || '', body: openNode?.body || '' }
    return () => {
      const node = store.getNode(id)
      if (!node || node.deletedAt) return
      if (node.text === snapshot.text && node.body === snapshot.body) return // nada cambió
      maybeUpdateContextKnowledge(node)
    }
  }, [detailNodeId])

  // Arranque del motor SOLO si la v1 no lo cargó ya en esta sesión SPA.
  // NO re-ejecutamos las migraciones estructurales de v1 (algunas destructivas):
  // la v2 es cliente de lectura/chat sobre el mismo árbol.
  useEffect(() => {
    userStore.fetchMe().catch(() => {})
    if (store.isLoaded) { setReady(true); return }
    store.isGuest = false
    store.initialLoad()
      .then(async () => {
        // Nodos de sistema (Plantillas, Atajos, Agentes, Prompts, Papelera, Perfil,
        // Contexto) y migraciones — MISMA cadena que MainLayout (v1), ver appInit.ts.
        // Antes del 15 jul 2026 esto nunca corría en v2 (la app principal en /app):
        // un usuario 100% nuevo no recibía ni los agentes ni los prompts predefinidos.
        try { await runStartupMigrations() } catch (e) { console.warn('[v2] runStartupMigrations falló:', e) }
        try { store.setLoaded() } catch { /* idempotente */ }
        try { store.startRemotePolling() } catch { /* ya activo */ }
        setReady(true)
      })
      .catch(() => setReady(true)) // no bloquear el shell aunque falle la carga
  }, [])

  // Al elegir un contexto, la columna derecha muestra SIEMPRE su ficha completa
  // (vista de contexto): contenido agrupado + qué sabe Fromly + archivar. La tab
  // Detalles es independiente — no se toca aquí, así que lo que hubiera abierto
  // sigue disponible al volver a ella (Alberto, 15 jul).
  const onSelectCtx = (id: string | null) => {
    setShowProfile(false)
    setCenterElementId(null)
    setSelectedCtxId(id)
    setFocusNodeId(null)
    setDetailNodeId(null)
    setRightMode(id ? 'contexto' : 'hoy')
    // Retomar la última conversación de este contexto si existe, en vez de siempre
    // resetear a un chat en blanco (Alberto, 15 jul: "cuando se vuelva el contexto,
    // me gustaría que se mantuviese el último chat que sea abierto, por si el
    // usuario quiere continuarlo").
    const recent = id ? mostRecentConversationOf(id) : null
    if (recent) aiChatStore.loadSession(recent.id)
    else aiChatStore.startNewSession()
  }

  // Botón «Nueva conversación» (barra izquierda) → SIEMPRE sin contexto (General).
  const onNewChat = () => {
    setShowProfile(false)
    setCenterElementId(null)
    setSelectedCtxId(null)
    setFocusNodeId(null)
    setDetailNodeId(null)
    setRightMode('detalles') // durante una conversación, la derecha muestra su panel
    aiChatStore.startNewSession()
  }

  // «＋» al pasar el ratón sobre un contexto → nueva conversación DENTRO de ese contexto.
  // Al escribir el 1er mensaje, send() la vincula al contexto (assignContext) → sale en
  // su Historial y su ficha.
  const onNewChatInCtx = (id: string | null) => {
    setShowProfile(false)
    setCenterElementId(null)
    setSelectedCtxId(id)
    setFocusNodeId(null)
    setDetailNodeId(null)
    setRightMode('detalles')  // se está iniciando una conversación, no viendo la ficha
    aiChatStore.startNewSession()
  }

  // Crear nota/lienzo directamente en UN CONTEXTO CONCRETO del sidebar (no
  // necesariamente el activo) — mismo patrón que onNewChatInCtx, con el
  // parentId explícito en vez de captureParentId() (Alberto, 22 jul: "botones
  // de creación de elementos en el sidebar").
  const onNewNoteInCtx = (ctxId: string | null) => {
    setShowProfile(false)
    setSelectedCtxId(ctxId)
    const n = store.createNode({ text: '', parentId: ctxId, extraData: { _doc: '1' } })
    store.updateNode(n.id, { body: '<p></p>' })
    setCenterElementId(n.id)
  }
  const onNewCanvasInCtx = (ctxId: string | null) => {
    setShowProfile(false)
    setSelectedCtxId(ctxId)
    const n = store.createNode({ text: '', parentId: ctxId, extraData: { _doc: '1', _v2canvas: '1' } })
    setCenterElementId(n.id)
  }

  // Abrir una conversación: chat al CENTRO + su(s) elemento(s) en la tab DETALLES a
  // la vez. 1 elemento → se abre en detalle; varios → listados en el panel de la
  // conversación. La tab Contexto se mantiene intacta (ficha del contexto, si lo hay).
  const onOpenConversation = (id: string) => {
    setShowProfile(false)
    setCenterElementId(null)
    aiChatStore.loadSession(id)
    // Mantener el contexto de la conversación en la barra lateral y el breadcrumb
    // (antes se limpiaba SIEMPRE — Alberto, 15 jul: "cuando se abre una conversación
    // dentro del contexto diario, se debería mantener ese contexto diario. Y arriba,
    // en el breadcrumb, debería poner contexto y luego la conversación en sí").
    const sessionNode = store.getNode(id)
    const sessionCtx = sessionNode ? firstContextOf(sessionNode) : null
    setSelectedCtxId(sessionCtx?.id ?? null)
    setFocusNodeId(null)
    const content = store.children(id).filter(n => {
      if (n.deletedAt || !n.text) return false
      const ed = parseExtraData(n.extraData)
      if (ed._aiTranscript === '1' || ed._aiMsgRole) return false
      // «Notas» de la conversación (getOrCreateContainerNotes) NO es un elemento
      // real — es la zona de anotación libre embebida al final del panel de la
      // conversación. Antes se colaba aquí como "el único elemento adjunto" en
      // cuanto se creaba vacía al ver el panel, y la columna derecha se abría en
      // su detalle de nota a pantalla completa en vez de mostrar la conversación
      // (Alberto, 15 jul).
      if (ed._containerNotes === '1') return false
      if (n.status != null || (n.types || []).includes('tarea')) return false
      if ((n.types || []).includes('evento') || n.isEvent) return false
      return true
    })
    setRightMode('detalles')
    setDetailNodeId(content.length === 1 ? content[0].id : null)
  }

  // «← Agentes»/«← Prompts» desde el detalle: cierra el detalle y abre la tab
  // Elementos ya filtrada por ese tipo (kind = ElemKind de ElementsPanel, p.ej.
  // 'agent'|'prompt').
  const onOpenElementsFiltered = (kind: ElemKind) => {
    setDetailNodeId(null)
    setCenterElementId(null)
    setElementsFilter(kind)
    setRightMode('elementos')
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
      toast(t('v2.uploadFailed', 'No se pudo subir {{name}}', { name: f.name }), 'error')
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
        if (id) { lastId = id; toast(t('v2.importedToFromly', '📥 {{name}} importado a Fromly', { name: f.name })) }
      }
    }
    return lastId
  }

  // Soltar un archivo — MISMO comportamiento sea cual sea la superficie donde se suelte
  // (chat, sidebar de contextos…): con conversación activa → se adjunta a ella (RAG +
  // aviso en el chat); SIN conversación → se importa a Fromly bajo el contexto/día activo
  // y se abre el elemento. Antes soltar sobre la sidebar tenía su PROPIA ruta
  // (`onImportToContext`, ligada al contexto concreto sobre el que soltabas) que daba
  // error al subir — una sola ruta, un solo sitio que arreglar/mantener.
  const onFilesDropped = async (files: File[]) => {
    const textFiles = files.filter(isTextFile)
    const otherFiles = files.filter(f => !isTextFile(f))

    // Notas de texto: siempre se importan como documento. Si hay conversación
    // activa, se abre en la columna derecha (no tapa el chat en el centro); si
    // no, en el espacio central como cualquier elemento nuevo.
    let lastNote: string | null = null
    for (const f of textFiles) {
      try { const note = createMarkdownNode(captureParentId(), await f.text(), f.name, false); if (note) lastNote = note.id } catch { /* */ }
    }
    if (lastNote) {
      if (aiChatStore.sessionId) { setDetailNodeId(lastNote); setRightMode('detalles') }
      else setCenterElementId(lastNote)
    }

    if (!otherFiles.length) return

    if (aiChatStore.sessionId) {
      // Hay conversación → adjuntar a ella.
      const sid = aiChatStore.sessionId
      setDetailNodeId(null); setRightMode('detalles')
      let ok = 0
      for (const f of otherFiles) { if (await uploadResourceNode(f, sid)) { ok++; toast(t('v2.attachedToConversation', '📎 {{name}} adjuntado a la conversación', { name: f.name })) } }
      if (ok > 0) {
        const label = ok === 1 ? `**${otherFiles[0].name}**` : t('v2.filesCount', '{{count}} archivos', { count: ok })
        aiChatStore.addNotice(t('v2.filesIncorporatedNotice', 'He incorporado {{label}} a esta conversación. Ya puedes preguntarme sobre su contenido.', { label }))
      }
    } else {
      // Sin conversación → importar a Fromly (RAG), sin iniciar chat.
      const id = await importFilesToFromly(otherFiles, captureParentId())
      if (id) setCenterElementId(id)
    }
  }

  // Toast unificado (mismo canal que el resto de la app).
  const toast = (message: string, type: 'success' | 'error' = 'success') =>
    window.dispatchEvent(new CustomEvent('from:toast', { detail: { message, type } }))

  // Crea el nodo-recurso de un archivo YA importado desde Drive (la subida a R2
  // la hizo el servidor en /google/drive/import) — mismo `extraData` que
  // `uploadResourceNode`, sin repetir la subida.
  const createDriveResourceNode = (result: DriveImportResult, parentId: string | null): string => {
    const node = store.createNode({ text: result.name.replace(/\.[^.]+$/, ''), parentId })
    store.updateNode(node.id, { isResource: true, extraData: JSON.stringify({ _resourceUrl: result.publicUrl, _resourceKey: result.key, _resourceType: result.resourceType }) })
    return node.id
  }

  // Botón "Adjuntar desde Drive" del composer — MISMO comportamiento dual que
  // soltar un archivo (onFilesDropped): con conversación activa se adjunta
  // ahí, sin conversación se importa al contexto/día activo.
  const onOpenDrivePicker = async () => {
    let result: DriveImportResult | null
    try {
      result = await pickAndImportDriveFile()
    } catch {
      toast(t('v2.driveImportFailed', 'No se pudo importar desde Google Drive'), 'error')
      return
    }
    if (!result) return // cancelado en el Picker, o redirigido a conectar Drive

    if (aiChatStore.sessionId) {
      const sid = aiChatStore.sessionId
      setDetailNodeId(null); setRightMode('detalles')
      createDriveResourceNode(result, sid)
      toast(t('v2.attachedToConversation', '📎 {{name}} adjuntado a la conversación', { name: result.name }))
      aiChatStore.addNotice(t('v2.filesIncorporatedNotice', 'He incorporado {{label}} a esta conversación. Ya puedes preguntarme sobre su contenido.', { label: `**${result.name}**` }))
    } else {
      const id = createDriveResourceNode(result, captureParentId())
      setCenterElementId(id)
      toast(t('v2.importedToFromly', '📥 {{name}} importado a Fromly', { name: result.name }))
    }
  }

  // Dónde nace el contenido creado desde el centro: el contexto activo o el diario de hoy.
  const captureParentId = (): string | null => {
    if (selectedCtxId) return selectedCtxId
    try { return getTodayDiaryUnderAgenda().id } catch { return null }
  }

  // Guardar una nota de voz grabada en el centro → se abre en el reproductor a la derecha.
  const onAudioSaved = (r: { audioKey: string; durationSec: number; transcript: string }) => {
    const parentId = captureParentId()
    if (!parentId || !r.audioKey) return
    const title = (r.transcript || '').trim().slice(0, 60) || t('v2.voiceNote', 'Nota de voz')
    const n = store.createNode({ text: title, parentId })
    store.updateNode(n.id, {
      extraData: JSON.stringify({ _audios: [{ audioKey: r.audioKey, durationSec: r.durationSec, transcript: r.transcript }] }),
    })
    setCenterElementId(n.id)
  }
  const recorder = useV2Recorder(onAudioSaved)

  // Adjuntar desde Drive / grabar audio EN UN CONTEXTO CONCRETO del sidebar (no
  // necesariamente el activo) — mismo patrón que onNewNoteInCtx/onNewChatInCtx.
  // onDriveInCtx cierra cualquier conversación activa ANTES de abrir el picker:
  // si no, onOpenDrivePicker() vería `aiChatStore.sessionId` todavía puesto y
  // adjuntaría el archivo a esa conversación ajena en vez de importarlo al
  // contexto elegido en el menú (Alberto, 22 jul: "todos los botones
  // superiores ahora se pueden quitar porque ya están incorporados en el
  // sidebar. si alguno falta, añádelo también").
  const onDriveInCtx = (ctxId: string | null) => {
    setShowProfile(false)
    setSelectedCtxId(ctxId)
    aiChatStore.startNewSession()
    onOpenDrivePicker()
  }
  const onRecordInCtx = (ctxId: string | null) => {
    setShowProfile(false)
    setSelectedCtxId(ctxId)
    recorder.start()
  }

  const onOpenNode = (id: string) => {
    setShowProfile(false)
    // Un CONTEXTO (marcado o área raíz) siempre abre su FICHA completa (tareas +
    // elementos + «Archivar» + «Lo que Fromly sabe»), sea cual sea la ruta de entrada
    // (sidebar, cockpit «Hoy», chip de contexto…). Antes solo la sidebar llegaba a
    // `onSelectCtx`; el resto caía en el detalle genérico (V2NoteBody) y perdía Archivar.
    const node = store.getNode(id)
    if (isMarkedContext(node) || isRootContext(id)) { onSelectCtx(id); return }

    // Una CONVERSACIÓN nunca se abre como detalle genérico (Alberto, 15 jul: "eso
    // es una conversación, entonces debería guardarse como conversación... no
    // abrirse en la columna derecha, sino... abrirse en el espacio de chat como
    // conversación") — antes caía aquí abajo y se veía como un nodo del outliner
    // clásico ("Convertir a documento"), porque una sesión de chat no es un
    // documento ni una nota, es su propia estructura (transcript + mensajes).
    if (node && parseExtraData(node.extraData)._aiSession === '1') { onOpenConversation(id); return }

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
    }
    const ctx = node ? firstContextOf(node) : null
    if (ctx) setSelectedCtxId(ctx.id)

    // Elemento normal: se abre en el ESPACIO CENTRAL (visor/editor según su
    // tipo), sustituyendo al chat — mismo patrón que el Perfil (Alberto, 22
    // jul). `detailNodeId`/columna derecha quedan reservados para el artifact
    // de la conversación ACTIVA, no para esto.
    setCenterElementId(id)
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
  // va sola a «Detalles» → se ve el panel de la conversación (Tareas/Elementos/Notas)
  // sin cambiar de tab a mano. Se dispara por mensaje (no por sessionId, que puede
  // venir persistido del reload), una sola vez por sesión, y solo desde la tab por
  // defecto «Hoy» para no pisar una elección deliberada (Elementos/Contexto/Agenda).
  // Contexto y Detalles son tabs independientes desde el 15 jul (Alberto: "debe haber
  // una forma de volver a la columna de contexto") — este efecto ya no necesita tocar
  // ni compararse con el estado de la ficha del contexto, que ahora vive aparte.
  const switchedFor = useRef<string | null>(null)
  useEffect(() => {
    const sid = chat.sessionId
    if (!sid || detailNodeId) return
    if (switchedFor.current === sid || rightMode !== 'hoy') return
    if (chat.messages.some(m => m.role === 'user')) {
      switchedFor.current = sid
      setRightMode('detalles')
    }
  }, [chat.sessionId, chat.messages.length])  // eslint-disable-line react-hooks/exhaustive-deps

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

  // Cerrar el detalle cuando un panel lo pide (p.ej. al ELIMINAR el elemento abierto) —
  // puede estar en la columna derecha (artifact) o en el espacio central.
  useEffect(() => {
    const h = () => { setDetailNodeId(null); setCenterElementId(null) }
    window.addEventListener('from:close-detail', h)
    return () => window.removeEventListener('from:close-detail', h)
  }, [])

  // Subrayar en un PDF → «Guardar» crea un HIGHLIGHT: nodo-cita buscable con `_pdfSelection`,
  // hijo del PDF de origen, que se lista como tipo propio en Elementos. (En el lienzo v1 esto
  // lo hace PizarraView; en v2 no hay lienzo montado, así que lo maneja el shell.)
  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent<{ text?: string; sourceNodeId?: string; page?: number | null; rects?: { x: number; y: number; w: number; h: number }[] }>).detail
      const text = (d?.text || '').trim()
      const sourceId = d?.sourceNodeId
      if (!text || !sourceId) return
      const src = store.getNode(sourceId)
      if (!src) return
      const extra: Record<string, string> = { _doc: '1', _ctext: '1', _pdfSelection: '1', _pdfSourceId: sourceId }
      if (d?.page != null) extra._pdfPage = String(d.page)
      // Rects normalizados de la selección → el visor los pinta como marca amarilla
      // persistente sobre la página (antes solo quedaba la cita en la lista 🖍, sin
      // marca visual en el propio PDF).
      if (d?.rects?.length) extra._pdfHlRects = JSON.stringify(d.rects)
      const quote = store.createNode({ text: '', parentId: sourceId, extraData: extra })
      const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      store.updateNode(quote.id, { body: `<blockquote><p>${esc(text)}</p></blockquote>` })
      toast(t('v2.highlightSaved', 'Subrayado guardado'))
    }
    window.addEventListener('from:pdf-send-to-canvas', h as EventListener)
    return () => window.removeEventListener('from:pdf-send-to-canvas', h as EventListener)
  }, [])

  // Paywall genérico — reutilizado tal cual (v1 lo monta en MainLayout; v2 no tenía
  // ningún listener/render todavía, así que el gate Pro de agentes no llegaba a mostrar
  // nada). Mismo evento `from:paywall` que dispara TokensError/límite de nodos en
  // client.ts, nodeStore.ts y ahora AgentPropertiesPanel al intentar ACTIVAR un agente.
  const [paywallReason, setPaywallReason] = useState<'node_limit' | 'ai_limit' | null>(null)
  useEffect(() => {
    const h = (e: Event) => setPaywallReason((e as CustomEvent).detail?.reason ?? 'ai_limit')
    window.addEventListener('from:paywall', h)
    return () => window.removeEventListener('from:paywall', h)
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
  const contextLabel = focusNode?.text || ctxNode?.text || t('v2.general', 'General')

  if (!ready) {
    return <div className="v2-loading">{t('v2.loadingFromly', 'Cargando Fromly 2.0…')}</div>
  }

  if (settingsTab) {
    return (
      <ToastProvider>
      <div className="v2-root" style={{ ['--v2-right' as string]: '0px' }}>
        <V2SettingsNav activeTab={settingsTab} onSelect={setSettingsTab} onClose={() => setSettingsTab(null)} />
        <main className="v2-col v2-center" style={{ padding: 0 }}>
          <div className="settings-view-content" style={{ height: '100%' }}>
            <SettingsPaneContent activeTab={settingsTab} />
          </div>
        </main>
        <aside className="v2-col v2-right" />
        <span className="v2-version">{WEB_VERSION}</span>
      </div>
      </ToastProvider>
    )
  }

  return (
    <ToastProvider>
    <div className="v2-root" style={{ ['--v2-right' as string]: `${rightWidth}px` }}>
      <V2Sidebar selectedCtxId={selectedCtxId} onSelectCtx={onSelectCtx} onNewChat={onNewChat} onNewChatInCtx={onNewChatInCtx} onNewNoteInCtx={onNewNoteInCtx} onNewCanvasInCtx={onNewCanvasInCtx} onDriveInCtx={onDriveInCtx} onRecordInCtx={onRecordInCtx} onFilesDropped={onFilesDropped} onDragStateChange={setImportDragOver} onOpenSettings={() => setSettingsTab('cuenta')} onOpenConversation={onOpenConversation} onOpenProfile={() => { setCenterElementId(null); setShowProfile(true) }} />
      {centerElementId ? (
        <V2ElementView nodeId={centerElementId} onClose={() => setCenterElementId(null)} onSelectCtx={onSelectCtx} onOpenElementsFiltered={onOpenElementsFiltered} hideBack />
      ) : showProfile ? (
        <V2ProfileView onClose={() => setShowProfile(false)} />
      ) : (
        <V2Chat
          currentNodeId={currentNodeId}
          contextLabel={contextLabel}
          onFilesDropped={onFilesDropped}
          // La tab Día ya NO usa este overlay: abre la nota diaria del día en el
          // centro (ver el useEffect de viewMode==='day' en PlannerPanel.tsx),
          // que sustituye por completo al chat — más específico que mantener
          // aquí el planificador de semana/mes/año (Alberto, 22 jul: "en el
          // centro una nota diaria... cada vez que se abre un día, se abre su
          // nota diaria").
          showPlanner={rightMode === 'hoy'}
        />
      )}
      <V2RightColumn
        mode={rightMode}
        onMode={setRightMode}
        selectedCtxId={selectedCtxId}
        onOpenNode={onOpenNode}
        onStartAbout={onStartAbout}
        onSelectCtx={onSelectCtx}
        detailNodeId={detailNodeId}
        onCloseDetail={() => { setDetailNodeId(null); setRightMode(lastNonDetailModeRef.current) }}
        onResize={setRightWidth}
        activeSessionId={chat.sessionId}
        onOpenConversation={onOpenConversation}
        importDragOver={importDragOver}
        elementsFilter={elementsFilter}
        onOpenElementsFiltered={onOpenElementsFiltered}
        recorder={recorder}
      />
      {rowMenu && <RightColMenu nodeId={rowMenu.nodeId} x={rowMenu.x} y={rowMenu.y} onClose={() => setRowMenu(null)} />}
      {showCapture && (
        <UnifiedCapture
          onClose={() => setShowCapture(false)}
          onSelectContext={id => { onSelectCtx(id); setShowCapture(false) }}
        />
      )}
      <V2Onboarding />
      {paywallReason && <PaywallModal reason={paywallReason} onClose={() => setPaywallReason(null)} />}
      <span className="v2-version">{WEB_VERSION}</span>
    </div>
    </ToastProvider>
  )
}
