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
import Outliner from '../outliner/Outliner'

// ── Geometría ──────────────────────────────────────────────────────────────
const HOUR_START  = 6
const HOUR_END    = 24
const TOTAL_HOURS = HOUR_END - HOUR_START
const SLOT_H      = 40          // px / 30 min
const HOUR_H      = SLOT_H * 2  // px / hora
const PX_PER_MIN  = SLOT_H / 30
const AXIS_W      = 44          // px eje horas
const TASK_COL_W  = 600         // px columna tareas (outliner de from)
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
  return Math.max(SNAP_PX, (endMs - startMs) / 60000 * PX_PER_MIN)
}
const SNAP_PX = SLOT_H / 2  // snap a 15 min (SLOT_H = 30 min = 2 × SNAP_PX)

function snapPx(y: number): number {
  return Math.round(y / SNAP_PX) * SNAP_PX
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
  const [newBlock, setNewBlock] = useState<{day:Date;start:Date;top:number;text:string}|null>(null)
  const newBlockRef = useRef<HTMLInputElement>(null)

  // resize ref
  const resizeRef      = useRef<{id:string}|null>(null)
  const justResized    = useRef(false)   // bloquea onClick tras soltar resize
  const justDragged    = useRef(false)   // bloquea onClick tras soltar drag de bloque

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

  // ── filterMatchIds para el Outliner de tareas ────────────────────────────
  // Calcula qué nodos task mostrar según el filtro activo.
  // Igual que WFHomeView: matchIds = tareas que cumplen el filtro,
  // ancestorIds = todos sus ancestros para mostrar la jerarquía completa.
  const { filterMatchIds, filterAncestorIds } = useMemo(() => {
    const todayStart = startOfDay(new Date())
    const matchIds   = new Set<string>()

    for (const n of s.allActive()) {
      if (n.status === null || n.deletedAt) continue
      try {
        if (JSON.parse(n.extraData || '{}')._timeBlock === '1') continue
      } catch {}

      if (taskFilter !== 'all') {
        // Para overdue/today/future necesitamos saber en qué diary day vive la tarea
        let diaryDate: Date | null = null
        let cur = n.parentId ? store.getNode(n.parentId) : null
        while (cur) {
          if (cur.isDiaryEntry && cur.diaryDate) { diaryDate = new Date(cur.diaryDate); break }
          cur = cur.parentId ? store.getNode(cur.parentId) : null
        }
        if (taskFilter === 'overdue' && !(diaryDate && startOfDay(diaryDate) < todayStart)) continue
        if (taskFilter === 'today'   && !(diaryDate && sameDay(diaryDate, todayStart))) continue
        if (taskFilter === 'future'  && !(diaryDate && startOfDay(diaryDate) > todayStart)) continue
      }
      matchIds.add(n.id)
    }

    // Ancestros de todos los nodos que coinciden
    const ancestorIds = new Set<string>()
    for (const id of matchIds) {
      let cur = store.getNode(id)?.parentId
      while (cur) { ancestorIds.add(cur); cur = store.getNode(cur)?.parentId }
    }

    return { filterMatchIds: matchIds, filterAncestorIds: ancestorIds }
  }, [s, taskFilter])

  // ── Drop en columna de día ────────────────────────────────────────────────
  function handleDrop(e: React.DragEvent, targetDay: Date, colEl: HTMLElement) {
    e.preventDefault()
    const taskId   = e.dataTransfer.getData('plannerTaskId')
    const blockId  = e.dataTransfer.getData('plannerBlockId')
    const rect     = colEl.getBoundingClientRect()

    if (taskId) {
      // Drag desde columna de tareas: el drop es donde empieza el bloque
      const rawY  = e.clientY - rect.top
      const start = pxToTime(rawY, targetDay)
      if (start.getHours() < HOUR_START || start.getHours() >= HOUR_END) return

      const task = store.getNode(taskId)
      if (!task) return

      const taskDiaryIso  = e.dataTransfer.getData('plannerTaskDiaryDate')
      const taskDiaryDate = taskDiaryIso ? new Date(taskDiaryIso) : null
      const targetDiaryNode = ensureDayPath(targetDay)

      // Mover tarea al nuevo día solo si es distinto
      if (taskDiaryDate && !sameDay(taskDiaryDate, targetDay)) {
        store.updateNode(taskId, { parentId: targetDiaryNode.id })
      }

      // Crear time block con el texto de la tarea (no vacío, para evitar auto-delete)
      const end = new Date(start.getTime() + 3600000)
      store.createNode({
        text:      task.text || 'Time block',
        parentId:  targetDiaryNode.id,
        due:       start.toISOString(),
        extraData: { _timeBlock: '1', _linkedTaskId: taskId },
      })
    } else if (blockId) {
      // Drag de bloque existente: restar offset del clic dentro del bloque
      const offsetY = parseFloat(e.dataTransfer.getData('plannerBlockOffsetY') || '0')
      const rawY    = e.clientY - rect.top - offsetY
      const start   = pxToTime(rawY, targetDay)
      if (start.getHours() < HOUR_START || start.getHours() >= HOUR_END) return

      const n = store.getNode(blockId)
      if (!n?.due) return
      const duration = n.dueEnd
        ? new Date(n.dueEnd).getTime() - new Date(n.due).getTime()
        : 3600000

      const targetDiaryNode = ensureDayPath(targetDay)
      store.updateNode(blockId, {
        due:      start.toISOString(),
        dueEnd:   new Date(start.getTime() + duration).toISOString(),
        parentId: targetDiaryNode.id,
      })
    }
  }

  // ── Clic en slot vacío → time block standalone ────────────────────────────
  function handleSlotClick(e: React.MouseEvent, day: Date, colEl: HTMLElement) {
    if ((e.target as HTMLElement).closest('.cp-block') || (e.target as HTMLElement).closest('.cp-new-block')) return
    const rect  = colEl.getBoundingClientRect()
    const rawY  = e.clientY - rect.top
    const start = pxToTime(rawY, day)
    if (start.getHours() < HOUR_START || start.getHours() >= HOUR_END) return
    setNewBlock({ day, start, top: snapPx(rawY), text: '' })
    setTimeout(() => newBlockRef.current?.focus(), 20)
  }

  function commitNewBlock() {
    if (!newBlock) return
    if (newBlock.text.trim()) {
      store.createNode({
        text:      newBlock.text.trim(),
        parentId:  ensureDayPath(newBlock.day).id,
        due:       newBlock.start.toISOString(),
        extraData: { _timeBlock: '1' },
      })
    }
    setNewBlock(null)
  }

  // ── Drag bloque en el grid ────────────────────────────────────────────────
  function handleBlockDragStart(e: React.DragEvent, block: TimeBlock) {
    if (block.kind === 'gcal') { e.preventDefault(); return }
    // Guardar el offset Y desde el top del bloque al cursor para drop preciso
    const blockEl = e.currentTarget as HTMLElement
    const blockRect = blockEl.getBoundingClientRect()
    const offsetY = e.clientY - blockRect.top
    e.dataTransfer.setData('plannerBlockId', block.id)
    e.dataTransfer.setData('plannerBlockOffsetY', String(Math.round(offsetY)))
    e.dataTransfer.effectAllowed = 'move'
    // Marcar como drag activo para bloquear onClick al soltar
    justDragged.current = false
    const onDragEnd = () => {
      justDragged.current = true
      setTimeout(() => { justDragged.current = false }, 200)
      blockEl.removeEventListener('dragend', onDragEnd)
    }
    blockEl.addEventListener('dragend', onDragEnd)
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
      const h = Math.max(SNAP_PX, snapPx(ev.clientY - rect.top) - topPx(new Date(n.due)))
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
      const h = Math.max(SNAP_PX, snapPx(ev.clientY - rect.top) - topPx(new Date(n.due)))
      store.updateNode(id, { dueEnd: new Date(new Date(n.due).getTime() + (h / PX_PER_MIN) * 60000).toISOString() })
      resizeRef.current = null
      // Bloquear el click que el navegador dispara tras soltar el mouse
      justResized.current = true
      setTimeout(() => { justResized.current = false }, 200)
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
          // Ignorar clicks que son consecuencia de soltar un resize o un drag
          if (justResized.current || justDragged.current) return
          if (block.kind === 'gcal' && block.gcalEvent) setEditingGcal(block.gcalEvent)
          else if (block.linkedId) navigate(`/node/${block.linkedId}`)
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
          {/* Slots cada 15 min: 4 por hora */}
          {Array.from({ length: TOTAL_HOURS * 4 }, (_, i) => {
            const cls = i%4===0 ? 'cp-slot--hr' : i%2===0 ? 'cp-slot--half' : 'cp-slot--qtr'
            return <div key={i} className={`cp-slot ${cls}`} style={{ top: i * SNAP_PX }} />
          })}
          {isToday && nowTop >= 0 && nowTop < TOTAL_HOURS * HOUR_H && (
            <div className="cp-now" style={{ top: nowTop }} />
          )}
          {blocks.map(renderBlock)}

          {/* Bloque inline en creación */}
          {newBlock && sameDay(newBlock.day, day) && (
            <div className="cp-new-block" style={{ top: newBlock.top, left: 2, right: 2 }}>
              <div className="cp-block-time" style={{ fontSize: 9, color: 'rgba(255,255,255,.85)' }}>{(() => { const h=newBlock.start.getHours(); const m=newBlock.start.getMinutes(); return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}` })()}</div>
              <input
                ref={newBlockRef}
                className="pp-new-block-input"
                value={newBlock.text}
                placeholder="Nombre…"
                onChange={e => setNewBlock(b => b ? {...b, text: e.target.value} : null)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); commitNewBlock() }
                  if (e.key === 'Escape') setNewBlock(null)
                }}
                onBlur={commitNewBlock}
              />
            </div>
          )}
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
  const scrollRef  = useRef<HTMLDivElement>(null)
  const headersRef = useRef<HTMLDivElement>(null)

  // Centrar en la columna del día actual al montar o cambiar centerDate
  // ── Sync cabecera con scroll horizontal del grid ─────────────────────────
  useEffect(() => {
    const grid = scrollRef.current
    if (!grid) return
    function onScroll() {
      if (headersRef.current) headersRef.current.scrollLeft = grid!.scrollLeft
    }
    grid.addEventListener('scroll', onScroll, { passive: true })
    return () => grid.removeEventListener('scroll', onScroll)
  }, [viewMode])

  useLayoutEffect(() => {
    if (viewMode !== 'day' || !scrollRef.current) return
    // Centrar el día actual: PRE_DAYS_EACH columnas antes del centro
    // El centro queda en el medio del viewport visible (2 a izquierda, 2 a derecha)
    const centerColLeft = PRE_DAYS_EACH * colW
    const viewportW = scrollRef.current.clientWidth - AXIS_W
    const scroll = centerColLeft - Math.floor((viewportW - colW) / 2)
    const pos = Math.max(0, scroll)
    scrollRef.current.scrollLeft = pos
    if (headersRef.current) headersRef.current.scrollLeft = pos
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

    // Contar tareas por día usando filterMatchIds y sus ancestros diarios
    const taskCountByDay = new Map<string, number>()
    for (const id of filterMatchIds) {
      const n = store.getNode(id)
      if (!n) continue
      // Buscar el diary ancestor
      let cur = n.parentId ? store.getNode(n.parentId) : null
      while (cur) {
        if (cur.isDiaryEntry && cur.diaryDate) {
          const key = cur.diaryDate.split('T')[0]!
          taskCountByDay.set(key, (taskCountByDay.get(key) ?? 0) + 1)
          break
        }
        cur = cur.parentId ? store.getNode(cur.parentId) : null
      }
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

        {/* Columna de tareas — Outliner filtrado igual que el árbol central */}
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

          {/* Árbol filtrado — mismos bullets, chevrons y zoom que el árbol central */}
          <div className="cp-task-outliner">
            {filterMatchIds.size === 0
              ? <div className="cp-task-empty">Sin tareas{taskFilter !== 'all' ? ' en este filtro' : ''}</div>
              : <Outliner
                  parentId={null}
                  filterMatchIds={filterMatchIds}
                  filterAncestorIds={filterAncestorIds}
                  placeholder=""
                />
            }
          </div>
        </div>

        {/* ── Timeline area ── */}
        <div className="cp-timeline" ref={el => { (gridScrollRef as any).current = el; (timelineRef as any).current = el }}>

          {viewMode === 'month' && renderMonthView()}

          {viewMode !== 'month' && (
            <>
              {/* Encabezados de días */}
              <div className="cp-col-heads" ref={headersRef}>
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
