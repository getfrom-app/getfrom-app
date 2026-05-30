import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { store } from '../../store/nodeStore'
import { renderInline } from '../outliner/InlineRenderer'
import type { Node } from '../../types'

// Estado global de drag (módulo) — compartido con CalendarSidePanel y agenda.
let _pendingTaskDragId: string | null = null
export function getPendingTaskDragId() { return _pendingTaskDragId }

function formatDue(due: string): string {
  const d = new Date(due)
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  if (d >= todayStart && d <= todayEnd) {
    if (d.getHours() === 0 && d.getMinutes() === 0) return 'Hoy'
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

interface Props {
  task: Node
  /** Categoría visual del checkbox: today | overdue | done | future | event */
  variant?: 'today' | 'overdue' | 'done' | 'future' | 'event'
  indented?: boolean
  parentNote?: string
  onClick: () => void
  /** Abre el modal de propiedades */
  onOpenProps: () => void
  /** Si se proporciona, la fila acepta drops de otra tarea para reparentarla como hija. */
  onDropAsChild?: (draggedId: string) => void
}

export default function PendingTaskRow({ task, variant, indented, parentNote, onClick, onOpenProps, onDropAsChild }: Props) {
  const { t } = useTranslation()
  const [hovered, setHovered] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [leaving, setLeaving] = useState<null | 'pulse' | 'fade'>(null)
  const btnRef = useRef<HTMLButtonElement>(null!)

  const isEvent = variant === 'event' || task.isEvent
  const isDone = task.status === 'done' || variant === 'done'

  // Determinar clase del checkbox según variant explícita o estado de la tarea
  const checkboxClass = (() => {
    if (isEvent) return 'diary-agenda-checkbox'
    if (isDone) return 'diary-agenda-checkbox diary-agenda-checkbox--done'
    if (variant === 'overdue') return 'diary-agenda-checkbox diary-agenda-checkbox--overdue'
    if (variant === 'future') return 'diary-agenda-checkbox diary-agenda-checkbox--future'
    return 'diary-agenda-checkbox diary-agenda-checkbox--today'
  })()

  function toggle() {
    if (isDone) { store.updateNode(task.id, { status: 'pending' }); return }
    if (leaving) return
    setLeaving('pulse')
    setTimeout(() => setLeaving('fade'), 700)
    setTimeout(() => { store.updateNode(task.id, { status: 'done' }) }, 1200)
  }

  const rowClass = [
    'diary-agenda-task',
    indented ? 'diary-agenda-task--indented' : '',
    (isDone || leaving) ? 'diary-agenda-task--done' : '',
    isDragOver ? 'diary-agenda-task--drop' : '',
    leaving === 'fade' ? 'cal-panel-task--leaving' : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      className={rowClass}
      style={{ position: 'relative', userSelect: 'none' }}
      draggable
      onDragStart={e => {
        _pendingTaskDragId = task.id
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', task.id)
        e.dataTransfer.setData('cal-node-id', task.id)
      }}
      onDragEnd={() => { _pendingTaskDragId = null; setIsDragOver(false) }}
      onDragOver={onDropAsChild ? e => {
        if (_pendingTaskDragId && _pendingTaskDragId !== task.id) {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          setIsDragOver(true)
        }
      } : undefined}
      onDragLeave={onDropAsChild ? () => setIsDragOver(false) : undefined}
      onDrop={onDropAsChild ? e => {
        e.preventDefault()
        setIsDragOver(false)
        const id = _pendingTaskDragId
        _pendingTaskDragId = null
        if (id && id !== task.id) onDropAsChild(id)
      } : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setIsDragOver(false) }}
      onClick={onClick}
    >
      {isEvent ? (
        <span className="diary-agenda-event-icon">📅</span>
      ) : leaving ? (
        <span className="diary-agenda-checkbox diary-agenda-checkbox--done cal-panel-check-pulse">✓</span>
      ) : (
        <button className={checkboxClass} onClick={e => { e.stopPropagation(); toggle() }}>
          {isDone ? '✓' : ''}
        </button>
      )}

      <span className={`diary-agenda-text${isDone ? ' done' : ''}`}>
        {task.text ? renderInline(task.text) : t('common.noTitle')}
      </span>

      {parentNote && (
        <span className="diary-agenda-parent-note" title={parentNote}>{parentNote}</span>
      )}
      {task.due && <span className="diary-agenda-due">{formatDue(task.due)}</span>}

      {hovered && (
        <div style={{ position: 'relative', marginLeft: 'auto', flexShrink: 0 }}>
          <button
            ref={btnRef}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-tertiary)', fontSize: 14, padding: '0 4px',
              lineHeight: 1, borderRadius: 4,
            }}
            onClick={e => { e.stopPropagation(); onOpenProps() }}
            title={t('panel.taskProperties')}
          >···</button>
        </div>
      )}
    </div>
  )
}
