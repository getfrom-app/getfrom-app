import { useEffect, useRef, useState, useMemo, Suspense } from 'react'
import { lazyWithReload as lazy } from '../../utils/lazyWithReload'
import { useTranslation } from 'react-i18next'
import { useFilterStore, setActiveFilter } from '../../store/filterStore'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import { clearTokens } from '../../api/client'
import { userStore } from '../../store/userStore'
import { getHotkeyKey } from '../../store/hotkeysStore'
import StatusBar from './StatusBar'
import NodeView from '../views/NodeView'
import PizarraView from '../views/PizarraView'
import ContextListPanel, { UNCLASSIFIED_FILTER_ID } from '../panels/ContextListPanel'
import ContextPropertiesPanel from '../panels/ContextPropertiesPanel'
import PromptListPanel from '../panels/PromptListPanel'
import PromptPropertiesPanel from '../panels/PromptPropertiesPanel'
import AgentListPanel from '../panels/AgentListPanel'
import AgentPropertiesPanel from '../panels/AgentPropertiesPanel'
import RecorderPanel from '../panels/RecorderPanel'
import AudioPanel from '../panels/AudioPanel'
import DayPanel from '../panels/DayPanel'
import PorPlanificarPanel from '../panels/PorPlanificarPanel'
import RecFab from './RecFab'
import SettingsListPanel from '../panels/SettingsListPanel'
import TemplatePropertiesPanel from '../panels/TemplatePropertiesPanel'
import { aiChatStore } from '../../store/aiChatStore'
import { ensurePromptsNode, getPromptsRoot } from '../../utils/promptsHelper'
import { findContextRoot } from '../../utils/rootLookup'
import { maybeICloudBackup } from '../../utils/icloudBackup'

import WFHomeView from '../views/WFHomeView'
import { ensureCanvasRoot } from '../../utils/canvasRoot'
import { revertContextReferenceOnce } from '../../utils/migrateContextReference'
import { relocateRootDiariesToAgenda, getTodayDiaryUnderAgenda, AGENDA_ROOT_NAME, cleanupYearMonthContexts } from '../../utils/agendaHelper'
import { createNodeFromText, labelForType } from '../../utils/captureHelper'

// Redirige /followup → /node/{diario de hoy} (ruta legacy).
function DiaryRedirect() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const s = useStore()
  const diary = s.todayDiary()
  useEffect(() => {
    if (diary) navigate(`/node/${diary.id}`, { replace: true })
  }, [diary?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="view-loading">{t('app.loadingDiary')}</div>
}

// Home = el lienzo infinito, renderizado como la PROPIA app en `/app` (no se navega
// a ningún nodo). Es la superficie fija: PizarraView global a pantalla completa, sin
// título ni breadcrumb (eso lo da NodeView, que aquí NO se usa). La columna derecha
// la pinta MainLayout alrededor. El nodo-lienzo raíz es solo el contenedor interno
// (cámara/trazos); el contenido son tus contextos.
function CanvasApp() {
  const s = useStore()
  void s.nodesVersion
  if (!store.isLoaded) return <div className="view-loading" />
  const root = ensureCanvasRoot()
  if (!root?.id) return <div className="view-loading" />
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <PizarraView parentId={root.id} globalCanvas />
    </div>
  )
}
// Eliminadas en v9.1: TasksView, ChatView, KanbanView, TagView, FilesView, InboxView, TrashView
// (reemplazadas por nodos del árbol o eliminadas sin sustituto)
// AgentsView eliminada en v9.1 — los agentes son nodos del árbol (🤖 Agentes)
// TrashView eliminada en v9.1 — reemplazada por nodo 🗑 Papelera en el árbol
// SearchView MANTIENE — es la vista de resultados de filtros/atajos (⌘F, Pendientes, etc.)
const SearchView = lazy(() => import('../views/SearchView'))
const AccountView = lazy(() => import('../views/AccountView'))
const SettingsView = lazy(() => import('../views/SettingsView'))
const ResourcesView = lazy(() => import('../views/ResourcesView'))
import SearchPanel from '../panels/SearchPanel'
import DocInspector from '../views/DocInspector'
import PdfContainer from '../pdf/PdfContainer'
import ElementsPanel from '../panels/ElementsPanel'
import LienzoDocPanel from '../panels/LienzoDocPanel'
import PublishButton from '../PublishButton'
import { isDocNode } from '../../utils/docNode'
import { useHasActiveDocEditor } from '../../utils/docEditorStore'
// Componentes pesados: lazy-loaded para reducir el bundle inicial
const PlannerPanel = lazy(() => import('../panels/PlannerPanel'))
const MagicChat = lazy(() => import('../aichat/MagicChat'))
const UnifiedCapture = lazy(() => import('../modals/UnifiedCapture'))
const NewTaskModal = lazy(() => import('../modals/NewTaskModal'))
const NewNoteModal = lazy(() => import('../modals/NewNoteModal'))
const NewEventModal = lazy(() => import('../modals/NewEventModal'))
const VoiceCaptureModal = lazy(() => import('../modals/VoiceCaptureModal'))
const TeachMagicModal = lazy(() => import('../modals/TeachMagicModal'))
const TaskPropsModal = lazy(() => import('../modals/TaskPropsModal'))
const RightColMenu = lazy(() => import('../panels/RightColMenu'))
const KeyboardShortcutsModal = lazy(() => import('../modals/KeyboardShortcutsModal'))
const PaywallModal = lazy(() => import('../paywall/PaywallModal'))
const OnboardingWidget = lazy(() => import('../onboarding/OnboardingWidget'))
const FeedbackButton = lazy(() => import('../feedback/FeedbackButton'))

// ── Prefetch de chunks lazy ──────────────────────────────────────────────
// Una pestaña abierta con un build viejo falla al montar un panel cuyo chunk ya
// no existe tras un deploy (error + recarga ?v=, el "parpadeo morado"). Al
// precargar TODOS los chunks en idle justo tras el arranque, los módulos quedan
// en memoria de la pestaña y los deploys posteriores ya no pueden romper el
// cambio de columna derecha / vistas. Vite dedupe: import() repetido = no-op.
function prefetchLazyChunks() {
  const factories = [
    () => import('../views/SearchView'),
    () => import('../views/AccountView'),
    () => import('../views/SettingsView'),
    () => import('../views/ResourcesView'),
    () => import('../panels/PlannerPanel'),
    () => import('../aichat/MagicChat'),
    () => import('../modals/UnifiedCapture'),
    () => import('../modals/NewTaskModal'),
    () => import('../modals/NewNoteModal'),
    () => import('../modals/NewEventModal'),
    () => import('../modals/VoiceCaptureModal'),
    () => import('../modals/TeachMagicModal'),
    () => import('../modals/KeyboardShortcutsModal'),
    () => import('../paywall/PaywallModal'),
    () => import('../onboarding/OnboardingWidget'),
    () => import('../feedback/FeedbackButton'),
    () => import('../pdf/PdfViewer'),
    () => import('../pdf/WhiteboardViewer'),
  ]
  // Secuencial con pequeño respiro entre chunks para no competir con el sync inicial.
  // Los fallos se ignoran (offline, etc.) — NUNCA disparan la recarga de emergencia.
  let i = 0
  function next() {
    if (i >= factories.length) return
    factories[i++]().catch(() => {}).finally(() => setTimeout(next, 150))
  }
  next()
}
import WFTopBar from './WFTopBar'
import TrialBanner from './TrialBanner'
import { useTaskNotifications } from '../../hooks/useTaskNotifications'
import { ToastProvider } from '../Toast'
import { syncTagDefinitions, cleanupSpuriousTags, migrateTagsToContexto, ensurePerfilInsideContexto, ensurePlantillasNode, cleanupNonAgendaContexts, getPlantillasRoot } from '../../utils/tagsHelper'
import { ensureAtajosNode, migrateLocalStorageShortcuts, migrateNodeShortcutsToFavorites } from '../../utils/atajosHelper'
import { ensureAgentesNode, migrateAgentsV2, migrateAgentMetaChildren, getAgentesNode } from '../../utils/agentesHelper'
import { cleanupOrphanProfileKnowledge, migrateKnowledgeNodesToFromly } from '../../api/userKnowledge'
import { ensurePapeleraNode } from '../../utils/papeleraHelper'
import { ensureHomeRootAndReparent, classifyNodeRoot } from '../../utils/homeHelper'
import { isMarkedContext } from '../../utils/cajones'
import { TaskPropsBody } from '../modals/TaskPropsModal'
import NodeConfigModal, { type ConfigKind } from '../modals/NodeConfigModal'
import { isCanvasRoot } from '../../utils/canvasRoot'
import { ensureDiaryForDate } from '../../utils/diaryNav'
import { invalidatePredictionCache } from '../../store/predictionStore'

export default function MainLayout() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const s = useStore()
  // Nodo actualmente abierto en la URL (`/node/:id` o `/app/node/:id`).
  // Se inyecta a Fromly AI como contexto.
  const currentNodeIdFromRoute = (() => {
    const m = location.pathname.match(/\/node\/([^/]+)/)
    return m ? m[1] : undefined
  })()
  const [loadError, setLoadError] = useState('')
  const [filterText, setFilterText] = useFilterStore()

  // Wrapper: aplicar filtro + navegar a raíz si estamos dentro de un nodo
  const applyFilter = (q: string) => {
    setFilterText(q)
    // Limpiar el filtro (query vacía) NO debe sacarte del nodo actual: solo navegamos
    // a la home cuando se APLICA un filtro real (para ver los resultados). Sin esto,
    // montar SearchPanel (que llama onFilter('') al iniciar) te echaba del nodo.
    if (!q.trim()) return
    const path = window.location.pathname.replace(/^\/app\/?/, '') || '/'
    if (path !== '/' && path !== '') navigate('/')
  }

  // Columna derecha — siempre visible, nunca se cierra
  // Paneles de detalle ('context'/'prompt'/'agent') muestran las propiedades de un
  // nodo concreto (su contenido se abre en la ventana central). El resto son ciclables.
  type RightPanel = 'magic' | 'filter' | 'planner' | 'recorder'
    | 'context-list' | 'context'
    | 'prompt-list'  | 'prompt'
    | 'agent-list'   | 'agent'
    | 'template'
    | 'settings'
    | 'audio'
    | 'day'
    | 'task'
    | 'doc'
    | 'resource'
    | 'elements'
    | 'lienzo-doc'
    | 'porplanificar'
  // Ciclo de la columna derecha: filtro (default) → magic → grabador. Las listas
  // (context/prompt/agent-list) y el planner salen del ciclo: contextos/prompts/
  // agentes se navegan por el árbol (su detalle se abre solo), y el planner tiene su
  // propio botón en la barra superior.
  type CyclablePanel = 'filter' | 'magic' | 'recorder'
  const PANEL_ORDER: CyclablePanel[] = ['filter', 'magic', 'recorder']
  // El panel Filtrar es el de inicio SIEMPRE al abrir la app — escribir una
  // palabra basta para buscar, y tiene filtros y favoritos a mano.
  const [rightPanel, setRightPanel] = useState<RightPanel>('filter')
  // Editor modal (prompt/agente/plantilla) SOBRE el lienzo — se editan sin salir del plano.
  const [configNode, setConfigNode] = useState<{ id: string; kind: ConfigKind } | null>(null)
  // contextNodeId: solo para el filtro especial "Sin clasificar" (se pasa a WFHomeView).
  const [contextNodeId, setContextNodeId] = useState<string | null>(null)
  // detailNodeId: nodo cuyas propiedades se muestran en los paneles context/prompt/agent.
  const [detailNodeId, setDetailNodeId] = useState<string | null>(null)
  // Día activo de la columna del día EN EL LIENZO (mini-calendario / «hoy»). null = hoy.
  // Cambiarlo NO navega: el lienzo es único y no se mueve; solo cambia la columna.
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const pendingContextRef = useRef<string | null>(null)  // contexto a aplicar tras navegación
  // Guard para evitar race condition entre efecto "aplicar pending" y efecto "limpiar al navegar":
  // cuando el efecto de pending consume el ref y setea contextNodeId, este flag evita que el
  // efecto de limpieza lo borre inmediatamente (ambos se disparan con la misma dep location.pathname).
  const pendingContextConsumedRef = useRef(false)

  // openPanel/togglePanel cambian a cualquier panel (no solo los del ciclo): el
  // planner y las listas tienen sus propios atajos/botones aunque estén fuera del ciclo.
  function openPanel(p: RightPanel) { setRightPanel(p) }
  // togglePanel ahora solo cambia de panel — no cierra
  function togglePanel(p: RightPanel) { setRightPanel(p) }

  function handleSelectContext(nodeId: string) {
    // Filtro especial "Sin clasificar" — no abre panel de detalle, solo aplica filtro
    if (nodeId === UNCLASSIFIED_FILTER_ID) {
      if (contextNodeId === UNCLASSIFIED_FILTER_ID) {
        setContextNodeId(null)
        return
      }
      const normPath = location.pathname.replace(/^\/app\/?/, '') || '/'
      const atHome = normPath === '/' || normPath === ''
      if (!atHome) {
        pendingContextRef.current = nodeId
        navigate('/')
      } else {
        setContextNodeId(nodeId)
        // Mantener panel context-list abierto para que el usuario vea los contextos
      }
      return
    }
    // En el LIENZO: NO navegar a /node (no se sale del lienzo). Abrir la columna del
    // contexto y volar el plano a su área → lo hace onOpenDetail (que además dispara
    // el vuelo si el contexto tiene cuerpo físico).
    const normPath = location.pathname.replace(/^\/app\/?/, '').replace(/^\/+|\/+$/g, '')
    if (normPath === '') {
      setContextNodeId(null)
      window.dispatchEvent(new CustomEvent('from:open-detail', { detail: { nodeId } }))
      return
    }
    // Fuera del lienzo: patrón unificado — contenido en el centro + propiedades a la derecha.
    openDetail('context', nodeId)
  }

  // ── Patrón unificado Contextos / Prompts / Agentes ────────────────────────
  // Clic en un item → su contenido se abre en la ventana central (/node/:id) y la
  // columna derecha muestra sus propiedades con un botón ← para volver a la lista.
  function openDetail(kind: 'context' | 'prompt' | 'agent', nodeId: string) {
    setContextNodeId(null)            // limpiar el filtro "Sin clasificar" si estaba activo
    // En el LIENZO, prompts/agentes se editan en un MODAL sobre el plano (contenido +
    // propiedades) → NO se navega fuera. Fuera del lienzo, abren su página.
    const onCanvas = location.pathname.replace(/^\/app\/?/, '').replace(/^\/+|\/+$/g, '') === ''
    if (onCanvas && (kind === 'prompt' || kind === 'agent')) { setConfigNode({ id: nodeId, kind }); return }
    setDetailNodeId(nodeId)
    setRightPanel(kind)
    navigate(`/node/${nodeId}`)
  }
  function backToList(kind: 'context' | 'prompt' | 'agent' | 'template') {
    // Las listas ya no viven en la columna derecha: el ← navega a la raíz
    // correspondiente en el árbol central y deja la derecha en el filtro.
    setDetailNodeId(null)
    setRightPanel('filter')
    const root = kind === 'context' ? findContextRoot()
      : kind === 'prompt' ? getPromptsRoot()
      : kind === 'template' ? getPlantillasRoot()
      : getAgentesNode()
    if (root) navigate(`/node/${root.id}`)
  }
  function handleSelectPrompt(nodeId: string) { openDetail('prompt', nodeId) }
  function handleSelectAgent(nodeId: string)  { openDetail('agent', nodeId) }
  // Probar un prompt en Magic: cargar su texto en el input (editable) + abrir Magic.
  function handleTestPromptInMagic(promptId: string) {
    aiChatStore.loadPromptIntoInput(promptId, currentNodeIdFromRoute)
    openPanel('magic')
  }

  // Aplicar contexto pendiente tras volver a home
  useEffect(() => {
    if (!pendingContextRef.current) return
    const normPath = location.pathname.replace(/^\/app\/?/, '') || '/'
    const atHome = normPath === '/' || normPath === ''
    if (atHome) {
      const nodeId = pendingContextRef.current
      pendingContextRef.current = null
      // Marcar que el pending fue consumido ANTES de limpiar el ref, para que el efecto
      // de limpieza (mismo location.pathname) no borre lo que acabamos de setear.
      pendingContextConsumedRef.current = true
      setContextNodeId(nodeId)
      // "Sin clasificar" no abre panel de nodo — mantiene context-list
      if (nodeId !== UNCLASSIFIED_FILTER_ID) setRightPanel('context')
    }
  }, [location.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // Al abrir un nodo de audio → la columna derecha muestra el reproductor + transcripción.
  // Al salir de él, se vuelve al filtro.
  useEffect(() => {
    let isAudio = false
    if (currentNodeIdFromRoute) {
      const n = store.getNode(currentNodeIdFromRoute)
      try { isAudio = !!n && JSON.parse(n.extraData || '{}')._aiSession === '1' } catch { isAudio = false }
    }
    // Nodo con conversación asociada (✦): al abrirlo, recargar SU conversación en Magic
    // (con su audio + transcripción) a la derecha. La nota (izquierda) solo tiene la
    // estructura. No recargar si ya es la conversación activa (no interrumpir).
    if (isAudio && currentNodeIdFromRoute && aiChatStore.sessionId !== currentNodeIdFromRoute) {
      aiChatStore.loadSession(currentNodeIdFromRoute)
      setRightPanel('magic')
    }
    setRightPanel(p => (p === 'audio' ? 'filter' : p))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNodeIdFromRoute])

  // Modo Planificar (/planner): el centro es el calendario y la columna derecha es
  // la cola «Por planificar» (atrasadas + sin fecha). Al salir, vuelve al filtro.
  const isPlannerRoute = location.pathname.replace(/^\/app\/?/, '').replace(/^\/+|\/+$/g, '') === 'planner'
  useEffect(() => {
    if (isPlannerRoute) { setRightCollapsed(false); setRightPanel('porplanificar') }
    else setRightPanel(p => (p === 'porplanificar' ? 'filter' : p))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlannerRoute])

  // Ciclar entre paneles con ← → (dirección = orden de iconos en la barra)
  function cyclePanel(dir: 'left' | 'right') {
    const current = PANEL_ORDER.includes(rightPanel as CyclablePanel)
      ? (rightPanel as CyclablePanel) : 'filter'
    const idx = PANEL_ORDER.indexOf(current)
    const next = dir === 'right'
      ? PANEL_ORDER[(idx + 1) % PANEL_ORDER.length]
      : PANEL_ORDER[(idx - 1 + PANEL_ORDER.length) % PANEL_ORDER.length]
    setPanelSlideDir(dir === 'right' ? 'down' : 'up')
    setPanelKey(k => k + 1)
    setRightPanel(next)
  }

  // Alias legacy para compatibilidad con eventos externos y lógica existente
  const showAIChat = rightPanel === 'magic'
  const showSearch = rightPanel === 'filter'
  const setShowAIChat = (v: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof v === 'function' ? v(rightPanel === 'magic') : v
    if (next) setRightPanel('magic')
  }
  const setShowSearch = (v: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof v === 'function' ? v(rightPanel === 'filter') : v
    if (next) setRightPanel('filter')
    else setFilterText('')
  }

  function handleDividerMouseDown(e: React.MouseEvent) {
    // Sidebar eliminado — función vacía por compatibilidad
    void e
  }
  const [paywallReason, setPaywallReason] = useState<'node_limit' | 'ai_limit' | null>(null)
  const [showUnifiedCapture, setShowUnifiedCapture] = useState(false)
  const [showNewTask, setShowNewTask] = useState(false)
  const [showNewNote, setShowNewNote] = useState(false)
  const [showNewEvent, setShowNewEvent] = useState(false)
  const [showVoiceCapture, setShowVoiceCapture] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showSaved, setShowSaved] = useState(false)
  const [rightPanelW, setRightPanelW] = useState(() => {
    const saved = localStorage.getItem('right-panel-w')
    return saved ? Math.max(320, Math.min(900, parseInt(saved))) : 480
  })
  // Colapsar manualmente la columna derecha (persistente).
  const [rightCollapsed, setRightCollapsed] = useState(() => localStorage.getItem('right-collapsed') === '1')
  useEffect(() => { localStorage.setItem('right-collapsed', rightCollapsed ? '1' : '0') }, [rightCollapsed])

  // Editor de documento ACTIVO (documento en solitario o texto del lienzo en edición).
  // Cuando lo hay, la columna derecha SE CONVIERTE en el panel de formato (en lugar de
  // superponerse). Igual que en la vista de documento; sin overlay flotante.
  const activeDocEditor = useHasActiveDocEditor()
  // ⚠️ CAUSA RAÍZ del bucle de renders (React #185) al seleccionar texto en el lienzo —
  // v9.6.681, encontrada con el stack real en modo dev (build minificado no lo mostraba):
  // `LienzoDocPanel` (rightPanel === 'lienzo-doc') TAMBIÉN registra un editor `registerActive`
  // (para su barra de formato persistente) — su sola presencia hacía `activeDocEditor` true,
  // lo que aquí abajo SUSTITUÍA a `LienzoDocPanel` por este `<DocInspector/>` suelto. Al
  // desmontarse `LienzoDocPanel`, su editor se desregistraba → `activeDocEditor` volvía a
  // false → `LienzoDocPanel` volvía a montarse → volvía a registrar → ping-pong infinito.
  // Excluir 'lienzo-doc': ese panel YA renderiza su propio `DocInspector` internamente.
  const showDocInspector = rightPanel === 'doc' || (activeDocEditor && rightPanel !== 'lienzo-doc')
  // Nodo de la columna del día: el seleccionado (nota/tarea) o, EN EL LIENZO, el día
  // activo (mini-calendario / «hoy») por METADATO — sin navegar. `ensureDiaryForDate`
  // solo asegura el nodo-día interno que alimenta la columna; el lienzo no se mueve.
  // «En el lienzo» = estar en el index (/app), que ahora renderiza el lienzo.
  const _onCanvasRoot = location.pathname.replace(/^\/app\/?/, '').replace(/^\/+|\/+$/g, '') === ''
  // En el lienzo, la columna derecha por defecto es la del DÍA (hoy).
  useEffect(() => {
    if (_onCanvasRoot) setRightPanel(p => (p === 'filter' ? 'day' : p))
  }, [_onCanvasRoot])
  const dayPanelNodeId = useMemo(() => {
    if (detailNodeId) return detailNodeId
    if (_onCanvasRoot) return ensureDiaryForDate(selectedDay ?? new Date()).id
    return currentNodeIdFromRoute
  }, [detailNodeId, _onCanvasRoot, selectedDay, currentNodeIdFromRoute, s.nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  // Migración única: BUCLES → tareas de seguimiento (tarea SIN fecha). Idempotente
  // y acotada (solo nodos con el tipo 'bucle'): quita el tipo y fija status (abierto
  // → pending, cerrado → done). Espera a que carguen los nodos antes de marcar hecho.
  useEffect(() => {
    if (localStorage.getItem('migrated-bucles-seguimiento') === '1') return
    const all = store.allActive()
    if (all.length === 0) return // nodos aún no cargados → reintenta al cambiar nodesVersion
    const bucles = all.filter(n => (n.types || []).includes('bucle'))
    for (const n of bucles) {
      store.updateNode(n.id, {
        types: (n.types || []).filter(t => t !== 'bucle'),
        status: n.status === 'done' ? 'done' : 'pending',
      })
    }
    localStorage.setItem('migrated-bucles-seguimiento', '1')
  }, [s.nodesVersion])

  // Limpieza única: los eventos de Google ya no se materializan como nodos. Archiva
  // en Papelera (reversible) los nodos que se crearon a partir de eventos de Google.
  useEffect(() => {
    if (localStorage.getItem('cleaned-gcal-materialized-v1') === '1') return
    if (store.allActive().length === 0) return // nodos aún no cargados → reintenta
    import('../../utils/gcalNodesSync').then(async ({ cleanupGcalMaterializedNodes }) => {
      const n = await cleanupGcalMaterializedNodes()
      localStorage.setItem('cleaned-gcal-materialized-v1', '1')
      if (n > 0) window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: `${n} evento(s) de Google ya no son nodos locales (movidos a Papelera)`, type: 'info' } }))
    })
  }, [s.nodesVersion])
  const magicHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Slide animation state
  const [panelSlideDir, setPanelSlideDir] = useState<'up' | 'down'>('down')
  const [panelKey, setPanelKey] = useState(0)

  // Notificar cuando Magic se abre (para onboarding)
  useEffect(() => {
    if (showAIChat) {
      window.dispatchEvent(new Event('from:magic-opened'))
    }
  }, [showAIChat])

  // Persistir preferencia de panel (excepto los paneles de detalle, que son temporales)
  useEffect(() => {
    // 'day' es contextual (solo en pizarra de la diaria) — no persistir para no
    // dejarlo pegado al recargar fuera de la diaria.
    if (rightPanel !== 'context' && rightPanel !== 'prompt' && rightPanel !== 'agent' && rightPanel !== 'day') {
      localStorage.setItem('from-right-panel', rightPanel)
    }
  }, [rightPanel])

  // Cambiar panel desde eventos externos (ej. onboarding)
  useEffect(() => {
    function handler(e: Event) {
      const mode = (e as CustomEvent<{ mode: null | 'magic' | 'search' }>).detail?.mode ?? null
      if (!mode) { setFilterText('') }
      else if (mode === 'magic') openPanel('magic')
      else if (mode === 'search') openPanel('filter')
    }
    window.addEventListener('from:panelMode', handler)
    return () => window.removeEventListener('from:panelMode', handler)
  }, [])

  // Al navegar: auto-abrir las propiedades del nodo según su tipo, y gestionar el
  // filtro "Sin clasificar".
  useEffect(() => {
    const m = location.pathname.match(/\/node\/([^/]+)/)
    const navId = m ? m[1] : null
    const atSettings = location.pathname.replace(/^\/app\/?/, '').replace(/^\//, '').startsWith('settings')
    // Si el nodo es (o desciende de) Agentes/Prompts/Contexto → mostrar sus
    // propiedades en la columna derecha. La navegación es por el árbol; el detalle
    // se abre solo (ya no hace falta clicar en una pestaña lista).
    const kind = navId ? classifyNodeRoot(navId) : null
    const navNode = navId ? store.getNode(navId) : null
    const navIsDoc = !!navNode && isDocNode(navNode)
    if (atSettings) {
      // Ajustes: la columna derecha lista las pestañas, el centro muestra el contenido.
      if (rightPanel !== 'settings') setRightPanel('settings')
    } else if (navIsDoc) {
      // DOCUMENTO: la columna derecha es el inspector de formato (estilo Pages).
      if (rightPanel !== 'doc') setRightPanel('doc')
      setDetailNodeId(null)
    } else if (navId && kind) {
      if (rightPanel !== kind || detailNodeId !== navId) {
        setDetailNodeId(navId)
        setRightPanel(kind)
      }
    } else if (rightPanel === 'context' || rightPanel === 'prompt' || rightPanel === 'agent' || rightPanel === 'template' || rightPanel === 'settings' || rightPanel === 'doc') {
      // Salimos a un nodo normal o al home → cerrar el detalle y volver al filtro.
      setRightPanel('filter')
      setDetailNodeId(null)
    }
    // Limpiar contextNodeId (filtro "Sin clasificar") al ENTRAR a un nodo concreto.
    if (location.pathname.startsWith('/node/')) {
      setContextNodeId(null)
      setFilterText('')
    } else if (pendingContextConsumedRef.current) {
      pendingContextConsumedRef.current = false
    } else if (!pendingContextRef.current) {
      setContextNodeId(null)
    }
  }, [location.pathname, location.search]) // eslint-disable-line react-hooks/exhaustive-deps

  // Inspector de documento como columna derecha. Va aparte del efecto de arriba
  // porque en recarga dura los nodos cargan async: hay que reevaluar cuando el
  // nodo de la ruta ya está disponible (s.nodesVersion). Conservador: solo
  // auto-abre 'doc' si la columna está en su estado por defecto ('filter'), para
  // no pisar una elección manual (magic/planner/grabador).
  useEffect(() => {
    void s.nodesVersion
    const n = currentNodeIdFromRoute ? store.getNode(currentNodeIdFromRoute) : null
    const docHere = !!n && isDocNode(n)
    setRightPanel(prev => {
      if (docHere && prev === 'filter') return 'doc'
      if (!docHere && prev === 'doc') return 'filter'
      return prev
    })
  }, [currentNodeIdFromRoute, s.nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  // Panel especial de CONFIG (agente / prompt / contexto / plantilla) — reevaluado
  // cuando el árbol carga async (recarga dura): el efecto de ruta corre antes de que
  // el árbol esté listo y classifyNodeRoot devuelve null → se quedaba en 'day'
  // (columna «Movidos», que para un agente no tiene sentido). Conservador: solo
  // auto-abre el panel si estamos en un estado por defecto ('filter'/'day'), para no
  // pisar una elección manual (magic/planner/grabador).
  useEffect(() => {
    void s.nodesVersion
    const navId = currentNodeIdFromRoute
    if (!navId) return
    const kind = classifyNodeRoot(navId)
    if (kind && (rightPanel === 'filter' || rightPanel === 'day') && detailNodeId !== navId) {
      setDetailNodeId(navId)
      setRightPanel(kind)
    }
  }, [currentNodeIdFromRoute, s.nodesVersion, rightPanel, detailNodeId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onSetFilter() {
      // Al aplicar filtro, si estábamos en un panel de detalle volvemos a filtro
      if (rightPanel === 'context' || rightPanel === 'prompt' || rightPanel === 'agent') {
        setRightPanel('filter'); setContextNodeId(null); setDetailNodeId(null)
      }
    }
    window.addEventListener('wf:set-filter', onSetFilter)
    return () => window.removeEventListener('wf:set-filter', onSetFilter)
  }, [rightPanel])

  // Cerrar Magic al hacer clic en cualquier nodo del outliner
  useEffect(() => {
    if (!showAIChat || !currentNodeIdFromRoute) return
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement
      const isNodeClick = target.closest('[data-node-id]') || target.closest('.node-text') || target.closest('.bullet-nav-dot')
      if (isNodeClick) setShowAIChat(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showAIChat, currentNodeIdFromRoute])

  // Resize del panel derecho desde su borde izquierdo
  function handleRightPanelResizeDown(e: React.MouseEvent) {
    const startX = e.clientX
    const startW = rightPanelW
    document.body.classList.add('sidebar-resizing')
    function onMove(ev: MouseEvent) {
      const w = Math.max(320, Math.min(900, startW + startX - ev.clientX))
      setRightPanelW(w)
    }
    function onUp() {
      document.body.classList.remove('sidebar-resizing')
      localStorage.setItem('right-panel-w', String(rightPanelW))
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    e.preventDefault()
  }

  // Hover en la franja derecha → toggle Magic con delay
  function handleEdgeEnter() {
    magicHoverTimerRef.current = setTimeout(() => setShowAIChat(v => !v), 200)
  }
  function handleEdgeLeave() {
    if (magicHoverTimerRef.current) clearTimeout(magicHoverTimerRef.current)
  }
  const [slugModal, setSlugModal] = useState<{ nodeId: string; currentSlug: string } | null>(null)
  const [slugInput, setSlugInput] = useState('')
  const slugModalInputRef = useRef<HTMLInputElement>(null)
  const [teachNodeId, setTeachNodeId] = useState<string | null>(null)
  const [taskPropsId, setTaskPropsId] = useState<string | null>(null)
  const [rowMenu, setRowMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null)

  // Abrir Magic Chat con texto prellenado (ej. desde Grabadora → "Resumir con IA")
  useEffect(() => {
    function onOpenWithText(e: Event) {
      const text = (e as CustomEvent<{ text: string }>).detail?.text ?? ''
      setShowAIChat(true)
      if (text) {
        // Pequeño delay para que MagicChat monte y registre el listener
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('magic-chat:prefill', { detail: { text } }))
        }, 80)
      }
    }
    window.addEventListener('magic-chat:open-with-text', onOpenWithText)
    return () => window.removeEventListener('magic-chat:open-with-text', onOpenWithText)
  }, [])

  // Al mandar a la papelera el nodo ABIERTO, salir a su padre (no quedarse en la
  // página que ya está en la papelera). Cubre todos los caminos de borrado (trashNode).
  useEffect(() => {
    function onTrashed(e: Event) {
      const { id, parentId } = (e as CustomEvent<{ id: string; parentId: string | null }>).detail || {}
      const m = location.pathname.match(/\/node\/([^/]+)/)
      const current = m ? m[1] : null
      if (current !== id) return
      const parent = parentId ? store.getNode(parentId) : null
      navigate(parent && !parent.deletedAt ? `/node/${parentId}` : '/')
    }
    function onRestored(e: Event) {
      const { id } = (e as CustomEvent<{ id: string; parentId: string | null }>).detail || {}
      if (!id) return
      navigate(`/node/${id}`)  // llevar al usuario al nodo restaurado (lo encuentra al instante)
    }
    // Abrir un nodo concreto (ej.: tras dictar por voz, llevar a la nota estructurada)
    function onOpenNode(e: Event) {
      const { nodeId } = (e as CustomEvent<{ nodeId: string }>).detail || {}
      if (nodeId) navigate(`/node/${nodeId}`)
    }
    // El cockpit diario («Tu día») pide el planificador al interactuar con él
    function onOpenPlanner() {
      setRightPanel(p => p === 'planner' ? p : 'planner')
    }
    // Panel del día (pizarra): NodeView lo abre al ver la diaria como pizarra,
    // y pide revertir (a filtro) al salir de ese modo.
    function onOpenDay() { setRightPanel('day') }
    function onCloseDay() { setRightPanel(p => p === 'day' ? 'filter' : p) }
    // Lienzo global: seleccionar un nodo → SU columna derecha (la de siempre de ese
    // tipo), SIN salir del lienzo. Al deseleccionar → vuelve a la del día (hoy).
    function onOpenDetail(e: Event) {
      const id = (e as CustomEvent).detail?.nodeId
      const n = id ? store.getNode(id) : null
      if (!n) return
      // `openNodeDetail` es la ÚNICA primitiva para "abrir un nodo". En el LIENZO se abre
      // EN SITIO (columna derecha + vuelo). FUERA del lienzo se navega a él, como siempre.
      // «Ya no hay páginas de nota»: CUALQUIER contenido puede renderizarse como pizarra
      // (viewKind==='pizarra' en NodeView, no solo la raíz `/`) — navegar dentro de un
      // contexto vía breadcrumb sigue siendo lienzo. Antes esto solo miraba si la ruta era
      // literalmente la raíz, así que abrir un recurso/tarea/documento desde DENTRO de un
      // contexto navegaba fuera en vez de abrir en sitio. Señal fiable: si hay una
      // PizarraView realmente montada en pantalla ahora mismo (`.pizarra-view`).
      const onCanvas = !!document.querySelector('.pizarra-view')
      if (!onCanvas) { navigate(`/node/${id}`); return }
      setRightCollapsed(false)
      setDetailNodeId(id)
      // RECURSO (PDF / imagen / archivo) → se abre GRANDE en la columna derecha para leerlo,
      // anotarlo y (PDF) dibujar/resaltar. La tarjeta sigue en el lienzo. (Estilo Heptabase.)
      if (n.isResource || (() => { try { return !!JSON.parse(n.extraData || '{}')._resourceUrl } catch { return false } })()) {
        setRightPanel('resource'); return
      }
      // TEXTO del lienzo (`_doc`) → panel de documento COMPLETO en la columna derecha (editor
      // + exportar a Markdown/HTML/PDF), igual que un recurso — para leer/editar cómodo sin
      // salir del lienzo. Mismo nodo, sin copia; la tarjeta sigue en el lienzo tal cual.
      // Decisión de Alberto: SIEMPRE (no solo si es largo) — una nota corta puede crecer.
      if (isDocNode(n)) { setRightPanel('lienzo-doc'); return }
      // TAREA/evento → columna de TAREA (fecha, repetición, prioridad), en el lienzo.
      if (n.status != null || n.isEvent) { setRightPanel('task'); return }
      // Contexto/prompt/agente/plantilla por ubicación en el árbol; ADEMÁS, cualquier
      // nodo marcado como contexto (`_ctx='1'`, p.ej. un ÁREA del lienzo) abre su
      // columna de contexto aunque no cuelgue de la raíz 🧠 Contexto.
      const kind = classifyNodeRoot(id) ?? (isMarkedContext(n) ? 'context' as const : null)
      // Prompt/agente/plantilla → editor MODAL sobre el lienzo (contenido + propiedades).
      if (kind === 'prompt' || kind === 'agent' || kind === 'template') { setConfigNode({ id, kind }); return }
      // Nota / diaria → columna del día (DayPanel resuelve NoteColumn o cockpit).
      setRightPanel(kind ?? 'day')
      // Contexto con cuerpo físico (área): además de su columna, el lienzo vuela a su
      // posición. Si no tiene área, PizarraView ignora el evento (no hay dónde volar).
      if (kind === 'context') window.dispatchEvent(new CustomEvent('from:pizarra-flyto', { detail: { nodeId: id } }))
    }
    function onCloseDetail() { setDetailNodeId(null); setRightPanel('day') }
    // Mini-calendario / «hoy»: cambia el DÍA (sin navegar). El día ELEGIDO queda como
    // detalle activo → el breadcrumb sigue visible y apunta a ese día; y el lienzo vuela
    // a su zona (agenda-calendario).
    function onSetDay(e: Event) {
      const iso = (e as CustomEvent).detail?.date
      const date = iso ? new Date(iso) : new Date()
      setSelectedDay(iso ? new Date(iso) : null)
      const day = ensureDiaryForDate(date)
      setDetailNodeId(day.id)
      setRightCollapsed(false)
      setRightPanel('day')
      // Volar a la ZONA del día. Si el día se acaba de crear, su celda aparece tras el
      // recálculo (debounced) del layout → reintentos para no perder el vuelo.
      const flyDay = () => window.dispatchEvent(new CustomEvent('from:pizarra-flyto', { detail: { nodeId: day.id } }))
      flyDay(); setTimeout(flyDay, 320); setTimeout(flyDay, 640)
    }
    // Panel «Elementos» (Heptabase): lista textos/selecciones/imágenes/PDF del lienzo actual.
    function onOpenElements(e: Event) {
      const id = (e as CustomEvent).detail?.nodeId
      if (!id) return
      setRightCollapsed(false)
      setDetailNodeId(id)
      setRightPanel('elements')
    }
    window.addEventListener('from:open-detail', onOpenDetail as EventListener)
    window.addEventListener('from:close-detail', onCloseDetail)
    window.addEventListener('from:set-day', onSetDay as EventListener)
    window.addEventListener('from:node-trashed', onTrashed)
    window.addEventListener('from:node-restored', onRestored)
    window.addEventListener('from:open-node', onOpenNode)
    window.addEventListener('from:open-planner', onOpenPlanner)
    window.addEventListener('from:open-day-panel', onOpenDay)
    window.addEventListener('from:close-day-panel', onCloseDay)
    window.addEventListener('from:open-elements-panel', onOpenElements as EventListener)
    return () => {
      window.removeEventListener('from:open-detail', onOpenDetail as EventListener)
      window.removeEventListener('from:close-detail', onCloseDetail)
      window.removeEventListener('from:set-day', onSetDay as EventListener)
      window.removeEventListener('from:open-elements-panel', onOpenElements as EventListener)
      window.removeEventListener('from:node-trashed', onTrashed)
      window.removeEventListener('from:node-restored', onRestored)
      window.removeEventListener('from:open-node', onOpenNode)
      window.removeEventListener('from:open-planner', onOpenPlanner)
      window.removeEventListener('from:open-day-panel', onOpenDay)
      window.removeEventListener('from:close-day-panel', onCloseDay)
    }
  }, [location.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // Limpiar / aplicar filtro desde cualquier componente
  useEffect(() => {
    function handleClearFilter() { setFilterText('') }
    function handleSetFilter(e: Event) {
      const q = (e as CustomEvent<{ query: string }>).detail?.query ?? ''
      setFilterText(q)
      // Solo navegar a home al aplicar un filtro real; query vacía = limpiar (no mover).
      if (!q.trim()) return
      // Asegurar que estamos en la vista raíz para ver el árbol filtrado
      const path = window.location.pathname.replace(/^\/app/, '') || '/'
      if (path !== '/' && path !== '') navigate('/')
    }
    window.addEventListener('wf:clear-filter', handleClearFilter)
    window.addEventListener('wf:set-filter', handleSetFilter)
    return () => {
      window.removeEventListener('wf:clear-filter', handleClearFilter)
      window.removeEventListener('wf:set-filter', handleSetFilter)
    }
  }, [navigate])

  // Cerrar búsqueda + limpiar filtro al navegar a un nodo concreto
  // Al navegar a un /node/ con el panel de filtro activo → limpiar el filtro
  // (el panel sigue abierto — ya no se cierra al navegar)
  const didMountRef = useRef(false)
  useEffect(() => {
    if (!didMountRef.current) { didMountRef.current = true; return }
    if (showSearch && location.pathname.includes('/node/')) {
      setFilterText('')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])
  const prevIsSyncing = useRef(false)

  useTaskNotifications()

  useEffect(() => {
    // Nota: eliminamos navigate('/', replace:true) porque con v7_startTransition
    // la función navigate puede cambiar de referencia al cambiar la ruta, lo que
    // re-ejecutaría este effect y tiraría al usuario de vuelta a root.
    // La exclusión de diarios en WFHomeView (excludeDiaryEntries) garantiza
    // que nunca se muestre el diario en root sin necesidad de redirigir.

    store.isGuest = false
    store.initialLoad()
      .then(async () => {
        // Migrar 🏷 Tags → 🧠 Contexto si existe el nodo antiguo
        migrateTagsToContexto()
        ensurePerfilInsideContexto()
        cleanupOrphanProfileKnowledge()  // borra el nodo huérfano "🧠 Lo que From sabe" del Perfil
        migrateKnowledgeNodesToFromly()  // Fase 2 rebrand: renombra in situ los nodos de conocimiento "From"→"Fromly"
        // Nodos de sistema: Plantillas (se crea solo si no existe)
        ensurePlantillasNode()
        // Nodo de sistema: 📌 Atajos
        ensureAtajosNode()
        migrateLocalStorageShortcuts()
        // Unifica favoritos: convierte los nodos-puntero legacy en isFavorite y los borra
        migrateNodeShortcutsToFavorites()
        migrateAgentsV2()   // elimina agentes-ejemplo v1 (una vez) antes de añadir los v2
        ensureAgentesNode()
        migrateAgentMetaChildren()  // limpia líneas «⏰ Se ejecuta…» y prefijo «📨 » (una vez)
        ensurePromptsNode()
        ensurePapeleraNode()
        // Raíz 🏠 From por encima de Agenda: reparenta las 5 raíces visibles bajo ella.
        // DESPUÉS de los ensure*() (deben existir) y ANTES del sync(true) que persiste.
        ensureHomeRootAndReparent()
        // Reubicar diarios de root bajo 📅 Agenda — ANTES de marcar isLoaded
        await relocateRootDiariesToAgenda()
        cleanupYearMonthContexts()
        cleanupNonAgendaContexts()  // quita chips de contexto heredados en contextos/raíces
        cleanupSpuriousTags()
        syncTagDefinitions()
        // Forzar sync inmediato para que todos los cambios de inicialización
        // (Plantillas, Contexto, Perfil) se persistan en el servidor.
        // Sin esto, si el usuario recarga antes del debounce (1.5s),
        // los nodos de sistema se recrean en cada recarga.
        await store.sync(true)
        // Colapsado por defecto: el árbol abre colapsado en cada arranque. Lo que el
        // usuario expanda es efímero (en memoria, sin sync). ANTES de setLoaded para
        // que no haya parpadeo expandido→colapsado.
        store.collapseAllLocal()
        store.setLoaded()
        store.startRemotePolling() // Polling 15s para recibir cambios remotos (MCP, otros clientes)
        // Precargar los chunks lazy en idle: blinda la pestaña contra deploys
        // posteriores (chunks obsoletos al cambiar de panel/vista).
        if ('requestIdleCallback' in window) {
          (window as any).requestIdleCallback(() => prefetchLazyChunks(), { timeout: 8000 })
        } else {
          setTimeout(prefetchLazyChunks, 4000)
        }
        // Canvas-first: al entrar por la raíz (/app) el index ya renderiza el lienzo
        // (CanvasApp), sin navegar a ningún nodo. No hace falta redirect. Solo
        // asegurar que el nodo-lienzo raíz existe (contenedor interno de cámara/trazos).
        try { ensureCanvasRoot() } catch { /* no bloquear el arranque */ }
        // REVERSIÓN (no destructiva): devuelve las secciones de referencia que se
        // movieron dentro de «Lo que Fromly sabe» a ser contenido del contexto. El
        // usuario cura «Lo que Fromly sabe» a mano. Reparent → reversible.
        try {
          const r = revertContextReferenceOnce()
          if (r && r.moved > 0) console.info(`[from] reversión conocimiento→contexto: ${r.moved} nodos`)
        } catch (e) { console.warn('[from] reversión conocimiento→contexto falló:', e) }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg === 'UNAUTHORIZED') {
          clearTokens()
          navigate('/login', { replace: true })
        } else {
          setLoadError(msg)
        }
      })
    userStore.fetchMe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { reason: 'node_limit' | 'ai_limit' }
      setPaywallReason(detail.reason)
    }
    window.addEventListener('from:paywall', handler)
    return () => window.removeEventListener('from:paywall', handler)
  }, [])

  // Invalidar caché de predicción cuando el store cambia (el nodo ⚙️ Ajustes puede haber sincronizado)
  useEffect(() => {
    return store.subscribe(() => invalidatePredictionCache())
  }, [])

  // Sesión expirada durante el uso → limpiar store y redirigir al login
  useEffect(() => {
    const handler = () => {
      clearTokens()
      store.reset()  // limpiar nodos para evitar mezcla al relogin
      navigate('/login', { replace: true })
    }
    window.addEventListener('from:unauthorized', handler)
    return () => window.removeEventListener('from:unauthorized', handler)
  }, [navigate])

  // ── Eventos nativos del Mac: captura rápida y navegación desde tray/deep-link ──
  // Solo la ventana principal escucha estos eventos (la ventana 'capture' no monta MainLayout).
  useEffect(() => {
    if (import.meta.env.VITE_TAURI !== 'true') return
    const unlisteners: Array<() => void> = []
    import('@tauri-apps/api/event').then(({ listen }) => {
      // Navegación pedida por la ventana de captura (resultado de búsqueda, etc.)
      listen<string>('from:navigate-path', (e) => {
        if (e.payload) navigate(e.payload)
      }).then(fn => unlisteners.push(fn))
      // Deep link from://node/<id>
      listen<string>('from:navigate-node', (e) => {
        if (e.payload) navigate(`/node/${e.payload}`)
      }).then(fn => unlisteners.push(fn))
      // Captura silenciosa a la nota diaria (Atajo de Apple: from://capture?silent=1)
      listen<string>('from:deep-capture', async (e) => {
        const text = (e.payload || '').trim()
        if (!text) return
        const run = () => {
          const result = createNodeFromText(text)
          if (!result) return
          import('@tauri-apps/plugin-notification').then(async ({ isPermissionGranted, requestPermission, sendNotification }) => {
            let granted = await isPermissionGranted()
            if (!granted) granted = (await requestPermission()) === 'granted'
            if (granted) sendNotification({ title: 'Fromly', body: `✓ ${labelForType(result.type)} añadido a tu nota de hoy` })
          }).catch(() => {})
        }
        // Si el store aún no está listo (app recién lanzada por el deep link), esperar.
        if (store.isLoaded) run()
        else window.addEventListener('from:store-loaded', run, { once: true })
      }).then(fn => unlisteners.push(fn))
    }).catch(() => {})
    return () => { for (const u of unlisteners) u() }
  }, [navigate])

  // ── Visibilidad del icono de la barra de menús (Mac) ──────────────────────
  // Sincroniza al arrancar según la preferencia, y persiste si el usuario lo
  // oculta desde el menú contextual del propio icono.
  useEffect(() => {
    if (import.meta.env.VITE_TAURI !== 'true') return
    const visible = localStorage.getItem('from_tray_visible') !== 'false'
    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke('set_tray_visible', { visible }).catch(() => {})
    }).catch(() => {})
    let unlisten: (() => void) | null = null
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen('from:tray-hidden', () => {
        localStorage.setItem('from_tray_visible', 'false')
      }).then(fn => { unlisten = fn })
    }).catch(() => {})
    return () => { unlisten?.() }
  }, [])

  // Cmd+K / Ctrl+K → command palette (única combinación global que no choca con Chrome)
  // Nota: Cmd+N, Cmd+T, Cmd+E, Cmd+R son comandos del navegador y se han eliminado
  // Escape → go home (if no modal/input focused)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // El modal UnifiedCapture gestiona su propio teclado — no interferir
      if (showUnifiedCapture) return
      // No procesar atajos globales hasta que el store esté listo
      if (!store.isLoaded) return

      // ⌘K → captura rápida / buscador unificado
      if (e.key === getHotkeyKey('command-palette') && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        setShowUnifiedCapture(v => !v)
      }
      // Ir a hoy (⌘D) — con modificador para no disparar al escribir texto
      if (e.key.toLowerCase() === getHotkeyKey('go-today').toLowerCase() && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
        e.preventDefault()
        const today = getTodayDiaryUnderAgenda()
        navigate(`/node/${today.id}`)
      }
      // Nuevo nodo hoy (por defecto N, sin modificador)
      if (e.key === getHotkeyKey('new-today') && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const active = document.activeElement as HTMLElement | null
        const isInputFocused = active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA' || active?.isContentEditable
        if (!isInputFocused) {
          e.preventDefault()
          const today = getTodayDiaryUnderAgenda()
          navigate(`/node/${today.id}`)
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('wf:new-child-today', { detail: { parentId: today.id } }))
          }, 150)
        }
      }
      // Espacio → captura rápida si no hay input activo O si el input activo está vacío
      // (no tiene sentido empezar un nodo/filtro/magic con un espacio)
      if (e.code === 'Space' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const active = document.activeElement as HTMLElement | null
        const tag = active?.tagName
        const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || active?.isContentEditable
        const isEmpty = !isEditable || (() => {
          if (tag === 'INPUT' || tag === 'TEXTAREA') {
            return !(active as HTMLInputElement).value.trim()
          }
          return !(active?.textContent || '').trim()
        })()
        if (isEmpty) { e.preventDefault(); setShowUnifiedCapture(true) }
      }
      // ⌘M → toggle Magic Chat (configurable)
      if (e.key === getHotkeyKey('toggle-magic') && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
        e.preventDefault()
        togglePanel('magic')
      }
      // ⌘F → BUSCAR: abre la columna Elementos (el buscador universal del lienzo). Toggle:
      // si ya está abierta, vuelve a la columna por defecto (Favoritos+Recientes).
      if (e.key === getHotkeyKey('toggle-filter') && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
        e.preventDefault()
        if (rightPanel === 'elements') setRightPanel('filter')
        else window.dispatchEvent(new CustomEvent('from:open-elements-panel', { detail: { nodeId: ensureCanvasRoot().id } }))
      }
      // ←/→ → ciclar entre paneles (orden = iconos del topbar, sin modificador, sin input activo)
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const active = document.activeElement as HTMLElement | null
        const inputEl = active as HTMLInputElement | null
        const isNonEmptyInput = (active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA')
          && (inputEl?.value || '') !== ''
        const isContentEditable = !!active?.isContentEditable && (active.textContent || '') !== ''
        if (!isNonEmptyInput && !isContentEditable) {
          e.preventDefault()
          cyclePanel(e.key === 'ArrowRight' ? 'right' : 'left')
        }
      }
      // ⌘R → toggle grabadora (configurable)
      if (e.key === getHotkeyKey('toggle-recorder') && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
        e.preventDefault()
        togglePanel('recorder')
      }
      // ⌘⇧C → toggle lista de contextos (configurable)
      if (e.key === getHotkeyKey('toggle-contexts') && !e.repeat && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault()
        togglePanel('context-list')
      }
      // ⌘P → toggle planificador (configurable)
      if (e.key === getHotkeyKey('toggle-planner') && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
        e.preventDefault()
        togglePanel('planner')
      }
      // (Cmd+Shift+S eliminado — no hay sidebar)
      // Cmd+, → Ajustes (página completa)
      if (e.key === ',' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        navigate('/settings')
      }
      // Cmd+[ → Atrás en la navegación
      if (e.key === '[' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        window.history.back()
      }
      // Cmd+] → Adelante en la navegación
      if (e.key === ']' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        window.history.forward()
      }
      if (e.key === 'z' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault()
        store.undo()
      }
      if ((e.key === 'z' && (e.metaKey || e.ctrlKey) && e.shiftKey) ||
          (e.key === 'y' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault()
        store.redo()
      }
      // Cmd+Shift+A → colapsar todos / expandir todos (toggle)
      if (e.key === 'a' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault()
        const anyCollapsed = store.allActive().some(n => n.isCollapsed)
        if (anyCollapsed) {
          store.expandAll(null)
        } else {
          store.collapseAll(null)
        }
      }
      // Ver atajos (configurable, por defecto ?)
      if (e.key === getHotkeyKey('show-shortcuts')) {
        const active = document.activeElement
        const isInputFocused =
          active?.tagName === 'INPUT' ||
          active?.tagName === 'TEXTAREA' ||
          (active as HTMLElement)?.isContentEditable
        if (!isInputFocused) {
          e.preventDefault()
          setShowShortcuts(v => !v)
        }
      }
      // Ctrl+1-9 → cambiar de vista (SIN Cmd, para no interferir con el sistema)
      if (e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
        const viewMap: Record<string, string> = {
          '1': '/',
          '3': '/search',
        }
        if (viewMap[e.key]) {
          const active = document.activeElement
          const isInputFocused =
            active?.tagName === 'INPUT' ||
            active?.tagName === 'TEXTAREA' ||
            (active as HTMLElement)?.isContentEditable
          if (!isInputFocused) {
            e.preventDefault()
            navigate(viewMap[e.key])
          }
        }
      }
      if (e.key === 'Escape') {
        // Prioridad 1: cerrar modales/paleta abiertos (los propios componentes lo gestionan via useEffect)
        if (showUnifiedCapture || showNewTask || showNewEvent || showVoiceCapture || showShortcuts || showUnifiedCapture) return

        // Prioridad 2: cerrar menús flotantes (slash, pickers, etc.) — sus propios handlers lo harán
        const hasFloatingMenu = !!document.querySelector('.slash-menu, .inline-picker, .wf-topbar-dropdown')
        if (hasFloatingMenu) return

        // Prioridad 2.5: en un panel de detalle → volver a su lista (no cerrar el panel)
        // También cubre el filtro "Sin clasificar" que queda en 'context-list'.
        if (rightPanel === 'context' || rightPanel === 'prompt' || rightPanel === 'agent' || contextNodeId === UNCLASSIFIED_FILTER_ID) {
          setRightPanel(rightPanel === 'prompt' ? 'prompt-list' : rightPanel === 'agent' ? 'agent-list' : 'context-list')
          setContextNodeId(null)  // limpia filtro del árbol
          setDetailNodeId(null)
          return
        }

        // Prioridad 3: deseleccionar texto seleccionado
        const sel = window.getSelection()
        if (sel && !sel.isCollapsed) {
          sel.removeAllRanges()
          return
        }

        // Prioridad 4: si hay input/editor activo, quitarle el foco (blur)
        const active = document.activeElement as HTMLElement | null
        const isInputFocused =
          active?.tagName === 'INPUT' ||
          active?.tagName === 'TEXTAREA' ||
          active?.isContentEditable
        if (isInputFocused) {
          active?.blur()
          return
        }

        // Prioridad 4.5: limpiar filtro de panel activo → volver a la agenda limpia
        if (filterText) {
          setFilterText('')
          window.dispatchEvent(new CustomEvent('wf:clear-filter'))
          return
        }

        // Prioridad 5: volver a la nota diaria de hoy (daily-first). La diaria es
        // el "home" de trabajo; la raíz del árbol queda como escape secundario.
        const match = window.location.pathname.match(/\/node\/([^/]+)/)
        const todayDiary = store.todayDiary()
        if (match && todayDiary && match[1] !== todayDiary.id) {
          navigate(`/node/${todayDiary.id}`)
        } else if (match) {
          // Ya en la diaria (o no hay diaria) → raíz del árbol
          navigate('/')
        }
        // Si ya estamos en root '/' no hacemos nada
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate, showUnifiedCapture, showNewTask, showNewEvent, showVoiceCapture, showShortcuts, rightPanel, contextNodeId])

  // Listener del modal de URL corta (slug) — disparado desde NodeContextMenu vía CustomEvent
  useEffect(() => {
    function handleOpenSlugModal(e: Event) {
      const detail = (e as CustomEvent).detail as { nodeId: string; currentSlug: string }
      setSlugInput(detail.currentSlug)
      setSlugModal({ nodeId: detail.nodeId, currentSlug: detail.currentSlug })
      setTimeout(() => slugModalInputRef.current?.focus(), 50)
    }
    window.addEventListener('from:open-slug-modal', handleOpenSlugModal)
    return () => window.removeEventListener('from:open-slug-modal', handleOpenSlugModal)
  }, [])

  // Listener del modal de PROPIEDADES DE TAREA — disparado desde NodeContextMenu.
  // Solo abre el modal global si el nodo NO está montado como fila de outliner: en el
  // outliner (y en el lienzo) ya lo gestiona el popup inline de OutlinerNode anclado a
  // la fila; desde la cabecera de la nota esa fila no existe → abrimos el modal.
  useEffect(() => {
    function handleTaskProps(e: Event) {
      const detail = (e as CustomEvent).detail as { nodeId: string }
      if (!detail?.nodeId) return
      const inOutliner = document.querySelector(`.outliner-node[data-node-id="${detail.nodeId}"]`)
      if (!inOutliner) setTaskPropsId(detail.nodeId)
    }
    window.addEventListener('from:open-task-props', handleTaskProps)
    return () => window.removeEventListener('from:open-task-props', handleTaskProps)
  }, [])

  // Listener del menú contextual de la COLUMNA DERECHA (filas cockpit/capturas/etc).
  // Antes el clic derecho borraba la fila; ahora abre RightColMenu.
  useEffect(() => {
    function handleRowMenu(e: Event) {
      const d = (e as CustomEvent).detail as { nodeId: string; x: number; y: number }
      if (d?.nodeId) setRowMenu({ nodeId: d.nodeId, x: d.x, y: d.y })
    }
    window.addEventListener('from:open-rowmenu', handleRowMenu)
    return () => window.removeEventListener('from:open-rowmenu', handleRowMenu)
  }, [])

  // Listener del modal "Enseñar a Magic" — disparado desde NodeContextMenu
  useEffect(() => {
    function handleTeach(e: Event) {
      const detail = (e as CustomEvent).detail as { nodeId: string }
      if (detail?.nodeId) setTeachNodeId(detail.nodeId)
    }
    window.addEventListener('from:teach-magic', handleTeach)
    return () => window.removeEventListener('from:teach-magic', handleTeach)
  }, [])

  // Polling automático: sync cada 15s para recoger cambios de Mac/iOS sin refrescar
  useEffect(() => {
    const id = setInterval(() => {
      if (!store.isSyncing) {
        store.sync().catch(() => {/* silencioso */})
      }
      // Backup a iCloud (solo Mac, auto-throttle a 2h, no hace nada en web)
      void maybeICloudBackup()
    }, 15_000)
    return () => clearInterval(id)
  }, [])

  // Detectar cambio isSyncing true → false para mostrar "✓ Guardado"
  useEffect(() => {
    if (prevIsSyncing.current && !s.isSyncing) {
      setShowSaved(true)
      const t = setTimeout(() => setShowSaved(false), 2000)
      return () => clearTimeout(t)
    }
    prevIsSyncing.current = s.isSyncing
  }, [s.isSyncing])

  // (El drag al planner usa el handler existente del outliner + evento 'planner:node-drop')

  function handleLogout() {
    clearTokens()
    store.reset()          // limpiar nodos — evita mezcla entre cuentas
    setActiveFilter('')    // limpiar filtro activo
    userStore.reset()
    navigate('/login', { replace: true })
  }

  if (loadError) {
    return (
      <div className="error-screen">
        <p>{t('app.connectError')}: {loadError}</p>
        <button onClick={() => window.location.reload()}>{t('app.retrying')}</button>
      </div>
    )
  }

  return (
    <ToastProvider>
    <div className="main-layout wf-layout">

      {/* ── Traffic lights row (solo Mac) ── */}
      <div
        className="traffic-bar"
        style={{ WebkitAppRegion: 'drag', userSelect: 'none' } as React.CSSProperties}
      />

      {/* ── Cabecera unificada — sin sidebar ── */}
      <div className="app-header">
        <WFTopBar
          onFilter={applyFilter}
          filterText={filterText}

          onLogout={handleLogout}
          onOpenSettings={() => navigate('/settings')}
          onTogglePlanner={() => { if (isPlannerRoute) navigate('/'); else navigate('/planner') }}
          plannerOpen={isPlannerRoute}
          onToggleSearch={() => togglePanel('filter')}
          onToggleMagic={() => togglePanel('magic')}
          onToggleContextList={() => togglePanel('context-list')}
          onTogglePromptList={() => togglePanel('prompt-list')}
          onToggleAgentList={() => togglePanel('agent-list')}
          onToggleRecorder={() => togglePanel('recorder')}
          rightPanel={rightPanel}
          detailNodeId={detailNodeId}
        />
      </div>

      {/* ── Contenido: árbol + panel derecho ── */}
      <div className="main-body">
      <main className="main-content">
        <TrialBanner />
        {/* Mobile header eliminado — sidebar eliminado */}
        <Suspense fallback={<div className="view-loading">{t('common.loading')}</div>}>
        <Routes>
          {/* Home = lienzo infinito (siempre presente). Con filtro activo (⌘F /
              «Sin clasificar»), sigue mostrando el home filtrable para no romper la búsqueda. */}
          <Route index element={
            (filterText || contextNodeId)
              ? <WFHomeView filterText={filterText} contextFilterId={contextNodeId} />
              : <CanvasApp />
          } />
          {/* /followup obsoleto desde v8.20: redirige al diario */}
          <Route path="followup" element={<DiaryRedirect />} />
          {/* SearchView: resultados de filtros y atajos (⌘F, shortcuts) — MANTENER */}
          <Route path="search" element={<SearchView />} />
          {/* Rutas eliminadas en v9.0-v9.1 → redirigen a inicio */}
          <Route path="calendar" element={<Navigate to="/" replace />} />
          <Route path="tasks"    element={<Navigate to="/" replace />} />
          <Route path="kanban"   element={<Navigate to="/" replace />} />
          <Route path="chat"     element={<Navigate to="/" replace />} />
          <Route path="tag/:name" element={<Navigate to="/" replace />} />
          <Route path="files"    element={<Navigate to="/" replace />} />
          <Route path="inbox"    element={<Navigate to="/" replace />} />
          <Route path="trash"    element={<Navigate to="/" replace />} />
          {/* agents route eliminado — los agentes viven como nodos en 🤖 Agentes */}
          <Route path="planner"   element={<div className="plan-center"><PlannerPanel initialView="week" initialDays={7} onClose={() => navigate('/')} /></div>} />
          <Route path="resources" element={<ResourcesView />} />
          <Route path="account" element={<AccountView />} />
          <Route path="node/:id" element={<NodeView />} />
          <Route path="settings" element={<SettingsView />} />
          <Route path="*" element={
            <div className="view">
              <div className="view-header"><h1 className="view-title">404</h1></div>
              <div className="view-body">
                <div className="view-empty" style={{ paddingTop: 40 }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🗺</div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{t('notFound.title')}</div>
                  <div style={{ color: 'var(--text-tertiary)' }}>{t('notFound.subtitle')}</div>
                  <button
                    className="btn-primary"
                    style={{ marginTop: 20 }}
                    onClick={() => window.location.href = '/app/'}
                  >{t('notFound.goHome')}</button>
                </div>
              </div>
            </div>
          } />
        </Routes>
        </Suspense>
      </main>

      {/* ── Columna derecha — siempre visible ── */}
      {rightCollapsed && !activeDocEditor && (
        <button
          title={t('tip.showPanel')}
          onClick={() => setRightCollapsed(false)}
          style={{
            position: 'fixed', top: 64, right: 0, zIndex: 40,
            width: 22, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid var(--border)', borderRight: 'none', borderRadius: '8px 0 0 8px',
            background: 'var(--bg-elevated, #fff)', color: 'var(--text-secondary, #888)', cursor: 'pointer',
            boxShadow: '-2px 0 8px rgba(0,0,0,0.05)',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3L5 8l5 5" /></svg>
        </button>
      )}
      {(!rightCollapsed || !!activeDocEditor) && <div className="right-panel-unified" style={{
        width: rightPanelW,
        display: 'flex', flexDirection: 'column',
        borderLeft: '1px solid var(--border)',
        flexShrink: 0, overflow: 'hidden',
        position: 'relative',
      }}>
        <div className="magic-panel-resize-bar" onMouseDown={handleRightPanelResizeDown} />
        <button
          title={t('tip.hidePanel')}
          onClick={() => setRightCollapsed(true)}
          style={{
            position: 'absolute', top: 8, right: 8, zIndex: 6,
            width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', borderRadius: 6, background: 'transparent', color: 'var(--text-tertiary, #aaa)', cursor: 'pointer',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3l5 5-5 5" /></svg>
        </button>
        <Suspense fallback={null}>
        {showDocInspector ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <DocInspector />
          </div>
        ) : (
        <div
          key={panelKey}
          className={`right-panel-slide right-panel-slide--${panelSlideDir}`}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden',
            paddingTop: rightPanel === 'planner' ? 0 : 32,
          }}
        >
          {rightPanel === 'magic' && (
            <MagicChat mode="panel" onClose={() => openPanel('filter')} currentNodeId={currentNodeIdFromRoute} />
          )}
          {rightPanel === 'filter' && (
            <SearchPanel filterText={filterText} onFilter={applyFilter} onClose={() => { setFilterText('') }} onSelectContext={handleSelectContext} activeContextId={contextNodeId} />
          )}
          {rightPanel === 'planner' && (
            <PlannerPanel onClose={() => openPanel('filter')} />
          )}
          {rightPanel === 'audio' && currentNodeIdFromRoute && (
            <AudioPanel nodeId={currentNodeIdFromRoute} />
          )}
          {rightPanel === 'day' && (
            <DayPanel nodeId={dayPanelNodeId} />
          )}
          {rightPanel === 'task' && detailNodeId && (
            <div style={{ height: '100%', overflowY: 'auto', padding: '16px 16px 88px' }}>
              <div className="rc-section-label" style={{ marginBottom: 10 }}>⚙ {t('taskPropsModal.title')}</div>
              <TaskPropsBody nodeId={detailNodeId} />
            </div>
          )}
          {rightPanel === 'resource' && detailNodeId && (() => {
            const n = store.getNode(detailNodeId)
            if (!n) return null
            let ed: Record<string, unknown> = {}
            try { ed = JSON.parse(n.extraData || '{}') } catch { /* ignore */ }
            const url = (ed._resourceUrl as string) || ''
            const type = (ed._resourceType as string) || ''
            const key = ed._resourceKey as string | undefined
            if (!url) return <div style={{ padding: 16, color: 'var(--text-tertiary)' }}>{t('common.noContent', 'Sin contenido')}</div>
            // Cabecera con el botón 🌐 de publicar — misma función que en el panel de
            // documento del lienzo, reutilizada aquí para recursos (PDF/imagen/archivo).
            const publishHeader = (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderBottom: '1px solid var(--border-subtle,#eee)', flexShrink: 0 }}>
                <span className="rc-section-label" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {n.text || t('common.noTitle')}
                </span>
                <PublishButton node={n} />
              </div>
            )
            if (type === 'pdf') return (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {publishHeader}
                <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}><PdfContainer url={url} nodeId={detailNodeId} filename={n.text || 'PDF'} resourceKey={key} /></div>
              </div>
            )
            if (type === 'image') return (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {publishHeader}
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16 }}>
                  <img src={url} alt={n.text || ''} style={{ maxWidth: '100%', height: 'auto', borderRadius: 8, display: 'block' }} />
                </div>
              </div>
            )
            return (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {publishHeader}
                <div style={{ padding: 16 }}>
                  <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>{t('common.open', 'Abrir')}</a>
                </div>
              </div>
            )
          })()}
          {rightPanel === 'elements' && (
            <ElementsPanel />
          )}
          {rightPanel === 'lienzo-doc' && detailNodeId && (
            <LienzoDocPanel nodeId={detailNodeId} />
          )}
          {rightPanel === 'porplanificar' && (
            <PorPlanificarPanel />
          )}
          {rightPanel === 'context' && detailNodeId && (
            <ContextPropertiesPanel nodeId={detailNodeId} onBack={() => backToList('context')} />
          )}
          {rightPanel === 'context-list' && (
            <ContextListPanel
              onSelectContext={handleSelectContext}
              selectedContextId={detailNodeId ?? contextNodeId}
            />
          )}
          {rightPanel === 'prompt' && detailNodeId && (
            <PromptPropertiesPanel nodeId={detailNodeId} onBack={() => backToList('prompt')} onTestInMagic={handleTestPromptInMagic} />
          )}
          {rightPanel === 'prompt-list' && (
            <PromptListPanel onSelectPrompt={handleSelectPrompt} selectedPromptId={detailNodeId} />
          )}
          {rightPanel === 'agent' && detailNodeId && (
            <AgentPropertiesPanel nodeId={detailNodeId} onBack={() => backToList('agent')} />
          )}
          {rightPanel === 'template' && detailNodeId && (
            <TemplatePropertiesPanel nodeId={detailNodeId} onBack={() => backToList('template')} />
          )}
          {rightPanel === 'agent-list' && (
            <AgentListPanel onSelectAgent={handleSelectAgent} selectedAgentId={detailNodeId} />
          )}
          {rightPanel === 'recorder' && (
            <RecorderPanel onClose={() => openPanel('filter')} />
          )}
          {rightPanel === 'settings' && (
            <SettingsListPanel />
          )}
        </div>
        )}
        </Suspense>
      </div>}

      </div>{/* .main-body */}

      {/* ── Footer global ── */}
      <StatusBar isSyncing={s.isSyncing} showSaved={showSaved} currentNodeId={currentNodeIdFromRoute} />
      <Suspense fallback={null}>
        {paywallReason && (
          <PaywallModal reason={paywallReason} onClose={() => setPaywallReason(null)} />
        )}
        {showUnifiedCapture && (
          <UnifiedCapture
            onClose={() => setShowUnifiedCapture(false)}
            onSelectContext={(nodeId) => { handleSelectContext(nodeId); setShowUnifiedCapture(false) }}
          />
        )}
      </Suspense>
      {/* Flotantes REC/+ — ocultos cuando Magic o la grabadora están abiertos (esos
          paneles ya tienen sus propios controles; así no se solapan con la columna). */}
      {!showAIChat && rightPanel !== 'recorder' && (
        <>
          {/* Botón REC/STOP — abre la grabadora en la columna derecha y graba; al parar
              ofrece «Crear nota» (nota del día + transcripción + Magic). */}
          <RecFab onOpenRecorder={() => { setRightCollapsed(false); openPanel('recorder') }} />
          {/* Botón FAB */}
          <button
            className="quick-capture-fab"
            onClick={() => setShowUnifiedCapture(true)}
            title={t('tip.newNoteSearch')}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </>
      )}
      <Suspense fallback={null}>
        {showNewNote && <NewNoteModal onClose={() => setShowNewNote(false)} />}
        {showNewTask && <NewTaskModal onClose={() => setShowNewTask(false)} />}
        {showNewEvent && <NewEventModal onClose={() => setShowNewEvent(false)} />}
        {showVoiceCapture && <VoiceCaptureModal onClose={() => setShowVoiceCapture(false)} />}
        {teachNodeId && <TeachMagicModal nodeId={teachNodeId} onClose={() => setTeachNodeId(null)} />}
        {taskPropsId && <TaskPropsModal nodeId={taskPropsId} onClose={() => setTaskPropsId(null)} />}
        {configNode && <NodeConfigModal nodeId={configNode.id} kind={configNode.kind} onClose={() => setConfigNode(null)} onTestInMagic={handleTestPromptInMagic} />}
        {rowMenu && <RightColMenu nodeId={rowMenu.nodeId} x={rowMenu.x} y={rowMenu.y} onClose={() => setRowMenu(null)} />}
        {showShortcuts && <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />}
      </Suspense>
      {/* Modal URL corta — renderizado a nivel global para sobrevivir al desmontaje del menú contextual */}
      {slugModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onMouseDown={() => setSlugModal(null)}
        >
          <div
            style={{ background: 'var(--bg-primary)', borderRadius: 14, padding: '28px 28px 24px', width: 420, maxWidth: '90vw', boxShadow: '0 24px 80px rgba(0,0,0,.22)', display: 'flex', flexDirection: 'column', gap: 16 }}
            onMouseDown={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>✂️ {t('slug.title')}</span>
              <button onClick={() => setSlugModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-tertiary)', lineHeight: 1 }}>×</button>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {t('slug.description')}<br />
              <code style={{ background: 'var(--bg-secondary)', borderRadius: 4, padding: '2px 6px', fontSize: 12, color: 'var(--accent)' }}>
                {window.location.origin}/app/node/<strong>{slugInput || t('slug.placeholderSlug')}</strong>
              </code>
            </p>
            <input
              ref={slugModalInputRef}
              type="text"
              value={slugInput}
              onChange={e => setSlugInput(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))}
              placeholder={t('slug.inputPlaceholder')}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const clean = slugInput.trim()
                  if (clean) {
                    store.updateNode(slugModal.nodeId, { publicSlug: clean })
                    const url = `${window.location.origin}/app/node/${clean}`
                    navigator.clipboard.writeText(url).catch(() => {})
                    window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: `URL copiada: /node/${clean}`, type: 'success' } }))
                  } else {
                    store.updateNode(slugModal.nodeId, { publicSlug: null })
                  }
                  setSlugModal(null)
                }
                if (e.key === 'Escape') setSlugModal(null)
              }}
              style={{ border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit' }}
              autoFocus
            />
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>
              {t('slug.hint')}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setSlugModal(null)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                {t('common.cancel')}
              </button>
              <button
                onClick={() => {
                  const clean = slugInput.trim()
                  if (clean) {
                    store.updateNode(slugModal.nodeId, { publicSlug: clean })
                    const url = `${window.location.origin}/app/node/${clean}`
                    navigator.clipboard.writeText(url).catch(() => {})
                    window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: `URL copiada: /node/${clean}`, type: 'success' } }))
                  } else {
                    store.updateNode(slugModal.nodeId, { publicSlug: null })
                  }
                  setSlugModal(null)
                }}
                style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer' }}
              >
                {t('slug.saveAndCopy')}
              </button>
            </div>
          </div>
        </div>
      )}
      <button
        className="mobile-fab"
        onClick={() => setShowUnifiedCapture(true)}
        title={t('tip.quickSearch')}
        aria-label={t('tip.openSearch')}
      >
        +
      </button>
      <Suspense fallback={null}><OnboardingWidget /></Suspense>
      <Suspense fallback={null}><FeedbackButton /></Suspense>
      {/* sync-indicator eliminado — el footer ya muestra el estado de sync */}
    </div>
    </ToastProvider>
  )
}
