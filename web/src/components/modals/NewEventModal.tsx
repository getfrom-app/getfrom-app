import { createPortal } from 'react-dom'
import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { store } from '../../store/nodeStore'

interface Props {
  onClose: () => void
  /** Día al que cuelga el evento nuevo (por defecto: el diario de HOY). Lo usa la
   *  columna de un día concreto (Agenda) para no crear siempre bajo hoy. */
  parentId?: string | null
  /** Fecha por defecto YYYY-MM-DD del formulario (por defecto: hoy). */
  defaultDateStr?: string
  /** Si se pasa, se llama con el id creado EN VEZ DE navegar a `/node/:id` — lo usa
   *  Fromly 2.0 (chat-first, SPA propia bajo `/app/v2`): navegar por URL sacaría al
   *  usuario del shell v2 hacia la v1. El caller decide qué hacer (p.ej. abrirlo en
   *  su propia columna derecha vía `from:open-detail`). */
  onCreated?: (id: string) => void
}

const EVENT_TYPES = [
  { id: 'meeting', label: 'Reunión', icon: '🤝' },
  { id: 'personal', label: 'Personal', icon: '👤' },
  { id: 'work', label: 'Trabajo', icon: '💼' },
  { id: 'reminder', label: 'Recordatorio', icon: '🔔' },
]

const DURATION_OPTIONS = [
  { value: '30', label: '30 min' },
  { value: '60', label: '1 hora' },
  { value: '90', label: '1h 30min' },
  { value: '120', label: '2 horas' },
  { value: 'custom', label: 'Personalizada' },
]

function todayDateStr() {
  const now = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function nowTimeStr() {
  const now = new Date()
  // Redondear a la próxima hora en punto
  now.setMinutes(0, 0, 0)
  now.setHours(now.getHours() + 1)
  return `${now.getHours().toString().padStart(2, '0')}:00`
}

export default function NewEventModal({ onClose, parentId, defaultDateStr, onCreated }: Props) {
  const { t } = useTranslation()
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState(defaultDateStr || todayDateStr())  // siempre YYYY-MM-DD
  const [startTime, setStartTime] = useState(nowTimeStr())    // HH:MM, solo si hasTime
  const [hasTime, setHasTime] = useState(false)
  const [duration, setDuration] = useState('60')
  const [endDate, setEndDate] = useState('')
  const [description, setDescription] = useState('')
  const [eventType, setEventType] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Auto-calcular fin cuando cambia fecha, hora o duración
  useEffect(() => {
    if (!hasTime || !startDate || !startTime || duration === 'custom') {
      setEndDate('')
      return
    }
    const start = new Date(`${startDate}T${startTime}`)
    const end = new Date(start.getTime() + parseInt(duration) * 60000)
    const pad = (n: number) => n.toString().padStart(2, '0')
    setEndDate(
      `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}` +
      `T${pad(end.getHours())}:${pad(end.getMinutes())}`
    )
  }, [hasTime, startDate, startTime, duration])

  function toggleTime() {
    setHasTime(prev => {
      if (!prev) {
        // Al activar hora: resetear duración a 1h
        setDuration('60')
      }
      return !prev
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const parent = parentId !== undefined ? parentId : (store.todayDiary()?.id ?? null)

    const body = [
      eventType ? EVENT_TYPES.find(t => t.id === eventType)?.label : '',
      description.trim(),
    ].filter(Boolean).join('\n\n') || undefined

    const dueISO = hasTime
      ? new Date(`${startDate}T${startTime}`).toISOString()
      : startDate ? new Date(`${startDate}T00:00:00`).toISOString() : null

    const node = store.createNode({
      text: title.trim(),
      parentId: parent,
      due: dueISO,
    })
    store.updateNode(node.id, { isEvent: true })
    if (hasTime && endDate) store.updateNode(node.id, { dueEnd: new Date(endDate).toISOString() })
    if (body) store.updateNode(node.id, { body })
    if (onCreated) onCreated(node.id)
    else navigate(`/node/${node.id}`)
    onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose()
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="modal-card new-event-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-icon">📅</span>
          <h2>{t('modal.newEvent')}</h2>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>

          {/* Title */}
          <div className="modal-field">
            <input
              ref={inputRef}
              type="text"
              className="modal-input"
              placeholder={t('node.titlePlaceholder')}
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Event type chips */}
          <div className="modal-field">
            <div className="event-type-chips">
              {EVENT_TYPES.map(t => (
                <button
                  key={t.id}
                  type="button"
                  className={`event-chip ${eventType === t.id ? 'event-chip--active' : ''}`}
                  onClick={() => setEventType(prev => prev === t.id ? '' : t.id)}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Fecha */}
          <div className="modal-row">
            <div className={`modal-field ${hasTime ? 'modal-field--half' : ''}`}>
              <label className="modal-label">{t('modal.eventDate')}</label>
              <input
                type="date"
                className="modal-input"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>

            {/* Hora — solo si hasTime */}
            {hasTime && (
              <div className="modal-field modal-field--half">
                <label className="modal-label">{t('modal.eventStartTime')}</label>
                <input
                  type="time"
                  className="modal-input"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Toggle añadir/quitar hora */}
          <div className="modal-field">
            <button
              type="button"
              className={`event-chip ${hasTime ? 'event-chip--active' : ''}`}
              onClick={toggleTime}
            >
              ⏱ {hasTime ? 'Quitar hora' : 'Añadir hora'}
            </button>
          </div>

          {/* Duración + fin — solo si hasTime */}
          {hasTime && (
            <>
              <div className="modal-row">
                <div className="modal-field modal-field--half">
                  <label className="modal-label">{t('modal.eventDuration')}</label>
                  <select
                    className="modal-input"
                    value={duration}
                    onChange={e => setDuration(e.target.value)}
                  >
                    {DURATION_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="modal-field modal-field--half">
                  <label className="modal-label">
                    Fin {duration !== 'custom' && <span className="modal-label-hint">(calculado)</span>}
                  </label>
                  <input
                    type="datetime-local"
                    className="modal-input"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    readOnly={duration !== 'custom'}
                    style={duration !== 'custom' ? { opacity: 0.6 } : undefined}
                  />
                </div>
              </div>
            </>
          )}

          {/* Description */}
          <div className="modal-field">
            <label className="modal-label">{t('modal.eventDescription')}</label>
            <textarea
              className="modal-input"
              placeholder={t('modal.eventDescription')}
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn-primary" disabled={!title.trim()}>{t('modal.newEvent')}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
