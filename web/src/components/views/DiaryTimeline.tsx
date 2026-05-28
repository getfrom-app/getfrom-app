/**
 * DiaryTimeline — Timeline continuo de días para notas de diario.
 *
 * Vista que reemplaza NodeCalendarView cuando el nodo es isDiaryEntry=true.
 * Muestra un grid horizontal de días centrado en el día de la nota:
 *   [ayer–2] [ayer–1] [HOY] [mañana+1] [mañana+2]
 * Con scroll horizontal se accede a días anteriores/posteriores.
 *
 * Tres tipos de time block:
 *   1. GCal event   — color del calendario, clic → editor GCal, derecho → "Crear nodo"
 *   2. Task block   — accent, vinculado a nodo tarea, clic → navega, derecho → eliminar block
 *   3. Standalone   — morado, solo texto, clic → editar, derecho → "Convertir a tarea" / eliminar
 *
 * Los time blocks se almacenan como nodos bajo el diary day:
 *   extraData._timeBlock = "1"
 *   extraData._linkedTaskId = "..." (task blocks)
 *   extraData._gcalEventId  = "..." (para futura referencia, gcal events no se guardan)
 */

import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'
import { getCalendarEventsRange, type CalendarEvent } from '../../api/googleCalendar'
import { GCalEventEditor } from '../panels/DiaryRightPanel'
import { useUserStore } from '../../store/userStore'
import { ensureDayPath } from '../../utils/agendaHelper'

// ── Geometría ──────────────────────────────────────────────────────────────

const HOUR_START  = 6
const HOUR_END    = 24
const TOTAL_HOURS = HOUR_END - HOUR_START
const SLOT_H      = 40          // px por 30 min
const HOUR_H      = SLOT_H * 2  // 80 px por hora
const PX_PER_MIN  = SLOT_H / 30
const COL_W       = 160         // px por columna de día
const AXIS_W      = 40          // px eje de horas
const SIDEBAR_W   = 220         // px panel de tareas
const DAYS_BEFORE = 30          // días pre-renderizados hacia atrás
const DAYS_AFTER  = 30          // días pre-renderizados hacia adelante

// ── Helpers de tiempo ──────────────────────────────────────────────────────

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth()    === b.getMonth()
      && a.getDate()     === b.getDate()
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
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

function pxToDateTime(px: number, day: Date): Date {
  const mins = snapPx(px) / PX_PER_MIN + HOUR_START * 60
  const d = new Date(day)
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0)
  return d
}

function formatHH(d: Date) {
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

const DAYS_ES  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const MONTHS_ES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

function dayHeader(d: Date, isCenter: boolean): string {
  const dow = DAYS_ES[d.getDay()]!
  const label = `${dow} ${d.getDate()} ${MONTHS_ES[d.getMonth()]}`
  return isCenter ? label.toUpperCase() : label
}

// ── Tipos de time block ────────────────────────────────────────────────────

type BlockKind = 'task' | 'standalone' | 'gcal'

interface TBlock {
  kind:        BlockKind
  id:          string          // nodeId (task/standalone) o gcalEventId
  text:        string
  start:       Date
  end:         Date
  color:       string
  linkedId?:   string          // para task blocks: nodeId de la tarea
  gcalEvent?:  CalendarEvent   // para gcal blocks
}

function gcalColor(ev: CalendarEvent): string {
  return ev.backgroundColor || '#4a90d9'
}

// ── Context menu state ────────────────────────────────────────────────────

interface CtxMenu {
  x: number; y: number
  block: TBlock
}

// ── Main component ────────────────────────────────────────────────────────

interface Props {
  diaryNode: Node
}

export default function DiaryTimeline({ diaryNode }: Props) {
  const s         = useStore()
  const us        = useUserStore()
  const navigate  = useNavigate()

  const baseDate  = diaryNode.diaryDate ? new Date(diaryNode.diaryDate) : new Date()
  baseDate.setHours(0, 0, 0, 0)

  // Días pre-renderizados
  const days = Array.from({ length: DAYS_BEFORE + 1 + DAYS_AFTER }, (_, i) =>
    addDays(baseDate, i - DAYS_BEFORE)
  )

  // ── GCal events ─────────────────────────────────────────────────────────
  const [gcalEvents, setGcalEvents] = useState<CalendarEvent[]>([])
  const [editingGcal, setEditingGcal] = useState<CalendarEvent | null>(null)

  useEffect(() => {
    if (!us.googleConnected) return
    const start = addDays(baseDate, -DAYS_BEFORE)
    const end   = addDays(baseDate,  DAYS_AFTER + 1)
    getCalendarEventsRange(start, end).then(setGcalEvents).catch(() => {})
  }, [us.googleConnected, diaryNode.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Time blocks from nodes ───────────────────────────────────────────────
  function getTimeBlocks(day: Date): TBlock[] {
    const blocks: TBlock[] = []

    // 1. Nodos time block almacenados bajo diary nodes de ese día
    const allNodes = s.allActive()
    for (const n of allNodes) {
      try {
        const ed = JSON.parse(n.extraData || '{}')
        if (ed._timeBlock !== '1' || !n.due) continue
        const start = new Date(n.due)
        if (!sameDay(start, day)) continue
        const end = n.dueEnd ? new Date(n.dueEnd) : new Date(start.getTime() + 3600000)
        const linkedTask = ed._linkedTaskId ? s.getNode(ed._linkedTaskId) : null
        blocks.push({
          kind:     ed._linkedTaskId ? 'task' : 'standalone',
          id:       n.id,
          text:     linkedTask ? linkedTask.text : n.text,
          start, end,
          color:    ed._linkedTaskId ? 'var(--accent)' : '#8b5cf6',
          linkedId: ed._linkedTaskId,
        })
      } catch { /* ignore */ }
    }

    // 2. GCal events ese día
    for (const ev of gcalEvents) {
      if (ev.allDay) continue
      const start = new Date(ev.start)
      if (!sameDay(start, day)) continue
      const end = new Date(ev.end)
      blocks.push({
        kind:      'gcal',
        id:        ev.id,
        text:      ev.title,
        start, end,
        color:     gcalColor(ev),
        gcalEvent: ev,
      })
    }

    return blocks.sort((a, b) => a.start.getTime() - b.start.getTime())
  }

  // ── Context menu ─────────────────────────────────────────────────────────
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null)

  function closeCtx() { setCtxMenu(null) }

  function handleBlockRightClick(e: React.MouseEvent, block: TBlock) {
    e.preventDefault()
    e.stopPropagation()
    setCtxMenu({ x: e.clientX, y: e.clientY, block })
  }

  function deleteBlock(block: TBlock) {
    if (block.kind !== 'gcal') store.deleteNode(block.id)
    closeCtx()
  }

  async function convertToTask(block: TBlock) {
    // Encuentra o crea el diary day node para esa fecha
    const dayNode = ensureDayPath(block.start)
    store.createNode({ text: block.text, parentId: dayNode.id, isTask: true })
    store.deleteNode(block.id)
    closeCtx()
  }

  async function createNodeFromGcal(block: TBlock) {
    if (!block.gcalEvent) return
    const dayNode = ensureDayPath(block.start)
    store.createNode({
      text:      block.gcalEvent.title,
      parentId:  dayNode.id,
      extraData: { _gcalRef: block.gcalEvent.id },
    })
    closeCtx()
  }

  // ── Drag de task desde sidebar ────────────────────────────────────────────
  const [draggingTask, setDraggingTask] = useState<Node | null>(null)

  function handleTaskDragStart(e: React.DragEvent, task: Node) {
    e.dataTransfer.setData('taskNodeId', task.id)
    setDraggingTask(task)
  }

  function handleTaskDragEnd() { setDraggingTask(null) }

  // ── Drop en columna de día ────────────────────────────────────────────────
  function handleColDrop(e: React.DragEvent, day: Date, colEl: HTMLElement) {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('taskNodeId')
    const blockId = e.dataTransfer.getData('blockId')

    const rect = colEl.getBoundingClientRect()
    const rawY = e.clientY - rect.top
    const start = pxToDateTime(rawY, day)
    const end   = new Date(start.getTime() + 3600000) // 1h por defecto

    if (start.getHours() < HOUR_START || start.getHours() >= HOUR_END) return

    if (taskId) {
      // Crear time block vinculado a la tarea
      const task = store.getNode(taskId)
      if (!task) return
      const dayNode = ensureDayPath(day)
      store.createNode({
        text:      '',
        parentId:  dayNode.id,
        due:       start.toISOString(),
        extraData: { _timeBlock: '1', _linkedTaskId: taskId },
      })
      // Si es otro día diferente al día de la tarea, mover la tarea a ese día
      const taskParent = task.parentId ? s.getNode(task.parentId) : null
      if (taskParent?.isDiaryEntry && taskParent.diaryDate) {
        const taskDay = new Date(taskParent.diaryDate)
        if (!sameDay(taskDay, day)) {
          store.updateNode(taskId, { parentId: dayNode.id })
        }
      }
      setDraggingTask(null)
    } else if (blockId) {
      // Mover time block existente
      store.updateNode(blockId, { due: start.toISOString(), dueEnd: end.toISOString() })
    }
  }

  // ── Clic en slot vacío → time block standalone ────────────────────────────
  function handleSlotClick(e: React.MouseEvent, day: Date, colEl: HTMLElement) {
    if ((e.target as HTMLElement).closest('.dtl-block')) return
    const rect = colEl.getBoundingClientRect()
    const rawY = e.clientY - rect.top
    const start = pxToDateTime(rawY, day)
    if (start.getHours() < HOUR_START || start.getHours() >= HOUR_END) return
    const end = new Date(start.getTime() + 3600000)
    const dayNode = ensureDayPath(day)
    const text = prompt('Nombre del time block:') ?? ''
    if (!text.trim()) return
    store.createNode({
      text,
      parentId:  dayNode.id,
      due:       start.toISOString(),
      extraData: { _timeBlock: '1' },
    })
  }

  // ── Drag de bloque en el timeline (mover) ─────────────────────────────────
  const dragBlockRef = useRef<{ id: string; offsetY: number } | null>(null)

  function handleBlockDragStart(e: React.DragEvent, block: TBlock) {
    if (block.kind === 'gcal') { e.preventDefault(); return }
    e.dataTransfer.setData('blockId', block.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  // ── Resize desde borde inferior ───────────────────────────────────────────
  const resizeRef = useRef<{ id: string } | null>(null)

  function handleResizeStart(e: React.MouseEvent, blockId: string) {
    e.stopPropagation()
    e.preventDefault()
    resizeRef.current = { id: blockId }

    function onMove(ev: MouseEvent) {
      if (!resizeRef.current) return
      const colEl = document.querySelector(`[data-block-id="${resizeRef.current.id}"]`)?.closest('.dtl-col') as HTMLElement
      if (!colEl) return
      const n = store.getNode(resizeRef.current.id)
      if (!n?.due) return
      const rect = colEl.getBoundingClientRect()
      const rawY = ev.clientY - rect.top
      const snapped = snapPx(rawY)
      const dueTop = topPx(new Date(n.due))
      const h = Math.max(SLOT_H, snapped - dueTop)
      const el = document.querySelector(`[data-block-id="${resizeRef.current.id}"]`) as HTMLElement
      if (el) el.style.height = h + 'px'
    }

    function onUp(ev: MouseEvent) {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (!resizeRef.current) return
      const { id } = resizeRef.current
      const n = store.getNode(id)
      if (!n?.due) { resizeRef.current = null; return }
      const colEl = document.querySelector(`[data-block-id="${id}"]`)?.closest('.dtl-col') as HTMLElement
      if (!colEl) { resizeRef.current = null; return }
      const rect = colEl.getBoundingClientRect()
      const rawY = ev.clientY - rect.top
      const h = Math.max(SLOT_H, snapPx(rawY) - topPx(new Date(n.due)))
      const dueEnd = new Date(new Date(n.due).getTime() + (h / PX_PER_MIN) * 60000)
      store.updateNode(id, { dueEnd: dueEnd.toISOString() })
      resizeRef.current = null
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ── Scroll inicial centrado en el día de la nota ──────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!scrollRef.current) return
    const centerX = DAYS_BEFORE * COL_W - (scrollRef.current.clientWidth / 2 - COL_W / 2)
    scrollRef.current.scrollLeft = Math.max(0, centerX)
  }, [])

  // ── Scroll vertical al "ahora" ────────────────────────────────────────────
  const gridRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!gridRef.current) return
    const now = new Date()
    const top = topPx(now) - 100
    gridRef.current.scrollTop = Math.max(0, top)
  }, [])

  // ── Tareas para el sidebar ────────────────────────────────────────────────
  const tasks = useCallback(() => {
    const allNodes = s.allActive()
    const now = new Date(); now.setHours(0,0,0,0)
    const overdue: Node[] = []
    const today: Node[] = []
    const upcoming: Node[] = []
    const noDate: Node[] = []

    for (const n of allNodes) {
      if (n.status !== 'pending' || n.deletedAt) continue
      try {
        const ed = JSON.parse(n.extraData || '{}')
        if (ed._timeBlock === '1') continue
      } catch { /* ignore */ }

      if (!n.due) { noDate.push(n); continue }
      const due = new Date(n.due); due.setHours(0,0,0,0)
      if (due < now) overdue.push(n)
      else if (sameDay(due, now)) today.push(n)
      else upcoming.push(n)
    }
    return { overdue, today, upcoming, noDate }
  }, [s])()

  // ── Render de un bloque ───────────────────────────────────────────────────
  function renderBlock(block: TBlock) {
    const h = heightPx(block.start.getTime(), block.end.getTime())
    const canDrag = block.kind !== 'gcal'

    return (
      <div
        key={block.id}
        data-block-id={block.id}
        className={`dtl-block dtl-block--${block.kind}`}
        style={{
          top:    topPx(block.start),
          height: h,
          background: block.color,
        }}
        draggable={canDrag}
        onDragStart={e => handleBlockDragStart(e, block)}
        onClick={e => {
          e.stopPropagation()
          if (block.kind === 'gcal' && block.gcalEvent) setEditingGcal(block.gcalEvent)
          else if (block.kind === 'task' && block.linkedId) navigate(`/node/${block.linkedId}`)
        }}
        onContextMenu={e => handleBlockRightClick(e, block)}
        title={`${block.text}\n${formatHH(block.start)} – ${formatHH(block.end)}`}
      >
        <div className="dtl-block-time">{formatHH(block.start)}</div>
        <div className="dtl-block-text">{block.text || 'Sin título'}</div>
        {canDrag && (
          <div className="dtl-block-resize" onMouseDown={e => handleResizeStart(e, block.id)} />
        )}
      </div>
    )
  }

  // ── Render de una columna de día ──────────────────────────────────────────
  function renderDayCol(day: Date, idx: number) {
    const isCenter = sameDay(day, baseDate)
    const isToday  = sameDay(day, new Date())
    const blocks   = getTimeBlocks(day)
    const nowMins  = new Date().getHours() * 60 + new Date().getMinutes()
    const nowTop   = (nowMins - HOUR_START * 60) * PX_PER_MIN

    return (
      <div key={day.toISOString()} style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, width: COL_W }}>
        {/* Encabezado del día */}
        <div className={`dtl-day-head ${isCenter ? 'dtl-day-head--center' : ''} ${isToday ? 'dtl-day-head--today' : ''}`}>
          {dayHeader(day, isCenter)}
        </div>
        {/* Columna con slots */}
        <div
          className="dtl-col"
          style={{ height: TOTAL_HOURS * HOUR_H, position: 'relative' }}
          onDragOver={e => e.preventDefault()}
          onDrop={e => handleColDrop(e, day, e.currentTarget)}
          onClick={e => handleSlotClick(e, day, e.currentTarget)}
        >
          {/* Slots de fondo */}
          {Array.from({ length: TOTAL_HOURS * 2 }, (_, i) => (
            <div key={i} className={`dtl-slot ${i%2===0?'dtl-slot--hr':'dtl-slot--half'}`} style={{ top: i*SLOT_H }} />
          ))}
          {/* Línea de ahora */}
          {isToday && nowTop >= 0 && nowTop < TOTAL_HOURS * HOUR_H && (
            <div className="dtl-now" style={{ top: nowTop }} />
          )}
          {/* Bloques */}
          {blocks.map(renderBlock)}
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="dtl-root">

      {/* Sidebar de tareas */}
      <div className="dtl-sidebar">
        <div className="dtl-sidebar-title">Tareas</div>

        {tasks.overdue.length > 0 && (
          <div className="dtl-task-group">
            <div className="dtl-task-group-label dtl-task-group-label--od">⚠ Vencidas ({tasks.overdue.length})</div>
            {tasks.overdue.map(t => (
              <div key={t.id} className="dtl-task-item dtl-task-item--od"
                draggable onDragStart={e => handleTaskDragStart(e, t)} onDragEnd={handleTaskDragEnd}>
                <span className="dtl-task-dot" />
                <span className="dtl-task-text">{t.text || 'Sin título'}</span>
              </div>
            ))}
          </div>
        )}

        {tasks.today.length > 0 && (
          <div className="dtl-task-group">
            <div className="dtl-task-group-label">Hoy</div>
            {tasks.today.map(t => (
              <div key={t.id} className="dtl-task-item"
                draggable onDragStart={e => handleTaskDragStart(e, t)} onDragEnd={handleTaskDragEnd}>
                <span className="dtl-task-dot" />
                <span className="dtl-task-text">{t.text || 'Sin título'}</span>
              </div>
            ))}
          </div>
        )}

        {tasks.upcoming.length > 0 && (
          <div className="dtl-task-group">
            <div className="dtl-task-group-label">Próximas</div>
            {tasks.upcoming.slice(0, 10).map(t => (
              <div key={t.id} className="dtl-task-item"
                draggable onDragStart={e => handleTaskDragStart(e, t)} onDragEnd={handleTaskDragEnd}>
                <span className="dtl-task-dot" style={{ background: 'var(--text-tertiary)' }} />
                <span className="dtl-task-text">{t.text || 'Sin título'}</span>
              </div>
            ))}
          </div>
        )}

        {tasks.noDate.length > 0 && (
          <div className="dtl-task-group">
            <div className="dtl-task-group-label">Sin fecha</div>
            {tasks.noDate.slice(0, 10).map(t => (
              <div key={t.id} className="dtl-task-item"
                draggable onDragStart={e => handleTaskDragStart(e, t)} onDragEnd={handleTaskDragEnd}>
                <span className="dtl-task-dot" style={{ background: 'var(--border)' }} />
                <span className="dtl-task-text">{t.text || 'Sin título'}</span>
              </div>
            ))}
          </div>
        )}

        {tasks.overdue.length + tasks.today.length + tasks.upcoming.length + tasks.noDate.length === 0 && (
          <div className="dtl-empty">Sin tareas pendientes</div>
        )}
      </div>

      {/* Grid horizontal scrollable */}
      <div className="dtl-grid-wrapper" ref={gridRef}>
        {/* Encabezados sticky */}
        <div className="dtl-heads-row">
          <div style={{ width: AXIS_W, flexShrink: 0 }} />
          {days.map(d => {
            const isCenter = sameDay(d, baseDate)
            const isToday  = sameDay(d, new Date())
            return (
              <div key={d.toISOString()}
                className={`dtl-day-head ${isCenter?'dtl-day-head--center':''} ${isToday?'dtl-day-head--today':''}`}
                style={{ width: COL_W, flexShrink: 0 }}>
                {dayHeader(d, isCenter)}
              </div>
            )
          })}
        </div>

        {/* Scroll horizontal */}
        <div className="dtl-scroll-h" ref={scrollRef}>
          {/* Eje de horas */}
          <div className="dtl-axis" style={{ width: AXIS_W, height: TOTAL_HOURS * HOUR_H }}>
            {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => (
              <div key={i} className="dtl-axis-label" style={{ top: i * HOUR_H - 8 }}>
                {String(HOUR_START + i).padStart(2,'0')}:00
              </div>
            ))}
          </div>
          {/* Columnas */}
          <div style={{ display: 'flex' }}>
            {days.map((d, i) => renderDayCol(d, i))}
          </div>
        </div>
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={closeCtx} />
          <div className="dtl-ctx" style={{ left: ctxMenu.x, top: ctxMenu.y }}>
            {ctxMenu.block.kind === 'gcal' && (
              <button onClick={() => createNodeFromGcal(ctxMenu.block)}>
                📄 Crear nodo asociado
              </button>
            )}
            {ctxMenu.block.kind === 'task' && ctxMenu.block.linkedId && (
              <button onClick={() => { navigate(`/node/${ctxMenu.block.linkedId!}`); closeCtx() }}>
                → Ir a la tarea
              </button>
            )}
            {ctxMenu.block.kind === 'standalone' && (
              <button onClick={() => convertToTask(ctxMenu.block)}>
                ✓ Convertir a tarea
              </button>
            )}
            {ctxMenu.block.kind !== 'gcal' && (
              <button className="dtl-ctx-danger" onClick={() => deleteBlock(ctxMenu.block)}>
                Eliminar time block
              </button>
            )}
          </div>
        </>
      )}

      {/* Editor de evento GCal */}
      {editingGcal && (
        <GCalEventEditor
          event={editingGcal}
          modal
          onClose={() => setEditingGcal(null)}
          onUpdated={ev => { setGcalEvents(prev => prev.map(x => x.id === ev.id ? ev : x)); setEditingGcal(null) }}
          onDeleted={id => { setGcalEvents(prev => prev.filter(x => x.id !== id)); setEditingGcal(null) }}
        />
      )}
    </div>
  )
}
