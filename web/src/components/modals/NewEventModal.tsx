import { createPortal } from 'react-dom'
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { store } from '../../store/nodeStore'

interface Props {
  onClose: () => void
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

export default function NewEventModal({ onClose }: Props) {
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [duration, setDuration] = useState('60')
  const [description, setDescription] = useState('')
  const [eventType, setEventType] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // When startDate or duration changes, auto-calculate endDate (unless custom)
  useEffect(() => {
    if (!startDate || duration === 'custom') return
    const end = new Date(new Date(startDate).getTime() + parseInt(duration) * 60000)
    // Format to datetime-local string (YYYY-MM-DDTHH:MM)
    const pad = (n: number) => n.toString().padStart(2, '0')
    const formatted =
      `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}` +
      `T${pad(end.getHours())}:${pad(end.getMinutes())}`
    setEndDate(formatted)
  }, [startDate, duration])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const diaryNode = store.todayDiary()

    const body = [
      eventType ? EVENT_TYPES.find(t => t.id === eventType)?.label : '',
      description.trim(),
    ].filter(Boolean).join('\n\n') || undefined

    const node = store.createNode({
      text: title.trim(),
      parentId: diaryNode?.id || null,
      due: startDate ? new Date(startDate).toISOString() : null,
      isTask: true,
    })
    if (endDate) store.updateNode(node.id, { dueEnd: new Date(endDate).toISOString() })
    if (body) store.updateNode(node.id, { body })
    navigate(`/node/${node.id}`)
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
          <h2>Nuevo evento</h2>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>

          {/* Title */}
          <div className="modal-field">
            <input
              ref={inputRef}
              type="text"
              className="modal-input"
              placeholder="Título del evento..."
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

          {/* Start date + duration */}
          <div className="modal-row">
            <div className="modal-field modal-field--half">
              <label className="modal-label">Inicio</label>
              <input
                type="datetime-local"
                className="modal-input"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
            <div className="modal-field modal-field--half">
              <label className="modal-label">Duración</label>
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
          </div>

          {/* End date: editable when custom, or read-only auto-calculated */}
          <div className="modal-field">
            <label className="modal-label">
              Fin {duration !== 'custom' && startDate && <span className="modal-label-hint">(calculado)</span>}
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

          {/* Description */}
          <div className="modal-field">
            <label className="modal-label">Descripción</label>
            <textarea
              className="modal-input"
              placeholder="Añade una descripción o notas..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={!title.trim()}>Crear evento</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
