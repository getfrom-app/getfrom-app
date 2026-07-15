import { createPortal } from 'react-dom'
import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { store } from '../../store/nodeStore'
import { useToast } from '../Toast'

interface Props {
  onClose: () => void
  parentId?: string | null
}

export default function NewTaskModal({ onClose, parentId }: Props) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  // Vacío por defecto: el input es datetime-local (fecha + hora), así que un
  // valor "YYYY-MM-DD" sin hora es inválido para el input (se ve el placeholder
  // vacío) pero SIGUE siendo un string truthy en el estado — al enviar sin tocar
  // el campo, `due ? ... : null` colaba igualmente y creaba la tarea con
  // due=hoy medianoche UTC (02:00 en Madrid en verano) en vez de sin fecha.
  const [due, setDue] = useState('')
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
          <h2>{t('modal.newTask')}</h2>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-field">
            <input
              ref={inputRef}
              type="text"
              className="modal-input"
              placeholder={t('modal.newTaskPlaceholder')}
              value={text}
              onChange={e => setText(e.target.value)}
              required
            />
          </div>
          <div className="modal-row">
            <div className="modal-field modal-field--half">
              <label className="modal-label">{t('modal.dueDate')}</label>
              <input
                type="datetime-local"
                className="modal-input"
                value={due}
                onChange={e => setDue(e.target.value)}
              />
            </div>
            <div className="modal-field modal-field--half">
              <label className="modal-label">{t('taskPropsModal.priority')}</label>
              <select
                className="modal-select"
                value={priority}
                onChange={e => setPriority(e.target.value as 'high' | 'medium' | 'low' | '')}
              >
                <option value="">{t('kanban.priorityNone')}</option>
                <option value="high">{t('kanban.filterHigh')}</option>
                <option value="medium">{t('kanban.filterMedium')}</option>
                <option value="low">{t('kanban.filterLow')}</option>
              </select>
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn-primary" disabled={!text.trim()}>{t('modal.newTask')}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
