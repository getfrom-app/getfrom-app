import { createPortal } from 'react-dom'
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { store } from '../../store/nodeStore'
import { useToast } from '../Toast'

interface Props {
  onClose: () => void
}

export default function QuickCapturePanel({ onClose }: Props) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [text, setText] = useState('')
  const [isTask, setIsTask] = useState(false)
  const [isFavorite, setIsFavorite] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { textareaRef.current?.focus() }, [])

  function handleSave(openNode = false) {
    const trimmed = text.trim()
    if (!trimmed) { onClose(); return }

    const diary = store.todayDiary()
    const node = store.createNode({
      text: trimmed.split('\n')[0], // Primera línea como título
      parentId: diary?.id || null,
      isTask,
    })

    // Si hay más líneas, se guardan como body
    const bodyLines = trimmed.split('\n').slice(1).join('\n').trim()
    if (bodyLines) store.updateNode(node.id, { body: bodyLines })
    if (isFavorite) store.updateNode(node.id, { isFavorite: true })

    showToast(`✓ ${isTask ? 'Tarea' : 'Nota'} guardada`)
    if (openNode) {
      navigate(`/node/${node.id}`)
    }
    onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose()
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
      e.preventDefault()
      handleSave(true)
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSave(false)
    }
  }

  return createPortal(
    <div className="quick-capture-overlay" onClick={onClose}>
      <div className="quick-capture-panel" onClick={e => e.stopPropagation()}>
        <div className="quick-capture-header">
          <span className="quick-capture-title">✎ Captura rápida</span>
          <div className="quick-capture-toggles">
            <button
              className={`quick-capture-toggle ${isTask ? 'active' : ''}`}
              onClick={() => setIsTask(v => !v)}
              title="Crear como tarea"
            >
              {isTask ? '○ Tarea' : '○ Nota'}
            </button>
            <button
              className={`quick-capture-toggle ${isFavorite ? 'active' : ''}`}
              onClick={() => setIsFavorite(v => !v)}
              title="Añadir a favoritos"
            >
              {isFavorite ? '★' : '☆'}
            </button>
          </div>
          <button className="quick-capture-close" onClick={onClose}>×</button>
        </div>
        <textarea
          ref={textareaRef}
          className="quick-capture-textarea"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Captura una idea, tarea o nota..."
          rows={4}
        />
        <div className="quick-capture-actions">
          <div className="quick-capture-hints">
            <kbd>⌘Enter</kbd> guardar · <kbd>⌘⇧Enter</kbd> guardar y abrir · <kbd>Esc</kbd> cancelar
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="btn-primary" onClick={() => handleSave(false)} disabled={!text.trim()}>
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
