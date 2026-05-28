/**
 * CalendarPlanner — Vista global de planificación temporal.
 *
 * Accesible desde el botón de calendario en el top-right de la app.
 * Ruta: /planner
 *
 * Layout:
 *   [Columna de tareas | Timeline (Día/Semana/Mes)]
 *
 * Columna de tareas:
 *   - Lista continua de días con sus tareas en jerarquía real
 *   - Filtro: Todas | Vencidas | Hoy | Futuras
 *   - Drag → timeline crea time block + mueve tarea si es otro día
 *
 * Timeline:
 *   - Día: 5 columnas centradas en hoy (scroll horizontal)
 *   - Semana: 7 columnas fijas (lun–dom)
 *   - Mes: grid mensual clásico
 *
 * Time blocks: nodos con _timeBlock:"1" bajo el diary day node correspondiente.
 * GCal events: fetched por rango, mostrados solo como time blocks (no nodos).
 * No hay due dates: la "fecha" de una tarea es el diary day en que vive.
 */

import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'
import { ensureDayPath } from '../../utils/agendaHelper'
import { getCalendarEventsRange, type CalendarEvent } from '../../api/googleCalendar'
import { GCalEventEditor } from '../panels/DiaryRightPanel'
import { useUserStore } from '../../store/userStore'

// ── Geometría ──────────────────────────────────────────────────────────────
const HOUR_START  = 6
const HOUR_END    = 24
const TOTAL_HOURS = HOUR_END - HOUR_START
const SLOT_H      = 40          // px / 30 min
const HOUR_H      = SLOT_H * 2  // px / hora
const PX_PER_MIN  = SLOT_H / 30
const AXIS_W      = 44          // px eje horas
const TASK_COL_W  = 300         // px columna tareas
const VISIBLE_DAY_COLS = 5      // columnas visibles simultáneamente en day view
const PRE_DAYS_EACH   = 7       // días extra pre-renderizados a cada lado (scroll)

// ── Helpers tiempo ────────────────────────────────────────────────────────
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth()    === b.getMonth()
      && a.getDate()     === b.getDate()
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}
function startOfDay(d: Date): Date {
  const r = new Date(d); r.setHours(0,0,0,0); return r
}
function startOfWeek(d: Date): Date {
  const r = startOfDay(d)
  const dow = r.getDay()
  r.setDate(r.getDate() - (dow === 0 ? 6 : dow - 1)) // Lunes
  return r
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}
function topPx(date: Date): number {
  const mins = date.getHours() * 60 + date.getMinutes() - HOUR_START * 60
  return Math.max(0, mins * PX_PER_MIN)
}
function heightPx(startMs: number, endMs: number): number {
  return Math.max(SLOT_H, (endMs - startMs) / 60000 * PX_PER_MIN)
}
function snapPx(y: number): number {
  return Math.round(y / SLOT_H) * SLOT_H
}
function pxToTime(px: number, day: Date): Date {
  const mins = snapPx(Math.max(0, px)) / PX_PER_MIN + HOUR_START * 60
  const d = new Date(day)
  d.setHours(Math.floor(mins / 60), Math.min(59, mins % 60), 0, 0)
  return d
}
function fmt(d: Date, opts: Intl.DateTimeFormatOptions) {
  return d.toLocaleDateString('es-ES', opts)
}
function fmtHH(d: Date) {
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

const DAYS_ES_SHORT  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const DAYS_ES_LONG   = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
const MONTHS_ES      = ['enero','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
const MONTHS_ES_LONG = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function dayColLabel(d: Date): string {
  const dow = DAYS_ES_SHORT[d.getDay()]!
  return `${dow} ${d.getDate()} ${MONTHS_ES[d.getMonth()]}`
}

// ── Tipos ─────────────────────────────────────────────────────────────────
type ViewMode = 'day' | 'week' | 'month'
type TaskFilter = 'all' | 'overdue' | 'today' | 'future'

interface TaskEntry {
  task: Node
  contextLabel: string | null  // nombre del nodo contenedor inmediato (si no es diary)
  diaryDate: Date
  status: 'overdue' | 'today' | 'future' | 'done'
}

interface DayGroup {
  date: Date
  diaryNode: Node
  tasks: TaskEntry[]
}

interface TimeBlock {
  kind: 'task' | 'standalone' | 'gcal'
  id: string
  text: string
  start: Date
  end: Date
  color: string
  linkedId?: string
  gcalEvent?: CalendarEvent
}

// ── Leer todas las tareas agrupadas por diary day ─────────────────────────
function buildDayGroups(s: ReturnType<typeof store.allActive> extends infer T ? any : any): DayGroup[] {
  const today = startOfDay(new Date())
  const allNodes = s.allActive()

  // 1. Encontrar todos los diary nodes
  const diaryNodes = (allNodes as Node[])
    .filter((n: Node) => n.isDiaryEntry && n.diaryDate)
    .sort((a: Node, b: Node) => new Date(a.diaryDate!).getTime() - new Date(b.diaryDate!).getTime())

  // 2. Para cada diary, recoger tareas con su contexto
  function getTasksUnder(nodeId: string, contextLabel: string | null, diary: Date, acc: TaskEntry[]) {
    for (const child of store.children(nodeId)) {
      if (child.deletedAt) continue
      try {
        const ed = JSON.parse(child.extraData || '{}')
        if (ed._timeBlock === '1') continue
      } catch {}

      if (child.status !== null) {
        // Es una tarea
        const diaryDay = startOfDay(diary)
        const status: TaskEntry['status'] =
          child.status === 'done' ? 'done' :
          diaryDay < today ? 'overdue' :
          sameDay(diaryDay, today) ? 'today' : 'future'
        acc.push({ task: child, contextLabel, diaryDate: diary, status })
      } else {
        // Es un contenedor — las tareas dentro heredan su nombre como contexto
        getTasksUnder(child.id, child.text || null, diary, acc)
      }
    }
  }

  return diaryNodes.map((dn: Node) => {
    const date = new Date(dn.diaryDate!)
    const tasks: TaskEntry[] = []
    getTasksUnder(dn.id, null, date, tasks)
    return { date, diaryNode: dn, tasks }
  }).filter((g: DayGroup) => g.tasks.length > 0)
}

// ── Leer time blocks de un día ────────────────────────────────────────────
function getTimeBlocks(day: Date, gcalEvents: CalendarEvent[]): TimeBlock[] {
  const blocks: TimeBlock[] = []
  const allNodes = store.allActive()

  for (const n of allNodes) {
    if (!n.due || n.deletedAt) continue
    try {
      const ed = JSON.parse(n.extraData || '{}')
      if (ed._timeBlock !== '1') continue
      const start = new Date(n.due)
      if (!sameDay(start, day)) continue
      const end = n.dueEnd ? new Date(n.dueEnd) : new Date(start.getTime() + 3600000)
      const linked = ed._linkedTaskId ? store.getNode(ed._linkedTaskId) : null
      blocks.push({
        kind: ed._linkedTaskId ? 'task' : 'standalone',
        id: n.id,
        text: linked ? linked.text : n.text,
        start, end,
        color: ed._linkedTaskId ? 'var(--accent)' : '#8b5cf6',
        linkedId: ed._linkedTaskId,
      })
    } catch { /* ignore */ }
  }

  for (const ev of gcalEvents) {
    if (ev.allDay) continue
    const start = new Date(ev.start)
    if (!sameDay(start, day)) continue
    const end = new Date(ev.end)
    blocks.push({
      kind: 'gcal', id: ev.id, text: ev.title,
      start, end, color: ev.backgroundColor || '#4a90d9',
      gcalEvent: ev,
    })
  }

  return blocks.sort((a,b) => a.start.getTime() - b.start.getTime())
}

// ═══════════════════════════════════════════════════════════════════════════
// CalendarPlanner — componente principal
// ═══════════════════════════════════════════════════════════════════════════

export default function CalendarPlanner() {
  const s          = useStore()
  const us         = useUserStore()
  const navigate   = useNavigate()
  const today      = startOfDay(new Date())

  const [viewMode, setViewMode]   = useState<ViewMode>('day')
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all')
  const [centerDate, setCenterDate] = useState(today)
  const [gcalEvents, setGcalEvents] = useState<CalendarEvent[]>([])
  const [editingGcal, setEditingGcal] = useState<CalendarEvent | null>(null)
  // Ancho dinámico de cada columna: (ancho del panel timeline - eje) / 5
  const [colW, setColW] = useState(180)
  const timelineRef = useRef<HTMLDivElement>(null)

  // ctx menu
  const [ctxMenu, setCtxMenu] = useState<{x:number;y:number;block:TimeBlock}|null>(null)

  // resize ref
  const resizeRef = useRef<{id:string}|null>(null)

  // ── Calcular colW dinámicamente ──────────────────────────────────────────
  useEffect(() => {
    function update() {
      if (!timelineRef.current) return
      const available = timelineRef.current.clientWidth - AXIS_W - 2
      const cols = viewMode === 'week' ? 7 : VISIBLE_DAY_COLS
      setColW(Math.max(100, Math.floor(available / cols)))
    }
    update()
    const ro = new ResizeObserver(update)
    if (timelineRef.current) ro.observe(timelineRef.current)
    return () => ro.disconnect()
  }, [viewMode])

  // ── GCal events ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!us.googleConnected) return
    const start = addDays(centerDate, -7)
    const end   = addDays(centerDate, 14)
    getCalendarEventsRange(start, end).then(setGcalEvents).catch(() => {})
  }, [us.googleConnected, centerDate.toDateString()]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Grupos de tareas ─────────────────────────────────────────────────────
  const dayGroups = useMemo(() => buildDayGroups(s), [s])

  const filteredGroups = useMemo(() => {
    if (taskFilter === 'all') return dayGroups
    return dayGroups.map(g => ({
      ...g,
      tasks: g.tasks.filter(t => {
        if (taskFilter === 'overdue') return t.status === 'overdue'
        if (taskFilter === 'today')   return t.status === 'today'
        if (taskFilter === 'future')  return t.status === 'future'
        return true
      })
    })).filter(g => g.tasks.length > 0)
  }, [dayGroups, taskFilter])

  // ── Drag task desde columna ───────────────────────────────────────────────
  function handleTaskDragStart(e: React.DragEvent, entry: TaskEntry) {
    e.dataTransfer.setData('plannerTaskId', entry.task.id)
    e.dataTransfer.setData('plannerTaskDiaryDate', entry.diaryDate.toISOString())
    e.dataTransfer.effectAllowed = 'move'
  }

  // ── Drop en columna de día ────────────────────────────────────────────────
  function handleDrop(e: React.DragEvent, targetDay: Date, colEl: HTMLElement) {
    e.preventDefault()
    const taskId   = e.dataTransfer.getData('plannerTaskId')
    const blockId  = e.dataTransfer.getData('plannerBlockId')
    const rect     = colEl.getBoundingClientRect()
    const rawY     = e.clientY - rect.top
    const start    = pxToTime(rawY, targetDay)
    const end      = new Date(start.getTime() + 3600000)
    if (start.getHours() < HOUR_START || start.getHours() >= HOUR_END) return

    if (taskId) {
      const task = store.getNode(taskId)
      if (!task) return
      const taskDiaryIso = e.dataTransfer.getData('plannerTaskDiaryDate')
      const taskDiaryDate = taskDiaryIso ? new Date(taskDiaryIso) : null

      // Crear diary node del día destino
      const targetDiaryNode = ensureDayPath(targetDay)

      // Si es un día distinto → mover la tarea al nuevo diary day
      if (taskDiaryDate && !sameDay(taskDiaryDate, targetDay)) {
        store.updateNode(taskId, { parentId: targetDiaryNode.id })
      }

      // Crear time block vinculado
      store.createNode({
        text: '',
        parentId: targetDiaryNode.id,
        due: start.toISOString(),
        extraData: { _timeBlock: '1', _linkedTaskId: taskId },
      })
    } else if (blockId) {
      // Mover time block existente
      const targetDiaryNode = ensureDayPath(targetDay)
      const duration = (() => {
        const n = store.getNode(blockId)
        if (!n?.due || !n.dueEnd) return 3600000
        return new Date(n.dueEnd).getTime() - new Date(n.due).getTime()
      })()
      store.updateNode(blockId, {
        due: start.toISOString(),
        dueEnd: new Date(start.getTime() + duration).toISOString(),
        parentId: targetDiaryNode.id,
      })
    }
  }

  // ── Clic en slot vacío → time block standalone ────────────────────────────
  function handleSlotClick(e: React.MouseEvent, day: Date, colEl: HTMLElement) {
    if ((e.target as HTMLElement).closest('.cp-block')) return
    const rect  = colEl.getBoundingClientRect()
    const start = pxToTime(e.clientY - rect.top, day)
    if (start.getHours() < HOUR_START || start.getHours() >= HOUR_END) return
    const text = prompt('Nombre del time block:') ?? ''
    if (!text.trim()) return
    const diaryNode = ensureDayPath(day)
    store.createNode({
      text,
      parentId: diaryNode.id,
      due: start.toISOString(),
      extraData: { _timeBlock: '1' },
    })
  }

  // ── Drag bloque en el grid ────────────────────────────────────────────────
  function handleBlockDragStart(e: React.DragEvent, block: TimeBlock) {
    if (block.kind === 'gcal') { e.preventDefault(); return }
    e.dataTransfer.setData('plannerBlockId', block.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  // ── Resize ────────────────────────────────────────────────────────────────
  function handleResizeStart(e: React.MouseEvent, blockId: string) {
    e.stopPropagation(); e.preventDefault()
    resizeRef.current = { id: blockId }
    function onMove(ev: MouseEvent) {
      if (!resizeRef.current) return
      const el = document.querySelector(`[data-cp-block="${resizeRef.current.id}"]`) as HTMLElement
      if (!el) return
      const col = el.closest('.cp-day-col') as HTMLElement
      if (!col) return
      const rect = col.getBoundingClientRect()
      const n = store.getNode(resizeRef.current.id)
      if (!n?.due) return
      const h = Math.max(SLOT_H, snapPx(ev.clientY - rect.top) - topPx(new Date(n.due)))
      el.style.height = h + 'px'
    }
    function onUp(ev: MouseEvent) {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (!resizeRef.current) return
      const { id } = resizeRef.current
      const n = store.getNode(id)
      if (!n?.due) { resizeRef.current = null; return }
      const col = document.querySelector(`[data-cp-block="${id}"]`)?.closest('.cp-day-col') as HTMLElement
      if (!col) { resizeRef.current = null; return }
      const rect = col.getBoundingClientRect()
      const h = Math.max(SLOT_H, snapPx(ev.clientY - rect.top) - topPx(new Date(n.due)))
      store.updateNode(id, { dueEnd: new Date(new Date(n.due).getTime() + (h / PX_PER_MIN) * 60000).toISOString() })
      resizeRef.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ── Render bloque ─────────────────────────────────────────────────────────
  function renderBlock(block: TimeBlock) {
    const h = heightPx(block.start.getTime(), block.end.getTime())
    const canDrag = block.kind !== 'gcal'
    return (
      <div
        key={block.id}
        data-cp-block={block.id}
        className={`cp-block cp-block--${block.kind}`}
        style={{ top: topPx(block.start), height: h, background: block.color, left: 2, right: 2 }}
        draggable={canDrag}
        onDragStart={e => handleBlockDragStart(e, block)}
        onClick={e => {
          e.stopPropagation()
          if (block.kind === 'gcal' && block.gcalEvent) setEditingGcal(block.gcalEvent)
          else if (block.kind === 'task' && block.linkedId) navigate(`/node/${block.linkedId}`)
        }}
        onContextMenu={e => { e.preventDefault(); setCtxMenu({x:e.clientX,y:e.clientY,block}) }}
        title={`${block.text}\n${fmtHH(block.start)} – ${fmtHH(block.end)}`}
      >
        <div className="cp-block-time">{fmtHH(block.start)}</div>
        <div className="cp-block-text">{block.text || 'Sin título'}</div>
        {canDrag && <div className="cp-block-resize" onMouseDown={e => handleResizeStart(e, block.id)} />}
      </div>
    )
  }

  // ── Render columna de día (timeline) ──────────────────────────────────────
  function renderDayCol(day: Date) {
    const isToday   = sameDay(day, today)
    const isCenter  = sameDay(day, centerDate)
    const blocks    = getTimeBlocks(day, gcalEvents)
    const nowTop    = topPx(new Date())

    return (
      <div key={day.toISOString()} className="cp-day-col-wrap" style={{ width: colW, flexShrink: 0 }}>
        <div className="cp-day-col"
          style={{ height: TOTAL_HOURS * HOUR_H, position: 'relative' }}
          onDragOver={e => e.preventDefault()}
          onDrop={e => handleDrop(e, day, e.currentTarget)}
          onClick={e => handleSlotClick(e, day, e.currentTarget)}
        >
          {Array.from({ length: TOTAL_HOURS * 2 }, (_, i) => (
            <div key={i} className={`cp-slot ${i%2===0?'cp-slot--hr':'cp-slot--half'}`} style={{ top: i*SLOT_H }} />
          ))}
          {isToday && nowTop >= 0 && nowTop < TOTAL_HOURS * HOUR_H && (
            <div className="cp-now" style={{ top: nowTop }} />
          )}
          {blocks.map(renderBlock)}
        </div>
      </div>
    )
  }

  // ── Navegación ────────────────────────────────────────────────────────────
  function navigate_date(delta: number) {
    setCenterDate(prev => {
      if (viewMode === 'day')   return addDays(prev, delta)
      if (viewMode === 'week')  return addDays(prev, delta * 7)
      return new Date(prev.getFullYear(), prev.getMonth() + delta, 1)
    })
  }

  // ── Vista DÍA — 5 columnas con scroll horizontal ──────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null)

  // Centrar en la columna del día actual al montar o cambiar centerDate
  useLayoutEffect(() => {
    if (viewMode !== 'day' || !scrollRef.current) return
    // Centrar el día actual: PRE_DAYS_EACH columnas antes del centro
    // El centro queda en el medio del viewport visible (2 a izquierda, 2 a derecha)
    const centerColLeft = PRE_DAYS_EACH * colW
    const viewportW = scrollRef.current.clientWidth - AXIS_W
    const scroll = centerColLeft - Math.floor((viewportW - colW) / 2)
    scrollRef.current.scrollLeft = Math.max(0, scroll)
  }, [viewMode, centerDate.toDateString(), colW]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll vertical al "ahora" al montar
  const gridScrollRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!gridScrollRef.current) return
    gridScrollRef.current.scrollTop = Math.max(0, topPx(new Date()) - 120)
  }, [viewMode])

  // ── Días de la vista actual ───────────────────────────────────────────────
  const visibleDays = useMemo(() => {
    if (viewMode === 'day') {
      // Pre-renderizamos PRE_DAYS_EACH días a cada lado para scroll continuo
      return Array.from({ length: PRE_DAYS_EACH * 2 + 1 }, (_, i) =>
        addDays(centerDate, i - PRE_DAYS_EACH)
      )
    }
    if (viewMode === 'week') {
      const mon = startOfWeek(centerDate)
      return Array.from({length:7}, (_,i) => addDays(mon,i))
    }
    return []
  }, [viewMode, centerDate.toDateString()]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Título de navegación ──────────────────────────────────────────────────
  const navTitle = useMemo(() => {
    if (viewMode === 'day') {
      return fmt(centerDate, { weekday:'long', day:'numeric', month:'long', year:'numeric' })
    }
    if (viewMode === 'week') {
      const mon = startOfWeek(centerDate)
      const sun = addDays(mon, 6)
      return `${mon.getDate()} – ${sun.getDate()} ${MONTHS_ES_LONG[mon.getMonth()]} ${mon.getFullYear()}`
    }
    return `${MONTHS_ES_LONG[centerDate.getMonth()]} ${centerDate.getFullYear()}`
  }, [viewMode, centerDate.toDateString()]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Vista MES — grid mensual ──────────────────────────────────────────────
  function renderMonthView() {
    const firstDay = startOfMonth(centerDate)
    const totalDays = daysInMonth(centerDate)
    // Día de la semana del primer día (0=Dom, convertir a lunes=0)
    const firstDow = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1
    const cells: (Date | null)[] = []
    for (let i = 0; i < firstDow; i++) cells.push(null)
    for (let d = 1; d <= totalDays; d++) cells.push(new Date(centerDate.getFullYear(), centerDate.getMonth(), d))

    // Contar tareas por día
    const taskCountByDay = new Map<string, number>()
    for (const g of dayGroups) {
      const key = g.date.toISOString().split('T')[0]!
      taskCountByDay.set(key, (taskCountByDay.get(key) ?? 0) + g.tasks.length)
    }

    return (
      <div className="cp-month-grid">
        {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => (
          <div key={d} className="cp-month-dow">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} className="cp-month-cell cp-month-cell--empty" />
          const key = day.toISOString().split('T')[0]!
          const count = taskCountByDay.get(key) ?? 0
          const isToday = sameDay(day, today)
          const isCenter = sameDay(day, centerDate)
          return (
            <div
              key={key}
              className={`cp-month-cell ${isToday?'cp-month-cell--today':''} ${isCenter?'cp-month-cell--center':''}`}
              onClick={() => { setCenterDate(startOfDay(day)); setViewMode('day') }}
            >
              <div className="cp-month-day-num">{day.getDate()}</div>
              {count > 0 && <div className="cp-month-task-dot" title={`${count} tareas`}>{count}</div>}
              {/* Puntos de GCal events */}
              {gcalEvents.filter(ev => !ev.allDay && sameDay(new Date(ev.start), day)).slice(0,3).map(ev => (
                <div key={ev.id} className="cp-month-gcal-dot" style={{ background: ev.backgroundColor || '#4a90d9' }} />
              ))}
            </div>
          )
        })}
      </div>
    )
  }

  // ═════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════════
  return (
    <div className="cp-root">

      {/* ── Header ── */}
      <div className="cp-header">
        <button className="cp-back-btn" onClick={() => navigate(-1)} title="Volver">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 16L6 10l6-6"/>
          </svg>
        </button>

        <div className="cp-view-tabs">
          {(['day','week','month'] as ViewMode[]).map(m => (
            <button key={m} className={`cp-view-tab ${viewMode===m?'cp-view-tab--active':''}`} onClick={() => setViewMode(m)}>
              {m === 'day' ? 'Día' : m === 'week' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>

        <button className="cp-nav-btn" onClick={() => navigate_date(-1)}>‹</button>
        <span className="cp-nav-title">{navTitle}</span>
        <button className="cp-nav-btn" onClick={() => navigate_date(1)}>›</button>
        <button className="cp-today-btn" onClick={() => setCenterDate(today)}>Hoy</button>
      </div>

      {/* ── Body ── */}
      <div className="cp-body">

        {/* Columna de tareas */}
        <div className="cp-task-col">
          {/* Filtros */}
          <div className="cp-task-filters">
            {([['all','Todas'],['overdue','Vencidas'],['today','Hoy'],['future','Futuras']] as [TaskFilter,string][]).map(([f,label]) => (
              <button
                key={f}
                className={`cp-filter-chip ${taskFilter===f?'cp-filter-chip--active':''} ${f==='overdue'?'cp-filter-chip--od':''}`}
                onClick={() => setTaskFilter(f)}
              >{label}</button>
            ))}
          </div>

          {/* Lista de días con tareas */}
          <div className="cp-task-list">
            {filteredGroups.length === 0 && (
              <div className="cp-task-empty">Sin tareas{taskFilter !== 'all' ? ' en este filtro' : ''}</div>
            )}
            {filteredGroups.map(g => {
              const isToday = sameDay(g.date, today)
              const isPast  = g.date < today
              return (
                <div key={g.diaryNode.id} className="cp-task-group">
                  {/* Cabecera del día */}
                  <div
                    className={`cp-task-day-head ${isToday?'cp-task-day-head--today':''} ${isPast?'cp-task-day-head--past':''}`}
                    onClick={() => { setCenterDate(startOfDay(g.date)); setViewMode('day') }}
                    title="Ver este día en el timeline"
                  >
                    <span>{fmt(g.date, { weekday:'short', day:'numeric', month:'short' })}</span>
                    {isToday && <span className="cp-task-today-badge">HOY</span>}
                  </div>

                  {/* Tareas agrupadas por contenedor */}
                  {(() => {
                    // Agrupar por contextLabel
                    const groups = new Map<string|null, TaskEntry[]>()
                    for (const t of g.tasks) {
                      const key = t.contextLabel
                      if (!groups.has(key)) groups.set(key, [])
                      groups.get(key)!.push(t)
                    }
                    return Array.from(groups.entries()).map(([label, tasks]) => (
                      <div key={label ?? '__root'}>
                        {label && <div className="cp-task-ctx-label">{label}</div>}
                        {tasks.map(t => (
                          <div
                            key={t.task.id}
                            className={`cp-task-row cp-task-row--${t.status}`}
                            draggable
                            onDragStart={e => handleTaskDragStart(e, t)}
                            onClick={() => navigate(`/node/${t.task.id}`)}
                          >
                            <span className={`cp-task-check cp-task-check--${t.status}`} />
                            <span className="cp-task-text">{t.task.text || 'Sin título'}</span>
                          </div>
                        ))}
                      </div>
                    ))
                  })()}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Timeline area ── */}
        <div className="cp-timeline" ref={el => { (gridScrollRef as any).current = el; (timelineRef as any).current = el }}>

          {viewMode === 'month' && renderMonthView()}

          {viewMode !== 'month' && (
            <>
              {/* Encabezados de días */}
              <div className="cp-col-heads">
                <div style={{ width: AXIS_W, flexShrink: 0 }} />
                {visibleDays.map(d => {
                  const isToday  = sameDay(d, today)
                  const isCenter = sameDay(d, centerDate)
                  return (
                    <div
                      key={d.toISOString()}
                      className={`cp-col-head ${isToday?'cp-col-head--today':''} ${isCenter?'cp-col-head--center':''}`}
                      style={{ width: colW, flexShrink: 0 }}
                    >
                      {dayColLabel(d)}
                    </div>
                  )
                })}
              </div>

              {/* Grid de horas */}
              <div className={`cp-hour-grid ${viewMode === 'day' ? 'cp-hour-grid--scroll' : ''}`} ref={scrollRef}>
                {/* Eje de horas */}
                <div className="cp-axis" style={{ width: AXIS_W, height: TOTAL_HOURS * HOUR_H }}>
                  {Array.from({length: TOTAL_HOURS+1}, (_,i) => (
                    <div key={i} className="cp-axis-label" style={{ top: i*HOUR_H - 8 }}>
                      {String(HOUR_START+i).padStart(2,'0')}:00
                    </div>
                  ))}
                </div>
                {/* Columnas */}
                <div style={{ display:'flex', flex:1 }}>
                  {visibleDays.map(d => renderDayCol(d))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Context menu ── */}
      {ctxMenu && (
        <>
          <div style={{ position:'fixed', inset:0, zIndex:998 }} onClick={() => setCtxMenu(null)} />
          <div className="cp-ctx" style={{ left: ctxMenu.x, top: ctxMenu.y }}>
            {ctxMenu.block.kind === 'gcal' && (
              <button onClick={() => {
                if (!ctxMenu.block.gcalEvent) return
                const dayNode = ensureDayPath(ctxMenu.block.start)
                store.createNode({ text: ctxMenu.block.gcalEvent.title, parentId: dayNode.id })
                setCtxMenu(null)
              }}>📄 Crear nodo asociado</button>
            )}
            {ctxMenu.block.kind === 'task' && ctxMenu.block.linkedId && (
              <button onClick={() => { navigate(`/node/${ctxMenu.block.linkedId!}`); setCtxMenu(null) }}>
                → Ir a la tarea
              </button>
            )}
            {ctxMenu.block.kind === 'standalone' && (
              <button onClick={() => {
                const b = ctxMenu.block
                const dayNode = ensureDayPath(b.start)
                store.createNode({ text: b.text, parentId: dayNode.id, isTask: true })
                store.deleteNode(b.id)
                setCtxMenu(null)
              }}>✓ Convertir a tarea</button>
            )}
            {ctxMenu.block.kind !== 'gcal' && (
              <button className="cp-ctx-danger" onClick={() => { store.deleteNode(ctxMenu.block.id); setCtxMenu(null) }}>
                Eliminar time block
              </button>
            )}
          </div>
        </>
      )}

      {/* GCal editor */}
      {editingGcal && (
        <GCalEventEditor
          event={editingGcal}
          modal
          onClose={() => setEditingGcal(null)}
          onUpdated={ev => { setGcalEvents(p => p.map(x => x.id===ev.id?ev:x)); setEditingGcal(null) }}
          onDeleted={id => { setGcalEvents(p => p.filter(x => x.id!==id)); setEditingGcal(null) }}
        />
      )}
    </div>
  )
}
