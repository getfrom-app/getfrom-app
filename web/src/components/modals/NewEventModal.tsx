import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { store } from '../../store/nodeStore'

interface Props {
  onClose: () => void
}

export default function NewEventModal({ onClose }: Props) {
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [notes, setNotes] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const diaryNode = store.todayDiary()
    const node = store.createNode({
      text: title.trim(),
      parentId: diaryNode?.id || null,
      due: startDate ? new Date(startDate).toISOString() : null,
      isTask: true,
    })
    if (endDate) store.updateNode(node.id, { dueEnd: new Date(endDate).toISOString() })
    if (notes.trim()) store.updateNode(node.id, { body: notes.trim() })
    navigate(`/node/${node.id}`)
    onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="modal-card new-event-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-icon">📅</span>
          <h2>Nuevo evento</h2>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
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
          <div className="modal-row">
            <div className="modal-field modal-field--half">
              <label className="modal-label">Fecha inicio</label>
              <input
                type="datetime-local"
                className="modal-input"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
            <div className="modal-field modal-field--half">
              <label className="modal-label">Fecha fin (opcional)</label>
              <input
                type="datetime-local"
                className="modal-input"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="modal-field">
            <label className="modal-label">Notas</label>
            <textarea
              className="modal-input"
              placeholder="Notas del evento..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
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
    </div>
  )
}
