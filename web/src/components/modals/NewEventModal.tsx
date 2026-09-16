import { createPortal } from 'react-dom'
import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { store } from '../../store/nodeStore'
import { useToast } from '../Toast'
import Icon from '../../v2/components/Icon'
import { recurrenceToString } from '../../utils/naturalDate'

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
  // Sin icono: los 4 tipos se distinguen por su etiqueta y su color; meterles un
  // emoji cada uno era justo lo que le daba aire de app barata (5 ago 2026).
  { id: 'meeting', label: 'Reunión' },
  { id: 'personal', label: 'Personal' },
  { id: 'work', label: 'Trabajo' },
  { id: 'reminder', label: 'Recordatorio' },
]

const DURATION_OPTIONS = [
  { value: '30', label: '30 min' },
  { value: '60', label: '1 hora' },
  { value: '90', label: '1h 30min' },
  { value: '120', label: '2 horas' },
  { value: 'custom', label: 'Personalizada' },
]

// Repetición: mismo formato y misma UI que «Repetición» en TaskPropsPopover
// (DiaryPanelComponents.tsx): `unit` / `unit:N`, o el RecurrenceConfig en JSON
// para «Personalizado» (días sueltos de la semana).
const DAY_LETTERS_ES = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] // L M X J V S D

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
  const { showToast } = useToast()
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState(defaultDateStr || todayDateStr())  // siempre YYYY-MM-DD
  const [startTime, setStartTime] = useState(nowTimeStr())    // HH:MM, solo si hasTime
  // Con hora por defecto (16 sep 2026): el Mes solo pinta eventos CON hora, así
  // que uno creado desde ahí sin hora desaparecía nada más crearlo.
  const [hasTime, setHasTime] = useState(true)
  const [duration, setDuration] = useState('60')
  const [endDate, setEndDate] = useState('')
  const [description, setDescription] = useState('')
  const [eventType, setEventType] = useState('')
  const [recUnit, setRecUnit] = useState<string | null>(null) // null = no se repite
  const [recN, setRecN] = useState(1)
  const [customOpen, setCustomOpen] = useState(false)
  const [customDays, setCustomDays] = useState<number[]>([])
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
    // `status: 'pending'` además de `isEvent`: un evento ES una tarea con día y hora
    // (ver utils/taskNode.ts) — sin status no contaba como tarea en ningún sitio.
    store.updateNode(node.id, { isEvent: true, status: 'pending' })
    const recurrence = customOpen
      ? (customDays.length ? recurrenceToString({ type: 'custom', days: customDays, display: customDays.map(d => DAY_LETTERS_ES[d]).join('') }) : null)
      : recUnit ? (recN === 1 ? recUnit : `${recUnit}:${recN}`) : null
    if (recurrence) store.updateNode(node.id, { recurrence })
    if (hasTime && endDate) store.updateNode(node.id, { dueEnd: new Date(endDate).toISOString() })
    if (body) store.updateNode(node.id, { body })
    if (onCreated) onCreated(node.id)
    else navigate(`/node/${node.id}`)
    showToast(t('ai.actionEventCreated', 'Evento creado'))
    onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose()
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="modal-card new-event-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-icon"><Icon name="event" size={18} /></span>
          <h2>{t('modal.newEvent')}</h2>
          <button className="modal-close-btn" onClick={onClose} aria-label={t('common.close')}>×</button>
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
                  {t.label}
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

          {/* Repetición */}
          <div className="modal-field">
            <label className="modal-label">{t('prop.recurrence')}</label>
            <div className="nqp-rec-row">
              <button type="button" className={`nqp-chip${!recUnit && !customOpen ? ' active' : ''}`}
                onClick={() => { setRecUnit(null); setCustomOpen(false); setCustomDays([]) }}>–</button>
              <input type="number" className="nqp-rec-n" min={1} max={999}
                value={recN} disabled={!recUnit || customOpen}
                onChange={e => setRecN(Math.max(1, parseInt(e.target.value) || 1))} />
              {([['daily', t('recUnit.days')], ['weekly', t('recUnit.weeks')], ['monthly', t('recUnit.months')], ['yearly', t('recUnit.years')]] as [string, string][]).map(([unit, label]) => (
                <button type="button" key={unit}
                  className={`nqp-chip${!customOpen && recUnit === unit ? ' active' : ''}`}
                  onClick={() => { setRecUnit(unit); setCustomOpen(false) }}>{label}</button>
              ))}
              <button type="button" className={`nqp-chip${customOpen ? ' active' : ''}`}
                onClick={() => { setCustomOpen(true); setRecUnit(null) }}>{t('prop.recurrenceCustom', 'Personalizado')}</button>
            </div>
            {customOpen && (
              <div className="nqp-rec-days-row">
                {WEEK_ORDER.map(day => (
                  <button type="button" key={day}
                    className={`nqp-rec-day${customDays.includes(day) ? ' active' : ''}`}
                    onClick={() => setCustomDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort((a, b) => a - b))}
                  >{DAY_LETTERS_ES[day]}</button>
                ))}
              </div>
            )}
          </div>

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
