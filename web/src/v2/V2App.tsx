// ══════════════════════════════════════════════════════════════════════
// Fromly 2.0 — shell chat-first (beta aislada en /app/v2)
// No toca la v1. Monta sobre el MISMO motor (stores, sync, auth) de v1.
// El chat es el centro; la columna derecha reacciona; los contextos = proyectos.
// ══════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../store/nodeStore'
import { userStore } from '../store/userStore'
import { aiChatStore, useAIChat, markAgentResultSeen, markPendingConversationSeen, findOriginSession } from '../store/aiChatStore'
import { isDocNode } from '../utils/docNode'
import { parseExtraData } from '../utils/papeleraHelper'
import { getTodayDiaryUnderAgenda } from '../utils/agendaHelper'
import { isMarkedContext, isRootContext, firstContextOf, maybeUpdateContextKnowledge, contextParent, getOrCreateContainerNotes, assignContext } from '../utils/cajones'
import ContextPicker from '../components/panels/ContextPicker'
import { darkenHex, lightenHex, hexToRgba } from '../utils/color'
import { htmlToMarkdown } from '../utils/htmlMarkdown'
import { createMarkdownNode } from '../utils/importMarkdown'
import { uploadFile } from '../api/client'
import { pickAndImportDriveFile } from '../utils/googleDrivePicker'
import type { DriveImportResult } from '../api/googleDrive'
import { useV2Recorder } from './useV2Recorder'
import PlannerPanel from '../components/panels/PlannerPanel'
import Icon from './components/Icon'
import V2Sidebar from './components/V2Sidebar'
import V2Chat from './components/V2Chat'
import V2ProfileView from './components/V2ProfileView'
import V2ElementView from './components/V2ElementView'
import V2RightColumn, { RightMode, type RightSubTab } from './components/V2RightColumn'
import V2SettingsNav from './components/V2SettingsNav'
import { SettingsPaneContent } from '../components/views/SettingsView'
import type { Tab as SettingsTab } from '../components/views/settingsNav'
import type { ElemKind } from '../components/panels/ElementsPanel'
import V2Onboarding from './components/V2Onboarding'
import V2AttachModal from './components/V2AttachModal'
import { maybeOfferProfileChat, openProfileChat } from './profileChat'
import { useWebPush } from '../hooks/useWebPush'
import RightColMenu from '../components/panels/RightColMenu'
import TaskPropsModal from '../components/modals/TaskPropsModal'
import { docOfTask } from '../utils/docTasks'
import UnifiedCapture from '../components/modals/UnifiedCapture'
import { ToastProvider } from '../components/Toast'
import { runStartupMigrations } from '../utils/appInit'
import PaywallModal from '../components/paywall/PaywallModal'
import type { PaywallReason } from '../components/paywall/PaywallModal'
import V2UpgradeBanner from './components/V2UpgradeBanner'
import NextEventBar from './components/NextEventBar'
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
  useWebPush()

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
  const [rightMode, setRightMode] = useState<RightMode>('agenda')
  const [importDragOver, setImportDragOver] = useState(false) // arrastrando un archivo sobre la columna de contextos
  // «Adjuntar» (V2AttachModal): archivo / enlace / Drive en un único sitio. Guarda
  // el contexto desde el que se abrió — lo que se adjunte nace ahí.
  const [attachCtx, setAttachCtx] = useState<{ id: string | null } | null>(null)
  // Elemento abierto en el ESPACIO CENTRAL — regla ÚNICA de dónde vive cada cosa
  // (Alberto, 30 jul: "me parece confuso que a veces los elementos se abran a la
  // derecha, a veces al centro"). Si hay un elemento, es el centro; si no, el
  // centro es el chat general. La columna derecha (tab «Chat») SIEMPRE es la
  // conversación asociada a lo que hay aquí — la misma cada vez, nunca un
  // artifact aparte que compita por su propio hueco (ya no existe `detailNodeId`:
  // era exactamente la ambigüedad que causaba la confusión — un elemento a veces
  // en el centro, a veces «de artifact» a la derecha, sin regla predecible).
  //
  // ⚠️ REDISEÑO 5 ago 2026 — Agenda/Elementos pasan de tabs de la columna
  // derecha a DESTINOS de la sidebar (junto a los contextos), y aparece un nuevo
  // destino «Chat» general (Alberto: "Elementos/Agenda/Día son generales, no de
  // un contexto — mezclarlas con Contexto/Chat en la misma fila confunde qué es
  // cada cosa"; sobre Chat: "debe haber algún chat en algún lugar fuera de
  // contextos... que se abra en columna derecha, y que cuando cree un elemento
  // este se abra en el lugar principal"). Regla que sigue vigente: abrir un
  // elemento cualquiera (`onOpenNode`) NUNCA cambia `rightMode` — solo revela la
  // Tab 2 "Chat" de la columna derecha (`rightSubTab`, ver V2RightColumn.tsx) si
  // no estaba ya visible. Elegir un destino en la sidebar (contexto real u
  // `onSelectGeneral`) SÍ fija `rightMode` — es cambiar de área de trabajo, no
  // «abrir un elemento». Chat/Agenda llevan además un centro fijo propio
  // (`onSelectGeneral` limpia o fija `centerElementId` según el destino) —
  // pulsarlos de nuevo en la sidebar siempre devuelve a esa vista por defecto,
  // cierre lo que cierre en el centro (mismo motivo que ya llevó a
  // `agendaResetKey`/`diaResetKey` el 4 ago, ahora vivo aquí en vez de en
  // V2RightColumn porque el clic ya no ocurre ahí).
  //
  // ⚠️ REDISEÑO 24 ago 2026 — Día vuelve a fusionarse en Agenda, esta vez para
  // quedarse: el timeline de un día ya se ve en el centro de Agenda (PlannerPanel
  // en semana, ahora 3 columnas con la elegida siempre en el centro — ver
  // `centerToday`/`initialDays` más abajo), así que un destino «Día» aparte con
  // su propia rejilla horaria era la MISMA vista duplicada. La nota diaria (antes
  // el centro exclusivo de «Día») pasa a vivir al pie de la columna derecha de
  // Agenda (V2RightColumn.tsx), debajo de atrasadas/sin fecha/futuro.
  //   · 'agenda' → centro = planner (semana 3 días/mes/año) · derecha =
  //     atrasadas/sin fecha/futuro + nota diaria al final.
  const [centerElementId, setCenterElementId] = useState<string | null>(null)
  // Ids del último lote de archivos subidos a la vez (2+) — para poder
  // asignarles un contexto compartido en un solo gesto (Alberto, 13 ago: "al
  // subir varios elementos... deberían agruparse para poder añadir contexto",
  // estilo la selección múltiple + "Agrupar" del proyecto hermano "brain").
  // `needsContext` = se subieron a General/sin contexto (no había `selectedCtxId`
  // en el momento de soltar) — solo ENTONCES hace falta el botón "Asignar contexto
  // a todos": si ya se soltaron DENTRO de un contexto concreto, cada elemento nace
  // con ese contexto (via `captureParentId`) y preguntar de nuevo es redundante
  // (Alberto, 24 ago: "cuando subes varios elementos a un contexto ya tienen que
  // tener ese contexto por tanto no es necesario que aparezca. si se sube a
  // General sí que debe aparecer").
  const [batchUploadIds, setBatchUploadIds] = useState<{ ids: string[]; needsContext: boolean } | null>(null)
  const [batchPickerOpen, setBatchPickerOpen] = useState(false)
  const batchAddBtnRef = useRef<HTMLButtonElement>(null)
  const [batchPickerUp, setBatchPickerUp] = useState(false)
  // Cuál de las 1-2 tabs de la columna derecha está activa — 'chat' solo tiene
  // efecto real si hay algo en `centerElementId` (V2RightColumn lo calcula de
  // forma defensiva, `effectiveSubTab`). Se resetea a 'primary' cada vez que
  // cambia el destino activo (contexto u `onSelectGeneral`); pasa a 'chat' cuando
  // algo revela su propio chat (abrir un elemento con "Hablar de esto", un
  // artifact recién creado por el chat general, etc.) — ver cada sitio abajo.
  const [rightSubTab, setRightSubTab] = useState<RightSubTab>('primary')
  // Ajustes a pantalla completa: null = modo normal; si no, la pestaña activa.
  // Sustituye al modal — nav a la izquierda (donde van los contextos), contenido
  // al centro, columna derecha vacía.
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null)
  const [showProfile, setShowProfile] = useState(false)

  /** «Perfil»: la nota del perfil ocupa el centro y, a la derecha, Fromly abre una
   *  conversación cuyo único fin es ampliarlo — pregunta distinta cada vez, y lo
   *  que el usuario cuente se incorpora al perfil solo (v2/profileChat.ts).
   *  Es el destino Chat: así la columna derecha ya trae su propio composer y su
   *  tab de Historial, sin inventar una superficie nueva. */
  const onOpenProfile = () => {
    setCenterElementId(null)
    setSelectedCtxId(null)
    setFocusNodeId(null)
    setShowProfile(true)
    setRightMode('chat')
    setRightSubTab('primary')
    openProfileChat()
  }
  const [elementsFilter, setElementsFilter] = useState<ElemKind | 'all' | 'favorite' | null>(null) // filtro inicial pedido para la tab Elementos (p.ej. «← Agentes»)
  const [rightWidth, setRightWidth] = useState(() => {
    const v = Number(localStorage.getItem('v2_right_w'))
    return v >= 320 && v <= 900 ? v : 440
  })
  // Día centrado en el Planner del destino Agenda (semana/mes/año, `PlannerPanel
  // centerToday`) — alimenta qué nota diaria embebe `V2RightColumn` al pie de la
  // columna derecha (antes fija a la de HOY; Alberto, 24 ago 2026: "al hacer
  // clic en otro día en el planificador, debería abrir la nota de ese otro
  // día"). Arranca en hoy, como el propio Planner (`PlannerPanel.centerDate`).
  const [agendaCenterDate, setAgendaCenterDate] = useState(() => new Date())
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

  // Arranque en frío: Agenda es el destino por defecto (`rightMode` ya nace
  // así) — su centro es el planner, sin elemento que fijar (la nota diaria
  // vive al pie de la columna derecha, ver V2RightColumn.tsx). Se difiere a que
  // `ready` sea `true` solo para lo que sigue: ofrecer ampliar el perfil.
  useEffect(() => {
    if (!ready) return
    // Fromly ofrece ampliar el perfil por su cuenta cada cierto tiempo. NO abre
    // nada: crea la conversación con `_pendingReply`, que la sidebar ya pinta como
    // aviso («1 conversación esperando») — el usuario entra cuando quiere. Todas
    // las condiciones (cada cuánto, si hay material nuevo, si ya hay una sin
    // responder) viven en `maybeOfferProfileChat`, no aquí.
    try { maybeOfferProfileChat() } catch { /* nunca debe romper el arranque */ }
  }, [ready]) // eslint-disable-line react-hooks/exhaustive-deps

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
    setRightSubTab('primary')
    if (id) {
      // El centro de un contexto es la NOTA DEL USUARIO, no la memoria de la IA
      // (Alberto, 6 ago 2026: "no creo que deba usar la nota de contexto, porque puede
      // ser confuso para el usuario"). Hasta hoy se abría aquí
      // `getOrCreateContextKnowledgeDoc`: un documento que Fromly reescribe solo y que
      // parecía la nota del contexto — nadie podía saber qué había escrito él y qué la
      // IA. La memoria sigue viva y alimentándose igual, pero OCULTA (`_ctxMemory`), y
      // se consulta desde el menú ··· del contexto.
      setCenterElementId(getOrCreateContainerNotes(id).id)
    } else {
      setCenterElementId(null)
      aiChatStore.startNewSession()
    }
  }

  // Handler de las 3 filas del bloque General de la sidebar (Agenda/Chat/
  // Elementos) — hermano de `onSelectCtx`, para los destinos que NO son un
  // contexto real. Siempre limpia `selectedCtxId` (estos destinos son "sin
  // contexto" por definición — mutuamente excluyentes con la selección de un
  // contexto real en la sidebar) y vuelve a la Tab 1 de la columna derecha.
  // (Día se fusionó en Agenda el 24 ago 2026 — ver el comentario de
  // `centerElementId` más arriba.)
  const onSelectGeneral = (dest: 'agenda' | 'chat' | 'elementos') => {
    setShowProfile(false)
    setSelectedCtxId(null)
    setFocusNodeId(null)
    setRightSubTab('primary')
    setRightMode(dest)
    if (dest === 'agenda') {
      // El centro ES el planificador (semana/mes/año), así que no hay elemento
      // abierto — igual que el destino Chat. La nota diaria de hoy vive al pie
      // de la columna derecha (V2RightColumn.tsx), no en el centro.
      setCenterElementId(null)
    } else if (dest === 'chat') {
      // YA NO retoma la conversación general que hubiera (27 ago 2026, Alberto:
      // "en el caso de web creo que es mejor que sean chats individuales y que
      // haya un histórico de chats igual que en los chats de los contextos" —
      // a diferencia de un contexto, que sí retoma SU documento/hilo propio, el
      // destino Chat general no tiene "un" hilo: cada conversación es su propio
      // nodo (`_aiSession`) desde siempre, lo único que cambiaba era que aquí
      // se re-abría la última sin preguntar. Con la sesión vacía, `V2Chat`
      // enseña su propio estado vacío (contextos + "General" con historial y
      // "Nueva conversación", el mismo componente que ya usan los contextos) en
      // vez de continuar el hilo de la última vez.
      setCenterElementId(null)
      aiChatStore.startNewSession()
    } else if (dest === 'elementos') {
      // Un clic normal en la fila Elementos siempre debe abrir «Todos» — sin esto,
      // `elementsFilter` se quedaba pegado al último filtro pedido por «← Agentes»/
      // «← Prompts» (`onOpenElementsFiltered`, que sí lo pone explícitamente) y
      // reaparecía cada vez que se volvía aquí por cualquier otro camino, incluso
      // después de que el usuario hubiera elegido «Todos» a mano dentro del propio
      // panel (auditoría, 4 ago 2026). `onOpenElementsFiltered` llama a
      // `setRightMode` directamente (no a este handler), así que no compite con esto.
      setElementsFilter(null)
      // El centro arranca VACÍO — era el único destino general que no lo tocaba, así
      // que heredaba lo que hubiera antes y parecía aleatorio (Alberto, 5 ago 2026:
      // "aparece el chat, nueva conversación... lo cual no tiene sentido"). En
      // Elementos el centro es el elemento que abras de la lista; hasta entonces,
      // hueco propio.
      setCenterElementId(null)
    }
  }

  // «＋» al pasar el ratón sobre un contexto → nueva conversación DENTRO de ese contexto.
  // Al escribir el 1er mensaje, send() la vincula al contexto (assignContext) → sale en
  // su Historial y su ficha. No es el destino Chat GENERAL (ese es sin contexto) — se
  // queda en `rightMode='contexto'` como `onSelectCtx`, pero con la Tab 2 "Chat" ya
  // enfocada para enseñar la conversación recién empezada en vez de la Ficha.
  const onNewChatInCtx = (id: string | null) => {
    setShowProfile(false)
    setSelectedCtxId(id)
    setFocusNodeId(null)
    setRightMode('contexto')
    setRightSubTab('chat')
    if (id) {
      // El centro de un contexto es la NOTA DEL USUARIO, no la memoria de la IA
      // (Alberto, 6 ago 2026: "no creo que deba usar la nota de contexto, porque puede
      // ser confuso para el usuario"). Hasta hoy se abría aquí
      // `getOrCreateContextKnowledgeDoc`: un documento que Fromly reescribe solo y que
      // parecía la nota del contexto — nadie podía saber qué había escrito él y qué la
      // IA. La memoria sigue viva y alimentándose igual, pero OCULTA (`_ctxMemory`), y
      // se consulta desde el menú ··· del contexto.
      setCenterElementId(getOrCreateContainerNotes(id).id)
    } else {
      setCenterElementId(null)
    }
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
    // Excepción a "abrir un elemento nunca cambia la tab activa": si venimos del
    // tab «Historial» (destino Chat), la conversación que acabamos de abrir se
    // pinta justo en la tab que estamos dejando atrás — sin esto el Historial se
    // queda en pantalla y la conversación no se ve en ningún sitio. Solo afecta
    // a ese sub-tab; el resto de la navegación se mantiene intacta.
    setRightSubTab(prev => (prev === 'historial' ? 'primary' : prev))
  }

  // «← Agentes»/«← Prompts» desde el detalle: cierra el detalle y abre la tab
  // Elementos ya filtrada por ese tipo (kind = ElemKind de ElementsPanel, p.ej.
  // 'agent'|'prompt').
  const onOpenElementsFiltered = (kind: ElemKind) => {
    setCenterElementId(null)
    setElementsFilter(kind)
    setRightMode('elementos')
  }

  const isTextFile = (f: File) => /\.(md|markdown|txt)$/i.test(f.name) || f.type === 'text/markdown' || f.type === 'text/plain'

  // Sube un archivo a R2 y crea su nodo-recurso bajo `parentId`. Devuelve el id o null.
  //
  // ⚠️ Antes: `createNode` (sin extraData) y LUEGO `updateNode` con la clave R2 —
  // dos ops de sync distintas (`create` + `set`) en dos POST /ops/push separados,
  // con debounce propio cada una. Al subir varias fotos/PDFs seguidos, la ráfaga
  // de pushes podía hacer que el `set` de un nodo llegase y se aplicara ANTES de
  // que su `create` hubiera materializado en el servidor — el `UPDATE` de
  // `materializeOps` no comprueba filas afectadas, así que el nodo se quedaba sin
  // fila real en `sync_nodes` para siempre (visible solo en el dispositivo que lo
  // subió, por el estado local optimista — nunca sincronizaba a otros, ver
  // FROM.md). Ahora se sube PRIMERO y se crea el nodo UNA sola vez, con la clave
  // R2 ya dentro: una única op `create` con todo el dato, sin ventana de carrera.
  const uploadResourceNode = async (f: File, parentId: string | null): Promise<string | null> => {
    try {
      const { key, publicUrl } = await uploadFile(f)
      const resourceType = f.type.startsWith('image/') ? 'image' : f.type === 'application/pdf' ? 'pdf' : 'file'
      const node = store.createNode({
        text: f.name.replace(/\.[^.]+$/, ''), parentId,
        isResource: true,
        extraData: { _resourceUrl: publicUrl, _resourceKey: key, _resourceType: resourceType },
      })
      return node.id
    } catch {
      toast(t('v2.uploadFailed', 'No se pudo subir {{name}}', { name: f.name }), 'error')
      return null
    }
  }

  // Importa archivos a Fromly bajo `parentId` SIN crear conversación (.md → nota; resto →
  // recurso). Se usa al soltar sobre la columna de contextos (o sobre el chat sin conversación).
  // Devuelve TODOS los ids creados (no solo el último) — subir varios a la vez necesita
  // poder agruparlos después para asignarles contexto de una sola vez (Alberto, 13 ago:
  // "al subir varios elementos en la web deberían agruparse para poder añadir contexto").
  const importFilesToFromly = async (files: File[], parentId: string | null): Promise<string[]> => {
    const ids: string[] = []
    for (const f of files) {
      if (isTextFile(f)) {
        try { const note = createMarkdownNode(parentId, await f.text(), f.name, false); if (note) ids.push(note.id) } catch { /* */ }
      } else {
        const id = await uploadResourceNode(f, parentId)
        if (id) { ids.push(id); toast(t('v2.importedToFromly', '{{name}} importado a Fromly', { name: f.name })) }
      }
    }
    return ids
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
    if (lastNote) { setCenterElementId(lastNote); setRightSubTab('chat') }

    if (!otherFiles.length) return

    // Adjuntar archivos (no texto plano) requiere plan de pago — el servidor ya
    // lo rechaza en /files/upload (402 file_limit), esto evita el intento fallido
    // y muestra el paywall directamente en el punto de fricción real.
    if (!userStore.hasAccess) {
      window.dispatchEvent(new CustomEvent('from:paywall', { detail: { reason: 'file_limit' } }))
      return
    }

    if (aiChatStore.sessionId) {
      // Hay conversación → adjuntar a ella. Si ya hay algo centrado, su Tab 2
      // "Chat" enseña esta conversación; si no, es el destino Chat general.
      const sid = aiChatStore.sessionId
      if (centerElementId) setRightSubTab('chat'); else setRightMode('chat')
      let ok = 0
      for (const f of otherFiles) { if (await uploadResourceNode(f, sid)) { ok++; toast(t('v2.attachedToConversation', '{{name}} adjuntado a la conversación', { name: f.name })) } }
      if (ok > 0) {
        const label = ok === 1 ? `**${otherFiles[0].name}**` : t('v2.filesCount', '{{count}} archivos', { count: ok })
        aiChatStore.addNotice(t('v2.filesIncorporatedNotice', 'He incorporado {{label}} a esta conversación. Ya puedes preguntarme sobre su contenido.', { label }))
      }
    } else {
      // Sin conversación → importar a Fromly (RAG), sin iniciar chat.
      const needsContext = !selectedCtxId
      const ids = await importFilesToFromly(otherFiles, captureParentId())
      if (ids.length) setCenterElementId(ids[ids.length - 1])
      // Varios a la vez → ofrecer agruparlos con un contexto compartido en un
      // solo gesto, en vez de abrir cada uno y asignárselo por separado
      // (estilo brain: seleccionar varios → una acción de grupo). Solo hace
      // falta el botón de asignar cuando fueron a General (`needsContext`);
      // dentro de un contexto concreto ya nacen con él.
      if (ids.length > 1) setBatchUploadIds({ ids, needsContext })
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
      if (centerElementId) setRightSubTab('chat'); else setRightMode('chat')
      createDriveResourceNode(result, sid)
      toast(t('v2.attachedToConversation', '{{name}} adjuntado a la conversación', { name: result.name }))
      aiChatStore.addNotice(t('v2.filesIncorporatedNotice', 'He incorporado {{label}} a esta conversación. Ya puedes preguntarme sobre su contenido.', { label: `**${result.name}**` }))
    } else {
      const id = createDriveResourceNode(result, captureParentId())
      setCenterElementId(id)
      toast(t('v2.importedToFromly', '{{name}} importado a Fromly', { name: result.name }))
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

  /** Abre «Adjuntar» (archivo / enlace / Drive). Sustituye al botón «Drive» suelto
   *  de la sidebar — Drive es ahora una de las tres vías, no la única. */
  const onOpenAttach = (ctxId: string | null) => {
    setShowProfile(false)
    setSelectedCtxId(ctxId)
    // Igual que `onDriveInCtx`: cerrar la conversación activa ANTES, o lo adjuntado
    // acabaría dentro de un chat ajeno en vez de en el contexto elegido.
    aiChatStore.startNewSession()
    setAttachCtx({ id: ctxId })
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

    // Una tarea DE UN DOCUMENTO abre el DOCUMENTO, no una ficha de tarea suelta
    // (Alberto, 6 ago 2026: "no sería una tarea separada del documento, sino que al
    // hacer clic sobre ella en cualquier parte se abriría el propio documento"). Va
    // aquí porque este es el punto único por el que pasan todas las aperturas —
    // cockpit, planner, columna del día, buscador y `from:open-detail`.
    const taskDoc = docOfTask(node)
    if (taskDoc && taskDoc.id !== id) {
      onOpenNode(taskDoc.id)
      // Tras montar el documento: resalta la tarea concreta (V2DocTasks la escucha).
      setTimeout(() => window.dispatchEvent(new CustomEvent('from:highlight-doc-task', { detail: { docId: taskDoc.id, taskId: id } })), 250)
      return
    }

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
    setSelectedCtxId(ctx ? ctx.id : null)
    // (3) Si pertenece a un contexto, la DERECHA también se va con él: ficha del
    // contexto en la Tab 1 y la conversación del elemento en la Tab 2 (Alberto,
    // 5 ago 2026: "desde planner le doy a una tarea, se abre la tarea y a la
    // izquierda aparece el contexto seleccionado. Pero además debería cambiar la
    // columna derecha y aparecer la columna de contexto y la de chat"). Es una
    // excepción DELIBERADA a "abrir un elemento nunca cambia `rightMode`": sin
    // ella la izquierda decía «Marina Alta» mientras la derecha seguía enseñando
    // la agenda, tres columnas hablando de dos cosas distintas. Si el elemento no
    // tiene contexto (una nota diaria, p.ej.) no se toca nada: el destino actual
    // sigue siendo el correcto.
    if (ctx) {
      setRightMode('contexto')
      setRightSubTab('primary')
    }

    // Tarea o evento SIN contexto: la columna derecha se va directa a su Chat
    // — antes se quedaba en la tab del destino activo (p.ej. "Agenda"), que
    // para una tarea concreta no aporta nada (Alberto, 26 ago 2026: "la
    // columna de la derecha... debería ser el chat directamente"). Si SÍ
    // tiene contexto, la Tab 1 "Contexto" de arriba es la correcta y no se
    // toca (Alberto, mismo día, corrigiendo el primer fix: "si la tarea
    // tiene contexto, la pestaña contexto es correcta... cuando la tarea no
    // tiene contexto, que pase a chat, porque si no se aplica la columna del
    // contexto general y no tiene sentido").
    if (node && node.status != null && !ctx) {
      setRightSubTab('chat')
    }

    // Elemento normal: se abre en el ESPACIO CENTRAL (visor/editor según su
    // tipo), sustituyendo al chat — mismo patrón que el Perfil (Alberto, 22 jul).
    setCenterElementId(id)
  }

  // Si le CAMBIAN el contexto al elemento que ya está abierto, la izquierda y
  // la derecha lo siguen (27 ago 2026, Alberto: "si creo un documento... se
  // abre directamente y luego pongo contexto inversión, la columna derecha
  // cambiará al contexto inversión"). `onOpenNode` ya hacía este mismo ajuste,
  // pero solo AL ABRIR — un documento recién creado sin contexto (p. ej. desde
  // el destino Chat general) se abre correctamente, pero asignarle un contexto
  // DESPUÉS, con el documento ya en pantalla, no re-ejecuta esa lógica porque
  // no vuelve a pasar por `onOpenNode`. Este efecto reacciona al mismo dato
  // (`firstContextOf` del elemento centrado) cada vez que cambia, en vez de
  // solo una vez al abrir.
  useEffect(() => {
    if (!centerElementId) return
    const node = store.getNode(centerElementId)
    if (!node) return
    const ctx = firstContextOf(node)
    if (!ctx || ctx.id === selectedCtxId) return
    setSelectedCtxId(ctx.id)
    setRightMode('contexto')
    setRightSubTab('primary')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerElementId, store.nodesVersion])

  // Clic en una notificación de Web Push (sw.js): si la pestaña ya estaba
  // abierta, el service worker manda un postMessage; si la abrió de cero,
  // llega como ?openNode= en la URL. Los dos casos navegan igual que abrir
  // el elemento desde cualquier otro sitio de la app.
  useEffect(() => {
    if (!ready) return
    const params = new URLSearchParams(window.location.search)
    const fromUrl = params.get('openNode')
    if (fromUrl) {
      onOpenNode(fromUrl)
      params.delete('openNode')
      const rest = params.toString()
      window.history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : ''))
    }
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'from:push-open' && e.data.nodeId) onOpenNode(e.data.nodeId)
    }
    navigator.serviceWorker?.addEventListener('message', onMessage)
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage)
  }, [ready]) // eslint-disable-line react-hooks/exhaustive-deps

  // Artifacts: cuando la IA crea un documento/nota/recurso en una conversación
  // GENERAL (sin nada abierto en el centro), ese artifact pasa a ser el CENTRO —
  // la MISMA conversación sigue disponible en la tab Detalles (la encuentra sola,
  // `getOrCreateElementSession`→`findOriginSession` resuelve el nuevo nodo como
  // hijo de esta sesión al instante, sin crear nada ni perder el hilo). Mismo
  // patrón que Claude: el chat se aparta, el artifact toma el centro.
  //
  // ⚠️ Si YA había un elemento en el centro cuando empezó el turno (chat de un
  // elemento — V2ElementChat, ver `elementId` en V2RightColumn), NO se hace esto:
  // antes se pisaba sin más la nota que se estaba trabajando por la que acababa
  // de crear la IA, dejándola fuera del centro sin ningún aviso, y el propio
  // chat (embebido en la columna derecha de ESA nota) desaparecía con ella al
  // cambiar `centerElementId` (Alberto, 30 jul, caso real: pidió un dossier
  // desde el chat de una tarea y el documento nuevo se llevó por delante la
  // tarea en la que estaba trabajando). En ese caso el documento se queda
  // enlazado como chip clicable dentro del propio mensaje del chat (ver
  // V2Chat.tsx) — el usuario decide si quiere abrirlo, y al hacerlo sustituye
  // el centro de forma explícita, no automática.
  // Nota sobre la implementación: se comprueba el valor ACTUAL de `centerElementId`
  // en vez de "capturar" su valor al empezar el turno con un ref — nada más lo
  // toca durante un envío, así que el valor actual al terminar el streaming ya
  // ES equivalente a "qué había abierto antes de que la IA creara esto", sin
  // depender de la sincronía exacta de efectos (React StrictMode duplica el
  // montaje de efectos en desarrollo, lo que hacía frágil un ref de "inicio de
  // turno" separado — visto en vivo probando este mismo fix, 30 jul).
  const prevStreaming = useRef(false)
  useEffect(() => {
    if (prevStreaming.current && !chat.isStreaming && !centerElementId) {
      try {
        const last = [...chat.messages].reverse().find(m => m.role === 'assistant' && m.actions && m.actions.length > 0)
        const ids: string[] = last ? last.actions.flatMap((a: { createdIds?: string[] }) => a.createdIds || []) : []
        // Prioriza documentos/recursos; si no, la primera nota creada (no tareas sueltas).
        const nodes = ids.map(id => store.getNode(id)).filter(Boolean) as ReturnType<typeof store.getNode>[]
        const artifact = nodes.find(n => !!n && (isDocNode(n) || !!n.isResource))
          || nodes.find(n => !!n && n.status == null && !n.isEvent)
        if (artifact) { setCenterElementId(artifact.id); setRightSubTab('chat') }
      } catch { /* noop */ }
    }
    prevStreaming.current = chat.isStreaming
  }, [chat.isStreaming, centerElementId])  // eslint-disable-line react-hooks/exhaustive-deps

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
      if (id) { onOpenNode(id); setRightSubTab('chat') }
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

  // Propiedades de tarea (fecha, recurrencia, prioridad). El evento existía desde v1
  // pero SOLO lo escuchaba MainLayout, que ya no está montado en ninguna ruta: el chip
  // de fecha de una casilla dentro de un documento (TaskItemChip) no hacía nada. Aquí
  // no hace falta el guard del outliner de v1 — en la v2 esa fila no existe.
  const [taskPropsId, setTaskPropsId] = useState<string | null>(null)
  useEffect(() => {
    const h = (e: Event) => {
      const id = (e as CustomEvent).detail?.nodeId
      if (id) setTaskPropsId(id)
    }
    window.addEventListener('from:open-task-props', h as EventListener)
    return () => window.removeEventListener('from:open-task-props', h as EventListener)
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
        <NextEventBar onOpenBackups={() => setSettingsTab('backups')} onOpenAgents={() => { setSettingsTab(null); onOpenElementsFiltered('agent') }} />
      </div>
      </ToastProvider>
    )
  }

  // Arrastrar un archivo para importarlo — ya NO hace falta soltarlo justo
  // encima de la sidebar (limitación heredada de cuando el lienzo infinito era
  // el centro de la app y la sidebar era la única zona "segura" para soltar
  // sin interferir con él; el lienzo ya no es el protagonista, ver
  // `Pizarra y Documento` en FROM.md). Ahora vale cualquier punto de la
  // ventana: el listener vive en la raíz de la app, no en la sidebar (Alberto,
  // 26 ago 2026: "quiero que se pueda arrastrar a cualquier parte de la
  // pantalla"). `hasFiles` descarta arrastres internos (nodos, bloques del
  // planner…), que no llevan el tipo `Files` y no deben disparar la importación.
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types || []).includes('Files')
  const onRootDragOver = (e: React.DragEvent) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    if (!importDragOver) setImportDragOver(true)
  }
  const onRootDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as HTMLElement)) setImportDragOver(false)
  }
  const onRootDrop = (e: React.DragEvent) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    setImportDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length) onFilesDropped(files)
  }

  return (
    <ToastProvider>
    <div className="v2-root" style={{ ['--v2-right' as string]: `${rightWidth}px` }}
      onDragOver={onRootDragOver} onDragLeave={onRootDragLeave} onDrop={onRootDrop}>
      <V2Sidebar selectedCtxId={selectedCtxId} onSelectCtx={onSelectCtx} onSelectGeneral={onSelectGeneral} activeGeneralDest={selectedCtxId ? null : (rightMode === 'contexto' ? null : rightMode)} onNewChatInCtx={onNewChatInCtx} onNewNoteInCtx={onNewNoteInCtx} onNewCanvasInCtx={onNewCanvasInCtx} onOpenAttach={onOpenAttach} onRecordInCtx={onRecordInCtx} onOpenSettings={() => setSettingsTab('cuenta')} onOpenConversation={onOpenConversation} onOpenNode={onOpenNode} onOpenProfile={onOpenProfile} />
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
        <V2ElementView key={centerElementId} nodeId={centerElementId} onClose={() => setCenterElementId(null)} onSelectCtx={onSelectCtx} onOpenElementsFiltered={onOpenElementsFiltered} />
      ) : showProfile ? (
        <V2ProfileView onClose={() => setShowProfile(false)} />
      ) : rightMode === 'chat' ? (
        // Destino Chat general: el composer vive SOLO en la columna derecha (Tab
        // 1, ver V2RightColumn) — este hueco neutro evita un segundo composer
        // duplicado compitiendo por la misma sesión global.
        <main className="v2-col v2-center">
          <div className="v2-empty">
            <h1>{t('v2.generalChatCenterTitle', 'Lo que crees se abre en este espacio')}</h1>
            <p>{t('v2.generalChatCenterHint', 'Escribe en el chat de la derecha — cualquier nota, tarea o documento que cree se abrirá en este espacio.')}</p>
          </div>
        </main>
      ) : rightMode === 'elementos' ? (
        // Destino Elementos: la lista vive en la columna derecha y el centro es el
        // elemento que abras de ella — hasta entonces, hueco propio con las 4 formas
        // de crear algo nuevo (sin contexto, como el destino en sí). Antes caía en el
        // fallback `V2Chat` y aparecía un chat que no pinta nada aquí.
        <main className="v2-col v2-center">
          <div className="v2-empty">
            <h1>{t('v2.elementsCenterTitle', 'Elige un elemento de la lista')}</h1>
            <p>{t('v2.elementsCenterHint', 'Lo que abras a la derecha se verá aquí. O empieza algo nuevo:')}</p>
            <div className="v2-empty-actions">
              <button onClick={() => onNewNoteInCtx(null)}><Icon name="note" size={14} /> {t('v2.chat.newNote', 'Nota')}</button>
              <button onClick={() => onNewCanvasInCtx(null)}><Icon name="canvas" size={14} /> {t('v2.chat.newCanvasShort', 'Lienzo')}</button>
              <button onClick={() => onOpenAttach(null)}><Icon name="attachment" size={14} /> {t('v2.attach.title', 'Adjuntar')}</button>
              <button onClick={() => onRecordInCtx(null)}><Icon name="mic" size={14} /> {t('v2.chat.record', 'Grabar')}</button>
            </div>
          </div>
        </main>
      ) : rightMode === 'agenda' ? (
        // Destino Agenda: calendario semana/mes/año navegable a pantalla
        // completa (Alberto, 5 ago 2026: "Planner sería un lugar solamente para
        // organizar"). `centerToday` centra la columna de hoy en vez de pegarla
        // al borde derecho (comportamiento por defecto de PlannerPanel, que sigue
        // intacto para v1). Sin `onClose` propio: se sale pulsando otra fila de
        // la sidebar, como el resto de vistas centrales.
        // `initialDays={3}` (antes 7, 24 ago 2026): solo 3 columnas — el día
        // elegido/hoy SIEMPRE en el centro (`centerToday`), una a cada lado como
        // contexto — cada columna más ancha, con sitio real para leer un bloque
        // con hora. Esto ya ES el timeline de un día (con margen), así que el
        // destino «Día» aparte (rejilla horaria de una sola columna) se retiró
        // por duplicado — ver el comentario de `centerElementId` más arriba.
        <main className="v2-col v2-center">
          <PlannerPanel initialView="week" initialDays={3} viewTabs={['week', 'month', 'year']} onClose={() => {}} centerToday onCenterDateChange={setAgendaCenterDate} />
        </main>
      ) : (
        <V2Chat
          currentNodeId={currentNodeId}
          contextLabel={contextLabel}
          onFilesDropped={onFilesDropped}
          onOpenConversation={onOpenConversation}
          onNewChatInCtx={onNewChatInCtx}
          onSelectCtx={onSelectCtx}
        />
      )}
      <V2RightColumn
        mode={rightMode}
        selectedCtxId={selectedCtxId}
        onOpenNode={onOpenNode}
        onSelectCtx={onSelectCtx}
        elementId={centerElementId}
        onResize={setRightWidth}
        rightSubTab={rightSubTab}
        onSubTabChange={setRightSubTab}
        onNewChatInCtx={onNewChatInCtx}
        onOpenConversation={onOpenConversation}
        importDragOver={importDragOver}
        elementsFilter={elementsFilter}
        onOpenElementsFiltered={onOpenElementsFiltered}
        recorder={recorder}
        onFilesDropped={onFilesDropped}
        agendaDayNoteDate={agendaCenterDate}
      />
      {rowMenu && <RightColMenu nodeId={rowMenu.nodeId} x={rowMenu.x} y={rowMenu.y} onClose={() => setRowMenu(null)} />}
      {taskPropsId && <TaskPropsModal nodeId={taskPropsId} onClose={() => setTaskPropsId(null)} />}
      {showCapture && (
        <UnifiedCapture
          onClose={() => setShowCapture(false)}
          onSelectContext={id => { onSelectCtx(id); setShowCapture(false) }}
        />
      )}
      {attachCtx && (
        <V2AttachModal
          onClose={() => setAttachCtx(null)}
          onFiles={onFilesDropped}
          onOpenDrive={() => onDriveInCtx(attachCtx.id)}
          parentId={attachCtx.id ?? captureParentId()}
          onOpenNode={id => setCenterElementId(id)}
        />
      )}
      <V2Onboarding />
      <V2UpgradeBanner />
      {paywallReason && <PaywallModal reason={paywallReason} onClose={() => setPaywallReason(null)} />}
      {batchUploadIds && (
        <div className="v2-batchupload-bar">
          <span>{t('v2.batchUploadCount', '{{count}} elementos añadidos', { count: batchUploadIds.ids.length })}</span>
          {batchUploadIds.needsContext && (
            <div className="v2-ctxpick-wrap">
              <button
                ref={batchAddBtnRef}
                className="v2-ctx-add-btn"
                onClick={() => {
                  // Misma detección de espacio que RowContextChip: si no cabe
                  // hacia abajo (la barra vive pegada al borde inferior de la
                  // ventana), el desplegable se abre hacia ARRIBA en su lugar.
                  const r = batchAddBtnRef.current?.getBoundingClientRect()
                  setBatchPickerUp(!!r && window.innerHeight - r.bottom < 320)
                  setBatchPickerOpen(o => !o)
                }}
              >
                ＋ {t('v2.assignContextToAll', 'Asignar contexto a todos')}
              </button>
              {batchPickerOpen && batchAddBtnRef.current && createPortal((() => {
                const r = batchAddBtnRef.current!.getBoundingClientRect()
                const left = Math.max(8, Math.min(r.left, window.innerWidth - 268))
                const style: React.CSSProperties = batchPickerUp
                  ? { position: 'fixed', bottom: window.innerHeight - r.top + 4, left, zIndex: 3000 }
                  : { position: 'fixed', top: r.bottom + 4, left, zIndex: 3000 }
                return (
                  <div className="v2-ctxpick-pop" style={style} onClick={e => e.stopPropagation()}>
                    <ContextPicker
                      currentId={null}
                      onPick={id => {
                        if (id) { for (const nid of batchUploadIds.ids) assignContext(nid, id) }
                        setBatchPickerOpen(false)
                        setBatchUploadIds(null)
                      }}
                    />
                  </div>
                )
              })(), document.body)}
            </div>
          )}
          <button className="v2-batchupload-dismiss" onClick={() => { setBatchUploadIds(null); setBatchPickerOpen(false) }} aria-label={t('common.close', 'Cerrar')}>✕</button>
        </div>
      )}
      <NextEventBar onOpenBackups={() => setSettingsTab('backups')} onOpenAgents={() => onOpenElementsFiltered('agent')} />
    </div>
    </ToastProvider>
  )
}
