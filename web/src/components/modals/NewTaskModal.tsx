import { createPortal } from 'react-dom'
import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { store } from '../../store/nodeStore'
import { useToast } from '../Toast'
import Icon from '../../v2/components/Icon'
import type { Node } from '../../types'

// Fecha de hoy a medianoche LOCAL, formato datetime-local ("YYYY-MM-DDT00:00")
// — medianoche es la convención de la app para "tarea de todo el día" (sin
// hora concreta), la misma que usa `timeLabel()` para decidir si una tarea
// tiene hora o no.
function todayMidnightLocal(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00`
}

interface Props {
  onClose: () => void
  parentId?: string | null
  // «Tareas para hoy» (Alberto, 22 jul: "se deben crear en el día de hoy por
  // defecto. Ahora mismo se crean sin fecha") — el resto de sitios que abren
  // este modal (sidebar, menú por-contexto) siguen sin fecha por defecto.
  defaultDueToday?: boolean
  // Fecha concreta YYYY-MM-DD a precargar (p.ej. clic en una celda del mes en
  // el planificador). Tiene prioridad sobre `defaultDueToday`.
  defaultDateStr?: string
  // Quien abre el modal puede rematar el nodo recién creado (p. ej. la columna
  // «Tareas» de una tabla le cuelga `_taskOf`/`_taskRow` y hereda el contexto).
  onCreated?: (node: Node) => void
}

export default function NewTaskModal({ onClose, parentId, defaultDueToday, defaultDateStr, onCreated }: Props) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  // Vacío por defecto: el input es datetime-local (fecha + hora), así que un
  // valor "YYYY-MM-DD" sin hora es inválido para el input (se ve el placeholder
  // vacío) pero SIGUE siendo un string truthy en el estado — al enviar sin tocar
  // el campo, `due ? ... : null` colaba igualmente y creaba la tarea con
  // due=hoy medianoche UTC (02:00 en Madrid en verano) en vez de sin fecha.
  const [due, setDue] = useState(defaultDateStr ? `${defaultDateStr}T00:00` : (defaultDueToday ? todayMidnightLocal() : ''))
  const [priority, setPriority] = useState<'high' | 'medium' | 'low' | ''>('')
  // Recurrencia desde el momento de crear (Alberto, 6 sep 2026: "no hay
  // recurrencias en las tareas de las tablas, añádela… mismo modal y mismas
  // opciones que una tarea normal") — mismo formato `unit` / `unit:N` que
  // TaskPropsModal. Sin fecha no tiene sentido: se activa al poner una.
  const [recUnit, setRecUnit] = useState<'' | 'daily' | 'weekly' | 'monthly' | 'yearly'>('')
  const [recN, setRecN] = useState(1)
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
    if (recUnit && due) store.updateNode(node.id, { recurrence: recN === 1 ? recUnit : `${recUnit}:${recN}` })
    onCreated?.(store.getNode(node.id) ?? node)
    showToast(t('ai.actionTaskCreated', 'Tarea creada'))
    onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose()
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="modal-card new-task-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-icon"><Icon name="task" size={18} /></span>
          <h2>{t('modal.newTask')}</h2>
          <button className="modal-close-btn" onClick={onClose} aria-label={t('common.close')}>×</button>
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
          <div className="modal-field">
            <label className="modal-label">{t('taskPropsModal.repeatEvery')}</label>
            <div className="new-task-rec">
              <button type="button" className={`new-task-rec-chip${!recUnit ? ' active' : ''}`} onClick={() => setRecUnit('')}>{t('taskPropsModal.repeatNo')}</button>
              <input type="number" min={1} max={999} className="modal-input new-task-rec-n" value={recN} disabled={!recUnit}
                onChange={e => setRecN(Math.max(1, parseInt(e.target.value) || 1))} />
              {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(u => (
                <button type="button" key={u} className={`new-task-rec-chip${recUnit === u ? ' active' : ''}`}
                  onClick={() => { setRecUnit(u); if (!due) setDue(todayMidnightLocal()) }}>
                  {t(`taskPropsModal.rec${u === 'daily' ? 'Days' : u === 'weekly' ? 'Weeks' : u === 'monthly' ? 'Months' : 'Years'}`)}
                </button>
              ))}
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
