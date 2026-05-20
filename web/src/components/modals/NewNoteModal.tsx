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
]

interface Props {
  parentId?: string | null
  onClose: () => void
}

export default function NewNoteModal({ parentId, onClose }: Props) {
  const [title, setTitle] = useState('')
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
    if (selectedTemplate.body) {
      store.updateNode(node.id, { body: selectedTemplate.body })
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
