/**
 * WFHomeView — Vista raíz estilo Workflowy
 * Sin filtro: árbol normal. Con filtro: vista árbol / lista plana / calendario.
 */
import { useMemo, useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Outliner from '../outliner/Outliner'
import { useStore, store } from '../../store/nodeStore'
import { applyWFFilter, isSmartQuery } from '../../utils/wfFilter'
import { normalizeSynonyms } from '../../utils/filterInterpreter'
import { FilterViewSwitcher, TableView, KanbanView, CalendarView } from './FilterResultsView'
import type { FilterView } from './FilterResultsView'
import { getPresignedUpload } from '../../api/client'
import { AGENDA_ROOT_NAME, ensureDayPath } from '../../utils/agendaHelper'

// ── Calendario anual inline ───────────────────────────────────────────────────
const MONTHS_L = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const MONTHS_S = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const DOW = ['L','M','X','J','V','S','D']

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function InlineYearCalendar({ year, agendaId }: { year: number; agendaId: string }) {
  const s = useStore()
  const navigate = useNavigate()
  const today = new Date()

  // Nodos del año seleccionado
  const yearNode = useMemo(() =>
    s.children(agendaId).find(n => !n.deletedAt && n.text === String(year))
  , [agendaId, year, s.nodes.size]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fechas que tienen contenido (nodo diario con hijos)
  const datesWithContent = useMemo(() => {
    const set = new Set<string>()
    if (!yearNode) return set
    s.children(yearNode.id).forEach(monthNode => {
      if (monthNode.deletedAt) return
      s.children(monthNode.id).forEach(dayNode => {
        if (dayNode.deletedAt || !dayNode.diaryDate) return
        if (s.children(dayNode.id).some(n => !n.deletedAt)) {
          const d = new Date(dayNode.diaryDate)
          set.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)
        }
      })
    })
    return set
  }, [yearNode?.id, s.nodes.size]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="wf-year-cal">
      {Array.from({ length: 12 }, (_, monthIdx) => {
        const daysInMonth = new Date(year, monthIdx + 1, 0).getDate()
        let startDow = new Date(year, monthIdx, 1).getDay() - 1
        if (startDow < 0) startDow = 6
        return (
          <div key={monthIdx} className="wf-year-cal-month">
            <div className="wf-year-cal-month-name">{MONTHS_S[monthIdx]}</div>
            <div className="wf-year-cal-dow-row">
              {DOW.map(d => <div key={d} className="wf-year-cal-dow">{d}</div>)}
            </div>
            <div className="wf-year-cal-days">
              {Array.from({ length: startDow }, (_, i) => (
                <div key={`e-${i}`} className="wf-year-cal-day wf-year-cal-day--empty" />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const d = i + 1
                const date = new Date(year, monthIdx, d)
                const isToday = sameDay(date, today)
                const hasContent = datesWithContent.has(`${year}-${monthIdx}-${d}`)
                return (
                  <div
                    key={d}
                    className={`wf-year-cal-day${isToday ? ' wf-year-cal-day--today' : ''}${hasContent ? ' wf-year-cal-day--has-content' : ''}`}
                    onClick={() => { const node = ensureDayPath(date); navigate(`/node/${node.id}`) }}
                    title={date.toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' })}
                  >{d}</div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

const WF_COLLAPSE_DONE_KEY = 'from_wf_initial_collapse_done'
const FILTER_VIEW_KEY = 'from_wf_filter_view'

interface Props {
  filterText?: string
  contextFilterId?: string | null
}

// Convierte el texto de un nodo contexto al slug usado en node.types
function ctxTextToSlug(text: string) {
  return text.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-\/]/g, '')
}

// Construye filterMatchIds + ancestorIds para filtrar por contexto.
// Los contextos pueden estar guardados como:
//   1. ID del nodo contexto (vía @ picker en el outliner)
//   2. Slug del texto (vía texto manual @Nombre → auto-sync)
function buildContextFilter(contextNodeId: string): { matchIds: Set<string>; ancestorIds: Set<string> } | null {
  const ctxNode = store.getNode(contextNodeId)
  if (!ctxNode) return null
  const slug = ctxTextToSlug(ctxNode.text)
  const matchIds = new Set<string>()
  const ancestorIds = new Set<string>()
  store.allActive().forEach(n => {
    if (n.deletedAt) return
    const types = n.types || []
    // Buscar por ID del nodo (@ picker) O por slug de texto (escritura manual)
    if (types.includes(contextNodeId) || types.includes(slug)) matchIds.add(n.id)
  })
  // Recoger todos los ancestros para que el árbol muestre el camino
  matchIds.forEach(id => {
    let cur = store.getNode(id)
    while (cur?.parentId) {
      ancestorIds.add(cur.parentId)
      cur = store.getNode(cur.parentId)
    }
  })
  return { matchIds, ancestorIds }
}

export default function WFHomeView({ filterText, contextFilterId }: Props) {
  const s = useStore()
  const navigate = useNavigate()

  // ── Loading gate ──────────────────────────────────────────────────────────
  const [storeReady, setStoreReady] = useState(() => store.isLoaded)
  useEffect(() => {
    if (storeReady) return
    const unsub = store.subscribe(() => { if (store.isLoaded) setStoreReady(true) })
    return () => unsub()
  }, [storeReady])

  // ── Vista activa del filtro ───────────────────────────────────────────────
  const [filterView, setFilterView] = useState<FilterView>(
    () => (localStorage.getItem(FILTER_VIEW_KEY) as FilterView) || 'lista'
  )
  function changeFilterView(v: FilterView) {
    setFilterView(v)
    localStorage.setItem(FILTER_VIEW_KEY, v)
  }

  // ── Nodo Agenda — la vista raíz muestra sus hijos directamente ───────────
  const agendaNode = useMemo(() => {
    if (!storeReady) return null
    return store.children(null).find(n => !n.deletedAt && n.text === AGENDA_ROOT_NAME) ?? null
  }, [storeReady, s.nodes.size]) // eslint-disable-line react-hooks/exhaustive-deps

  const agendaId = agendaNode?.id ?? null

  // ── Selector de año ────────────────────────────────────────────────────────
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear())

  const yearNodes = useMemo(() => {
    if (!agendaId) return []
    return store.children(agendaId)
      .filter(n => !n.deletedAt && /^\d{4}$/.test(n.text || ''))
      .sort((a, b) => parseInt(a.text) - parseInt(b.text))
  }, [agendaId, s.nodes.size]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Colapsar root nodes al primer arranque ─────────────────────────────────
  useEffect(() => {
    if (!storeReady || !agendaId) return
    if (localStorage.getItem(WF_COLLAPSE_DONE_KEY)) return
    const roots = store.children(agendaId).filter(n => !n.deletedAt)
    if (roots.length === 0) return
    roots.forEach(root => {
      const kids = store.children(root.id).filter(n => !n.deletedAt)
      if (kids.length > 0 && !root.isCollapsed) store.updateNode(root.id, { isCollapsed: true })
    })
    localStorage.setItem(WF_COLLAPSE_DONE_KEY, '1')
  }, [storeReady, agendaId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filtro inteligente ─────────────────────────────────────────────────────
  // ── Filtro por contexto (sidebar) ─────────────────────────────────────────
  const contextFilter = useMemo(() => {
    if (!contextFilterId) return null
    return buildContextFilter(contextFilterId)
  }, [contextFilterId, s.nodes.size]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filtro por texto ───────────────────────────────────────────────────────
  const filterResult = useMemo(() => {
    if (contextFilter) return null // el filtro de contexto tiene prioridad
    if (!filterText?.trim()) return null
    const effective = normalizeSynonyms(filterText) ?? filterText
    if (!isSmartQuery(effective)) return null
    return applyWFFilter(s.nodes, effective)
  }, [filterText, contextFilter, s.nodes.size]) // eslint-disable-line react-hooks/exhaustive-deps

  const isFiltering = !!filterText?.trim() || !!contextFilter
  const matchCount = contextFilter?.matchIds.size ?? filterResult?.matchIds.size ?? 0

  // Los ids activos (ya sea de contexto o de texto)
  const activeMatchIds = contextFilter?.matchIds ?? filterResult?.matchIds
  const activeAncestorIds = contextFilter?.ancestorIds ?? filterResult?.ancestorIds

  // ── Drag & drop de archivos desde el Finder → crear nodos ─────────────────
  const [isDragOver, setIsDragOver] = useState(false)

  const uploadFileAsNode = useCallback(async (file: File, parentId: string | null = null) => {
    // Crear nodo con el nombre del archivo
    const siblings = store.children(parentId)
    const maxOrder = siblings.length > 0 ? Math.max(...siblings.map(s => s.siblingOrder)) : 0
    const newNode = store.createNode({
      text: file.name.replace(/\.[^.]+$/, ''), // nombre sin extensión
      parentId,
      siblingOrder: maxOrder + 1,
    })
    try {
      const { uploadUrl, publicUrl } = await getPresignedUpload(file.name, file.type || 'application/octet-stream')
      await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } })
      const resourceType = file.type.startsWith('image/') ? 'image'
        : file.type === 'application/pdf' ? 'pdf' : 'file'
      store.updateNode(newNode.id, {
        isResource: true,
        extraData: JSON.stringify({ _resource: true, _resourceUrl: publicUrl, _resourceType: resourceType }),
      })
    } catch (e) {
      console.error('Upload failed', e)
    }
  }, [])

  function handleDragOver(e: React.DragEvent) {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      setIsDragOver(true)
    }
  }
  function handleDragLeave() { setIsDragOver(false) }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    if (!store.isLoaded) return
    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return
    files.forEach(file => uploadFileAsNode(file, agendaId))
  }

  if (!storeReady) return <div className="wf-home-view" />

  return (
    <div
      className={`wf-home-view${isDragOver ? ' wf-home-view--drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Barra de resultados con selector de vista */}
      {isFiltering && matchCount === 0 && (
        <div className="wf-filter-empty">
          {contextFilter
            ? 'Sin nodos con este contexto'
            : <>Sin resultados para <strong>"{filterText}"</strong></>}
        </div>
      )}
      {!contextFilter && filterResult?.hasFilter && matchCount > 0 && (
        <FilterViewSwitcher
          view={filterView}
          onChange={changeFilterView}
          count={matchCount}
          onClear={() => window.dispatchEvent(new CustomEvent('wf:clear-filter'))}
        />
      )}

      {/* Vistas alternativas cuando hay filtro de texto activo */}
      {!contextFilter && filterResult?.hasFilter && matchCount > 0 && filterView === 'tabla' && (
        <TableView matchIds={filterResult.matchIds} />
      )}
      {!contextFilter && filterResult?.hasFilter && matchCount > 0 && filterView === 'kanban' && (
        <KanbanView matchIds={filterResult.matchIds} />
      )}
      {!contextFilter && filterResult?.hasFilter && matchCount > 0 && filterView === 'calendario' && (
        <CalendarView matchIds={filterResult.matchIds} />
      )}

      {/* Calendario anual inline — solo en vista raíz sin filtro */}
      {!isFiltering && !contextFilter && agendaId && yearNodes.length > 0 && (
        <div className="wf-home-year-section">
          {/* Tabs de año */}
          <div className="wf-home-year-tabs">
            {yearNodes.map(y => (
              <button
                key={y.id}
                className={`wf-home-year-tab${selectedYear === parseInt(y.text) ? ' active' : ''}`}
                onClick={() => setSelectedYear(parseInt(y.text))}
              >{y.text}</button>
            ))}
          </div>
          {/* Calendario 12 meses */}
          <InlineYearCalendar year={selectedYear} agendaId={agendaId} />
        </div>
      )}

      {/* Árbol — vista lista (default) o sin filtro */}
      <div style={{ display: (!contextFilter && filterResult?.hasFilter && matchCount > 0 && filterView !== 'lista') ? 'none' : 'block' }}>
        <Outliner
          parentId={agendaId}
          autoFocusEmpty={false}
          placeholder="Escribe algo… o pulsa Enter para crear un nodo"
          filterText={activeMatchIds ? undefined : (isFiltering ? filterText : undefined)}
          filterMatchIds={activeMatchIds}
          filterAncestorIds={activeAncestorIds}
          disableLocalFilter
        />
      </div>
    </div>
  )
}
