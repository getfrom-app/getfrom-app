// ══════════════════════════════════════════════════════════════════════
// Fromly 2.0 — shell chat-first (beta aislada en /app/v2)
// No toca la v1. Monta sobre el MISMO motor (stores, sync, auth) de v1.
// El chat es el centro; la columna derecha reacciona; los contextos = proyectos.
// ══════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
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
import DailyCockpit from '../components/views/DailyCockpit'
import V2BriefCard from './components/V2BriefCard'
import Icon from './components/Icon'
import V2Sidebar from './components/V2Sidebar'
import V2Chat from './components/V2Chat'
import V2ProfileView from './components/V2ProfileView'
import V2ElementView from './components/V2ElementView'
import V2ConversationView from './components/V2ConversationView'
import V2RightColumn, { RightMode, type RightSubTab } from './components/V2RightColumn'
import V2SettingsNav from './components/V2SettingsNav'
import { SettingsPaneContent } from '../components/views/SettingsView'
import type { Tab as SettingsTab } from '../components/views/settingsNav'
import ElementsPanel, { type ElemKind } from '../components/panels/ElementsPanel'
import V2Onboarding from './components/V2Onboarding'
import V2AttachModal from './components/V2AttachModal'
import { maybeOfferProfileChat } from './profileChat'
import { assistantStore } from '../store/assistantStore'
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
import { parsePizarra } from '../components/views/PizarraView'
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

/** Claves válidas de `Tab` (settingsNav.ts) — para validar el segmento de la
 *  URL antes de aceptarlo como pestaña de Ajustes (una URL escrita a mano o
 *  vieja no debe poder dejar `settingsTab` en un valor que rompa el nav). */
const SETTINGS_TABS = new Set<SettingsTab>([
  'cuenta', 'google', 'apariencia', 'ia', 'magic', 'asistente', 'atajos',
  'exportar', 'importar', 'backups', 'captura',
])

export default function V2App() {
  useStore()
  const { t } = useTranslation()
  const chat = useAIChat()
  const navigate = useNavigate()
  const location = useLocation()
  /** Prefijo de ruta actual — V2App se monta tanto en `/v2/*` (compatibilidad
   *  de enlaces antiguos) como en `/*` (raíz, la app principal). Las rutas que
   *  genera este componente deben respetar bajo cuál de los dos está montado,
   *  o navegar añadiría/perdería el prefijo `/v2` en cada paso. */
  const routeBase = location.pathname.startsWith('/v2') ? '/v2' : ''
  const [ready, setReady] = useState(store.isLoaded)
  const [loadFailed, setLoadFailed] = useState(false)
  const [loadRetry, setLoadRetry] = useState(0)
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
  // De dónde se abrió el elemento actual — para que "‹ Volver" restaure el
  // destino exacto de antes, no lo que sea que `onOpenNode` haya dejado
  // puesto (28 ago 2026, Alberto: "le doy al botón atrás, no vuelve a
  // Elementos sino aquí, una página que no es la correcta"). `onOpenNode`
  // cambia `rightMode` a 'contexto' cuando el elemento tiene uno (excepción
  // deliberada, ver más abajo) — sin este registro, cerrar el elemento dejaba
  // ese cambio puesto para siempre en vez de deshacerlo. Solo se captura al
  // pasar de "nada abierto" a "algo abierto" (no al saltar de un elemento a
  // otro ya con algo centrado) — así el origen real no se pisa a medio camino.
  const openOriginRef = useRef<{ rightMode: RightMode; selectedCtxId: string | null } | null>(null)
  // Espejo SIEMPRE actualizado de `rightMode`/`selectedCtxId`/`centerElementId`
  // para `onOpenNode` — este handler también se invoca desde un listener global
  // de `from:open-detail` registrado una sola vez con deps `[]` (más abajo), que
  // por tanto queda congelado con el cierre (closure) de su primer render: leer
  // el `useState` directamente ahí siempre devolvía el valor INICIAL ('agenda'),
  // nunca el actual. Sin esto, "‹ Volver" desde Elementos aterrizaba siempre en
  // Agenda en vez de en Elementos, pese a que el registro del origen (arriba)
  // parecía correcto — el bug estaba en qué valor se leía, no en la lógica de
  // guardarlo. Se actualizan en cada render (no en un efecto): son solo un
  // espejo de lectura, no disparan nada.
  const rightModeRef = useRef(rightMode)
  rightModeRef.current = rightMode
  const selectedCtxIdRef = useRef(selectedCtxId)
  selectedCtxIdRef.current = selectedCtxId
  const centerElementIdRef = useRef(centerElementId)
  centerElementIdRef.current = centerElementId
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
  //
  // ⚠️ URL real (28 ago 2026, primera pieza del router — auditoría "no se
  // puede compartir un enlace ni usar atrás/adelante dentro de la app"):
  // `settingsTab` deja de ser la fuente de verdad y pasa a DERIVARSE de
  // `location.pathname` vía el efecto de abajo — abrir/cerrar Ajustes ahora
  // es simplemente navegar a `${routeBase}/settings/:tab` o volver atrás, y
  // el efecto sincroniza el estado. Así el botón atrás del navegador cierra
  // Ajustes, refrescar la página con `/settings/apariencia` en la URL abre
  // esa pestaña directamente, y el enlace es compartible. Se eligió Ajustes
  // como primera pieza por ser una vista de pantalla completa aislada (no
  // interactúa con `centerElementId`/`rightMode`/`selectedCtxId`) — el resto
  // de destinos (elemento, contexto, chat) quedan para tandas futuras.
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null)
  useEffect(() => {
    const m = location.pathname.match(/\/settings\/([a-z]+)$/)
    const fromUrl = m && SETTINGS_TABS.has(m[1] as SettingsTab) ? (m[1] as SettingsTab) : null
    setSettingsTab(fromUrl)
  }, [location.pathname])
  /** Abrir Ajustes = navegar. El efecto de arriba deriva `settingsTab` de la
   *  URL resultante — no hace falta (ni conviene) llamar a setSettingsTab
   *  aquí también, sería una segunda fuente de verdad compitiendo con la 1ª. */
  const openSettings = (tab: SettingsTab) => navigate(`${routeBase}/settings/${tab}`)
  /** Cerrar Ajustes = volver a la ruta base. No `navigate(-1)`: si se llegó
   *  aquí por enlace directo o refresco (sin entrada previa en el historial
   *  de ESTA sesión), ir "atrás" saldría de la app. La ruta base siempre
   *  existe y es segura. */
  const closeSettings = () => navigate(routeBase || '/')
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
    // El destino Chat (Tab 1) SIEMPRE enseña el hilo GENERAL (currentNodeId=null,
    // ver V2RightColumn) — así que la pregunta de perfil tiene que salir justo
    // ahí, no en un hilo aparte que nadie mostraría.
    assistantStore.setThread(null)
    assistantStore.askProfileQuestion()
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
  // Los lienzos (`_v2canvas`) tienen su PROPIA rama: su "vacío" es JSON de
  // pizarra (`WBData` en PizarraView.tsx), no `<p></p>` — un lienzo nunca
  // tocado sí tiene texto/body vacíos como un documento normal, pero además
  // hay que comprobar que no tenga trazos/textos/conectores propios en el
  // JSON (E10 de la auditoría, 28 ago 2026: "un clic en Lienzo crea un
  // elemento persistente sin nombre y sin deshacer" — verificado en vivo, el
  // documento normal ya se limpiaba solo desde jul, el lienzo no).
  // Depende de `centerElementId` — único lugar donde se abre un elemento ahora.
  useEffect(() => {
    if (!centerElementId) return
    const id = centerElementId
    return () => {
      const node = store.getNode(id)
      if (!node || node.deletedAt) return
      const ed = parseExtraData(node.extraData)
      if (ed._doc !== '1') return
      const noTitle = !(node.text || '').trim()
      const noChildren = store.children(id).every(c => c.deletedAt)
      if (!noTitle || !noChildren) return
      if (ed._v2canvas === '1') {
        // El body de un lienzo no es JSON plano: va envuelto en una valla
        // ```from-pizarra — `parsePizarra` (PizarraView.tsx) ya sabe
        // desenvolverlo y da un WBData por defecto ante cualquier cosa rara.
        const wb = parsePizarra(node.body)
        const blank = !wb.strokes.length && !(wb.texts?.length) && !(wb.connectors?.length) && !(wb.tasks?.length)
        if (blank) store.deleteNode(id)
        return
      }
      const blank = !node.body || node.body === '<p></p>' || !htmlToMarkdown(node.body).trim()
      if (blank) store.deleteNode(id)
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

  // ⚠️ URL real, cuarta pieza del router (28 ago 2026 — Ajustes/elemento/
  // contexto en fases anteriores). A propósito de alcance LIMITADO: de
  // `rightMode` solo se sincronizan 'agenda' y 'elementos' (`/agenda`,
  // `/elementos`) — 'chat' se deja FUERA a propósito: `onSelectGeneral`
  // arranca SIEMPRE una sesión nueva al entrar en ese destino
  // (`aiChatStore.startNewSession()`, decisión de Alberto del 27 ago), así
  // que sincronizarlo con la URL haría que cada visita a un enlace/recarga
  // de `/chat` empezara una conversación en blanco — sorprendente, no lo que
  // alguien esperaría de "volver a donde estaba". La conversación en sí
  // (`aiChatStore`, store aparte del router) queda para otra fase.
  //
  // Precedencia elemento vs. contexto vs. destino general: `onSelectCtx(id)`
  // fija AMBOS `selectedCtxId` Y `centerElementId` (a la nota-contenedor del
  // propio contexto, `_containerNotes` — ver cajones.ts) — eso es "estás
  // viendo este contexto", URL `/context/:id`. Pero `onOpenNode` también fija
  // `selectedCtxId` como EFECTO SECUNDARIO al abrir una tarea/nota que
  // pertenece a un contexto (sin tocarlo, la izquierda no reflejaría dónde
  // vive) — eso sigue siendo "este elemento en concreto", URL
  // `/element/:id`, más específica. La forma de distinguir los dos casos sin
  // guardar un flag aparte: mirar si el nodo abierto en el centro ES la
  // nota-contenedor de su contexto. Sin nada de eso, cae a `rightMode`.
  //
  // Solo ida (estado → URL): PUSH solo en la transición nada-abierto→algo
  // (para que el botón atrás del navegador tenga un sitio simple al que
  // volver); cualquier otro cambio usa REPLACE — sin esto, el redirect
  // interno tarea→documento de `onOpenNode` (se llama a sí mismo) empujaría
  // dos entradas de historial por un solo clic del usuario.
  //
  // `mountedRef`: en el primer render `rightMode` YA vale 'agenda' (su
  // default, no una navegación real) — sin este guard, cargar la app en la
  // raíz (`/app`) empujaría un redirect inmediato a `/app/agenda` antes de
  // que el usuario hiciera nada, añadiendo una entrada de historial de la
  // que "atrás" no tendría de dónde volver. Elemento/contexto SÍ deben
  // sincronizar desde el primer render (un enlace directo debe abrir), así
  // que el guard solo afecta a la rama `rightMode`.
  //
  // ⚠️ `ready` en la condición (no solo `mountedRef`) — bug real encontrado
  // probando en vivo: `ready` tarda un tick en pasar a `true` (carga
  // asíncrona del store). Sin el `&& ready`, este efecto podía disparar ANTES
  // que el de más abajo (URL → estado) hubiera tenido ocasión de corregir
  // `rightMode` a partir de una URL como `/elementos` — con `rightMode`
  // todavía en su valor por defecto 'agenda', empujaba `/agenda` y PISABA el
  // enlace directo antes de que se procesara. Cargar `/app/elementos` de
  // cero acababa mostrando Agenda con la URL ya reescrita a `/agenda`, sin
  // ningún error visible — el bug más difícil de detectar sin probar de
  // verdad en el navegador.
  const hadUrlDestRef = useRef(false)
  const mountedRef = useRef(false)
  useEffect(() => {
    const centerNode = centerElementId ? store.getNode(centerElementId) : null
    const isContainerNotes = !!centerNode && parseExtraData(centerNode.extraData)._containerNotes === '1'
    const generalTarget = rightMode === 'agenda' ? `${routeBase}/agenda`
      : rightMode === 'elementos' ? `${routeBase}/elementos`
      : null // 'chat'/'contexto': sin URL propia aquí, ver comentario arriba
    const target =
      isContainerNotes && selectedCtxId ? `${routeBase}/context/${selectedCtxId}`
      : centerElementId ? `${routeBase}/element/${centerElementId}`
      : selectedCtxId ? `${routeBase}/context/${selectedCtxId}` // contexto sin nota-contenedor todavía creada
      : (mountedRef.current && ready) ? generalTarget
      : null
    if (ready) mountedRef.current = true
    const wasOpen = hadUrlDestRef.current
    hadUrlDestRef.current = target !== null
    if (target) {
      if (location.pathname !== target) navigate(target, { replace: wasOpen })
    } else if (wasOpen && (/\/element\//.test(location.pathname) || /\/context\//.test(location.pathname) || /\/agenda$/.test(location.pathname) || /\/elementos$/.test(location.pathname))) {
      // Se acaba de cerrar todo (X, o `onSelectGeneral` tomó otro camino) —
      // no dejar la URL apuntando a algo que ya no se ve.
      navigate(routeBase || '/', { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerElementId, selectedCtxId, rightMode, ready])

  // Vuelta (URL → estado): cubre enlace directo, refresco de página, Y el
  // botón atrás/adelante del navegador. No hace ping-pong con el efecto de
  // arriba porque compara contra `centerElementIdRef`/`selectedCtxIdRef`
  // (actualizadas en cada render, sin esperar al siguiente efecto): cuando
  // ESTE efecto abre algo y el de arriba reacciona empujando la URL, para
  // cuando ese cambio de URL vuelve a disparar este efecto los refs ya
  // coinciden y no hace nada — y viceversa cuando el de arriba cierra.
  useEffect(() => {
    if (!ready) return
    const em = location.pathname.match(/\/element\/([^/]+)$/)
    const cm = location.pathname.match(/\/context\/([^/]+)$/)
    const gm = location.pathname.match(/\/(agenda|elementos)$/)
    if (em) {
      if (em[1] !== centerElementIdRef.current) onOpenNode(em[1])
    } else if (cm) {
      if (cm[1] !== selectedCtxIdRef.current) onSelectCtx(cm[1])
    } else if (gm) {
      // Mismo guard que element/context: solo actuar si de verdad hace falta
      // — `onSelectGeneral` no es gratis (limpia filtros, arranca
      // aiChatStore para 'chat', pero eso no llega aquí — ver arriba).
      if (gm[1] !== rightModeRef.current) onSelectGeneral(gm[1] as 'agenda' | 'elementos')
    } else if (centerElementIdRef.current !== null || selectedCtxIdRef.current !== null) {
      // Ni elemento ni contexto en la URL (atrás/adelante del navegador) pero
      // había algo abierto — cerrarlo para no dejar la pantalla
      // desincronizada de la URL.
      if (selectedCtxIdRef.current !== null) {
        onSelectCtx(null)
      } else {
        // Mismo camino que el botón ✕ de V2ElementView: restaura
        // `rightMode`/`selectedCtxId` de antes de abrir.
        setCenterElementId(null)
        const origin = openOriginRef.current
        if (origin) {
          setRightMode(origin.rightMode)
          setSelectedCtxId(origin.selectedCtxId)
          openOriginRef.current = null
        }
      }
    } else if (rightModeRef.current === 'elementos') {
      // Ruta base (`/`) sin elemento/contexto/destino en la URL, pero
      // `rightMode` se había quedado en 'elementos' (atrás del navegador
      // desde /elementos) — 'agenda' es el default real de la ruta base, no
      // 'elementos'; sin esto la pantalla se quedaba en Elementos con la URL
      // ya en la raíz. 'chat'/'contexto' no entran aquí: no tienen URL
      // propia en esta fase, así que no hay nada que "desincronizar".
      onSelectGeneral('agenda')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, location.pathname])

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
      .catch(() => {
        // La carga inicial falló: NUNCA pintar la app "vacía" como si el
        // usuario no tuviera nada — para un segundo cerebro, "parece que he
        // perdido todo" es el peor mensaje posible (auditoría 28 ago 2026).
        setLoadFailed(true)
        setReady(true)
      })
  }, [loadRetry])

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
    // La conversación se pinta en el destino Chat (Tab 1, `elementId===null`) —
    // sin esto, abrirla desde Elementos/sidebar mientras se está en OTRO destino
    // (p.ej. Elementos filtrado a Conversaciones) cargaba la sesión pero no se
    // veía en ningún sitio: la columna derecha seguía mostrando lo de antes (27
    // ago 2026, Alberto: "cuando selecciono una conversacion de la columna
    // derecha no ocurre nada").
    setRightMode('chat')
    // Mantener el contexto de la conversación en la barra lateral (antes se
    // limpiaba SIEMPRE — Alberto, 15 jul: "cuando se abre una conversación dentro
    // del contexto diario, se debería mantener ese contexto diario").
    const sessionNode = store.getNode(id)
    const sessionCtx = sessionNode ? firstContextOf(sessionNode) : null
    setSelectedCtxId(sessionCtx?.id ?? null)
    setFocusNodeId(null)
    // La conversación se abre en el CENTRO con su vista propia
    // (V2ConversationView) — antes se ponía a null y no se veía nada
    // (auditoría 28 ago 2026).
    setCenterElementId(id)
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

    // Siempre al contexto/día activo. La rama anterior "si hay conversación
    // del motor viejo, adjuntar a su nodo _aiSession" colgaba los archivos de
    // una sesión fantasma que ninguna UI pinta (auditoría 28 ago 2026).
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

  // Toast unificado (mismo canal que el resto de la app).
  const toast = (message: string, type: 'success' | 'error' = 'success') =>
    window.dispatchEvent(new CustomEvent('from:toast', { detail: { message, type } }))

  // Crea el nodo-recurso de un archivo YA importado desde Drive (la subida a R2
  // la hizo el servidor en /google/drive/import) — mismo `extraData` que
  // `uploadResourceNode`, sin repetir la subida.
  const createDriveResourceNode = (result: DriveImportResult, parentId: string | null): string => {
    // R7 de la auditoría (28 ago 2026): create-luego-update — un fallo justo
    // entre las dos escrituras dejaba un nodo de texto normal, sin marcar
    // como recurso. `createNode` ya acepta `isResource`/`extraData` en el
    // mismo alta.
    const node = store.createNode({
      text: result.name.replace(/\.[^.]+$/, ''), parentId, isResource: true,
      extraData: { _resourceUrl: result.publicUrl, _resourceKey: result.key, _resourceType: result.resourceType },
    })
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

    const id = createDriveResourceNode(result, captureParentId())
    setCenterElementId(id)
    toast(t('v2.importedToFromly', '{{name}} importado a Fromly', { name: result.name }))
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
    // R7 de la auditoría: create-luego-update, un fallo entre las dos
    // escrituras dejaba una nota de voz sin audio enganchado.
    const n = store.createNode({
      text: title, parentId,
      extraData: { _audios: [{ audioKey: r.audioKey, durationSec: r.durationSec, transcript: r.transcript }] },
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
    // Centinela del chat "abre mis elementos" (paridad iOS AssistantNavigator):
    // no es un nodo — navega al destino Elementos. Antes se intentaba abrir un
    // id inexistente y no pasaba nada (auditoría 28 ago 2026).
    if (id === '__elements__') {
      setShowProfile(false)
      setCenterElementId(null)
      setRightMode('elementos')
      return
    }
    // Registra de dónde se abre — solo en la transición "nada abierto" → "algo
    // abierto" (no al saltar de un elemento a otro ya centrado, para no pisar
    // el origen real con un destino intermedio).
    if (centerElementIdRef.current === null) {
      openOriginRef.current = { rightMode: rightModeRef.current, selectedCtxId: selectedCtxIdRef.current }
    }
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
  // T7 de la auditoría (28 ago 2026): antes caía a `t('v2.general')` como
  // valor por defecto, y V2Chat comparaba ese texto YA TRADUCIDO contra el
  // literal español 'General' para decidir si mostrar el sufijo de contexto
  // — roto en cualquier idioma donde "General" se traduce (alemán "Allgemein",
  // francés "Général"...). Ahora `null` es la señal de "sin contexto", sin
  // depender de qué texto tenga esa traducción.
  const contextLabel = focusNode?.text || ctxNode?.text || null

  if (!ready) {
    return <div className="v2-loading">{t('v2.loadingFromly', 'Cargando Fromly…')}</div>
  }

  if (loadFailed && store.nodes.size === 0) {
    return (
      <div className="v2-loading" style={{ flexDirection: 'column', gap: 12 }}>
        <div>{t('v2.loadFailed', 'No se han podido cargar tus datos')}</div>
        <div style={{ fontSize: 13, color: 'var(--text-tertiary,#999)', maxWidth: 360, textAlign: 'center' }}>
          {t('v2.loadFailedHint', 'Tus elementos están a salvo en el servidor — esto suele ser un problema de conexión.')}
        </div>
        <button className="v2-chip" onClick={() => { setLoadFailed(false); setReady(store.isLoaded); setLoadRetry(n => n + 1) }}>
          {t('common.retry', 'Reintentar')}
        </button>
      </div>
    )
  }

  if (settingsTab) {
    return (
      <ToastProvider>
      <div className="v2-root" style={{ ['--v2-right' as string]: '0px' }}>
        <V2SettingsNav activeTab={settingsTab} onSelect={openSettings} onClose={closeSettings} />
        <main className="v2-col v2-center" style={{ padding: 0 }}>
          <div className="settings-view-content" style={{ height: '100%' }}>
            <SettingsPaneContent activeTab={settingsTab} />
          </div>
        </main>
        <aside className="v2-col v2-right" />
        <NextEventBar onOpenBackups={() => openSettings('backups')} onOpenAgents={() => { closeSettings(); onOpenElementsFiltered('agent') }} />
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
      <V2Sidebar selectedCtxId={selectedCtxId} onSelectCtx={onSelectCtx} onSelectGeneral={onSelectGeneral} activeGeneralDest={selectedCtxId ? null : (rightMode === 'contexto' ? null : rightMode)} onNewChatInCtx={onNewChatInCtx} onNewNoteInCtx={onNewNoteInCtx} onNewCanvasInCtx={onNewCanvasInCtx} onOpenAttach={onOpenAttach} onRecordInCtx={onRecordInCtx} onOpenSettings={() => openSettings('cuenta')} onOpenConversation={onOpenConversation} onOpenNode={onOpenNode} onOpenProfile={onOpenProfile} />
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
        (() => {
          // Una CONVERSACIÓN guardada (_aiSession) no es una nota: se abre con
          // su vista propia (tareas + elementos de la conversación). Antes caía
          // en V2ElementView y se veía como una nota vacía, o directamente no
          // se veía nada al clicarla en Elementos (auditoría 28 ago 2026).
          const cn = store.getNode(centerElementId)
          let isConv = false
          try { isConv = !!cn && JSON.parse(cn.extraData || '{}')._aiSession === '1' } catch { /* ignore */ }
          if (isConv) {
            return (
              <main className="v2-col v2-center">
                <V2ConversationView sessionId={centerElementId} onOpenNode={onOpenNode} onSelectCtx={onSelectCtx} />
              </main>
            )
          }
          return null
        })() ??
        <V2ElementView key={centerElementId} nodeId={centerElementId} onClose={() => {
          setCenterElementId(null)
          const origin = openOriginRef.current
          if (origin) {
            setRightMode(origin.rightMode)
            setSelectedCtxId(origin.selectedCtxId)
            openOriginRef.current = null
          }
        }} onSelectCtx={onSelectCtx} onOpenElementsFiltered={onOpenElementsFiltered} />
      ) : showProfile ? (
        <V2ProfileView onClose={() => setShowProfile(false)} />
      ) : rightMode === 'chat' ? (
        // Destino Chat general: el chat ES el centro — antes este hueco era un
        // lema vacío y el composer vivía apretado en la columna derecha (C14 de
        // la auditoría, 29 ago 2026: "el chat es la tesis... el centro
        // desperdiciado en un lema"). La columna derecha pasa a enseñar el
        // historial de conversaciones por contexto (ver V2RightColumn).
        <V2Chat
          currentNodeId={null}
          contextLabel={null}
          onFilesDropped={onFilesDropped}
          onOpenConversation={onOpenConversation}
          onNewChatInCtx={onNewChatInCtx}
          onSelectCtx={onSelectCtx}
        />
      ) : rightMode === 'elementos' ? (
        // Destino Elementos: el CENTRO es ahora el navegador real (buscador +
        // filtros + lista/tabla/kanban/calendario) — antes vivía apretado en la
        // columna derecha y el centro quedaba vacío hasta abrir algo (Alberto,
        // 27 ago 2026: "el espacio central se puede aprovechar para distribuir
        // los elementos"). Al abrir uno, este hueco lo sustituye el propio
        // elemento (rama `centerElementId` de arriba) y la columna derecha pasa
        // a las 2 tabs de siempre (Elementos para seguir explorando / Chat del
        // elemento) — ver V2RightColumn.
        <main className="v2-col v2-center v2-center--elements">
          <ElementsPanel initialFilter={elementsFilter ?? undefined} />
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
        //
        // A3 de la auditoría (29 ago 2026): el cockpit (atrasadas/sin fecha)
        // sube aquí, arriba de la rejilla — antes vivía apretado en la mitad
        // superior de la columna derecha (440px) compartiendo sitio a medias
        // con la nota diaria; la derecha ahora es SOLO la nota, a panel
        // completo (ver V2RightColumn).
        <main className="v2-col v2-center v2-center--agenda">
          <V2BriefCard />
          <div className="v2-agenda-cockpit-strip">
            <DailyCockpit bare disablePlanner hideToday hideFuture />
          </div>
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
          // N12 de la auditoría (28 ago 2026): filtros guardados y #tag desde
          // ⌘K llamaban a `wf:set-filter`, un evento que solo escuchaba
          // MainLayout v1 — sin efecto en v2. UnifiedCapture ya escribe en
          // `elementsBrowserStore` directamente (arreglado en el propio
          // componente); solo faltaba saber ir a Elementos.
          onNavigate={path => { if (path === '/elementos') onSelectGeneral('elementos') }}
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
      <NextEventBar onOpenBackups={() => openSettings('backups')} onOpenAgents={() => onOpenElementsFiltered('agent')} />
    </div>
    </ToastProvider>
  )
}
