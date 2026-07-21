import React, { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { store, useStore, nodeMeta, type NodeStore } from '../../store/nodeStore'
import PendingTaskRow from '../shared/PendingTaskRow'
import CenteredModal from '../shared/CenteredModal'
import type { Node } from '../../types'
import { renderInline } from '../outliner/InlineRenderer'
import { getCalendarEvents, updateCalendarEvent, deleteCalendarEvent, createCalendarEvent, type CalendarEvent } from '../../api/googleCalendar'
import { useUserStore } from '../../store/userStore'
import { isoToLocalDate, isoToLocalTime, hasLocalTime, makeDueISO, parseNaturalDate } from '../../utils/dates'
import { isInPapelera } from '../../utils/papeleraHelper'
import { pushEventToGcal } from '../../utils/gcalNodesSync'
import ContextChip from './ContextChip'
import ContextPicker from './ContextPicker'
import { firstContextOf, setNodeContext } from '../../utils/cajones'

type DiaryPanelTab = 'agenda' | 'timeline'

/** True si algún ancestro del nodo es un "container vivo" (nota con tareas
 *  pendientes dentro). Se usa para evitar duplicar tareas en el panel —
 *  si están bajo un container, se renderizan ya dentro del container. */
function hasLiveContainerAncestor(nodeId: string): string | null {
  let current = store.getNode(nodeId)
  while (current?.parentId) {
    const parent = store.getNode(current.parentId)
    if (!parent) break
    if (store.isLiveContainer(parent)) return parent.id
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

function calculateStreak(s: NodeStore): number {
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
  const { t } = useTranslation()
  const [movePickerOpen, setMovePickerOpen] = useState(false)

  // Bucles no son agendables: si por error se intenta abrir un bucle, cerrar
  // inmediatamente y navegar a su nota (es un contenedor, no una tarea).
  const isBucle = (node.types || []).includes('bucle')
  useEffect(() => {
    if (isBucle) {
      popNavigate(`/node/${node.id}`)
      onClose()
    }
  }, [isBucle, node.id, onClose, popNavigate])

  // ESC + click-out gestionados ahora por <CenteredModal>. Sin handler local.

  const dueDate = isoToLocalDate(node.due)
  const dueTime = isoToLocalTime(node.due)

  function setDue(date: string, time: string) {
    if (!date) { store.updateNode(node.id, { due: null }); return }
    const updates: Partial<Node> = { due: makeDueISO(date, time) }
    // Tarea + hora concreta = evento: aterriza en el calendario y se sincroniza con
    // Google (antes se quedaba como tarea con hora, sin aparecer en Google Calendar
    // ni en la vista de calendario — solo los nodos isEvent aterrizan ahí).
    const becomesEvent = !!time && !node.isEvent
    if (becomesEvent) updates.isEvent = true
    store.updateNode(node.id, updates)
    if (time && (node.isEvent || becomesEvent)) {
      const fresh = store.getNode(node.id)
      if (fresh) pushEventToGcal(fresh).catch(() => {})
    }
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
  const recUnits: [string, string][] = [['daily', t('recUnit.days')], ['weekly', t('recUnit.weeks')], ['monthly', t('recUnit.months')], ['yearly', t('recUnit.years')]]

  const qNextMondayDays = (() => { const d = new Date().getDay(); return d === 1 ? 7 : (8 - d) % 7 || 7 })()

  const priorityOpts: { v: Node['priority']; l: string; c: string }[] = [
    { v: null,     l: '–',    c: '' },
    { v: 'low',    l: t('priority.low'),  c: '#6b7280' },
    { v: 'medium', l: t('priority.medium'), c: '#f59e0b' },
    { v: 'high',   l: t('priority.high'),  c: '#ef4444' },
  ]

  if (isBucle) return null

  return (
    <CenteredModal onClose={onClose} className="task-props-popup task-props-popup--modal">
    <div
      ref={popoverRef}
      style={{ display: 'contents' }}
    >
      {/* Header: acciones de la tarea (abrir, ampliar, mover) */}
      <div className="tpp-header-actions">
        <button
          className="tpp-open-note-btn"
          onClick={e => {
            e.stopPropagation()
            popNavigate(`/node/${node.id}`)
            onClose()
          }}
          title={t('panel.openFullNote')}
        >
          {t('panel.openFull')}
        </button>
        {node.status !== null && (
          <button
            className="tpp-open-note-btn"
            onClick={e => {
              e.stopPropagation()
              const result = store.expandToContainer(node.id)
              onClose()
              if (result) popNavigate(`/node/${result.containerId}`)
            }}
            title={t('panel.convertToContainer')}
          >
            ↑ {t('tip.expand')}
          </button>
        )}
        <button
          className="tpp-open-note-btn"
          onClick={e => {
            e.stopPropagation()
            setMovePickerOpen(v => !v)
          }}
          title={t('tip.moveTaskIntoNote')}
        >
          → {t('context.moveTo')}
        </button>
        <button
          className="tpp-open-note-btn"
          onClick={e => {
            e.stopPropagation()
            const diary = store.todayDiary()
            if (!diary) return
            const sibs = store.children(diary.id)
            const lastOrder = sibs.length > 0 ? Math.max(...sibs.map(x => x.siblingOrder)) : 0
            store.updateNode(node.id, { parentId: diary.id, siblingOrder: lastOrder + 1 })
            onClose()
          }}
          title={t('tip.moveTaskToToday')}
        >
          📓 {t('tip.toToday')}
        </button>
      </div>

      {movePickerOpen && <MovePicker nodeId={node.id} onPicked={() => { setMovePickerOpen(false); onClose() }} onCancel={() => setMovePickerOpen(false)} />}

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
          placeholder={t('common.noTitle')}
        />
      ) : (
        <div className="tpp-title">{node.text || t('common.noTitle')}</div>
      )}

      {/* Fechas rápidas */}
      <div className="tpp-section-label">{t('modal.dueDate')}</div>
      <input
        type="text"
        className="tpp-natural-date-input"
        placeholder={t('ph.naturalDate')}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            const iso = parseNaturalDate((e.target as HTMLInputElement).value)
            if (iso) {
              store.updateNode(node.id, { due: iso });
              (e.target as HTMLInputElement).value = ''
            }
          }
        }}
      />
      <div className="nqp-quick-row">
        {[
          { label: t('common.today'), days: 0 },
          { label: t('common.tomorrow'), days: 1 },
          { label: t('date.monday'), days: qNextMondayDays },
          { label: t('date.plus7d'), days: 7 },
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
            onClick={() => setDue(dueDate, '')} title={t('tip.removeTime')}>✕h</button>
        )}
      </div>

      {/* Prioridad */}
      <div className="tpp-section-label">{t('kanban.byPriority')}</div>
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
      <div className="tpp-section-label">{t('prop.recurrence')}</div>
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
      <div className="tpp-section-label">{t('search.filterStatus')}</div>
      <div className="nqp-chips-row">
        {([
          { v: 'pending' as const, l: `○ ${t('status.pending')}` },
          { v: 'done'    as const, l: `✓ ${t('status.done')}` },
          { v: 'future'  as const, l: `◆ ${t('status.future')}` },
          { v: null,               l: `– ${t('status.none')}` },
        ] as { v: Node['status']; l: string }[]).map(opt => (
          <button key={String(opt.v)}
            className={`nqp-chip${node.status === opt.v ? ' active' : ''}`}
            onClick={() => { store.updateNode(node.id, { status: opt.v }); if (opt.v !== null) onClose() }}
          >{opt.l}</button>
        ))}
      </div>

      {/* Color de acento de la nota — se usa de fondo en calendario y border en outliner */}
      <div className="tpp-section-label">{t('panel.color')}</div>
      <div className="nqp-chips-row tpp-color-row">
        {(() => {
          const currentColor: string | null = (() => {
            try { return JSON.parse(node.extraData || '{}').color || null } catch { return null }
          })()
          const COLORS: { v: string | null; label: string }[] = [
            { v: null,      label: t('prop.noColor') },
            { v: '#a8c5ec', label: t('color.blue') },
            { v: '#b8a7e8', label: t('color.purple') },
            { v: '#f0a3a3', label: t('color.red') },
            { v: '#f5c197', label: t('color.orange') },
            { v: '#f5c97a', label: t('color.amber') },
            { v: '#fbd75b', label: t('color.yellow') },
            { v: '#9bd6a3', label: t('color.green') },
            { v: '#8ed4dd', label: t('color.cyan') },
            { v: '#dbadff', label: t('color.lavender') },
            { v: '#f5b3d3', label: t('color.pink') },
            { v: '#a3a8b3', label: t('color.gray') },
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
          >🗑 {t('common.delete')}</button>
        </>
      )}

    </div>
    </CenteredModal>
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
  /** Si el evento tiene un nodo Fromly vinculado, su id → botón «Abrir nota» + selector de contexto. */
  linkedNodeId?: string
  /** Crea (bajo demanda) el documento local vinculado a este evento y devuelve su id —
   *  lo usan tanto el botón «Crear documento» como el selector de contexto (que
   *  materializa el vínculo la primera vez que se elige un contexto). */
  onCreateNode?: () => string
}

export function GCalEventEditor({ event, onClose, onUpdated, onDeleted, modal, linkedNodeId, onCreateNode }: GCalEventEditorProps) {
  useStore()
  const { t } = useTranslation()
  const gcalNavigate = useNavigate()
  const [title, setTitle] = useState(event.title)
  const [startDate, setStartDate] = useState(event.start ? event.start.slice(0, 10) : '')
  const [startTime, setStartTime] = useState(event.start && !event.allDay ? event.start.slice(11, 16) : '')
  const [endDate, setEndDate] = useState(event.end ? event.end.slice(0, 10) : '')
  const [endTime, setEndTime] = useState(event.end && !event.allDay ? event.end.slice(11, 16) : '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  // El vínculo con el nodo puede nacer DURANTE la edición (al elegir un contexto
  // sin haber creado el documento todavía) — de ahí el estado propio en vez de
  // usar `linkedNodeId` directamente (Alberto, 22 jul: "puede estar sin ningún
  // contexto, pero se debe poder poner contexto").
  const [linkedId, setLinkedId] = useState(linkedNodeId)
  const [ctxPicker, setCtxPicker] = useState<{ x: number; y: number } | null>(null)
  const ctxBtnRef = useRef<HTMLButtonElement>(null)
  const ctxPickerRef = useRef<HTMLDivElement>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ctxPicker) return
    // Cierra al hacer clic fuera del popover — NO del botón que lo abrió (con
    // contexto ya asignado, el disparador es el propio ContextChip, no un botón
    // con `ctxBtnRef`, así que comprobar el popover en sí es lo único fiable).
    function onDoc(e: MouseEvent) { if (ctxPickerRef.current && !ctxPickerRef.current.contains(e.target as globalThis.Node)) setCtxPicker(null) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [ctxPicker])

  const linkedNode = linkedId ? store.getNode(linkedId) : null
  const currentCtx = linkedNode ? firstContextOf(linkedNode) : null

  function openCtxPicker(e?: React.MouseEvent) {
    const r = (e?.currentTarget as HTMLElement | undefined)?.getBoundingClientRect() ?? ctxBtnRef.current?.getBoundingClientRect()
    if (r) setCtxPicker({ x: r.left, y: r.bottom + 4 })
  }
  /** Elegir un contexto materializa el documento primero si aún no existía. */
  function pickContext(contextId: string | null) {
    let id = linkedId
    if (!id && onCreateNode) { id = onCreateNode(); setLinkedId(id) }
    if (id) setNodeContext(id, contextId)
    setCtxPicker(null)
  }

  // En modo modal, ESC + click-out vienen ya de <CenteredModal>.

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
      const startISO = new Date(start).toISOString()
      const endISO = new Date(end).toISOString()
      const updated = await updateCalendarEvent(event.id, { title, start: startISO, end: endISO })
      onUpdated(updated)
      // Sin esto, el Planificador seguía mostrando la hora vieja tras "guardar":
      // solo se actualizaba Google Calendar, nunca el nodo Fromly — y el
      // Planificador siempre lee `due`/`dueEnd` del NODO, no del evento de Google
      // (Alberto, 21 jul: "aunque lo modifique manualmente... sigue mostrando la
      // hora equivocada").
      if (linkedId) {
        store.updateNode(linkedId, { text: title, due: startISO, dueEnd: endISO })
      }
      setMsg(`✓ ${t('gcal.savedToGoogle')}`)
      setTimeout(onClose, 800)
    } catch { setMsg(t('gcal.saveError')) }
    finally { setSaving(false) }
  }

  async function remove() {
    if (!window.confirm(t('gcal.deleteConfirm', { title: event.title }))) return
    setSaving(true); setMsg(null)
    try {
      await deleteCalendarEvent(event.id)
      onDeleted(event.id)
    } catch { setMsg(t('gcal.deleteError')) }
    finally { setSaving(false) }
  }

  const body = (
    <div ref={ref}
      className={`gcal-editor-popup${modal ? ' gcal-editor-popup--modal' : ''}`}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      <div className="gcal-editor-title">📅 {t('gcal.editTitle')}</div>
      <input className="gcal-editor-name" value={title} onChange={e => setTitle(e.target.value)}
        placeholder={t('ph.eventTitle')}
        autoFocus
        onKeyDown={e => { if (e.key === 'Enter') save() }}
      />
      <div className="gcal-editor-row">
        <span className="gcal-editor-label">{t('gcal.start')}</span>
        <input type="date" className="nqp-date-input" value={startDate} onChange={e => setStartDate(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') save() }} />
        <input type="time" className="nqp-time-input" value={startTime} onChange={e => setStartTime(e.target.value)} disabled={!startDate} placeholder="HH:MM" onKeyDown={e => { if (e.key === 'Enter') save() }} />
        {startTime && (
          <button className="nqp-qbtn nqp-clear" style={{ fontSize: 10, padding: '2px 5px' }}
            onClick={() => setStartTime('')} title={t('tip.removeTime')}>✕h</button>
        )}
      </div>
      <div className="gcal-editor-row">
        <span className="gcal-editor-label">{t('gcal.end')}</span>
        <input type="date" className="nqp-date-input" value={endDate} onChange={e => setEndDate(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') save() }} />
        <input type="time" className="nqp-time-input" value={endTime} onChange={e => setEndTime(e.target.value)} disabled={!endDate} placeholder="HH:MM" onKeyDown={e => { if (e.key === 'Enter') save() }} />
        {endTime && (
          <button className="nqp-qbtn nqp-clear" style={{ fontSize: 10, padding: '2px 5px' }}
            onClick={() => setEndTime('')} title={t('tip.removeTime')}>✕h</button>
        )}
      </div>
      {/* Contexto — como cualquier otro elemento: puede quedarse sin contexto, pero
          siempre debe poder asignarse uno (Alberto, 22 jul). Elegir un contexto
          antes de crear el documento lo materializa sobre la marcha. */}
      <div className="gcal-editor-row" style={{ alignItems: 'center' }}>
        <span className="gcal-editor-label">{t('gcal.context', 'Contexto')}</span>
        {currentCtx ? (
          <ContextChip context={currentCtx} title={t('noteColumn.changeContext')}
            onClick={openCtxPicker} onRemove={() => linkedId && setNodeContext(linkedId, null)} />
        ) : (
          <button ref={ctxBtnRef} className="dc-ctx-chip dc-ctx-chip--empty" onClick={openCtxPicker} title={t('rowContextChip.assign')}>
            {t('gcal.noContext', 'Sin contexto')}
          </button>
        )}
        {ctxPicker && createPortal((
          <div ref={ctxPickerRef} style={{ position: 'fixed', top: ctxPicker.y, left: ctxPicker.x, zIndex: 3001 }} onClick={e => e.stopPropagation()}>
            <ContextPicker currentId={currentCtx?.id ?? null} onPick={pickContext} />
          </div>
        ), document.body)}
      </div>
      {msg && <div className={`gcal-editor-msg${msg.startsWith('✓') ? ' ok' : ''}`}>{msg}</div>}
      {linkedId ? (
        <button className="gcal-editor-opennote" onClick={() => { gcalNavigate(`/node/${linkedId}`); onClose() }}
          style={{ width: '100%', marginTop: 4, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
          ↗ {t('gcal.openNote')}
        </button>
      ) : onCreateNode ? (
        <button className="gcal-editor-opennote" onClick={() => { onCreateNode(); onClose() }}
          style={{ width: '100%', marginTop: 4, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
          ➕ {t('gcal.createDocument', 'Crear documento')}
        </button>
      ) : null}
      <div className="gcal-editor-actions">
        <button className="gcal-editor-delete" onClick={remove} disabled={saving} title={t('gcal.deleteFromGoogle')}>🗑 {t('common.delete')}</button>
        <button className="gcal-editor-cancel" onClick={onClose}>{t('common.cancel')}</button>
        <button className="gcal-editor-save" onClick={save} disabled={saving || !title || !startDate}>
          {saving ? '↻' : t('common.save')}
        </button>
      </div>
    </div>
  )

  if (modal) {
    return <CenteredModal onClose={onClose}>{body}</CenteredModal>
  }
  return body
}

// ── Drag state para el panel agenda ───────────────────────────────────────────
let _agendaDragId: string | null = null

// ── Task row with hover props button ──────────────────────────────────────────

// Setter del modal a nivel panel — inyectado vía contexto-prop por DiaryRightPanel.
// ── MovePicker — buscador fuzzy para reparentar una tarea ────────────────────

function MovePicker({ nodeId, onPicked, onCancel }: { nodeId: string; onPicked: () => void; onCancel: () => void }) {
  const { t } = useTranslation()
  const s = useStore()
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  // Precomputar candidatos una sola vez por render. Con visited Set en
  // isAncestor para evitar ciclos en datos corruptos.
  const candidates = useMemo(() => {
    const allNodes = s.allActive()
    // Precomputar set de descendientes de nodeId (lo que NO debe aparecer
    // como destino — evitar mover dentro de uno mismo). Una sola pasada
    // BFS desde nodeId.
    const descendants = new Set<string>()
    const visited = new Set<string>()
    const stack: string[] = [nodeId]
    while (stack.length) {
      const id = stack.pop()!
      if (visited.has(id)) continue
      visited.add(id)
      descendants.add(id)
      for (const k of s.children(id)) {
        if (!visited.has(k.id)) stack.push(k.id)
      }
    }
    // Filtrar
    const out: Node[] = []
    for (const n of allNodes) {
      if (n.deletedAt) continue
      if (descendants.has(n.id)) continue
      if (n.isDiaryEntry) continue
      if (n.status !== null) continue
      if (n.isEvent) continue
      try { if (JSON.parse(n.extraData || '{}')._resource) continue } catch { /* */ }
      out.push(n)
    }
    return out
  }, [s.nodes.size, nodeId]) // eslint-disable-line react-hooks/exhaustive-deps

  const q = query.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (q) {
      const r: Node[] = []
      for (const n of candidates) {
        if ((n.text || '').toLowerCase().includes(q)) {
          r.push(n)
          if (r.length >= 12) break
        }
      }
      return r
    }
    return [...candidates].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 12)
  }, [candidates, q])

  function pick(targetId: string) {
    const sibs = store.children(targetId)
    const lastOrder = sibs.length > 0 ? Math.max(...sibs.map(x => x.siblingOrder)) : 0
    store.updateNode(nodeId, { parentId: targetId, siblingOrder: lastOrder + 1 })
    onPicked()
  }

  return (
    <div className="tpp-move-picker">
      <input
        ref={inputRef}
        className="tpp-move-input"
        placeholder={t('ph.searchDestNote')}
        value={query}
        onChange={e => { setQuery(e.target.value); setActiveIdx(0) }}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, filtered.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
          else if (e.key === 'Enter') { e.preventDefault(); const t = filtered[activeIdx]; if (t) pick(t.id) }
          else if (e.key === 'Escape') { e.preventDefault(); onCancel() }
        }}
      />
      <div className="tpp-move-results">
        {filtered.length === 0 && <div className="tpp-move-empty">{t('search.noResults')}</div>}
        {filtered.map((n: Node, i: number) => (
          <button
            key={n.id}
            className={`tpp-move-item${i === activeIdx ? ' active' : ''}`}
            onClick={() => pick(n.id)}
            onMouseEnter={() => setActiveIdx(i)}
          >
            <span className="tpp-move-item-icon">📄</span>
            <span className="tpp-move-item-text">{n.text || t('common.noTitle')}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

