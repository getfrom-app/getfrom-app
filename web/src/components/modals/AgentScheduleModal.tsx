// AgentScheduleModal — programación de un agente (hora, repetición, expiración
// opcional). Mismo modal visual que NewTaskModal (Alberto, 15 jul: "pon un modal
// como el de las tareas, mismo modal pero ligeramente modificado"), pero
// adaptado al formato de schedule del agente ("daily:HH:MM" / "weekly:D:HH:MM")
// en vez del `due`/`recurrence` de una tarea.
import { createPortal } from 'react-dom'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

type Freq = 'none' | 'daily' | 'weekly'

interface Props {
  schedule: string           // '' | 'daily:HH:MM' | 'weekly:D:HH:MM'
  expiresAt: string          // '' | ISO
  onClose: () => void
  onSave: (schedule: string, expiresAt: string) => void
}

function parseSchedule(schedule: string): { freq: Freq; time: string; day: number } {
  if (schedule.startsWith('daily:')) return { freq: 'daily', time: schedule.slice(6), day: 1 }
  if (schedule.startsWith('weekly:')) {
    const [, d, t] = schedule.split(':').length === 3 ? schedule.split(':') : ['', '1', '09:00']
    return { freq: 'weekly', time: t || '09:00', day: parseInt(d) || 1 }
  }
  return { freq: 'none', time: '09:00', day: 1 }
}

export default function AgentScheduleModal({ schedule, expiresAt, onClose, onSave }: Props) {
  const { t } = useTranslation()
  const initial = parseSchedule(schedule)
  const [freq, setFreq] = useState<Freq>(initial.freq)
  const [time, setTime] = useState(initial.time)
  const [day, setDay] = useState(initial.day)
  const [expires, setExpires] = useState(() => expiresAt ? expiresAt.slice(0, 10) : '')

  const DAYS = [
    { v: 1, l: t('day.mon', 'lun') }, { v: 2, l: t('day.tue', 'mar') }, { v: 3, l: t('day.wed', 'mié') },
    { v: 4, l: t('day.thu', 'jue') }, { v: 5, l: t('day.fri', 'vie') }, { v: 6, l: t('day.sat', 'sáb') },
    { v: 0, l: t('day.sun', 'dom') },
  ]

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const sched = freq === 'none' ? '' : freq === 'daily' ? `daily:${time}` : `weekly:${day}:${time}`
    const exp = freq === 'none' || !expires ? '' : new Date(`${expires}T23:59:59`).toISOString()
    onSave(sched, exp)
    onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose()
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-icon">📅</span>
          <h2>{t('agents.scheduleTitle', 'Programación')}</h2>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-field">
            <label className="modal-label">{t('agents.scheduleFrequency', 'Repetición')}</label>
            <div className="nqp-chips-row">
              <button type="button" className={`nqp-chip${freq === 'none' ? ' active' : ''}`} onClick={() => setFreq('none')}>
                {t('agents.scheduleNone', 'Sin programar')}
              </button>
              <button type="button" className={`nqp-chip${freq === 'daily' ? ' active' : ''}`} onClick={() => setFreq('daily')}>
                {t('agents.scheduleDaily', 'Diario')}
              </button>
              <button type="button" className={`nqp-chip${freq === 'weekly' ? ' active' : ''}`} onClick={() => setFreq('weekly')}>
                {t('agents.scheduleWeekly', 'Semanal')}
              </button>
            </div>
          </div>

          {freq !== 'none' && (
            <div className="modal-row">
              <div className="modal-field modal-field--half">
                <label className="modal-label">{t('agents.scheduleTime', 'Hora')}</label>
                <input type="time" className="modal-input" value={time} onChange={e => setTime(e.target.value)} required />
              </div>
              {freq === 'weekly' && (
                <div className="modal-field modal-field--half">
                  <label className="modal-label">{t('agents.scheduleDay', 'Día')}</label>
                  <div className="nqp-chips-row">
                    {DAYS.map(d => (
                      <button key={d.v} type="button" className={`nqp-chip${day === d.v ? ' active' : ''}`} onClick={() => setDay(d.v)}>
                        {d.l}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {freq !== 'none' && (
            <div className="modal-field">
              <label className="modal-label">{t('agents.scheduleExpires', 'Expira (opcional)')}</label>
              <input
                type="date"
                className="modal-input"
                value={expires}
                onChange={e => setExpires(e.target.value)}
                placeholder={t('agents.scheduleNoExpiry', 'Sin expiración')}
              />
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>{t('common.cancel', 'Cancelar')}</button>
            <button type="submit" className="btn-primary">{t('common.save', 'Guardar')}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
