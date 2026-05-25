import { createPortal } from 'react-dom'
import { useState, useRef, useEffect } from 'react'
import { store } from '../../store/nodeStore'
import { useToast } from '../Toast'

interface Props {
  onClose: () => void
  parentId?: string | null
}

export default function NewTaskModal({ onClose, parentId }: Props) {
  const [text, setText] = useState('')
  const [due, setDue] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  })
  const [priority, setPriority] = useState<'high' | 'medium' | 'low' | ''>('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { showToast } = useToast()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    const diaryNode = store.todayDiary()
    const node = store.createNode({
      text: text.trim(),
      parentId: parentId !== undefined ? parentId : (diaryNode?.id || null),
      isTask: true,
      due: due ? new Date(due).toISOString() : null,
    })
    if (priority) store.updateNode(node.id, { priority: priority as 'high' | 'medium' | 'low' })
    showToast('✓ Tarea creada')
    onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose()
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="modal-card new-task-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-icon">✓</span>
          <h2>Nueva tarea</h2>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-field">
            <input
              ref={inputRef}
              type="text"
              className="modal-input"
              placeholder="Nombre de la tarea..."
              value={text}
              onChange={e => setText(e.target.value)}
              required
            />
          </div>
          <div className="modal-row">
            <div className="modal-field modal-field--half">
              <label className="modal-label">Fecha límite</label>
              <input
                type="datetime-local"
                className="modal-input"
                value={due}
                onChange={e => setDue(e.target.value)}
              />
            </div>
            <div className="modal-field modal-field--half">
              <label className="modal-label">Prioridad</label>
              <select
                className="modal-select"
                value={priority}
                onChange={e => setPriority(e.target.value as 'high' | 'medium' | 'low' | '')}
              >
                <option value="">Sin prioridad</option>
                <option value="high">🔴 Alta</option>
                <option value="medium">🟡 Media</option>
                <option value="low">⚪ Baja</option>
              </select>
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={!text.trim()}>Crear tarea</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
