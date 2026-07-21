import { createPortal } from 'react-dom'
import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { createContext, listContextsForParent } from '../../utils/cajones'
import { useToast } from '../Toast'

interface Props {
  onClose: () => void
  /** Contexto ya seleccionado en el sidebar (si se abre desde dentro de uno) —
      se preselecciona como padre, pero sigue siendo editable en el desplegable. */
  defaultParentId?: string | null
  onCreated?: (id: string) => void
}

export default function NewContextModal({ onClose, defaultParentId, onCreated }: Props) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState(defaultParentId || '')
  const inputRef = useRef<HTMLInputElement>(null)
  const { showToast } = useToast()
  const parents = listContextsForParent()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const node = createContext(name.trim(), parentId || null)
    showToast(`✓ ${t('modal.newContextCreatedToast', 'Contexto creado')}`)
    onCreated?.(node.id)
    onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose()
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-icon">📁</span>
          <h2>{t('modal.newContext', 'Nuevo contexto')}</h2>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-field">
            <input
              ref={inputRef}
              type="text"
              className="modal-input"
              placeholder={t('modal.newContextNamePlaceholder', 'Nombre del contexto…')}
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>
          <div className="modal-field">
            <label className="modal-label">{t('modal.newContextParent', 'Contexto padre')}</label>
            <select
              className="modal-select"
              value={parentId}
              onChange={e => setParentId(e.target.value)}
            >
              <option value="">{t('modal.newContextParentNone', 'Ninguno (raíz)')}</option>
              {parents.map(p => (
                <option key={p.id} value={p.id}>{p.text || t('v2.untitled', 'Sin título')}</option>
              ))}
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn-primary" disabled={!name.trim()}>{t('modal.newContext', 'Nuevo contexto')}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
