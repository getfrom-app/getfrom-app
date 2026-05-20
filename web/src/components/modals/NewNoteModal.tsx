import { createPortal } from 'react-dom'
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { store } from '../../store/nodeStore'

interface Template {
  id: string
  name: string
  icon: string
  text: string
  body?: string
  types?: string[]
}

const TEMPLATES: Template[] = [
  { id: 'blank', name: 'Nota en blanco', icon: '📄', text: '', body: '' },
  { id: 'meeting', name: 'Reunión', icon: '🤝', text: 'Reunión - ', body: '## Objetivo\n\n## Asistentes\n\n## Notas\n\n## Próximos pasos\n', types: ['reunión'] },
  { id: 'project', name: 'Proyecto', icon: '🚀', text: 'Proyecto - ', body: '## Objetivo\n\n## Alcance\n\n## Tareas clave\n\n## Notas\n', types: ['proyecto'] },
  { id: 'decision', name: 'Decisión', icon: '⚖️', text: 'Decisión: ', body: '## Contexto\n\n## Opciones consideradas\n\n## Decisión tomada\n\n## Motivo\n', types: ['decisión'] },
  { id: 'review', name: 'Revisión semanal', icon: '📊', text: 'Revisión semanal', body: '## Logros\n\n## Pendiente\n\n## Objetivos próxima semana\n' },
  { id: 'idea', name: 'Idea', icon: '💡', text: 'Idea: ', body: '## Descripción\n\n## Siguiente paso\n', types: ['idea'] },
  { id: 'notes', name: 'Apuntes', icon: '📓', text: 'Apuntes: ', body: '## Contexto\n\n## Puntos clave\n\n## Preguntas\n', types: ['apuntes'] },
  { id: 'task-list', name: 'Lista de tareas', icon: '✅', text: 'Tareas: ', body: '- [ ] \n- [ ] \n- [ ] \n', types: [] },
  { id: 'reading', name: 'Lectura', icon: '📚', text: 'Resumen: ', body: '## ¿De qué trata?\n\n## Ideas principales\n\n## Citas\n\n## Acción a tomar\n', types: ['lectura'] },
  { id: 'daily', name: 'Plan del día', icon: '☀️', text: new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }), body: '## Objetivos\n- \n\n## Tareas\n- [ ] \n- [ ] \n\n## Notas\n', types: [] },
]

interface Props {
  parentId?: string | null
  onClose: () => void
}

export default function NewNoteModal({ parentId, onClose }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<Template>(TEMPLATES[0])
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => { inputRef.current?.focus() }, [])

  function handleCreate() {
    const text = title.trim() || selectedTemplate.text || 'Sin título'
    const node = store.createNode({
      text: text + (selectedTemplate.text && !title ? new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : ''),
      parentId: parentId !== undefined ? parentId : null,
      types: selectedTemplate.types,
    })
    const body = description.trim()
      ? description.trim() + (selectedTemplate.body ? '\n\n' + selectedTemplate.body : '')
      : selectedTemplate.body
    if (body) {
      store.updateNode(node.id, { body })
    }
    navigate(`/node/${node.id}`)
    onClose()
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card new-note-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-icon">✎</span>
          <h2>Nueva nota</h2>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-field">
          <input
            ref={inputRef}
            type="text"
            className="modal-input"
            placeholder="Nombre de la nota..."
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') onClose() }}
          />
        </div>

        <div className="modal-field">
          <textarea
            className="modal-description"
            placeholder="Descripción (opcional)"
            value={description}
            rows={2}
            onChange={e => setDescription(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') onClose() }}
          />
        </div>

        <div className="note-templates">
          <div className="note-templates-label">Plantilla</div>
          <div className="note-templates-grid">
            {TEMPLATES.map(t => (
              <button
                key={t.id}
                className={`note-template-btn ${selectedTemplate.id === t.id ? 'active' : ''}`}
                onClick={() => setSelectedTemplate(t)}
              >
                <span className="note-template-icon">{t.icon}</span>
                <span className="note-template-name">{t.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleCreate}>Crear nota</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
