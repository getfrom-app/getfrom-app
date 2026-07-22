/**
 * ElementsPanel — el BUSCADOR universal del lienzo (estilo Heptabase). Lista TODOS los
 * elementos del lienzo (globalmente): textos, tareas, eventos, enlaces, PDFs, imágenes y
 * contextos. Buscador de texto + filtro por TIPO; al filtrar por Tareas/Eventos aparece un
 * sub-filtro (hoy/abiertas/cerradas/futuras/sin fecha). Clic en una fila → vuela al elemento
 * en el lienzo y abre su panel. Lista VIRTUALIZADA → escala a miles de elementos (años de
 * trabajo) sin pegarse.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useVirtualizer } from '@tanstack/react-virtual'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'
import { isDocNode, elementDisplayTitle } from '../../utils/docNode'
import { fmtDate, fmtDateFull } from '../../utils/formatDate'
import { isMarkedContext, listMarkedContexts, contextColor, assignContext, firstContextOf, contextParent } from '../../utils/cajones'
import { isContextKnowledge } from '../../utils/knowledgeNodes'
import { openNodeDetail } from '../../utils/canvasNav'
import { renderInline } from '../outliner/InlineRenderer'
import RowContextChip from './RowContextChip'
import TaskHoverActions from './TaskHoverActions'
import TaskRow from './TaskRow'
import { TaskPropsPopover } from './DiaryPanelComponents'
import { toggleTaskDone } from '../../utils/dailyCockpit'
import { isInPapelera } from '../../utils/papeleraHelper'
import { createAgentUnder } from '../../utils/agentesHelper'
import { createPromptUnder } from '../../utils/promptsHelper'
import { FilterViewSwitcher, TableView, KanbanView, CalendarView } from '../views/FilterResultsView'
import type { FilterView } from '../views/FilterResultsView'
import PizarraThumbnail from '../views/PizarraThumbnail'

export type ElemKind = 'text' | 'canvas' | 'task' | 'event' | 'link' | 'pdf' | 'image' | 'context' | 'memory' | 'highlight' | 'agent' | 'conversation' | 'prompt' | 'dia' | 'cita'
type TaskSub = 'all' | 'today' | 'open' | 'done' | 'future' | 'nodate'

interface ElemRow { id: string; kind: ElemKind; title: string; snippet: string; updatedAt: string; createdAt: string; ctxId: string | null; due?: string | null; status?: string | null }
type SortBy = 'updated' | 'created' | 'title'

const ed = (n: Node): Record<string, unknown> => { try { return JSON.parse(n.extraData || '{}') } catch { return {} } }

function classify(n: Node): ElemKind | null {
  if (n.deletedAt) return null
  const e = ed(n)
  if (e._absorbedBy != null) return null       // oculto dentro de un bloque → no es elemento suelto
  // Mensajes/transcripciones DENTRO de una conversación no son elementos sueltos (solo
  // la sesión en sí lo es, como tipo 'conversation' — ver más abajo).
  if (e._aiTranscript != null || e._aiMsgRole != null) return null
  // Nota diaria (📅 Agenda → Año → Mes → Día) — antes quedaba fuera de `isNote`/
  // `isDocNode` (estructural) y por tanto invisible en el buscador. Ahora es su
  // propio tipo buscable (Alberto, 22 jul: "serían un elemento nuevo llamado Día").
  if (n.isDiaryEntry) return 'dia'
  // La conversación (sesión ✦) SÍ es un elemento — Alberto: "la conversación en sí también
  // debería ser un elemento". Antes se ocultaban aquí las sesiones de comando rápido (1
  // turno, sin continuidad); ahora TODOS los chats se guardan y se listan (15 jul: "quiero
  // que se guarden todos los chats").
  if (e._aiSession === '1') return 'conversation'
  if (e._containerNotes === '1') return null   // espacio de notas libres (estructural, no un elemento)
  if (isContextKnowledge(n.text)) return null  // 🧠 Memoria del contexto — estructural, no un elemento suelto
  if (e._pdfSelection != null) return 'highlight'   // subrayado guardado de un PDF (cita)
  if (e._docSelection != null) return 'cita'        // párrafo de otra nota asignado a este contexto
  if (e._agentDef === '1') return 'agent'           // agente (v2: puede colgar de cualquier contexto)
  if (e._promptDef === '1') return 'prompt'         // prompt (v2: puede colgar de cualquier contexto)
  if (isMarkedContext(n)) return 'context'
  if (n.status != null) return 'task'
  if (n.isEvent) return 'event'
  const rt = e._resourceType as string | undefined
  if (rt === 'image' || e._imageUrl) return 'image'
  if (rt === 'pdf') return 'pdf'
  if (n.isResource || e._resourceUrl || e._resource) return 'link'
  if (e._v2canvas === '1') return 'canvas'          // nodo-documento en modo Lienzo (pizarra)
  if (isDocNode(n) || store.isNote(n)) return 'text'
  // Memoria IA ANTIGUA (oculta del lienzo pero BUSCABLE aquí): línea de conocimiento con texto.
  if (e._tagDefinition != null && (n.text || '').trim()) return 'memory'
  return null
}

function stripHtml(html?: string | null): string {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Sub-filtro de tareas/eventos por su `due`/`status`. */
function matchesTaskSub(r: ElemRow, sub: TaskSub): boolean {
  if (sub === 'all') return true
  if (sub === 'open') return r.status === 'pending'
  if (sub === 'done') return r.status === 'done'
  if (sub === 'nodate') return !r.due
  if (!r.due) return false
  const d = new Date(r.due); const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dayMs = 24 * 3600 * 1000
  if (sub === 'today') return d >= start && d < new Date(start.getTime() + dayMs)
  if (sub === 'future') return d >= new Date(start.getTime() + dayMs)
  return true
}

const KIND_ICON: Record<ElemKind, string> = { text: '📝', canvas: '🎨', task: '☑️', event: '📅', link: '🔗', pdf: '📄', image: '🖼', context: '📁', memory: '🧠', highlight: '🖍️', agent: '🤖', conversation: '💬', prompt: '⚡', dia: '🗓️', cita: '🔖' }
const ROW_H = 46
const ELEMENTS_VIEW_KEY = 'from_v2_elements_view'
const ELEMENTS_SORT_KEY = 'from_v2_elements_sort'

interface Props {
  /** Filtro inicial (p.ej. al llegar desde «← Agentes»/«← Prompts» en el detalle). */
  initialFilter?: ElemKind | 'all' | 'favorite'
}

export default function ElementsPanel({ initialFilter }: Props = {}) {
  const { t, i18n } = useTranslation()
  const s = useStore()
  const [filter, setFilter] = useState<ElemKind | 'all' | 'favorite'>(initialFilter || 'all')
  // Si llegamos aquí ya con el panel montado (p.ej. «← Agentes» tras «← Prompts»
  // sin pasar por otro modo), re-aplica el filtro pedido en vez de ignorarlo.
  useEffect(() => { if (initialFilter) setFilter(initialFilter) }, [initialFilter])
  const [taskSub, setTaskSub] = useState<TaskSub>('all')
  const [q, setQ] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  // Vista: lista (por defecto, virtualizada) o tabla/kanban/calendario (reutilizadas de la v1).
  const [view, setView] = useState<FilterView>(
    () => (localStorage.getItem(ELEMENTS_VIEW_KEY) as FilterView) || 'lista'
  )
  function changeView(v: FilterView) {
    setView(v)
    localStorage.setItem(ELEMENTS_VIEW_KEY, v)
  }
  // Kanban/Calendario solo tienen sentido filtrando Tareas — si el filtro cambia a
  // cualquier otra cosa mientras esa vista está activa, vuelve a Lista (el interruptor
  // ya no muestra esos botones, pero sin esto la vista se quedaría "atascada").
  useEffect(() => {
    if (filter !== 'task' && (view === 'kanban' || view === 'calendario')) changeView('lista')
  }, [filter]) // eslint-disable-line react-hooks/exhaustive-deps
  const [sortBy, setSortBy] = useState<SortBy>(() => (localStorage.getItem(ELEMENTS_SORT_KEY) as SortBy) || 'created')
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  function changeSort(v: SortBy) {
    setSortBy(v)
    localStorage.setItem(ELEMENTS_SORT_KEY, v)
    setSortMenuOpen(false)
  }

  // TODOS los elementos del lienzo (globalmente) — el orden final lo decide `sortBy`.
  const rows = useMemo(() => {
    void s.nodesVersion
    const out: ElemRow[] = []
    for (const n of store.allActive()) {
      const kind = classify(n); if (!kind) continue
      if (isInPapelera(n.id)) continue   // en Papelera (borrado) → no es un elemento vivo
      const snippet = (n.body || '').trimStart().startsWith('```from-pizarra') ? '' : stripHtml(n.body)
      // Quita el prefijo decorativo (✦ sesión / 💬 transcripción) para no duplicar
      // icono: la fila ya muestra el icono de tipo (KIND_ICON) a la izquierda.
      const title = (elementDisplayTitle(n) || snippet.slice(0, 60) || t('common.noTitle')).replace(/^(?:✦|💬)\s*/u, '')
      const ctxId = firstContextOf(n)?.id ?? null
      out.push({ id: n.id, kind, title, snippet, updatedAt: n.updatedAt || '', createdAt: n.createdAt || '', ctxId, due: n.due, status: n.status })
    }
    return out
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.nodesVersion, t])

  const nq = q.trim().toLowerCase()
  const showTaskSub = filter === 'task' || filter === 'event'
  // Capa 1: tipo + búsqueda + sub-filtro de tareas — sin el contexto todavía, porque
  // los chips de contexto disponibles (abajo) deben reflejar ESTE conjunto, no el ya
  // recortado por contexto (si no, al elegir un contexto desaparecerían los demás chips).
  const byTypeAndSearch = useMemo(() => rows.filter(r => {
    if (filter === 'favorite') { if (!store.getNode(r.id)?.isFavorite) return false }
    else if (filter === 'all') { if (r.kind === 'memory') return false } // memoria IA solo con su propio chip
    else if (r.kind !== filter) return false
    if (showTaskSub && !matchesTaskSub(r, taskSub)) return false
    if (!nq) return true
    return r.title.toLowerCase().includes(nq) || r.snippet.toLowerCase().includes(nq)
  }), [rows, filter, taskSub, showTaskSub, nq])

  // Sub-filtro por CONTEXTO — segundo nivel, para CUALQUIER tipo (no solo tareas).
  // JERÁRQUICO: primero los contextos RAÍZ; clic en uno con subcontextos entre los
  // disponibles sustituye la fila por sus hijos (con animación) para seguir
  // filtrando, igual que el drill-down de la sidebar. Solo se construyen ramas
  // que de verdad llevan a algo en el conjunto ya filtrado arriba (byTypeAndSearch).
  const contextTree = useMemo(() => {
    const leafIds = new Set<string>()
    for (const r of byTypeAndSearch) if (r.ctxId) leafIds.add(r.ctxId)
    const allIds = new Set<string>()
    const childrenOf = new Map<string, Set<string>>()
    for (const leaf of leafIds) {
      const chain: Node[] = []
      let cur: Node | null = store.getNode(leaf) ?? null
      let guard = 0
      while (cur && guard++ < 40) { chain.unshift(cur); const p = contextParent(cur.id); cur = p ?? null }
      for (let i = 0; i < chain.length; i++) {
        allIds.add(chain[i].id)
        if (i > 0) {
          const parentId = chain[i - 1].id
          if (!childrenOf.has(parentId)) childrenOf.set(parentId, new Set())
          childrenOf.get(parentId)!.add(chain[i].id)
        }
      }
    }
    const roots = [...allIds].filter(id => { const p = contextParent(id); return !p || !allIds.has(p.id) })
    return { allIds, childrenOf, roots }
  }, [byTypeAndSearch])

  const [ctxFilter, setCtxFilter] = useState<string | 'all'>('all')
  const [ctxStack, setCtxStack] = useState<Node[]>([]) // ruta de drill-down (contextos padre)
  const ctxParent = ctxStack.length ? ctxStack[ctxStack.length - 1] : null
  const availableContexts = useMemo(() => {
    const ids = ctxParent ? [...(contextTree.childrenOf.get(ctxParent.id) ?? [])] : contextTree.roots
    return ids.map(id => store.getNode(id)).filter((n): n is Node => !!n && !!(n.text || '').trim())
      .sort((a, b) => a.text.localeCompare(b.text))
  }, [contextTree, ctxParent])
  useEffect(() => {
    if (ctxFilter !== 'all' && !contextTree.allIds.has(ctxFilter)) { setCtxFilter('all'); setCtxStack([]) }
  }, [contextTree, ctxFilter])

  // Elige un contexto del sub-filtro: filtra por él (Y sus descendientes) y, si
  // tiene subcontextos entre los disponibles, entra en él para seguir refinando.
  const enterCtxFilter = (c: Node) => {
    setCtxFilter(c.id)
    if ((contextTree.childrenOf.get(c.id)?.size ?? 0) > 0) setCtxStack(prev => [...prev, c])
  }
  const backCtxFilter = () => setCtxStack(prev => prev.slice(0, -1))
  const clearCtxFilter = () => { setCtxFilter('all'); setCtxStack([]) }

  // ¿El contexto de la fila es `filterId` o uno de sus descendientes? Al elegir un
  // contexto RAÍZ (o cualquiera con hijos) en el sub-filtro, deben verse también
  // los elementos que cuelgan de sus subcontextos, no solo los asignados a él.
  function ctxMatchesFilter(rowCtxId: string | null, filterId: string): boolean {
    if (!rowCtxId) return false
    let cur: Node | null = store.getNode(rowCtxId) ?? null
    let guard = 0
    while (cur && guard++ < 40) {
      if (cur.id === filterId) return true
      const p = contextParent(cur.id)
      cur = p ?? null
    }
    return false
  }

  const filtered = useMemo(() => {
    const out = ctxFilter === 'all' ? byTypeAndSearch : byTypeAndSearch.filter(r => ctxMatchesFilter(r.ctxId, ctxFilter))
    const sorted = [...out]
    // Sin fecha (createdAt/updatedAt vacío) SIEMPRE al final, sea cual sea la
    // dirección — antes un '' se colaba como "más reciente" en algunos casos
    // (Alberto, 15 jul: "Locución CREO Laura Martínez..." salía primero sin ser
    // ni de lejos lo más nuevo).
    if (sortBy === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title))
    else if (sortBy === 'created') sorted.sort((a, b) => {
      if (!a.createdAt && !b.createdAt) return 0
      if (!a.createdAt) return 1
      if (!b.createdAt) return -1
      return b.createdAt.localeCompare(a.createdAt)
    })
    else sorted.sort((a, b) => {
      if (!a.updatedAt && !b.updatedAt) return 0
      if (!a.updatedAt) return 1
      if (!b.updatedAt) return -1
      return b.updatedAt.localeCompare(a.updatedAt)
    })
    return sorted
  }, [byTypeAndSearch, ctxFilter, sortBy])

  const counts = useMemo(() => rows.reduce((acc, r) => { acc[r.kind] = (acc[r.kind] || 0) + 1; return acc }, {} as Record<ElemKind, number>), [rows])
  const favCount = useMemo(() => { void s.nodesVersion; return rows.filter(r => store.getNode(r.id)?.isFavorite).length }, [rows, s.nodesVersion])

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_H,
    overscan: 12,
  })

  const CHIPS: { key: ElemKind | 'all' | 'favorite'; label: string }[] = [
    { key: 'all',      label: t('elements.all') },
    { key: 'favorite', label: '★ ' + t('elements.favorites', 'Favoritos') },
    { key: 'text',    label: t('elements.texts') },
    { key: 'canvas',  label: '🎨 ' + t('elements.canvases', 'Lienzos') },
    { key: 'task',    label: t('elements.tasks') },
    { key: 'event',   label: t('elements.events') },
    { key: 'link',    label: t('elements.links') },
    { key: 'pdf',     label: t('elements.pdfs') },
    { key: 'highlight', label: '🖍️ ' + t('elements.highlights', 'Subrayados') },
    { key: 'cita',    label: '🔖 ' + t('elements.citas', 'Citas') },
    { key: 'image',   label: t('elements.images') },
    { key: 'context', label: t('elements.contexts') },
    { key: 'dia',     label: '🗓️ ' + t('elements.days', 'Días') },
    { key: 'agent',   label: '🤖 ' + t('elements.agents', 'Agentes') },
    { key: 'prompt',  label: '⚡ ' + t('elements.prompts', 'Prompts') },
    { key: 'conversation', label: '💬 ' + t('elements.conversations', 'Conversaciones') },
    { key: 'memory',  label: t('elements.memory', 'Memoria') },
  ]
  const SUB_CHIPS: { key: TaskSub; label: string }[] = [
    { key: 'all',    label: t('elements.subAll', 'Todas') },
    { key: 'today',  label: t('elements.subToday', 'Hoy') },
    { key: 'open',   label: t('elements.subOpen', 'Abiertas') },
    { key: 'done',   label: t('elements.subDone', 'Cerradas') },
    { key: 'future', label: t('elements.subFuture', 'Futuras') },
    { key: 'nodate', label: t('elements.subNoDate', 'Sin fecha') },
  ]

  function open(id: string) {
    openNodeDetail(id)
    window.dispatchEvent(new CustomEvent('from:pizarra-flyto', { detail: { nodeId: id } }))
  }

  function createNewAgent() {
    const name = window.prompt(t('elements.newAgentPrompt', 'Nombre del agente:'))
    if (!name || !name.trim()) return
    const created = createAgentUnder({ parentId: null, label: name.trim(), icon: '🤖' })
    open(created.id)
  }
  function createNewPrompt() {
    const name = window.prompt(t('elements.newPromptPrompt', 'Nombre del prompt:'))
    if (!name || !name.trim()) return
    const created = createPromptUnder({ parentId: null, label: name.trim(), icon: '⚡' })
    open(created.id)
  }

  // ── Acciones de organización por fila (clic-derecho + botón ···) ──────────────
  const [menu, setMenu] = useState<{ id: string; x: number; y: number; ctx: boolean } | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [propsNodeId, setPropsNodeId] = useState<string | null>(null)
  const renameRef = useRef<HTMLInputElement>(null)

  function openMenu(id: string, x: number, y: number) {
    // Encima abajo si no cabe; el menú mide ~aprox, lo clampeamos.
    setMenu({ id, x: Math.min(x, window.innerWidth - 230), y: Math.min(y, window.innerHeight - 320), ctx: false })
  }
  function startRename(id: string) {
    const n = store.getNode(id); setRenaming(id); setRenameVal(n?.text || ''); setMenu(null)
    setTimeout(() => { renameRef.current?.focus(); renameRef.current?.select() }, 20)
  }
  function commitRename() {
    if (renaming && renameVal.trim()) store.updateNode(renaming, { text: renameVal.trim() })
    setRenaming(null); setRenameVal('')
  }
  function toggleFav(id: string) { const n = store.getNode(id); if (n) store.updateNode(id, { isFavorite: !n.isFavorite }); setMenu(null) }
  function del(id: string) {
    const deletedIds = store.deleteNode(id)
    setMenu(null)
    if (deletedIds.length === 0) return
    window.dispatchEvent(new CustomEvent('from:toast', {
      detail: {
        message: t('context.toastMovedToTrash', 'Movido a la papelera'),
        type: 'success',
        action: { label: t('tip.undo', 'Deshacer'), onClick: () => store.restoreDeleted(deletedIds) },
      },
    }))
  }

  // ── Selección múltiple — limpiar en bloque (Alberto, 14 jul: "tuve que borrar
  // huérfanos uno a uno vía base de datos porque no hay forma nativa"). Un overlay
  // transparente por fila intercepta el clic (checkbox) sin tocar TaskRow ni el resto
  // de tipos de fila — funciona igual para tareas, eventos y filas genéricas.
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  function toggleSelect(id: string) {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }
  function exitSelectMode() { setSelectMode(false); setSelected(new Set()) }
  function bulkDelete() {
    const ids = [...selected]
    if (ids.length === 0) return
    const allDeleted: string[] = []
    for (const id of ids) allDeleted.push(...store.deleteNode(id))
    exitSelectMode()
    if (allDeleted.length === 0) return
    window.dispatchEvent(new CustomEvent('from:toast', {
      detail: {
        message: t('elements.bulkDeletedToast', '{{count}} elemento(s) movidos a la papelera', { count: ids.length }),
        type: 'success',
        action: { label: t('tip.undo', 'Deshacer'), onClick: () => store.restoreDeleted(allDeleted) },
      },
    }))
  }
  // Salir de selección si cambia el filtro/búsqueda — evita seleccionar a ciegas
  // sobre filas que ya no se ven.
  useEffect(() => { if (selectMode) exitSelectMode() }, [filter, ctxFilter, taskSub, nq]) // eslint-disable-line react-hooks/exhaustive-deps
  function moveToContext(id: string, ctxId: string) {
    // Mover a otro contexto: asignación lógica (_ctxRefs) + si NO está fijado con pin, lo
    // reparentamos para que fluya dentro de la caja del contexto en el lienzo.
    assignContext(id, ctxId)
    const n = store.getNode(id)
    let pinned = false; try { const e = JSON.parse(n?.extraData || '{}'); pinned = e._pinX != null || e._gx != null } catch { /* ignore */ }
    if (n && !pinned && !isMarkedContext(n)) store.updateNode(id, { parentId: ctxId })
    setMenu(null)
  }
  const contexts = useMemo(() => { void s.nodesVersion; return listMarkedContexts().filter(c => (c.text || '').trim()) }, [s.nodesVersion])

  // IDs filtrados (búsqueda + tipo + sub-filtro) para las vistas tabla/kanban/calendario —
  // reutilizan TableView/KanbanView/CalendarView de la v1 tal cual (mismo Set<string>).
  const filteredIds = useMemo(() => new Set(filtered.map(r => r.id)), [filtered])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '14px 14px 6px', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, position: 'relative' }}>
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder={t('elements.searchShort', 'Buscar')}
            style={{ flex: 1, minWidth: 0, boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border,#e2e2e2)', background: 'var(--bg,#fff)', color: 'var(--text,#222)', fontSize: 13, outline: 'none' }}
          />
          <button
            title={t('elements.sortBy', 'Ordenar por')}
            onClick={() => setSortMenuOpen(v => !v)}
            style={{ flexShrink: 0, width: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: '1px solid var(--border,#e2e2e2)', background: sortMenuOpen ? 'var(--bg-hover,#f4f4f5)' : 'var(--bg,#fff)', color: 'var(--text-secondary,#666)', cursor: 'pointer' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h10M3 12h6M3 18h3M17 4v16m0 0l4-4m-4 4l-4-4"/></svg>
          </button>
          <button
            title={selectMode ? t('elements.exitSelect', 'Salir de selección') : t('elements.selectMultiple', 'Seleccionar varios')}
            onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
            style={{ flexShrink: 0, width: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: '1px solid var(--border,#e2e2e2)', background: selectMode ? 'var(--accent,#6c5ce7)' : 'var(--bg,#fff)', color: selectMode ? '#fff' : 'var(--text-secondary,#666)', cursor: 'pointer' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12l2.5 2.5L16 9"/></svg>
          </button>
          {sortMenuOpen && (
            <>
              <div onClick={() => setSortMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1000 }} />
              <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 1001, minWidth: 180, background: 'var(--bg-elevated,#fff)', border: '1px solid var(--border,#e2e2e2)', borderRadius: 8, boxShadow: '0 6px 24px rgba(0,0,0,0.14)', padding: 4, fontSize: 13 }}>
                <ElMenuItem label={(sortBy === 'updated' ? '✓ ' : '') + t('elements.sortUpdated', 'Última modificación')} onClick={() => changeSort('updated')} />
                <ElMenuItem label={(sortBy === 'created' ? '✓ ' : '') + t('elements.sortCreated', 'Fecha de creación')} onClick={() => changeSort('created')} />
                <ElMenuItem label={(sortBy === 'title' ? '✓ ' : '') + t('elements.sortTitle', 'Título')} onClick={() => changeSort('title')} />
              </div>
            </>
          )}
        </div>
        {/* Filtro por tipo — texto limpio en una fila, con scroll horizontal, subrayado activo. */}
        <div className="el-filterbar">
          {CHIPS.map(c => {
            const active = filter === c.key
            const n = c.key === 'all' ? (rows.length - (counts.memory || 0)) : c.key === 'favorite' ? favCount : (counts[c.key as ElemKind] || 0)
            return (
              <button key={c.key} onClick={() => { setFilter(c.key); if (c.key !== 'task' && c.key !== 'event') setTaskSub('all') }}
                style={{
                  flex: '0 0 auto', border: 'none', background: 'transparent', cursor: 'pointer', padding: '3px 0',
                  fontSize: 12.5, fontWeight: active ? 700 : 500, whiteSpace: 'nowrap', fontFamily: 'inherit',
                  color: active ? 'var(--accent,#6c5ce7)' : 'var(--text-tertiary,#999)',
                  borderBottom: '2px solid ' + (active ? 'var(--accent,#6c5ce7)' : 'transparent'),
                }}>
                {c.label} <span style={{ opacity: 0.55, fontWeight: 400 }}>{n}</span>
              </button>
            )
          })}
        </div>
        {(filter === 'agent' || filter === 'prompt') && (
          <div style={{ marginTop: 6 }}>
            <button
              onClick={filter === 'agent' ? createNewAgent : createNewPrompt}
              style={{ display: 'flex', alignItems: 'center', gap: 5, border: '1px dashed var(--border,#e2e2e2)', background: 'transparent', borderRadius: 7, padding: '5px 10px', fontSize: 12.5, fontWeight: 500, color: 'var(--accent,#6c5ce7)', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              + {filter === 'agent' ? t('elements.newAgent', 'Nuevo agente') : t('elements.newPrompt', 'Nuevo prompt')}
            </button>
          </div>
        )}
        {showTaskSub && (
          <div className="el-filterbar" style={{ marginTop: 4 }}>
            {SUB_CHIPS.map(c => {
              const active = taskSub === c.key
              return (
                <button key={c.key} onClick={() => setTaskSub(c.key)}
                  style={{
                    flex: '0 0 auto', border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px 0',
                    fontSize: 11.5, fontWeight: active ? 700 : 500, whiteSpace: 'nowrap', fontFamily: 'inherit',
                    color: active ? 'var(--accent,#6c5ce7)' : 'var(--text-tertiary,#999)',
                  }}>
                  {c.label}
                </button>
              )
            })}
          </div>
        )}
        {/* Sub-filtro por CONTEXTO — segundo nivel, para cualquier tipo (no solo tareas).
            Jerárquico: raíces primero; clic en uno con subcontextos sustituye la fila
            por sus hijos (key=ctxParent.id remonta el div → animación de entrada). */}
        {(availableContexts.length > 0 || ctxStack.length > 0) && (
          <div className="el-filterbar el-filterbar--ctx" style={{ marginTop: 4 }} key={ctxParent?.id ?? 'root'}>
            <button onClick={clearCtxFilter}
              style={{
                flex: '0 0 auto', border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px 0',
                fontSize: 11.5, fontWeight: ctxFilter === 'all' ? 700 : 500, whiteSpace: 'nowrap', fontFamily: 'inherit',
                color: ctxFilter === 'all' ? 'var(--accent)' : 'var(--text-tertiary,#999)',
              }}>
              {t('elements.allContexts', 'Todos los contextos')}
            </button>
            {ctxParent && (
              <button onClick={backCtxFilter}
                style={{
                  flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 4, border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px 0',
                  fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap', fontFamily: 'inherit', color: 'var(--text-primary)',
                }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: contextColor(ctxParent.id), flexShrink: 0 }} />
                ‹ {ctxParent.text}
              </button>
            )}
            {availableContexts.map(c => {
              const active = ctxFilter === c.id
              const hasKids = (contextTree.childrenOf.get(c.id)?.size ?? 0) > 0
              return (
                <button key={c.id} onClick={() => enterCtxFilter(c)}
                  style={{
                    flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 4, border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px 0',
                    fontSize: 11.5, fontWeight: active ? 700 : 500, whiteSpace: 'nowrap', fontFamily: 'inherit',
                    color: active ? 'var(--accent)' : 'var(--text-tertiary,#999)',
                  }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: contextColor(c.id), flexShrink: 0 }} />
                  {c.text}{hasKids ? ' ›' : ''}
                </button>
              )
            })}
          </div>
        )}
        {/* Selector de vista — lista (por defecto) / tabla / kanban / calendario. Reutiliza
            los componentes de la v1 (FilterResultsView) tal cual, sobre los ids ya filtrados. */}
        <FilterViewSwitcher
          view={view}
          onChange={changeView}
          count={filtered.length}
          onClear={() => { setQ(''); setFilter('all'); setTaskSub('all'); setCtxFilter('all'); setCtxStack([]) }}
          allowBoardViews={filter === 'task'}
        />
        {/* Barra de acciones en bloque — visible solo en modo selección. */}
        {selectMode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, padding: '6px 2px' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary,#666)' }}>
              {t('elements.selectedCount', '{{count}} seleccionados', { count: selected.size })}
            </span>
            <button
              onClick={() => setSelected(new Set(filtered.map(r => r.id)))}
              style={{ fontSize: 12, fontWeight: 500, color: 'var(--accent,#6c5ce7)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
            >
              {t('elements.selectAllVisible', 'Seleccionar los {{count}} visibles', { count: filtered.length })}
            </button>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button onClick={exitSelectMode} style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-tertiary,#999)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', fontFamily: 'inherit' }}>
                {t('common.cancel', 'Cancelar')}
              </button>
              <button
                onClick={bulkDelete}
                disabled={selected.size === 0}
                style={{ fontSize: 12.5, fontWeight: 600, color: '#fff', background: selected.size === 0 ? 'var(--text-tertiary,#bbb)' : '#dc2626', border: 'none', borderRadius: 6, cursor: selected.size === 0 ? 'default' : 'pointer', padding: '5px 12px', fontFamily: 'inherit' }}
              >
                {t('tip.delete', 'Eliminar')} {selected.size > 0 ? `(${selected.size})` : ''}
              </button>
            </div>
          </div>
        )}
      </div>

      {view !== 'lista' ? (
        filtered.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-tertiary,#999)', padding: '20px' }}>{t('elements.empty')}</div>
        ) : view === 'tabla' ? (
          <TableView matchIds={filteredIds} />
        ) : view === 'kanban' ? (
          <KanbanView matchIds={filteredIds} />
        ) : (
          <CalendarView matchIds={filteredIds} />
        )
      ) : filtered.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-tertiary,#999)', padding: '20px' }}>{t('elements.empty')}</div>
      ) : filter === 'canvas' ? (
        // Lienzos: NO tiene sentido listarlos como filas de texto — se ven como
        // miniaturas visuales de su contenido (trazos/dibujos), en rejilla.
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            {filtered.map(r => (
              <div
                key={r.id}
                onClick={() => open(r.id)}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); openMenu(r.id, e.clientX, e.clientY) }}
                style={{ cursor: 'pointer' }}
              >
                <PizarraThumbnail body={store.getNode(r.id)?.body} />
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text,#222)', marginTop: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.title}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 12px 80px' }}>
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map(vi => {
              const r = filtered[vi.index]
              const isRenaming = renaming === r.id
              const isSelected = selected.has(r.id)
              const wrapStyle: React.CSSProperties = { position: 'absolute', top: 0, left: 0, width: '100%', height: ROW_H, transform: `translateY(${vi.start}px)`, boxSizing: 'border-box' }

              let inner: React.ReactNode = null
              // Tarea → TaskRow ÚNICO compartido con toda la app (Hoy, Contexto, otros
              // días): mismo checkbox, texto, chips de hora/día/repetición, contexto y
              // acciones de hover en TODAS partes, no una copia distinta por pestaña.
              if (r.kind === 'task' && !isRenaming) {
                const n = store.getNode(r.id)
                if (n) inner = (
                  <TaskRow
                    node={n}
                    onOpenDate={(nn) => setPropsNodeId(id => id === nn.id ? null : nn.id)}
                    style={{ position: 'static', width: '100%', height: '100%', boxSizing: 'border-box' }}
                  />
                )
              } else if (r.kind === 'event' && !isRenaming) {
                // Evento: pieza propia (sin checkbox de tarea real / chips de repetición).
                const n = store.getNode(r.id)
                if (n) inner = (
                  <div
                    className={`dc-row ${n.status === 'done' ? 'dc-row--done' : ''}`}
                    data-node-id={n.id}
                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); openMenu(r.id, e.clientX, e.clientY) }}
                    style={{ width: '100%', height: '100%', boxSizing: 'border-box' }}
                  >
                    <button
                      className={`dc-check ${n.status === 'done' ? 'dc-check--done' : ''}`}
                      onClick={(e) => { e.stopPropagation(); toggleTaskDone(n) }}
                    >{n.status === 'done' ? '✓' : ''}</button>
                    <span className="dc-text dc-text--tight" onClick={() => openNodeDetail(n.id)}>{n.text ? renderInline(n.text) : t('tip.task', 'Tarea')}</span>
                    <span style={{ flex: 1 }} />
                    <TaskHoverActions node={n} onOpenDate={(nn) => setPropsNodeId(id => id === nn.id ? null : nn.id)} />
                    <RowContextChip node={n} />
                  </div>
                )
              } else {
                inner = (
                  <div
                    className="dc-row el-row"
                    onClick={() => { if (!isRenaming) open(r.id) }}
                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); openMenu(r.id, e.clientX, e.clientY) }}
                    style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px 0 6px', cursor: 'pointer', boxSizing: 'border-box' }}
                  >
                    <span style={{ fontSize: 15, flexShrink: 0 }}>{KIND_ICON[r.kind]}</span>
                    <div style={{ minWidth: 0, flex: 1 }} title={`${t('v2.rightColumn.created', 'Creado')}: ${fmtDateFull(r.createdAt, i18n.language)}\n${t('v2.rightColumn.updated', 'Modificado')}: ${fmtDateFull(r.updatedAt, i18n.language)}`}>
                      {isRenaming ? (
                        <input
                          ref={renameRef}
                          value={renameVal}
                          onClick={e => e.stopPropagation()}
                          onChange={e => setRenameVal(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitRename() } if (e.key === 'Escape') { setRenaming(null) } }}
                          onBlur={commitRename}
                          style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--accent,#6c5ce7)', borderRadius: 5, padding: '2px 6px', fontSize: 13, background: 'var(--bg,#fff)', color: 'var(--text,#222)', fontFamily: 'inherit' }}
                        />
                      ) : (<>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text,#222)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                        {r.snippet && r.snippet !== r.title && (
                          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary,#999)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.snippet}</div>
                        )}
                      </>)}
                    </div>
                    {!isRenaming && (
                      <span style={{ flexShrink: 0, fontSize: 11, color: 'var(--text-tertiary,#999)', whiteSpace: 'nowrap' }}>
                        {fmtDate(sortBy === 'created' ? r.createdAt : r.updatedAt, i18n.language)}
                      </span>
                    )}
                    {!isRenaming && (
                      <>
                        {/* Eliminar directo al hover — mismo patrón que el resto de listas de la app. */}
                        <button
                          className="el-row-del"
                          title={t('tip.delete', 'Eliminar')}
                          onClick={(e) => { e.stopPropagation(); del(r.id) }}
                          style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary,#999)', padding: '4px 5px', borderRadius: 4, display: 'flex', alignItems: 'center' }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                        </button>
                        <button
                          className="el-more"
                          title={t('elements.actions', 'Acciones')}
                          onClick={(e) => { e.stopPropagation(); const rc = (e.currentTarget as HTMLElement).getBoundingClientRect(); openMenu(r.id, rc.right - 200, rc.bottom + 2) }}
                          style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary,#999)', fontSize: 16, lineHeight: 1, padding: '2px 6px', borderRadius: 4 }}
                        >⋯</button>
                      </>
                    )}
                  </div>
                )
              }

              if (!inner) return null
              return (
                <div key={r.id} style={wrapStyle}>
                  {inner}
                  {/* Overlay de selección — intercepta el clic sin tocar TaskRow ni el resto
                      de filas; el contenido de debajo sigue visible (fondo transparente). */}
                  {selectMode && (
                    <div
                      onClick={() => toggleSelect(r.id)}
                      style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', alignItems: 'center', paddingLeft: 6, cursor: 'pointer', background: isSelected ? 'rgba(108,92,231,0.10)' : 'transparent' }}
                    >
                      <input type="checkbox" checked={isSelected} readOnly style={{ pointerEvents: 'none', width: 15, height: 15 }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Menú de acciones (clic-derecho / ···) — organizar cualquier elemento */}
      {menu && (() => {
        const n = store.getNode(menu.id)
        return (
          <>
            <div onClick={() => setMenu(null)} onContextMenu={e => { e.preventDefault(); setMenu(null) }} style={{ position: 'fixed', inset: 0, zIndex: 1000 }} />
            <div style={{ position: 'fixed', left: menu.x, top: menu.y, zIndex: 1001, minWidth: 200, maxHeight: 300, overflowY: 'auto', background: 'var(--bg-elevated,#fff)', border: '1px solid var(--border,#e2e2e2)', borderRadius: 8, boxShadow: '0 6px 24px rgba(0,0,0,0.14)', padding: 4, fontSize: 13 }}>
              {!menu.ctx ? (
                <>
                  <ElMenuItem label={t('elements.open', 'Abrir')} onClick={() => { open(menu.id); setMenu(null) }} />
                  <ElMenuItem label={t('common.rename', 'Renombrar')} onClick={() => startRename(menu.id)} />
                  <ElMenuItem label={n?.isFavorite ? t('tip.removeFavorite', 'Quitar favorito') : t('tip.addFavorite', 'Favorito')} onClick={() => toggleFav(menu.id)} />
                  <ElMenuItem label={t('elements.moveToContext', 'Mover a contexto') + ' ▸'} onClick={() => setMenu(m => m && { ...m, ctx: true })} />
                  <div style={{ height: 1, background: 'var(--border-subtle,#eee)', margin: '4px 0' }} />
                  <ElMenuItem label={t('tip.delete', 'Eliminar')} danger onClick={() => del(menu.id)} />
                </>
              ) : (
                <>
                  <ElMenuItem label={'‹ ' + t('common.back', 'Atrás')} onClick={() => setMenu(m => m && { ...m, ctx: false })} />
                  {contexts.length === 0 && <div style={{ padding: '6px 10px', color: 'var(--text-tertiary,#999)' }}>{t('elements.noContexts', 'Sin contextos')}</div>}
                  {contexts.map(c => (
                    <ElMenuItem key={c.id} label={c.text} dot={contextColor(c.id)} onClick={() => moveToContext(menu.id, c.id)} />
                  ))}
                </>
              )}
            </div>
          </>
        )
      })()}

      {/* Popover de propiedades de tarea (fecha/hora) — al hover en una tarea/evento */}
      {propsNodeId && (() => {
        const pn = store.getNode(propsNodeId)
        return pn ? <TaskPropsPopover node={pn} allowRename allowDelete onClose={() => setPropsNodeId(null)} /> : null
      })()}
    </div>
  )
}

function ElMenuItem({ label, onClick, danger, dot }: { label: string; onClick: () => void; danger?: boolean; dot?: string }) {
  return (
    <button
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 5, fontSize: 13, color: danger ? 'var(--color-error,#e53e3e)' : 'var(--text,#222)', fontFamily: 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover,#f4f4f5)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
    >
      {dot && <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0 }} />}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
    </button>
  )
}
