import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'
import { renderInline } from '../outliner/InlineRenderer'
import { getCalendarEvents, updateCalendarEvent, deleteCalendarEvent, createCalendarEvent, type CalendarEvent } from '../../api/googleCalendar'
import { useUserStore } from '../../store/userStore'
import { isoToLocalDate, isoToLocalTime, hasLocalTime, makeDueISO } from '../../utils/dates'

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
    // Todo el día (medianoche local) → "Hoy", con hora → mostrar hora
    if (d.getHours() === 0 && d.getMinutes() === 0) return 'Hoy'
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

export interface TaskPropsPopoverProps {
  node: Node
  onClose: () => void
  anchorRef?: React.RefObject<HTMLButtonElement | HTMLElement>  // legacy — no usado en modo modal
  allowRename?: boolean
  allowDelete?: boolean
  onDeleted?: () => void
}

export function TaskPropsPopover({ node, onClose, allowRename, allowDelete, onDeleted }: TaskPropsPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const popNavigate = useNavigate()

  // Bucles no son agendables: si por error se intenta abrir un bucle, cerrar
  // inmediatamente y navegar a su nota (es un contenedor, no una tarea).
  const isBucle = node.isSeguimiento || (node.types || []).includes('bucle')
  useEffect(() => {
    if (isBucle) {
      popNavigate(`/node/${node.id}`)
      onClose()
    }
  }, [isBucle, node.id, onClose, popNavigate])

  // Modal centrado: ESC cierra (sin propagar a router), click fuera cierra.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    // capture: true → atrapamos ESC antes que cualquier otro handler global
    document.addEventListener('keydown', onKey, { capture: true })
    return () => document.removeEventListener('keydown', onKey, { capture: true })
  }, [onClose])

  const dueDate = isoToLocalDate(node.due)
  const dueTime = isoToLocalTime(node.due)

  function setDue(date: string, time: string) {
    if (!date) { store.updateNode(node.id, { due: null }); return }
    store.updateNode(node.id, { due: makeDueISO(date, time) })
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

  if (isBucle) return null

  return createPortal(
    <div
      className="task-props-modal-backdrop"
      onMouseDown={onClose}
      onClick={onClose}
    >
    <div
      ref={popoverRef}
      className="task-props-popup task-props-popup--modal"
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      {/* Header: abrir nota */}
      <button
        className="tpp-open-note-btn"
        onClick={e => {
          e.stopPropagation()
          popNavigate(`/node/${node.id}`)
          onClose()
        }}
        title="Abrir nota completa"
      >
        ↗ Abrir nota
      </button>

      {/* Título / rename */}
      {allowRename ? (
        <input
          className="tpp-title-input"
          defaultValue={node.text}
          autoFocus
          onClick={e => e.stopPropagation()}
          onKeyDown={e => {
            if (e.key === 'Enter') { (e.target as HTMLInputElement).blur() }
            if (e.key === 'Escape') { onClose() }
          }}
          onBlur={e => {
            const v = e.target.value
            if (v !== node.text) store.updateNode(node.id, { text: v })
          }}
          placeholder="Sin título"
        />
      ) : (
        <div className="tpp-title">{node.text || 'Sin título'}</div>
      )}

      {/* Fechas rápidas */}
      <div className="tpp-section-label">Fecha</div>
      <div className="nqp-quick-row">
        {[
          { label: 'Hoy', days: 0 },
          { label: 'Mañana', days: 1 },
          { label: 'Lunes', days: qNextMondayDays },
          { label: '+7d', days: 7 },
        ].map(({ label, days }) => {
          const d = new Date(); d.setDate(d.getDate() + days)
          const iso = [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-')
          return (
            <button key={label} className={`nqp-qbtn${dueDate === iso ? ' active' : ''}`}
              onClick={() => setDue(iso, hasLocalTime(node.due) ? dueTime : '')}>{label}</button>
          )
        })}
        {node.due && <button className="nqp-qbtn nqp-clear" onClick={() => store.updateNode(node.id, { due: null })}>✕</button>}
      </div>

      {/* Fecha + hora (hora opcional) */}
      <div className="nqp-inputs-row">
        <input type="date" className="nqp-date-input" value={dueDate}
          onChange={e => setDue(e.target.value, hasLocalTime(node.due) ? dueTime : '')} />
        <input type="time" className="nqp-time-input"
          value={hasLocalTime(node.due) ? dueTime : ''}
          onChange={e => setDue(dueDate, e.target.value)} disabled={!dueDate} placeholder="HH:MM" />
        {hasLocalTime(node.due) && (
          <button className="nqp-qbtn nqp-clear" style={{ fontSize: 10, padding: '2px 5px' }}
            onClick={() => setDue(dueDate, '')} title="Quitar hora">✕h</button>
        )}
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

      {/* Color de acento de la nota — se usa de fondo en calendario y border en outliner */}
      <div className="tpp-section-label">Color</div>
      <div className="nqp-chips-row tpp-color-row">
        {(() => {
          const currentColor: string | null = (() => {
            try { return JSON.parse(node.extraData || '{}').color || null } catch { return null }
          })()
          const COLORS: { v: string | null; label: string }[] = [
            { v: null,      label: 'Sin color' },
            { v: '#a8c5ec', label: 'Azul' },
            { v: '#b8a7e8', label: 'Morado' },
            { v: '#f0a3a3', label: 'Rojo' },
            { v: '#f5c197', label: 'Naranja' },
            { v: '#f5c97a', label: 'Ámbar' },
            { v: '#fbd75b', label: 'Amarillo' },
            { v: '#9bd6a3', label: 'Verde' },
            { v: '#8ed4dd', label: 'Cian' },
            { v: '#dbadff', label: 'Lavanda' },
            { v: '#f5b3d3', label: 'Rosa' },
            { v: '#a3a8b3', label: 'Gris' },
          ]
          function setColor(c: string | null) {
            let ed: Record<string, unknown> = {}
            try { ed = JSON.parse(node.extraData || '{}') } catch {}
            if (c) ed.color = c; else delete ed.color
            store.updateNode(node.id, { extraData: JSON.stringify(ed) })
          }
          return COLORS.map(({ v, label }) => {
            const active = currentColor === v || (!currentColor && v === null)
            return (
              <button
                key={String(v)}
                className={`tpp-color-swatch${active ? ' active' : ''}`}
                onClick={() => setColor(v)}
                title={label}
                style={v
                  ? { background: v, borderColor: active ? '#000' : v + '80' }
                  : { background: 'transparent' }}
              >
                {v === null ? '—' : null}
              </button>
            )
          })
        })()}
      </div>

      {allowDelete && (
        <>
          <div className="tpp-divider" />
          <button
            className="tpp-delete-btn"
            onClick={e => {
              e.stopPropagation()
              store.deleteNode(node.id)
              onClose()
              onDeleted?.()
            }}
          >🗑 Eliminar</button>
        </>
      )}

    </div>
    </div>,
    document.body
  )
}

// ── GCal event editor popup ────────────────────────────────────────────────────

export interface GCalEventEditorProps {
  event: CalendarEvent
  onClose: () => void
  onUpdated: (updated: CalendarEvent) => void
  onDeleted: (id: string) => void
  /** Si true, se renderiza como modal centrado con backdrop. */
  modal?: boolean
}

export function GCalEventEditor({ event, onClose, onUpdated, onDeleted, modal }: GCalEventEditorProps) {
  const [title, setTitle] = useState(event.title)
  const [startDate, setStartDate] = useState(event.start ? event.start.slice(0, 10) : '')
  const [startTime, setStartTime] = useState(event.start && !event.allDay ? event.start.slice(11, 16) : '')
  const [endDate, setEndDate] = useState(event.end ? event.end.slice(0, 10) : '')
  const [endTime, setEndTime] = useState(event.end && !event.allDay ? event.end.slice(11, 16) : '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  // ESC cierra (capture para no propagar a router) — sólo en modo modal
  useEffect(() => {
    if (!modal) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose() }
    }
    document.addEventListener('keydown', onKey, { capture: true })
    return () => document.removeEventListener('keydown', onKey, { capture: true })
  }, [modal, onClose])

  // Click fuera cierra — sólo en modo NO-modal (inline)
  useEffect(() => {
    if (modal) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as globalThis.Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [modal, onClose])

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
      setMsg('✓ Guardado en Google')
      setTimeout(onClose, 800)
    } catch { setMsg('Error al guardar en Google') }
    finally { setSaving(false) }
  }

  async function remove() {
    if (!window.confirm(`¿Eliminar "${event.title}" de Google Calendar?`)) return
    setSaving(true); setMsg(null)
    try {
      await deleteCalendarEvent(event.id)
      onDeleted(event.id)
    } catch { setMsg('Error al eliminar en Google') }
    finally { setSaving(false) }
  }

  const body = (
    <div ref={ref}
      className={`gcal-editor-popup${modal ? ' gcal-editor-popup--modal' : ''}`}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      <div className="gcal-editor-title">📅 Editar evento Google Calendar</div>
      <input className="gcal-editor-name" value={title} onChange={e => setTitle(e.target.value)}
        placeholder="Título del evento"
        autoFocus
        onKeyDown={e => { if (e.key === 'Enter') save() }}
      />
      <div className="gcal-editor-row">
        <span className="gcal-editor-label">Inicio</span>
        <input type="date" className="nqp-date-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
        <input type="time" className="nqp-time-input" value={startTime} onChange={e => setStartTime(e.target.value)} disabled={!startDate} placeholder="HH:MM" />
        {startTime && (
          <button className="nqp-qbtn nqp-clear" style={{ fontSize: 10, padding: '2px 5px' }}
            onClick={() => setStartTime('')} title="Quitar hora">✕h</button>
        )}
      </div>
      <div className="gcal-editor-row">
        <span className="gcal-editor-label">Fin</span>
        <input type="date" className="nqp-date-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
        <input type="time" className="nqp-time-input" value={endTime} onChange={e => setEndTime(e.target.value)} disabled={!endDate} placeholder="HH:MM" />
        {endTime && (
          <button className="nqp-qbtn nqp-clear" style={{ fontSize: 10, padding: '2px 5px' }}
            onClick={() => setEndTime('')} title="Quitar hora">✕h</button>
        )}
      </div>
      {msg && <div className={`gcal-editor-msg${msg.startsWith('✓') ? ' ok' : ''}`}>{msg}</div>}
      <div className="gcal-editor-actions">
        <button className="gcal-editor-delete" onClick={remove} disabled={saving} title="Eliminar de Google Calendar">🗑 Eliminar</button>
        <button className="gcal-editor-cancel" onClick={onClose}>Cancelar</button>
        <button className="gcal-editor-save" onClick={save} disabled={saving || !title || !startDate}>
          {saving ? '↻' : 'Guardar'}
        </button>
      </div>
    </div>
  )

  if (modal) {
    return createPortal(
      <div className="task-props-modal-backdrop" onMouseDown={onClose} onClick={onClose}>
        {body}
      </div>,
      document.body
    )
  }
  return body
}

// ── Drag state para el panel agenda ───────────────────────────────────────────
let _agendaDragId: string | null = null

// ── Task row with hover props button ──────────────────────────────────────────

interface AgendaTaskRowProps {
  task: Node
  checkboxClass: string
  indented?: boolean
  isEvent?: boolean
  parentNote?: string   // nombre de la nota padre (si no es diario)
  onToggle: () => void
  onClick: () => void
  onDropBefore?: (draggedId: string) => void  // soltar antes de esta fila
  onDropAsChild?: (draggedId: string) => void // soltar como hijo (solo seguimiento)
}

function AgendaTaskRow({ task, checkboxClass, indented, isEvent, parentNote, onToggle, onClick, onDropBefore, onDropAsChild }: AgendaTaskRowProps) {
  const [hovered, setHovered] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [leaving, setLeaving] = useState<null | 'pulse' | 'fade'>(null)
  const btnRef = useRef<HTMLButtonElement>(null!)

  function handleToggle() {
    // Si ya está done o es evento → toggle inmediato
    if (task.status === 'done' || isEvent) { onToggle(); return }
    // Marcar done con animación de despedida
    if (leaving) return
    setLeaving('pulse')
    setTimeout(() => setLeaving('fade'), 700)
    setTimeout(() => { onToggle() }, 1200)
  }

  const rowClass = [
    'diary-agenda-task',
    indented ? 'diary-agenda-task--indented' : '',
    (task.status === 'done' || leaving) ? 'diary-agenda-task--done' : '',
    isDragOver ? 'diary-agenda-task--drop' : '',
    leaving === 'fade' ? 'cal-panel-task--leaving' : '',
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
        e.dataTransfer.setData('cal-node-id', task.id)
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
      ) : leaving ? (
        <span className="diary-agenda-checkbox diary-agenda-checkbox--done cal-panel-check-pulse">✓</span>
      ) : (
        <button
          className={checkboxClass}
          onClick={e => { e.stopPropagation(); handleToggle() }}
        >
          {task.status === 'done' ? '✓' : ''}
        </button>
      )}

      <span className={`diary-agenda-text${task.status === 'done' ? ' done' : ''}`}>
        {task.text ? renderInline(task.text) : 'Sin título'}
      </span>

      {parentNote && (
        <span className="diary-agenda-parent-note" title={parentNote}>{parentNote}</span>
      )}
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
  /** Si true, renderiza SOLO el timeline (sin tabs ni agenda). Para usar
   *  como columna intermedia toggleable desde un botón externo. */
  timelineMode?: boolean
}

export default function DiaryRightPanel({ diaryDate, rangeType = 'day', timelineMode }: DiaryRightPanelProps) {
  const s = useStore()
  const us = useUserStore()
  const navigate = useNavigate()
  const [panelTab, setPanelTab] = useState<DiaryPanelTab>('agenda')
  const [googleEvents, setGoogleEvents] = useState<CalendarEvent[]>([])
  const [editingGCalEvent, setEditingGCalEvent] = useState<CalendarEvent | null>(null)
  const [taskModalNode, setTaskModalNode] = useState<Node | null>(null)
  const [dragOverSegId, setDragOverSegId] = useState<string | null>(null)

  // Fetch Google Calendar events when date changes (day view only)
  useEffect(() => {
    if (rangeType !== 'day') return
    if (!us.googleConnected) { setGoogleEvents([]); return }
    let cancelled = false
    getCalendarEvents(diaryDate)
      .then(events => {
        if (cancelled) return
        const arr = Array.isArray(events) ? events : []
        // eslint-disable-next-line no-console
        console.log('[GCal panel] events fetched', { date: diaryDate.toISOString().slice(0,10), count: arr.length, sample: arr.slice(0,3) })
        setGoogleEvents(arr)
      })
      .catch(err => {
        if (cancelled) return
        // eslint-disable-next-line no-console
        console.error('[GCal panel] fetch error', err)
        setGoogleEvents([])
      })
    return () => { cancelled = true }
  }, [diaryDate, rangeType, us.googleConnected])

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

  // Nodos de seguimiento — filtrar por día (sin due → hoy + overdue, con due → ese día)
  const isThisDayToday = diaryDate.toDateString() === now.toDateString()
  const seguimientoNodes = s.allActive()
    .filter(n => !n.deletedAt && (n.isSeguimiento || (n.types || []).includes('bucle')))
    .filter(n => {
      // Sin fecha: solo en el panel de HOY
      if (!n.due) return isThisDayToday
      const due = new Date(n.due)
      // Cae en este día: mostrar
      if (due >= dateStart && due < dateEnd) return true
      // Overdue (due < hoy) y estamos en HOY: traer de vuelta a hoy
      if (isThisDayToday && due < todayStart) return true
      return false
    })
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

  /** True si el padre directo del nodo es una tarea (status !== null, no diario, no seguimiento) */
  function hasTaskParent(node: Node): boolean {
    if (!node.parentId) return false
    const parent = s.getNode(node.parentId)
    if (!parent || parent.deletedAt) return false
    return parent.status !== null && !parent.isDiaryEntry && !parent.isSeguimiento
  }

  const overdueRaw = allPending.filter(n => {
    if (!n.due) return false
    if (seguimientoIds.has(n.id)) return false        // el nodo MISMO es seguimiento
    if (hasSeguimientoAncestor(n.id)) return false    // es hijo de seguimiento
    if (hasTaskParent(n)) return false                // es hijo de tarea → se muestra bajo ella
    return new Date(n.due) < todayStart
  })

  // Para semana/mes: mostrar tareas del rango en lugar de solo hoy
  const todayTasksRaw = allPending.filter(n => {
    if (!n.due) return false
    if (seguimientoIds.has(n.id)) return false
    if (hasSeguimientoAncestor(n.id)) return false
    if (hasTaskParent(n)) return false                // es hijo de tarea → se muestra bajo ella
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


  // ── Helper: nombre de la nota padre (si no es diario ni raíz) ──────────────
  function getParentNote(node: Node): string | undefined {
    if (!node.parentId) return undefined
    const parent = s.getNode(node.parentId)
    if (!parent || parent.deletedAt || parent.isDiaryEntry) return undefined
    return parent.text?.trim() || undefined
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

  // ── Recursos pendientes / en progreso ──────────────────────────────────────
  const pendingResources = s.allResources().filter(n => {
    try {
      const ed = JSON.parse(n.extraData || '{}')
      return ed._resourceStatus === 'pending' || ed._resourceStatus === 'consuming' || !ed._resourceStatus
    } catch { return false }
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  function renderAgenda() {
    // Eventos de Google Calendar ya se muestran en el Timeline — no duplicar en Agenda.
    const hasAnything = seguimientoNodes.length > 0 || overdue.length > 0 || todayTasks.length > 0 || pendingResources.length > 0

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
        {/* Nodos en seguimiento + sus tareas hijo */}
        {seguimientoNodes.map(node => {
          const childTasks = getChildTasks(node.id)
          return (
            <div key={node.id}>
              {/* Header bucle — NO draggable (los bucles no son agendables, son contenedores).
                  Solo acepta drops para meter tareas dentro. */}
              <div
                className={`diary-agenda-seguimiento${dragOverSegId === node.id ? ' diary-agenda-seguimiento--drop' : ''}`}
                draggable={false}
                style={{ userSelect: 'none' }}
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
                <span className={`diary-agenda-text${node.status === 'done' ? ' done' : ''}`}>{node.text ? renderInline(node.text) : 'Sin título'}</span>
                {getParentNote(node) && (
                  <span className="diary-agenda-parent-note" title={getParentNote(node)}>{getParentNote(node)}</span>
                )}
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

        {/* Tareas vencidas + sus hijos de tarea */}
        {overdue.map(task => {
          const taskKids = store.children(task.id).filter(c => !c.deletedAt && c.status !== null)
          return (
            <React.Fragment key={task.id}>
              <AgendaTaskRow
                task={task}
                checkboxClass={`diary-agenda-checkbox diary-agenda-checkbox--${task.status === 'done' ? 'done' : 'overdue'}`}
                parentNote={getParentNote(task)}
                onToggle={() => toggleTask(task.id, task.status)}
                onClick={() => navigate(`/node/${task.id}`)}
                onDropBefore={draggedId => dropBefore(draggedId, task.id)}
                onDropAsChild={draggedId => dropAsChild(draggedId, task.id)}
              />
              {taskKids.map(child => (
                <AgendaTaskRow
                  key={child.id}
                  task={child}
                  checkboxClass={childTaskCheckboxClass(child)}
                  indented
                  isEvent={child.isEvent}
                  onToggle={() => toggleTask(child.id, child.status)}
                  onClick={() => navigate(`/node/${child.id}`)}
                  onDropBefore={draggedId => dropBefore(draggedId, child.id)}
                  onDropAsChild={draggedId => dropAsChild(draggedId, child.id)}
                />
              ))}
            </React.Fragment>
          )
        })}

        {/* Tareas de hoy + sus hijos de tarea */}
        {todayTasks.map(task => {
          const taskKids = store.children(task.id).filter(c => !c.deletedAt && c.status !== null)
          return (
            <React.Fragment key={task.id}>
              <AgendaTaskRow
                task={task}
                checkboxClass={`diary-agenda-checkbox diary-agenda-checkbox--${task.status === 'done' ? 'done' : 'today'}`}
                parentNote={getParentNote(task)}
                onToggle={() => toggleTask(task.id, task.status)}
                onClick={() => navigate(`/node/${task.id}`)}
                onDropBefore={draggedId => dropBefore(draggedId, task.id)}
                onDropAsChild={draggedId => dropAsChild(draggedId, task.id)}
              />
              {taskKids.map(child => (
                <AgendaTaskRow
                  key={child.id}
                  task={child}
                  checkboxClass={childTaskCheckboxClass(child)}
                  indented
                  isEvent={child.isEvent}
                  onToggle={() => toggleTask(child.id, child.status)}
                  onClick={() => navigate(`/node/${child.id}`)}
                  onDropBefore={draggedId => dropBefore(draggedId, child.id)}
                  onDropAsChild={draggedId => dropAsChild(draggedId, child.id)}
                />
              ))}
            </React.Fragment>
          )
        })}

        {/* Recursos pendientes / en progreso */}
        {pendingResources.length > 0 && (
          <div className="diary-agenda-resources-section">
            <div className="diary-agenda-section-label">Recursos</div>
            {pendingResources.map(node => {
              let ed: Record<string, unknown> = {}
              try { ed = JSON.parse(node.extraData || '{}') } catch {}
              const status = (ed._resourceStatus as string) || 'pending'
              const meta = ed._resourceMeta as { title?: string; image?: string; domain?: string; channel?: string } | null
              const type = (ed._resourceType as string) || 'url'
              const url = (ed._resourceUrl as string) || ''
              const typeIcon = type === 'youtube' ? '▶️' : type === 'book' ? '📚' : type === 'podcast' ? '🎙' : type === 'document' ? '📄' : '🔗'
              const statusColor = status === 'consuming' ? '#3b82f6' : '#06b6d4'
              return (
                <div
                  key={node.id}
                  className="diary-agenda-resource-row"
                  onClick={() => navigate(`/node/${node.id}`)}
                >
                  <span className="diary-agenda-resource-icon">{typeIcon}</span>
                  <span className="diary-agenda-resource-title">
                    {meta?.title || node.text || 'Sin título'}
                  </span>
                  <span
                    className="diary-agenda-resource-status"
                    style={{ color: statusColor, borderColor: statusColor }}
                  >
                    {status === 'consuming' ? 'En progreso' : 'Pendiente'}
                  </span>
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="diary-agenda-resource-open"
                      onClick={e => e.stopPropagation()}
                    >↗</a>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── Timeline logic ─────────────────────────────────────────────────────────
  // Franja horaria de Ajustes > Apariencia (reactiva)
  const [tlDayStart, setTlDayStart] = useState(() => {
    const v = parseInt(localStorage.getItem('from_day_start_hour') || '')
    return isNaN(v) ? 7 : v
  })
  const [tlDayEnd, setTlDayEnd] = useState(() => {
    const v = parseInt(localStorage.getItem('from_day_end_hour') || '')
    return isNaN(v) ? 23 : v
  })
  useEffect(() => {
    function refresh() {
      const s = parseInt(localStorage.getItem('from_day_start_hour') || '')
      const e = parseInt(localStorage.getItem('from_day_end_hour') || '')
      setTlDayStart(isNaN(s) ? 7 : s)
      setTlDayEnd(isNaN(e) ? 23 : e)
    }
    window.addEventListener('from-day-hours-changed', refresh)
    return () => window.removeEventListener('from-day-hours-changed', refresh)
  }, [])
  const hours = Array.from({ length: Math.max(0, tlDayEnd - tlDayStart) }, (_, i) => i + tlDayStart)
  const currentHour = now.getHours()
  const currentMinutes = now.getMinutes()

  const allDayTasks = s.allActive().filter(n =>
    n.status !== null && !n.deletedAt && n.due
    && !n.isSeguimiento && !(n.types || []).includes('bucle')
  )

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
  const allEvents = s.allActive().filter(n =>
    n.isEvent && n.due && !n.deletedAt
    && !n.isSeguimiento && !(n.types || []).includes('bucle')
  )
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

  // Items planos del día (tareas + eventos de From)
  const fromTimedItems = [...allDayTasks, ...allEvents].filter(n => {
    if (!n.due) return false
    const d = new Date(n.due)
    return d >= dateStart && d < dateEnd
  })
  const gcalTimedItems = googleEvents.filter(ev => !ev.allDay && ev.start)

  function renderTimeline() {
    return <TimelineRenderer
      diaryDate={diaryDate}
      dayStart={tlDayStart}
      dayEnd={tlDayEnd}
      fromItems={fromTimedItems}
      gcalItems={gcalTimedItems}
      currentHour={currentHour}
      currentMinutes={currentMinutes}
      isToday={isToday}
      onCreateTaskAt={(h, m) => {
        const d = new Date(diaryDate); d.setHours(h, m, 0, 0)
        const newNode = store.createNode({ text: '', parentId: null, siblingOrder: Date.now(), isTask: true })
        store.updateNode(newNode.id, { due: d.toISOString() })
        navigate(`/node/${newNode.id}`)
      }}
      onEditFrom={node => setTaskModalNode(node)}
      onEditGCal={ev => setEditingGCalEvent(ev)}
      editingGCalEvent={editingGCalEvent}
      onGCalUpdated={updated => { setGoogleEvents(prev => prev.map(x => x.id === updated.id ? updated : x)); setEditingGCalEvent(null) }}
      onGCalDeleted={id => { setGoogleEvents(prev => prev.filter(x => x.id !== id)); setEditingGCalEvent(null) }}
      onCloseGCal={() => setEditingGCalEvent(null)}
    />
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

  // Modo timeline puro (columna toggleable desde botón externo)
  if (timelineMode) {
    return (
      <div className="diary-right-panel diary-right-panel--timeline-only">
        {renderTimeline()}
        {taskModalNode && (
          <TaskPropsPopover
            node={taskModalNode}
            onClose={() => setTaskModalNode(null)}
            allowRename
            allowDelete
            onDeleted={() => setTaskModalNode(null)}
          />
        )}
      </div>
    )
  }

  // Para notas de semana/mes: solo Agenda
  const agendaLabel = rangeType === 'week' ? 'Semana' : rangeType === 'month' ? 'Mes' : 'Agenda'

  return (
    <div className="diary-right-panel">
      <div className="diary-panel-tabs">
        <button
          className={`diary-panel-tab${panelTab === 'agenda' ? ' active' : ''}`}
          onClick={() => setPanelTab('agenda')}
        >
          {agendaLabel}
        </button>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        {renderAgenda()}
      </div>
    </div>
  )
}

// ── TimelineRenderer — bloques continuos con altura/ancho proporcionales ─────

interface TimelineRendererProps {
  diaryDate: Date
  dayStart: number
  dayEnd: number
  fromItems: Node[]
  gcalItems: CalendarEvent[]
  currentHour: number
  currentMinutes: number
  isToday: boolean
  onCreateTaskAt: (hour: number, minutes: number) => void
  onEditFrom: (node: Node) => void
  onEditGCal: (ev: CalendarEvent) => void
  editingGCalEvent: CalendarEvent | null
  onGCalUpdated: (updated: CalendarEvent) => void
  onGCalDeleted: (id: string) => void
  onCloseGCal: () => void
}

let _tlDrag: { id: string; source: 'from' | 'gcal' } | null = null

const HOUR_HEIGHT = 56 // px por hora en el timeline (más alto = bloques más grandes)
const QUARTER_HEIGHT = HOUR_HEIGHT / 4

// Paleta oficial Google Calendar colorIds 1-11 (duplicada de CalendarView)
const TL_GCAL_COLORS: Record<string, string> = {
  '1': '#a4bdfc', '2': '#7ae7bf', '3': '#dbadff', '4': '#ff887c',
  '5': '#fbd75b', '6': '#ffb878', '7': '#46d6db', '8': '#e1e1e1',
  '9': '#5484ed', '10': '#51b749', '11': '#dc2127',
}
function tlGcalColor(ev: CalendarEvent): string {
  if (ev.colorId && TL_GCAL_COLORS[ev.colorId]) return TL_GCAL_COLORS[ev.colorId]
  if (ev.backgroundColor) return ev.backgroundColor
  return '#b5c9ea'
}
function tlNodeColor(node: Node): string {
  try {
    const c = JSON.parse(node.extraData || '{}').color
    if (typeof c === 'string' && c.trim()) return c
  } catch { /* ignore */ }
  if (node.isEvent && !node.status) return '#f5c97a'
  if (node.status === 'done') return '#a3a8b3'
  if (node.isSeguimiento) return '#b8a7e8'
  try { if (JSON.parse(node.extraData || '{}')._resource) return '#8ed4dd' } catch { /* ignore */ }
  if (node.priority === 'high') return '#f0a3a3'
  if (node.priority === 'medium') return '#f5c197'
  if (node.priority === 'low') return '#9bd6a3'
  return '#a8c5ec'
}

// Overlap layout copiado/adaptado de CalendarView
interface TLLaid { id: string; startMs: number; endMs: number; durationMs: number }
function tlComputeLayout(events: TLLaid[]): Map<string, { leftPct: number; widthPct: number; zIndex: number }> {
  const result = new Map<string, { leftPct: number; widthPct: number; zIndex: number }>()
  if (events.length === 0) return result
  const sorted = [...events].sort((a, b) => a.startMs - b.startMs || b.durationMs - a.durationMs)
  type Cluster = { events: TLLaid[]; maxEnd: number }
  const clusters: Cluster[] = []
  for (const ev of sorted) {
    const last = clusters[clusters.length - 1]
    if (last && ev.startMs < last.maxEnd) { last.events.push(ev); last.maxEnd = Math.max(last.maxEnd, ev.endMs) }
    else clusters.push({ events: [ev], maxEnd: ev.endMs })
  }
  for (const cluster of clusters) {
    const cols: TLLaid[][] = []
    const assign = new Map<string, number>()
    for (const ev of cluster.events) {
      let placed = false
      for (let c = 0; c < cols.length; c++) {
        const last = cols[c][cols[c].length - 1]
        if (last.endMs <= ev.startMs) { cols[c].push(ev); assign.set(ev.id, c); placed = true; break }
      }
      if (!placed) { cols.push([ev]); assign.set(ev.id, cols.length - 1) }
    }
    const totalCols = cols.length
    for (const ev of cluster.events) {
      const col = assign.get(ev.id) ?? 0
      const baseWidth = 100 / totalCols
      const widthPct = totalCols === 1 ? 100 : baseWidth + (baseWidth * 0.08)
      const leftPct = col * baseWidth
      const zIndex = Math.min(1440, 10 + Math.max(0, Math.round((86400000 - ev.durationMs) / 60000)))
      result.set(ev.id, { leftPct, widthPct: Math.min(widthPct, 100 - leftPct), zIndex })
    }
  }
  return result
}

function TimelineRenderer({
  diaryDate, dayStart, dayEnd,
  fromItems, gcalItems,
  currentHour, currentMinutes, isToday,
  onCreateTaskAt, onEditFrom,
  onEditGCal, editingGCalEvent, onGCalUpdated, onGCalDeleted, onCloseGCal,
}: TimelineRendererProps) {
  const [snapPreview, setSnapPreview] = useState<{ y: number; label: string } | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const numHours = Math.max(0, dayEnd - dayStart)
  const totalHeight = numHours * HOUR_HEIGHT

  // Construir lista unificada de items para layout
  const laidItems: TLLaid[] = []
  for (const n of fromItems) {
    if (!n.due) continue
    const startMs = new Date(n.due).getTime()
    const endMs = n.dueEnd
      ? new Date(n.dueEnd).getTime()
      : startMs + (n.isEvent ? 3600000 : 1800000) // evento 1h, tarea 30min por defecto
    laidItems.push({ id: 'from:' + n.id, startMs, endMs, durationMs: Math.max(900000, endMs - startMs) }) // mín 15min
  }
  for (const ev of gcalItems) {
    if (!ev.start) continue
    const startMs = new Date(ev.start).getTime()
    const endMs = ev.end ? new Date(ev.end).getTime() : startMs + 3600000
    laidItems.push({ id: 'gcal:' + ev.id, startMs, endMs, durationMs: Math.max(900000, endMs - startMs) })
  }
  const layout = tlComputeLayout(laidItems)

  function posFromMs(ms: number): { topPx: number; visible: boolean } {
    const d = new Date(ms)
    if (d.getDate() !== diaryDate.getDate() || d.getMonth() !== diaryDate.getMonth() || d.getFullYear() !== diaryDate.getFullYear()) {
      return { topPx: 0, visible: false }
    }
    const minutesFromDayStart = (d.getHours() - dayStart) * 60 + d.getMinutes()
    if (minutesFromDayStart < 0 || minutesFromDayStart >= numHours * 60) return { topPx: minutesFromDayStart * HOUR_HEIGHT / 60, visible: false }
    return { topPx: minutesFromDayStart * HOUR_HEIGHT / 60, visible: true }
  }

  function computeSnapFromY(clientY: number): { hour: number; minutes: number; pxY: number; label: string } | null {
    const grid = gridRef.current
    if (!grid) return null
    const rect = grid.getBoundingClientRect()
    const y = clientY - rect.top
    if (y < 0 || y > totalHeight) return null
    // Snap a múltiplos de 15min
    const quarter = Math.round(y / QUARTER_HEIGHT)
    const snappedY = quarter * QUARTER_HEIGHT
    const totalMinutes = quarter * 15
    const hour = dayStart + Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return { hour, minutes, pxY: snappedY, label: `${String(hour).padStart(2,'0')}:${String(minutes).padStart(2,'0')}` }
  }

  function handleGridDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const snap = computeSnapFromY(e.clientY)
    if (snap) setSnapPreview({ y: snap.pxY, label: snap.label })
  }

  function handleGridDragLeave(e: React.DragEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as globalThis.Node)) setSnapPreview(null)
  }

  async function handleGridDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const snap = computeSnapFromY(e.clientY)
    setSnapPreview(null)
    if (!snap) return

    const targetDate = new Date(diaryDate)
    targetDate.setHours(snap.hour, snap.minutes, 0, 0)

    if (_tlDrag) {
      const internal = _tlDrag
      _tlDrag = null
      if (internal.source === 'from') {
        store.scheduleNodeAt(internal.id, targetDate.toISOString())
      } else {
        const ev = gcalItems.find(x => x.id === internal.id)
        if (ev) {
          const duration = new Date(ev.end).getTime() - new Date(ev.start).getTime()
          const newEnd = new Date(targetDate.getTime() + duration)
          try {
            const updated = await updateCalendarEvent(internal.id, {
              title: ev.title, start: targetDate.toISOString(), end: newEnd.toISOString(),
            })
            onGCalUpdated(updated)
          } catch { /* swallow */ }
        }
      }
      return
    }
    const extId = e.dataTransfer.getData('cal-node-id') || e.dataTransfer.getData('text/plain')
    if (extId) store.scheduleNodeAt(extId, targetDate.toISOString())
  }

  function handleGridClick(e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('.timeline-block')) return
    const snap = computeSnapFromY(e.clientY)
    if (snap) onCreateTaskAt(snap.hour, snap.minutes)
  }

  const nowTopPx = isToday
    ? ((currentHour - dayStart) * 60 + currentMinutes) * HOUR_HEIGHT / 60
    : -1

  return (
    <div className="timeline-panel-full">
      <div className="timeline-grid-wrapper">
        {/* Etiquetas de hora */}
        <div className="timeline-hours-col">
          {Array.from({ length: numHours }, (_, i) => dayStart + i).map(h => (
            <div key={h} className="timeline-hour-tick" style={{ height: HOUR_HEIGHT }}>
              <span>{String(h).padStart(2, '0')}:00</span>
            </div>
          ))}
        </div>

        {/* Grid de horas + bloques */}
        <div
          ref={gridRef}
          className="timeline-grid"
          style={{ height: totalHeight }}
          onDragOver={handleGridDragOver}
          onDragLeave={handleGridDragLeave}
          onDrop={handleGridDrop}
          onClick={handleGridClick}
        >
          {/* Líneas horarias de fondo */}
          {Array.from({ length: numHours + 1 }, (_, i) => (
            <div
              key={i}
              className="timeline-grid-line"
              style={{ top: i * HOUR_HEIGHT }}
            />
          ))}
          {/* Líneas de cuarto de hora */}
          {Array.from({ length: numHours * 4 }, (_, i) => (
            i % 4 === 0 ? null : (
              <div
                key={'q'+i}
                className="timeline-grid-line timeline-grid-line--quarter"
                style={{ top: i * QUARTER_HEIGHT }}
              />
            )
          ))}

          {/* Línea de ahora */}
          {nowTopPx >= 0 && nowTopPx <= totalHeight && (
            <div className="timeline-now-line-abs" style={{ top: nowTopPx }}>
              <span className="timeline-now-dot" />
              <span className="timeline-now-rule" />
            </div>
          )}

          {/* Snap preview */}
          {snapPreview && (
            <div className="timeline-snap-line-abs" style={{ top: snapPreview.y }}>
              <span className="timeline-snap-label">{snapPreview.label}</span>
            </div>
          )}

          {/* Bloques From */}
          {fromItems.map(n => {
            if (!n.due) return null
            const startMs = new Date(n.due).getTime()
            const endMs = n.dueEnd ? new Date(n.dueEnd).getTime() : startMs + (n.isEvent ? 3600000 : 1800000)
            const pos = posFromMs(startMs)
            if (!pos.visible) return null
            const durationMin = Math.max(15, (endMs - startMs) / 60000)
            const heightPx = (durationMin / 60) * HOUR_HEIGHT
            const lay = layout.get('from:' + n.id) || { leftPct: 0, widthPct: 100, zIndex: 10 }
            const color = tlNodeColor(n)
            const timeLabel = new Date(startMs).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
            return (
              <div
                key={n.id}
                className={`timeline-block${n.status === 'done' ? ' done' : ''}${n.isEvent ? ' is-event' : ' is-task'}`}
                style={{
                  top: pos.topPx,
                  height: Math.max(QUARTER_HEIGHT, heightPx),
                  left: `calc(${lay.leftPct}% + 2px)`,
                  width: `calc(${lay.widthPct}% - 4px)`,
                  zIndex: lay.zIndex,
                  background: color,
                }}
                draggable
                onDragStart={e => {
                  _tlDrag = { id: n.id, source: 'from' }
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('text/plain', n.id)
                }}
                onDragEnd={() => { _tlDrag = null; setSnapPreview(null) }}
                onClick={e => { e.stopPropagation(); onEditFrom(n) }}
                title={`${n.text || 'Sin título'} · ${timeLabel}`}
              >
                <span className="timeline-block-time">{timeLabel}</span>
                <span className="timeline-block-text">{n.text || 'Sin título'}</span>
              </div>
            )
          })}

          {/* Bloques Google Calendar */}
          {gcalItems.map(ev => {
            const startMs = new Date(ev.start).getTime()
            const endMs = ev.end ? new Date(ev.end).getTime() : startMs + 3600000
            const pos = posFromMs(startMs)
            if (!pos.visible) return null
            const durationMin = Math.max(15, (endMs - startMs) / 60000)
            const heightPx = (durationMin / 60) * HOUR_HEIGHT
            const lay = layout.get('gcal:' + ev.id) || { leftPct: 0, widthPct: 100, zIndex: 10 }
            return (
              <div
                key={ev.id}
                className="timeline-block is-gcal"
                style={{
                  top: pos.topPx,
                  height: Math.max(QUARTER_HEIGHT, heightPx),
                  left: `calc(${lay.leftPct}% + 2px)`,
                  width: `calc(${lay.widthPct}% - 4px)`,
                  zIndex: lay.zIndex,
                  background: tlGcalColor(ev),
                }}
                draggable
                onDragStart={e => {
                  _tlDrag = { id: ev.id, source: 'gcal' }
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('text/plain', ev.id)
                }}
                onDragEnd={() => { _tlDrag = null; setSnapPreview(null) }}
                onClick={e => { e.stopPropagation(); onEditGCal(ev) }}
                title={ev.title}
              >
                <span className="timeline-block-text">{ev.title}</span>
              </div>
            )
          })}
        </div>
      </div>

      {editingGCalEvent && (
        <GCalEventEditor
          event={editingGCalEvent}
          modal
          onClose={onCloseGCal}
          onUpdated={onGCalUpdated}
          onDeleted={onGCalDeleted}
        />
      )}
    </div>
  )
}
