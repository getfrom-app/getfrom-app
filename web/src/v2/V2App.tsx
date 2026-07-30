// ══════════════════════════════════════════════════════════════════════
// Fromly 2.0 — shell chat-first (beta aislada en /app/v2)
// No toca la v1. Monta sobre el MISMO motor (stores, sync, auth) de v1.
// El chat es el centro; la columna derecha reacciona; los contextos = proyectos.
// ══════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../store/nodeStore'
import { userStore } from '../store/userStore'
import { aiChatStore, useAIChat, markAgentResultSeen, markPendingConversationSeen, findOriginSession } from '../store/aiChatStore'
import { isDocNode } from '../utils/docNode'
import { parseExtraData } from '../utils/papeleraHelper'
import { getTodayDiaryUnderAgenda } from '../utils/agendaHelper'
import { isMarkedContext, isRootContext, firstContextOf, maybeUpdateContextKnowledge, contextParent, getOrCreateContextKnowledgeDoc } from '../utils/cajones'
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
import type { PaywallReason } from '../components/paywall/PaywallModal'
import V2UpgradeBanner from './components/V2UpgradeBanner'
import './styles/v2.css'

export const V2_VERSION = 'v2.0.0-beta.1'

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
  const [importDragOver, setImportDragOver] = useState(false) // arrastrando un archivo sobre la columna de contextos
  // Elemento abierto en el ESPACIO CENTRAL — regla ÚNICA de dónde vive cada cosa
  // (Alberto, 30 jul: "me parece confuso que a veces los elementos se abran a la
  // derecha, a veces al centro"). Si hay un elemento, es el centro; si no, el
  // centro es el chat general. La columna derecha (tab «Chat») SIEMPRE es la
  // conversación asociada a lo que hay aquí — la misma cada vez, nunca un
  // artifact aparte que compita por su propio hueco (ya no existe `detailNodeId`:
  // era exactamente la ambigüedad que causaba la confusión — un elemento a veces
  // en el centro, a veces «de artifact» a la derecha, sin regla predecible).
  //
  // ⚠️ DESACOPLADO de qué tab está activa (rediseño 30 jul, segunda vuelta): clicar
  // una tab NUNCA toca `centerElementId` (antes, ir a la tab Agenda vaciaba el
  // centro — quitado) y abrir un elemento cualquiera NUNCA cambia `rightMode`
  // (onOpenNode no lo toca; ver comentario en onOpenConversation). Dos excepciones
  // deliberadas, confirmadas explícitamente por Alberto, no descuidos:
  //   1. Seleccionar un CONTEXTO (onSelectCtx) SÍ navega a la tab Contexto — es
  //      cambiar de área de trabajo, no «abrir un elemento».
  //   2. Cuando el chat CREA un artifact, la tab SÍ salta a Chat — no es que «abrir
  //      un elemento cambie la tab», es que EL CHAT que estaba en el centro se
  //      traslada a la derecha porque el artifact ocupa su sitio; es el mismo chat
  //      relocalizándose, no una tab ajena reaccionando a algo que pasó en el centro.
  const [centerElementId, setCenterElementId] = useState<string | null>(null)
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
  // Depende de `centerElementId` — único lugar donde se abre un elemento ahora.
  useEffect(() => {
    if (!centerElementId) return
    const id = centerElementId
    return () => {
      const node = store.getNode(id)
      if (!node || node.deletedAt) return
      const ed = parseExtraData(node.extraData)
      if (ed._doc !== '1' || ed._v2canvas === '1') return
      const blank = !(node.text || '').trim() && (!node.body || node.body === '<p></p>' || !htmlToMarkdown(node.body).trim())
      if (blank && store.children(id).every(c => c.deletedAt)) store.deleteNode(id)
    }
  }, [centerElementId])

  // maybeUpdateContextKnowledge (cajones.ts) — compartida con aiChatExecutor.ts, que la
  // dispara también al crear contenido por chat (antes SOLO se disparaba aquí, al cerrar
  // una nota editada a mano; la mayoría del contenido de un producto chat-first se crea
  // por chat, así que la memoria del contexto casi nunca se alimentaba).
  useEffect(() => {
    if (!centerElementId) return
    const id = centerElementId
    const openNode = store.getNode(id)
    const snapshot = { text: openNode?.text || '', body: openNode?.body || '' }
    return () => {
      const node = store.getNode(id)
      if (!node || node.deletedAt) return
      if (node.text === snapshot.text && node.body === snapshot.body) return // nada cambió
      maybeUpdateContextKnowledge(node)
    }
  }, [centerElementId])

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
  // (vista de contexto: tareas + elementos + acceso a «Lo que Fromly sabe») — es
  // cambiar de área de trabajo, no «abrir un elemento», así que SÍ navega
  // (Alberto, 30 jul: confirmado explícitamente frente a la regla general de abajo).
  // El documento de memoria del contexto se abre en el CENTRO, como cualquier
  // documento (rediseño 30 jul: antes vivía embebido en esta misma columna,
  // compitiendo por espacio con tareas/elementos — "debería mostrarse en el
  // espacio central como un documento normal"). Ya no se intenta "retomar la
  // última conversación" del contexto (mostRecentConversationOf, 15 jul): con la
  // memoria como documento real, su chat asociado (getOrCreateElementSession) es
  // ahora el hilo canónico del contexto — la tab Chat lo encuentra solo. General
  // (id null) no tiene documento propio, así que limpia el centro y empieza un
  // chat en blanco, como siempre.
  const onSelectCtx = (id: string | null) => {
    setShowProfile(false)
    setSelectedCtxId(id)
    setFocusNodeId(null)
    setRightMode('contexto')
    if (id) {
      setCenterElementId(getOrCreateContextKnowledgeDoc(id).id)
    } else {
      setCenterElementId(null)
      aiChatStore.startNewSession()
    }
  }

  // Botón «Nueva conversación» (barra izquierda) → SIEMPRE sin contexto (General).
  const onNewChat = () => {
    setShowProfile(false)
    setCenterElementId(null)
    setSelectedCtxId(null)
    setFocusNodeId(null)
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

  // Abrir una conversación guardada: es un elemento como cualquier otro (Alberto,
  // 30 jul: "esa conversación sería un elemento por tanto va al centro") — al
  // centro, sin tocar la tab activa. Se ve vía V2Chat (centerElementId null +
  // sesión cargada = exactamente lo que ya renderiza el chat general). Ya no hace
  // falta decidir "1 elemento adjunto → ábrelo, si no → la conversación": los
  // elementos que nacieron de un chat encuentran SU chat solos al abrirlos
  // (`onOpenNode` → `findOriginSession`) — no hay un caso especial que resolver
  // aquí, la conversación en sí ya no tiene una vista "de artifact" separada.
  const onOpenConversation = (id: string) => {
    setShowProfile(false)
    markPendingConversationSeen(id) // quita el aviso "N esperando" al abrirla, no solo al responder
    aiChatStore.loadSession(id)
    // Mantener el contexto de la conversación en la barra lateral (antes se
    // limpiaba SIEMPRE — Alberto, 15 jul: "cuando se abre una conversación dentro
    // del contexto diario, se debería mantener ese contexto diario").
    const sessionNode = store.getNode(id)
    const sessionCtx = sessionNode ? firstContextOf(sessionNode) : null
    setSelectedCtxId(sessionCtx?.id ?? null)
    setFocusNodeId(null)
    setCenterElementId(null)
  }

  // «← Agentes»/«← Prompts» desde el detalle: cierra el detalle y abre la tab
  // Elementos ya filtrada por ese tipo (kind = ElemKind de ElementsPanel, p.ej.
  // 'agent'|'prompt').
  const onOpenElementsFiltered = (kind: ElemKind) => {
    setCenterElementId(null)
    setElementsFilter(kind)
    setRightMode('elementos')
  }

  // «Hablar de esto» (botón en la cabecera de un documento/tarea/PDF/imagen
  // abierto en el CENTRO, V2ElementView): el elemento YA es el centro — solo
  // hace falta enseñar la tab Detalles, que SIEMPRE muestra el chat asociado a
  // lo que hay en el centro (V2RightColumn → V2ElementChat →
  // aiChatStore.getOrCreateElementSession). No hay estado propio que gestionar
  // aquí: a diferencia del botón de antes, no crea una conversación nueva y
  // aislada cada vez — reutiliza la de siempre.
  const onOpenChatAbout = () => setRightMode('detalles')

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

    // Notas de texto: siempre se importan como documento, y siempre al centro —
    // como cualquier elemento nuevo (regla única, ver `centerElementId` arriba).
    // Si había conversación activa, su chat sigue disponible en la tab Detalles.
    let lastNote: string | null = null
    for (const f of textFiles) {
      try { const note = createMarkdownNode(captureParentId(), await f.text(), f.name, false); if (note) lastNote = note.id } catch { /* */ }
    }
    if (lastNote) { setCenterElementId(lastNote); setRightMode('detalles') }

    if (!otherFiles.length) return

    // Adjuntar archivos (no texto plano) requiere plan de pago — el servidor ya
    // lo rechaza en /files/upload (402 file_limit), esto evita el intento fallido
    // y muestra el paywall directamente en el punto de fricción real.
    if (!userStore.isPremium) {
      window.dispatchEvent(new CustomEvent('from:paywall', { detail: { reason: 'file_limit' } }))
      return
    }

    if (aiChatStore.sessionId) {
      // Hay conversación → adjuntar a ella.
      const sid = aiChatStore.sessionId
      setRightMode('detalles')
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
      setRightMode('detalles')
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
    markAgentResultSeen(id) // deja de avisar en la sidebar en cuanto se abre (ver aiChatStore.ts)
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
    // tipo), sustituyendo al chat — mismo patrón que el Perfil (Alberto, 22 jul).
    setCenterElementId(id)
  }

  // Artifacts: cuando la IA crea un documento/nota/recurso en una conversación
  // (general o ya centrada en un elemento), ese artifact pasa a ser el CENTRO —
  // la MISMA conversación sigue disponible en la tab Detalles (la encuentra sola,
  // `getOrCreateElementSession`→`findOriginSession` resuelve el nuevo nodo como
  // hijo de esta sesión al instante, sin crear nada ni perder el hilo). Mismo
  // patrón que Claude: el chat se aparta, el artifact toma el centro. Detecta
  // el fin del turno.
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
        if (artifact) { setCenterElementId(artifact.id); setRightMode('detalles') }
      } catch { /* noop */ }
    }
    prevStreaming.current = chat.isStreaming
  }, [chat.isStreaming])  // eslint-disable-line react-hooks/exhaustive-deps

  // Al aparecer el PRIMER mensaje de usuario de una conversación GENERAL (sin
  // elemento en el centro), la columna derecha va sola a «Detalles» → se ve el
  // panel de la conversación (Tareas/Elementos/Notas) sin cambiar de tab a mano.
  // Se dispara por mensaje (no por sessionId, que puede venir persistido del
  // reload), una sola vez por sesión, y solo desde la tab por defecto «Hoy» para
  // no pisar una elección deliberada (Elementos/Contexto/Agenda). Si hay un
  // elemento en el centro, su tab Detalles ya muestra el chat en curso — este
  // efecto no tiene nada que hacer ahí.
  const switchedFor = useRef<string | null>(null)
  // Cualquier sesión que pase por el modo «elemento» (centerElementId puesto)
  // queda marcada como ya gestionada por el efecto de abajo. Sin esto: al
  // volver de un elemento con conversación ya iniciada a la tab Agenda (que
  // limpia `centerElementId`, ver el useEffect de `rightMode==='hoy'` más
  // arriba), la sesión "aparecía" por primera vez ante el efecto de abajo con
  // mensajes de usuario ya puestos → lo interpretaba como "primer mensaje
  // recién escrito" y devolvía la tab a Detalles, peleándose con el clic
  // explícito en Agenda (bug real, encontrado probando en vivo el 30 jul).
  useEffect(() => {
    if (centerElementId && chat.sessionId) switchedFor.current = chat.sessionId
  }, [centerElementId, chat.sessionId])

  useEffect(() => {
    const sid = chat.sessionId
    if (!sid || centerElementId) return
    if (switchedFor.current === sid || rightMode !== 'hoy') return
    if (chat.messages.some(m => m.role === 'user')) {
      switchedFor.current = sid
      setRightMode('detalles')
    }
  }, [chat.sessionId, chat.messages.length, centerElementId])  // eslint-disable-line react-hooks/exhaustive-deps

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

  // `from:open-artifact` — un elemento que el CHAT acaba de crear (agente, prompt…):
  // mismo destino que cualquier elemento (el centro, vía onOpenNode — ya no hay un
  // «artifact de la columna derecha» separado, ver `centerElementId` arriba), más
  // revelar la tab Detalles para que se vea su chat de inmediato.
  useEffect(() => {
    const h = (e: Event) => {
      const id = (e as CustomEvent).detail?.nodeId
      if (id) { onOpenNode(id); setRightMode('detalles') }
    }
    window.addEventListener('from:open-artifact', h as EventListener)
    return () => window.removeEventListener('from:open-artifact', h as EventListener)
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // Cerrar el elemento cuando un panel lo pide (p.ej. al ELIMINARLO estando abierto).
  useEffect(() => {
    const h = () => setCenterElementId(null)
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
  const [paywallReason, setPaywallReason] = useState<PaywallReason | null>(null)
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
      <V2Sidebar selectedCtxId={selectedCtxId} onSelectCtx={onSelectCtx} onNewChat={onNewChat} onNewChatInCtx={onNewChatInCtx} onNewNoteInCtx={onNewNoteInCtx} onNewCanvasInCtx={onNewCanvasInCtx} onDriveInCtx={onDriveInCtx} onRecordInCtx={onRecordInCtx} onFilesDropped={onFilesDropped} onDragStateChange={setImportDragOver} onOpenSettings={() => setSettingsTab('cuenta')} onOpenConversation={onOpenConversation} onOpenNode={onOpenNode} onOpenProfile={() => { setCenterElementId(null); setShowProfile(true) }} />
      {centerElementId ? (
        // ⚠️ `key` es OBLIGATORIO: sin él, al pasar de un elemento a otro (p.ej.
        // abrir una nota de Casa Alicante y luego la nota diaria de otro día
        // desde la tab Día) React reutiliza la MISMA instancia de V2ElementView
        // → V2DetailView → DocEditor en vez de desmontarla, y DocEditor tiene
        // varios efectos con cierres sobre `editor`/`node.id` que NO se
        // resincronizan de forma atómica entre renders — la editor instance de
        // TipTap (useEditor) tarda un render extra en recrearse tras cambiar de
        // id, y en esa ventana el texto de la nota VIEJA podía guardarse sobre
        // el nodo NUEVO (Alberto, 22 jul: "estaba viendo una tarea... al dar al
        // tab día... ese texto de esa tarea se ha copiado en la nota diaria").
        // Con `key={centerElementId}` React desmonta y monta desde cero, sin
        // ventana de solape posible.
        <V2ElementView key={centerElementId} nodeId={centerElementId} onClose={() => setCenterElementId(null)} onSelectCtx={onSelectCtx} onOpenElementsFiltered={onOpenElementsFiltered} onOpenChat={onOpenChatAbout} />
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
        onSelectCtx={onSelectCtx}
        elementId={centerElementId}
        onResize={setRightWidth}
        activeSessionId={chat.sessionId}
        onOpenConversation={onOpenConversation}
        importDragOver={importDragOver}
        elementsFilter={elementsFilter}
        onOpenElementsFiltered={onOpenElementsFiltered}
        recorder={recorder}
        onFilesDropped={onFilesDropped}
      />
      {rowMenu && <RightColMenu nodeId={rowMenu.nodeId} x={rowMenu.x} y={rowMenu.y} onClose={() => setRowMenu(null)} />}
      {showCapture && (
        <UnifiedCapture
          onClose={() => setShowCapture(false)}
          onSelectContext={id => { onSelectCtx(id); setShowCapture(false) }}
        />
      )}
      <V2Onboarding />
      <V2UpgradeBanner />
      {paywallReason && <PaywallModal reason={paywallReason} onClose={() => setPaywallReason(null)} />}
      <span className="v2-version">{WEB_VERSION}</span>
    </div>
    </ToastProvider>
  )
}
