import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'
import { getCalendarEvents, updateCalendarEvent, deleteCalendarEvent, createCalendarEvent, type CalendarEvent } from '../../api/googleCalendar'
import { isoToLocalDate, isoToLocalTime } from '../../utils/dates'

type DiaryPanelTab = 'agenda' | 'timeline'

function hasSeguimientoAncestor(nodeId: string): string | null {
  let current = store.getNode(nodeId)
  while (current?.parentId) {
    const parent = store.getNode(current.parentId)
    if (!parent) break
    if (parent.isSeguimiento || (parent.types || []).includes('bucle')) return parent.id
    current = parent
  }
  return null
}

function formatDue(due: string): string {
  const d = new Date(due)
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  if (d >= todayStart && d <= todayEnd) {
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

function calculateStreak(s: ReturnType<typeof useStore>): number {
  const diaries = s.allActive()
    .filter(n => n.isDiaryEntry && !n.deletedAt && n.diaryDate)
    .sort((a, b) => (b.diaryDate ?? '').localeCompare(a.diaryDate ?? ''))

  if (diaries.length === 0) return 0
  let streak = 1
  let lastDate = new Date(diaries[0].diaryDate!)

  for (let i = 1; i < diaries.length; i++) {
    const d = new Date(diaries[i].diaryDate!)
    const diff = Math.round((lastDate.getTime() - d.getTime()) / 86400000)
    if (diff === 1) { streak++; lastDate = d }
    else break
  }
  return streak
}

// ── Task properties popover ────────────────────────────────────────────────────

interface TaskPropsPopoverProps {
  node: Node
  onClose: () => void
  anchorRef: React.RefObject<HTMLButtonElement>
}

function TaskPropsPopover({ node, onClose, anchorRef }: TaskPropsPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    // Posicionar via portal relativo al botón ancla
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect()
      setPos({
        top: rect.bottom + 6,
        left: Math.max(8, Math.min(rect.right - 280, window.innerWidth - 292)),
      })
    }
    function handler(e: MouseEvent) {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as globalThis.Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as globalThis.Node)
      ) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose, anchorRef])

  const dueDate = isoToLocalDate(node.due)
  const dueTime = isoToLocalTime(node.due)

  function setDue(date: string, time: string) {
    if (!date) { store.updateNode(node.id, { due: null }); return }
    store.updateNode(node.id, { due: new Date(`${date}T${time || '09:00'}:00`).toISOString() })
  }

  // Recurrencia helpers
  function parseRec(r: string) {
    const [unit, nStr] = r.split(':')
    return { n: parseInt(nStr || '1') || 1, unit }
  }
  function applyRec(n: number, unit: string) {
    const safe = Math.max(1, n)
    store.updateNode(node.id, { recurrence: safe === 1 ? unit : `${unit}:${safe}` })
  }
  const recUnits: [string, string][] = [['daily', 'días'], ['weekly', 'sem.'], ['monthly', 'mes.'], ['yearly', 'año']]

  const qNextMondayDays = (() => { const d = new Date().getDay(); return d === 1 ? 7 : (8 - d) % 7 || 7 })()

  const priorityOpts: { v: Node['priority']; l: string; c: string }[] = [
    { v: null,     l: '–',    c: '' },
    { v: 'low',    l: 'Baja',  c: '#6b7280' },
    { v: 'medium', l: 'Media', c: '#f59e0b' },
    { v: 'high',   l: 'Alta',  c: '#ef4444' },
  ]

  if (!pos) return null

  return createPortal(
    <div
      ref={popoverRef}
      className="task-props-popup"
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 500 }}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      {/* Título */}
      <div className="tpp-title">{node.text || 'Sin título'}</div>

      {/* Fechas rápidas */}
      <div className="tpp-section-label">Fecha</div>
      <div className="nqp-quick-row">
        {[
          { label: 'Hoy', days: 0 },
          { label: 'Mañana', days: 1 },
          { label: 'Lunes', days: qNextMondayDays },
          { label: '+7d', days: 7 },
        ].map(({ label, days }) => {
          const d = new Date(); d.setDate(d.getDate() + days); d.setHours(9, 0, 0, 0)
          const iso = d.toISOString().slice(0, 10)
          return (
            <button key={label} className={`nqp-qbtn${dueDate === iso ? ' active' : ''}`}
              onClick={() => setDue(iso, dueTime || '09:00')}>{label}</button>
          )
        })}
        {node.due && <button className="nqp-qbtn nqp-clear" onClick={() => store.updateNode(node.id, { due: null })}>✕</button>}
      </div>

      {/* Fecha + hora */}
      <div className="nqp-inputs-row">
        <input type="date" className="nqp-date-input" value={dueDate}
          onChange={e => setDue(e.target.value, dueTime)} />
        <input type="time" className="nqp-time-input" value={dueTime}
          onChange={e => setDue(dueDate, e.target.value)} disabled={!dueDate} />
      </div>

      {/* Prioridad */}
      <div className="tpp-section-label">Prioridad</div>
      <div className="nqp-chips-row">
        {priorityOpts.map(opt => (
          <button key={String(opt.v)}
            className={`nqp-chip${node.priority === opt.v ? ' active' : ''}`}
            style={opt.c ? { color: opt.c, ...(node.priority === opt.v ? { borderColor: opt.c, background: opt.c + '20' } : {}) } : {}}
            onClick={() => store.updateNode(node.id, { priority: opt.v })}
          >{opt.l}</button>
        ))}
      </div>

      {/* Repetición */}
      <div className="tpp-section-label">Repetición</div>
      <div className="nqp-rec-row">
        <button className={`nqp-chip${!node.recurrence ? ' active' : ''}`}
          onClick={() => store.updateNode(node.id, { recurrence: null })}>–</button>
        <input type="number" className="nqp-rec-n" min={1} max={999}
          value={node.recurrence ? parseRec(node.recurrence).n : 1}
          disabled={!node.recurrence}
          onClick={e => e.stopPropagation()}
          onChange={e => {
            const n = Math.max(1, parseInt(e.target.value) || 1)
            const unit = node.recurrence ? parseRec(node.recurrence).unit : 'daily'
            applyRec(n, unit)
          }}
        />
        {recUnits.map(([unit, label]) => (
          <button key={unit}
            className={`nqp-chip${!!node.recurrence && parseRec(node.recurrence).unit === unit ? ' active' : ''}`}
            onClick={() => applyRec(node.recurrence ? parseRec(node.recurrence).n : 1, unit)}
          >{label}</button>
        ))}
      </div>

      {/* Estado */}
      <div className="tpp-section-label">Estado</div>
      <div className="nqp-chips-row">
        {([
          { v: 'pending' as const, l: '○ Pendiente' },
          { v: 'done'    as const, l: '✓ Hecha' },
          { v: 'future'  as const, l: '◆ Futura' },
          { v: null,               l: '– Sin estado' },
        ] as { v: Node['status']; l: string }[]).map(opt => (
          <button key={String(opt.v)}
            className={`nqp-chip${node.status === opt.v ? ' active' : ''}`}
            onClick={() => { store.updateNode(node.id, { status: opt.v }); if (opt.v !== null) onClose() }}
          >{opt.l}</button>
        ))}
      </div>

    </div>,
    document.body
  )
}

// ── GCal event editor popup ────────────────────────────────────────────────────

interface GCalEventEditorProps {
  event: CalendarEvent
  onClose: () => void
  onUpdated: (updated: CalendarEvent) => void
  onDeleted: (id: string) => void
}

function GCalEventEditor({ event, onClose, onUpdated, onDeleted }: GCalEventEditorProps) {
  const [title, setTitle] = useState(event.title)
  const [startDate, setStartDate] = useState(event.start ? event.start.slice(0, 10) : '')
  const [startTime, setStartTime] = useState(event.start ? event.start.slice(11, 16) : '')
  const [endDate, setEndDate] = useState(event.end ? event.end.slice(0, 10) : '')
  const [endTime, setEndTime] = useState(event.end ? event.end.slice(11, 16) : '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as globalThis.Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  async function save() {
    if (!startDate) return
    setSaving(true); setMsg(null)
    try {
      const start = startTime ? `${startDate}T${startTime}:00` : `${startDate}T00:00:00`
      const end = endDate
        ? (endTime ? `${endDate}T${endTime}:00` : `${endDate}T23:59:00`)
        : new Date(new Date(start).getTime() + 3600000).toISOString().slice(0, 19)
      const updated = await updateCalendarEvent(event.id, {
        title, start: new Date(start).toISOString(), end: new Date(end).toISOString()
      })
      onUpdated(updated)
      setMsg('✓ Guardado')
      setTimeout(onClose, 800)
    } catch { setMsg('Error al guardar') }
    finally { setSaving(false) }
  }

  async function remove() {
    if (!window.confirm(`¿Eliminar "${event.title}" de Google Calendar?`)) return
    setSaving(true)
    try {
      await deleteCalendarEvent(event.id)
      onDeleted(event.id)
    } catch { setMsg('Error al eliminar') }
    finally { setSaving(false) }
  }

  return (
    <div ref={ref} className="gcal-editor-popup" onClick={e => e.stopPropagation()}>
      <div className="gcal-editor-title">📅 Editar evento GCal</div>
      <input className="gcal-editor-name" value={title} onChange={e => setTitle(e.target.value)}
        placeholder="Título del evento"
        onKeyDown={e => { if (e.key === 'Enter') save() }}
      />
      <div className="gcal-editor-row">
        <span className="gcal-editor-label">Inicio</span>
        <input type="date" className="nqp-date-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
        <input type="time" className="nqp-time-input" value={startTime} onChange={e => setStartTime(e.target.value)} disabled={!startDate} />
      </div>
      <div className="gcal-editor-row">
        <span className="gcal-editor-label">Fin</span>
        <input type="date" className="nqp-date-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
        <input type="time" className="nqp-time-input" value={endTime} onChange={e => setEndTime(e.target.value)} disabled={!endDate} />
      </div>
      {msg && <div className={`gcal-editor-msg${msg.startsWith('✓') ? ' ok' : ''}`}>{msg}</div>}
      <div className="gcal-editor-actions">
        <button className="gcal-editor-delete" onClick={remove} disabled={saving}>🗑</button>
        <button className="gcal-editor-cancel" onClick={onClose}>Cancelar</button>
        <button className="gcal-editor-save" onClick={save} disabled={saving || !title || !startDate}>
          {saving ? '↻' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}

// ── Drag state para el panel agenda ───────────────────────────────────────────
let _agendaDragId: string | null = null

// ── Task row with hover props button ──────────────────────────────────────────

interface AgendaTaskRowProps {
  task: Node
  checkboxClass: string
  indented?: boolean
  isEvent?: boolean
  onToggle: () => void
  onClick: () => void
  onDropBefore?: (draggedId: string) => void  // soltar antes de esta fila
  onDropAsChild?: (draggedId: string) => void // soltar como hijo (solo seguimiento)
}

function AgendaTaskRow({ task, checkboxClass, indented, isEvent, onToggle, onClick, onDropBefore, onDropAsChild }: AgendaTaskRowProps) {
  const [hovered, setHovered] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null!)

  const rowClass = [
    'diary-agenda-task',
    indented ? 'diary-agenda-task--indented' : '',
    task.status === 'done' ? 'diary-agenda-task--done' : '',
    isDragOver ? 'diary-agenda-task--drop' : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      className={rowClass}
      style={{ position: 'relative', userSelect: 'none' }}
      draggable
      onDragStart={e => {
        _agendaDragId = task.id
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', task.id)
      }}
      onDragEnd={() => { _agendaDragId = null; setIsDragOver(false) }}
      onDragOver={e => {
        if (_agendaDragId && _agendaDragId !== task.id) {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          setIsDragOver(true)
        }
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={e => {
        e.preventDefault()
        setIsDragOver(false)
        const id = _agendaDragId
        _agendaDragId = null
        if (!id || id === task.id) return
        // Siempre hacer hijo: drop sobre cualquier nodo lo indenta bajo él
        if (onDropAsChild) {
          onDropAsChild(id)
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setIsDragOver(false) }}
      onClick={onClick}
    >
      {isEvent ? (
        <span className="diary-agenda-event-icon">📅</span>
      ) : (
        <button
          className={checkboxClass}
          onClick={e => { e.stopPropagation(); onToggle() }}
        >
          {task.status === 'done' ? '✓' : ''}
        </button>
      )}

      <span className={`diary-agenda-text${task.status === 'done' ? ' done' : ''}`}>
        {task.text || 'Sin título'}
      </span>

      {task.due && <span className="diary-agenda-due">{formatDue(task.due)}</span>}

      {/* Hover props button */}
      {(hovered || popoverOpen) && (
        <div style={{ position: 'relative', marginLeft: 'auto', flexShrink: 0 }}>
          <button
            ref={btnRef}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              fontSize: 14,
              padding: '0 4px',
              lineHeight: 1,
              borderRadius: 4,
            }}
            onClick={e => { e.stopPropagation(); setPopoverOpen(v => !v) }}
            title="Propiedades de la tarea"
          >
            ···
          </button>
          {popoverOpen && (
            <TaskPropsPopover
              node={task}
              onClose={() => setPopoverOpen(false)}
              anchorRef={btnRef}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ── Sort helper (Mac-style: overdue → today/range → no due) ──────────────────

function sortTasksMacStyle(tasks: Node[], todayStart: Date): Node[] {
  return [...tasks].sort((a, b) => {
    const groupOf = (n: Node) => {
      if (!n.due) return 2
      return new Date(n.due) < todayStart ? 0 : 1
    }
    const ga = groupOf(a)
    const gb = groupOf(b)
    if (ga !== gb) return ga - gb
    if (a.due && b.due) return new Date(a.due).getTime() - new Date(b.due).getTime()
    if (a.due && !b.due) return -1
    if (!a.due && b.due) return 1
    return 0
  })
}

export interface DiaryRightPanelProps {
  diaryDate: Date
  rangeType?: 'day' | 'week' | 'month'
}

export default function DiaryRightPanel({ diaryDate, rangeType = 'day' }: DiaryRightPanelProps) {
  const s = useStore()
  const navigate = useNavigate()
  const [panelTab, setPanelTab] = useState<DiaryPanelTab>('agenda')
  const [googleEvents, setGoogleEvents] = useState<CalendarEvent[]>([])
  const [editingGCalEvent, setEditingGCalEvent] = useState<CalendarEvent | null>(null)
  const [dragOverSegId, setDragOverSegId] = useState<string | null>(null)

  // Fetch Google Calendar events when date changes (day view only)
  useEffect(() => {
    if (rangeType !== 'day') return
    let cancelled = false
    getCalendarEvents(diaryDate)
      .then(events => {
        if (!cancelled) setGoogleEvents(events)
      })
      .catch(() => {
        // NOT_CONNECTED or any error: show empty, no noise
        if (!cancelled) setGoogleEvents([])
      })
    return () => { cancelled = true }
  }, [diaryDate, rangeType])

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

  // Determine if diaryDate is today
  const isToday = rangeType === 'day' && diaryDate.toDateString() === now.toDateString()

  // Compute range boundaries based on rangeType
  const { dateStart, dateEnd } = (() => {
    if (rangeType === 'week') {
      // ISO week: Mon–Sun
      const d = new Date(diaryDate)
      const dow = (d.getDay() + 6) % 7 // Mon=0
      const start = new Date(d); start.setDate(d.getDate() - dow); start.setHours(0, 0, 0, 0)
      const end = new Date(start); end.setDate(start.getDate() + 7)
      return { dateStart: start, dateEnd: end }
    }
    if (rangeType === 'month') {
      const start = new Date(diaryDate.getFullYear(), diaryDate.getMonth(), 1)
      const end = new Date(diaryDate.getFullYear(), diaryDate.getMonth() + 1, 1)
      return { dateStart: start, dateEnd: end }
    }
    // day (default)
    const start = new Date(diaryDate.getFullYear(), diaryDate.getMonth(), diaryDate.getDate())
    return { dateStart: start, dateEnd: new Date(start.getTime() + 86400000) }
  })()

  function toggleTask(id: string, currentStatus: string | null) {
    const newStatus = currentStatus === 'done' ? 'pending' : 'done'
    store.updateNode(id, { status: newStatus })
  }

  // ── Agenda logic ───────────────────────────────────────────────────────

  // Nodos de seguimiento — ordenados igual que Mac: seguimientoOrder primero, luego updatedAt desc
  const seguimientoNodes = s.allActive()
    .filter(n => !n.deletedAt && (n.isSeguimiento || (n.types || []).includes('bucle')))
    .sort((a, b) => {
      const ao = (a as any).seguimientoOrder ?? null
      const bo = (b as any).seguimientoOrder ?? null
      if (ao !== null && bo !== null) return ao - bo
      if (ao !== null) return -1
      if (bo !== null) return 1
      return b.updatedAt.localeCompare(a.updatedAt)
    })

  const allPending = s.allActive().filter(
    n => n.status === 'pending' && !n.deletedAt && n.due
  )

  // Set de IDs de nodos que SON seguimiento (para excluirlos de overdue/today)
  const seguimientoIds = new Set(seguimientoNodes.map(n => n.id))

  const overdueRaw = allPending.filter(n => {
    if (!n.due) return false
    if (seguimientoIds.has(n.id)) return false        // el nodo MISMO es seguimiento
    if (hasSeguimientoAncestor(n.id)) return false    // es hijo de seguimiento
    return new Date(n.due) < todayStart
  })

  // Para semana/mes: mostrar tareas del rango en lugar de solo hoy
  const todayTasksRaw = allPending.filter(n => {
    if (!n.due) return false
    if (seguimientoIds.has(n.id)) return false
    if (hasSeguimientoAncestor(n.id)) return false
    const d = new Date(n.due)
    if (rangeType === 'week' || rangeType === 'month') {
      return d >= dateStart && d < dateEnd
    }
    return d >= todayStart && d <= todayEnd
  })

  // Apply Mac-style sort to overdue and today tasks combined (then split back)
  // For the agenda view: show overdue first (sorted by due asc), then today tasks (sorted by due asc)
  const overdue = [...overdueRaw].sort((a, b) => {
    if (a.due && b.due) return new Date(a.due).getTime() - new Date(b.due).getTime()
    return 0
  })

  const todayTasks = [...todayTasksRaw].sort((a, b) => {
    if (a.due && b.due) return new Date(a.due).getTime() - new Date(b.due).getTime()
    if (a.due && !b.due) return -1
    if (!a.due && b.due) return 1
    return 0
  })

  // Hijos de un nodo de seguimiento: tareas (pending + done) y eventos — igual que Mac
  function getChildTasks(nodeId: string): Node[] {
    return store.children(nodeId)
      .filter(n => !n.deletedAt && (n.status !== null || n.isEvent))
      .sort((a, b) => {
        // Pendientes primero, luego completadas
        if (a.status !== 'done' && b.status === 'done') return -1
        if (a.status === 'done' && b.status !== 'done') return 1
        // Por fecha si tienen
        if (a.due && b.due) return new Date(a.due).getTime() - new Date(b.due).getTime()
        if (a.due && !b.due) return -1
        if (!a.due && b.due) return 1
        return a.siblingOrder - b.siblingOrder
      })
  }

  // Clase de checkbox para tareas hijo de seguimiento — COMO TAREA, no como seguimiento
  function childTaskCheckboxClass(task: Node): string {
    if (task.isEvent) return 'diary-agenda-checkbox'
    if (task.status === 'done') return 'diary-agenda-checkbox diary-agenda-checkbox--done'
    if (task.due) {
      const d = new Date(task.due)
      if (d < todayStart) return 'diary-agenda-checkbox diary-agenda-checkbox--overdue'  // naranja
      if (d <= todayEnd)  return 'diary-agenda-checkbox diary-agenda-checkbox--today'    // amarillo
    }
    // Sin fecha o futura → amarillo (pendiente)
    return 'diary-agenda-checkbox diary-agenda-checkbox--today'
  }


  // ── Helpers de drag para la Agenda ──────────────────────────────────────────

  /** Mover el nodo draggedId para que quede justo antes de targetId */
  function dropBefore(draggedId: string, targetId: string) {
    const target = store.getNode(targetId)
    if (!target) return
    const siblings = store.children(target.parentId).sort((a, b) => a.siblingOrder - b.siblingOrder)
    const targetIdx = siblings.findIndex(n => n.id === targetId)
    const before = targetIdx > 0 ? siblings[targetIdx - 1].siblingOrder : (siblings[targetIdx]?.siblingOrder ?? 0) - 1000
    const after  = siblings[targetIdx]?.siblingOrder ?? before + 2000
    store.updateNode(draggedId, { parentId: target.parentId, siblingOrder: (before + after) / 2 })
  }

  /** Mover el nodo draggedId como último hijo de parentId */
  function dropAsChild(draggedId: string, parentId: string) {
    const kids = store.children(parentId).sort((a, b) => a.siblingOrder - b.siblingOrder)
    const lastOrder = kids.length > 0 ? kids[kids.length - 1].siblingOrder : 0
    store.updateNode(draggedId, { parentId, siblingOrder: lastOrder + 1000 })
    if (store.getNode(parentId)?.isCollapsed) store.updateNode(parentId, { isCollapsed: false })
  }

  function renderAgenda() {
    const gcalToday = googleEvents.filter(ev => !ev.allDay)
    const hasAnything = seguimientoNodes.length > 0 || overdue.length > 0 || todayTasks.length > 0 || gcalToday.length > 0

    if (!hasAnything) {
      return (
        <div className="diary-panel-content">
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px 8px' }}>
            Nada pendiente hoy
          </div>
        </div>
      )
    }

    return (
      <div className="diary-panel-content">
        {/* Eventos de Google Calendar — editables desde aquí */}
        {gcalToday.length > 0 && (
          <div className="diary-agenda-gcal-section">
            <div className="diary-agenda-section-label">Google Calendar</div>
            {gcalToday.sort((a, b) => a.start.localeCompare(b.start)).map(ev => {
              const startStr = ev.start ? new Date(ev.start).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : ''
              const endStr = ev.end ? new Date(ev.end).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : ''
              return (
                <div key={ev.id} className="diary-agenda-gcal-row" style={{ position: 'relative' }}>
                  <span className="diary-agenda-gcal-dot" />
                  <span className="diary-agenda-gcal-title">{ev.title}</span>
                  <span className="diary-agenda-gcal-time">{startStr}{endStr ? `–${endStr}` : ''}</span>
                  <div className="diary-agenda-gcal-btns">
                    <button className="diary-agenda-gcal-btn" title="Editar"
                      onClick={e => { e.stopPropagation(); setEditingGCalEvent(ev) }}>✎</button>
                    <button className="diary-agenda-gcal-btn diary-agenda-gcal-btn--del" title="Eliminar"
                      onClick={async e => {
                        e.stopPropagation()
                        if (!window.confirm(`¿Eliminar "${ev.title}" de Google Calendar?`)) return
                        try {
                          await deleteCalendarEvent(ev.id)
                          setGoogleEvents(prev => prev.filter(x => x.id !== ev.id))
                        } catch { alert('Error al eliminar') }
                      }}>🗑</button>
                  </div>
                  {editingGCalEvent?.id === ev.id && (
                    <div style={{ position: 'absolute', right: 0, top: '100%', zIndex: 200 }}>
                      <GCalEventEditor
                        event={ev}
                        onClose={() => setEditingGCalEvent(null)}
                        onUpdated={updated => { setGoogleEvents(prev => prev.map(x => x.id === updated.id ? updated : x)); setEditingGCalEvent(null) }}
                        onDeleted={id => { setGoogleEvents(prev => prev.filter(x => x.id !== id)); setEditingGCalEvent(null) }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Nodos en seguimiento + sus tareas hijo */}
        {seguimientoNodes.map(node => {
          const childTasks = getChildTasks(node.id)
          return (
            <div key={node.id}>
              {/* Header seguimiento — también draggable y acepta drops */}
              <div
                className={`diary-agenda-seguimiento${dragOverSegId === node.id ? ' diary-agenda-seguimiento--drop' : ''}`}
                draggable
                style={{ userSelect: 'none' }}
                onDragStart={e => { _agendaDragId = node.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', node.id) }}
                onDragEnd={() => { _agendaDragId = null; setDragOverSegId(null) }}
                onDragOver={e => {
                  if (_agendaDragId && _agendaDragId !== node.id) {
                    e.preventDefault(); e.dataTransfer.dropEffect = 'move'
                    setDragOverSegId(node.id)
                  }
                }}
                onDragLeave={() => setDragOverSegId(null)}
                onDrop={e => {
                  e.preventDefault()
                  const id = _agendaDragId; _agendaDragId = null
                  setDragOverSegId(null)
                  if (id && id !== node.id) dropAsChild(id, node.id)
                }}
                onClick={() => navigate(`/node/${node.id}`)}
              >
                <span
                  className={`diary-agenda-checkbox diary-agenda-checkbox--seguimiento${node.status === 'done' ? ' diary-agenda-checkbox--done' : ''}`}
                  onClick={e => {
                    e.stopPropagation()
                    store.updateNode(node.id, { status: node.status === 'done' ? null : 'done' })
                  }}
                ></span>
                <span className={`diary-agenda-text${node.status === 'done' ? ' done' : ''}`}>{node.text || 'Sin título'}</span>
                {node.due && <span className="diary-agenda-due">{formatDue(node.due)}</span>}
              </div>
              {childTasks.map(task => (
                <AgendaTaskRow
                  key={task.id}
                  task={task}
                  checkboxClass={childTaskCheckboxClass(task)}
                  indented
                  isEvent={task.isEvent}
                  onToggle={() => toggleTask(task.id, task.status)}
                  onClick={() => navigate(`/node/${task.id}`)}
                  onDropBefore={draggedId => dropBefore(draggedId, task.id)}
                  onDropAsChild={draggedId => dropAsChild(draggedId, task.id)}
                />
              ))}
            </div>
          )
        })}

        {/* Tareas vencidas */}
        {overdue.map(task => (
          <AgendaTaskRow
            key={task.id}
            task={task}
            checkboxClass={`diary-agenda-checkbox diary-agenda-checkbox--${task.status === 'done' ? 'done' : 'overdue'}`}
            onToggle={() => toggleTask(task.id, task.status)}
            onClick={() => navigate(`/node/${task.id}`)}
            onDropBefore={draggedId => dropBefore(draggedId, task.id)}
            onDropAsChild={draggedId => dropAsChild(draggedId, task.id)}
          />
        ))}

        {/* Tareas de hoy */}
        {todayTasks.map(task => (
          <AgendaTaskRow
            key={task.id}
            task={task}
            checkboxClass={`diary-agenda-checkbox diary-agenda-checkbox--${task.status === 'done' ? 'done' : 'today'}`}
            onToggle={() => toggleTask(task.id, task.status)}
            onClick={() => navigate(`/node/${task.id}`)}
            onDropBefore={draggedId => dropBefore(draggedId, task.id)}
            onDropAsChild={draggedId => dropAsChild(draggedId, task.id)}
          />
        ))}
      </div>
    )
  }

  // ── Timeline logic ─────────────────────────────────────────────────────────
  const hours = Array.from({ length: 15 }, (_, i) => i + 8)
  const currentHour = now.getHours()
  const currentMinutes = now.getMinutes()

  const allDayTasks = s.allActive().filter(n => n.status !== null && !n.deletedAt && n.due)

  const tasksByHour: Record<number, Node[]> = {}
  for (const h of hours) {
    tasksByHour[h] = []
  }
  allDayTasks.forEach(n => {
    if (!n.due) return
    const d = new Date(n.due)
    if (d >= dateStart && d < dateEnd) {
      const h = d.getHours()
      if (h >= 8 && h <= 22) {
        tasksByHour[h] = tasksByHour[h] || []
        tasksByHour[h].push(n)
      }
    }
  })

  // ── Events for timeline ────────────────────────────────────────────────
  const allEvents = s.allActive().filter(n => n.isEvent && n.due && !n.deletedAt)
  const eventsByHour: Record<number, Node[]> = {}
  for (const h of hours) {
    eventsByHour[h] = []
  }
  allEvents.forEach(n => {
    if (!n.due) return
    const d = new Date(n.due)
    if (d >= dateStart && d < dateEnd) {
      const h = d.getHours()
      if (h >= 8 && h <= 22) {
        eventsByHour[h] = eventsByHour[h] || []
        eventsByHour[h].push(n)
      }
    }
  })

  // ── Google Calendar events for timeline ────────────────────────────────
  const googleEventsByHour: Record<number, CalendarEvent[]> = {}
  for (const h of hours) {
    googleEventsByHour[h] = []
  }
  googleEvents.forEach(ev => {
    if (ev.allDay) return // skip all-day events from hourly slots
    const d = new Date(ev.start)
    const h = d.getHours()
    if (h >= 8 && h <= 22) {
      googleEventsByHour[h] = googleEventsByHour[h] || []
      googleEventsByHour[h].push(ev)
    }
  })

  function handleTimelineHourClick(h: number) {
    const clickDate = new Date(diaryDate)
    clickDate.setHours(h, 0, 0, 0)
    const newNode = store.createNode({
      text: '',
      parentId: null,
      siblingOrder: Date.now(),
      isTask: true,
    })
    store.updateNode(newNode.id, {
      isEvent: true,
      status: 'pending',
      due: clickDate.toISOString(),
    })
    navigate(`/node/${newNode.id}`)
  }

  function renderTimeline() {
    return (
      <div className="timeline-panel-full">
        {hours.map(h => {
          const tasks = tasksByHour[h] || []
          const events = eventsByHour[h] || []
          const allItems = [...events, ...tasks]
          const showNowLine = isToday && h === currentHour

          const gcalItems = googleEventsByHour[h] || []

          return (
            <div key={h} className="timeline-hour-slot">
              {showNowLine && (
                <div
                  className="timeline-now-line"
                  style={{ top: `${(currentMinutes / 60) * 100}%` }}
                  title={`Ahora: ${String(currentHour).padStart(2, '0')}:${String(currentMinutes).padStart(2, '0')}`}
                >
                  <span className="timeline-now-dot" />
                  <span className="timeline-now-rule" />
                </div>
              )}
              <div className="timeline-row">
                <span className="timeline-hour-label">{String(h).padStart(2, '0')}:00</span>
                <div
                  className="timeline-hour-clickable"
                  onClick={() => handleTimelineHourClick(h)}
                  title={`Crear evento a las ${String(h).padStart(2, '0')}:00`}
                >
                  {allItems.map(t => (
                    <span
                      key={t.id}
                      className={t.isEvent ? 'timeline-event-chip' : 'timeline-task-chip'}
                      onClick={e => { e.stopPropagation(); navigate(`/node/${t.id}`) }}
                      title={t.text || 'Sin título'}
                    >
                      {t.isEvent ? '📅 ' : ''}{t.text || 'Sin título'}
                    </span>
                  ))}
                  {gcalItems.map(ev => {
                    const startTime = new Date(ev.start).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                    const endTime = new Date(ev.end).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                    return (
                      <span
                        key={ev.id}
                        className="timeline-event-chip timeline-event-chip--gcal"
                        title={`${ev.title} · ${startTime} – ${endTime} · Click para editar`}
                        onClick={e => { e.stopPropagation(); setEditingGCalEvent(ev) }}
                      >
                        📅 {ev.title} <span style={{ opacity: 0.7, fontSize: 10 }}>{startTime}–{endTime}</span>
                        {editingGCalEvent?.id === ev.id && (
                          <span
                            style={{ position: 'absolute', left: 0, top: '100%', zIndex: 300 }}
                            onClick={e => e.stopPropagation()}
                          >
                            <GCalEventEditor
                              event={ev}
                              onClose={() => setEditingGCalEvent(null)}
                              onUpdated={updated => { setGoogleEvents(prev => prev.map(x => x.id === updated.id ? updated : x)); setEditingGCalEvent(null) }}
                              onDeleted={id => { setGoogleEvents(prev => prev.filter(x => x.id !== id)); setEditingGCalEvent(null) }}
                            />
                          </span>
                        )}
                      </span>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // renderStats() movida a Ajustes (pendiente)
  function _renderStats_REMOVED() {
    const allNodes = s.allActive()

    // Weekly bar chart
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - 6 + i)
      d.setHours(0, 0, 0, 0)
      return d
    })
    const weekCounts = weekDays.map(day => {
      const end = new Date(day.getTime() + 86400000)
      return allNodes.filter(n => {
        if (n.isDiaryEntry || n.deletedAt) return false
        const updated = new Date(n.updatedAt)
        return updated >= day && updated < end
      }).length
    })
    const maxCount = Math.max(...weekCounts, 1)
    const barHeight = 40
    const barWidth = 24
    const gap = 4

    // Global counters
    const totalNotes = allNodes.filter(n => !n.isDiaryEntry && n.status === null).length
    const totalTasks = allNodes.filter(n => n.status !== null).length
    const doneTasks = allNodes.filter(n => n.status === 'done').length
    const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

    // Top 5 tags
    const topTags = s.allUsedTags()
      .map(t => ({ tag: t, count: s.tagNodeCount(t) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
    const maxTagCount = topTags.length > 0 ? topTags[0].count : 1

    // Streak
    const currentStreak = calculateStreak(s)

    // Diary for diaryDate (used for bullet count)
    const diaryNode = s.allActive().find(n => {
      if (!n.isDiaryEntry || n.deletedAt || !n.diaryDate) return false
      const d = new Date(n.diaryDate)
      return d >= dateStart && d < dateEnd
    }) ?? null

    return (
      <div className="diary-panel-content">
        {/* Weekly bar chart */}
        <div className="stats-section-label">Últimos 7 días</div>
        <div className="stats-week-chart">
          <svg width={(barWidth + gap) * 7 - gap} height={barHeight + 20}>
            {weekDays.map((day, i) => {
              const h = Math.max(2, (weekCounts[i] / maxCount) * barHeight)
              const isTodayBar = i === 6
              return (
                <g key={i}>
                  <rect
                    x={i * (barWidth + gap)}
                    y={barHeight - h}
                    width={barWidth}
                    height={h}
                    rx={3}
                    fill={isTodayBar ? 'var(--accent)' : weekCounts[i] > 0 ? 'var(--accent-soft, #c4b5fd)' : 'var(--bg-tertiary)'}
                  />
                  <text
                    x={i * (barWidth + gap) + barWidth / 2}
                    y={barHeight + 14}
                    textAnchor="middle"
                    fontSize={10}
                    fill={isTodayBar ? 'var(--text-accent, var(--accent))' : 'var(--text-tertiary)'}
                  >
                    {day.toLocaleDateString('es-ES', { weekday: 'narrow' })}
                  </text>
                </g>
              )
            })}
          </svg>
          <div className="stats-week-label">
            {weekCounts.reduce((a, b) => a + b, 0)} actividades esta semana
          </div>
        </div>

        {/* Global counters */}
        <div className="stats-section-label" style={{ marginTop: 12 }}>Global</div>
        <div className="stats-counters">
          <div className="stats-counter">
            <div className="stats-counter-value">{totalNotes}</div>
            <div className="stats-counter-label">Notas</div>
          </div>
          <div className="stats-counter">
            <div className="stats-counter-value">{totalTasks}</div>
            <div className="stats-counter-label">Tareas</div>
          </div>
          <div className="stats-counter">
            <div className="stats-counter-value">{doneTasks}</div>
            <div className="stats-counter-label">Completadas</div>
          </div>
          <div className="stats-counter">
            <div className="stats-counter-value">{completionRate}%</div>
            <div className="stats-counter-label">Tasa completado</div>
          </div>
        </div>

        {/* Streak */}
        {currentStreak >= 1 && (
          <>
            <div className="stats-section-label" style={{ marginTop: 12 }}>Racha</div>
            <div className="stats-counter" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <div className="stats-counter-value" style={{ fontSize: 28 }}>🔥</div>
              <div>
                <div className="stats-counter-value">{currentStreak} {currentStreak === 1 ? 'día' : 'días'}</div>
                <div className="stats-counter-label">Racha actual de diario</div>
              </div>
            </div>
          </>
        )}

        {/* Productividad del día — solo hoy */}
        {isToday && (
          <>
            <div className="stats-section-label" style={{ marginTop: 12 }}>Productividad del día</div>
            <div className="stats-counters">
              <div className="stats-counter">
                <div className="stats-counter-value">{diaryNode ? store.children(diaryNode.id).length : 0}</div>
                <div className="stats-counter-label">Bullets hoy</div>
              </div>
              <div className="stats-counter">
                <div className="stats-counter-value" style={{ color: '#22c55e' }}>
                  {allNodes.filter(n => {
                    if (n.status !== 'done') return false
                    const d = new Date(n.updatedAt)
                    return d >= todayStart && d <= todayEnd
                  }).length}
                </div>
                <div className="stats-counter-label">Tareas completadas hoy</div>
              </div>
            </div>
          </>
        )}

        {/* Hábitos — grid últimas 4 semanas */}
        <>
          <div className="stats-section-label" style={{ marginTop: 12 }}>Hábitos — últimas 4 semanas</div>
          {(() => {
            const lastMonth = Array.from({ length: 28 }, (_, i) => {
              const d = new Date()
              d.setDate(d.getDate() - 27 + i)
              d.setHours(0, 0, 0, 0)
              return d
            })
            const diaryDays = new Set(
              s.allActive()
                .filter(n => n.isDiaryEntry && n.diaryDate)
                .map(n => new Date(n.diaryDate!).toDateString())
            )
            return (
              <div className="stats-habit-grid">
                {lastMonth.map((day, i) => (
                  <div
                    key={i}
                    className={`habit-dot${diaryDays.has(day.toDateString()) ? ' habit-dot--active' : ''}${day.toDateString() === new Date().toDateString() ? ' habit-dot--today' : ''}`}
                    title={day.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                  />
                ))}
              </div>
            )
          })()}
        </>

        {/* Top tags */}
        {topTags.length > 0 && (
          <>
            <div className="stats-section-label" style={{ marginTop: 12 }}>Tags más usados</div>
            <div className="stats-tags-list">
              {topTags.map(({ tag, count }) => (
                <div key={tag} className="stats-tag-row">
                  <span className="stats-tag-name" style={{ color: store.tagColor(tag) }}>#{tag}</span>
                  <div
                    className="stats-tag-bar"
                    style={{
                      flex: 1,
                      background: 'var(--bg-tertiary)',
                      marginLeft: 6,
                      marginRight: 6,
                    }}
                  >
                    <div
                      className="stats-tag-bar"
                      style={{
                        width: `${(count / maxTagCount) * 100}%`,
                        background: store.tagColor(tag) || 'var(--accent)',
                      }}
                    />
                  </div>
                  <span className="stats-tag-count">{count}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  // Para notas de semana/mes: solo Agenda (sin Timeline)
  const agendaLabel = rangeType === 'week' ? 'Semana' : rangeType === 'month' ? 'Mes' : 'Agenda'
  const showTimeline = rangeType === 'day'

  return (
    <div className="diary-right-panel">
      <div className="diary-panel-tabs">
        <button
          className={`diary-panel-tab${panelTab === 'agenda' ? ' active' : ''}`}
          onClick={() => setPanelTab('agenda')}
        >
          {agendaLabel}
        </button>
        {showTimeline && (
          <button
            className={`diary-panel-tab${panelTab === 'timeline' ? ' active' : ''}`}
            onClick={() => setPanelTab('timeline')}
          >
            Timeline
          </button>
        )}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        {(!showTimeline || panelTab === 'agenda') ? renderAgenda() : renderTimeline()}
      </div>
    </div>
  )
}
