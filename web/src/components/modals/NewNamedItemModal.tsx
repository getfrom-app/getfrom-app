// Modal genérico "nombre de X" — sustituye a window.prompt() (diálogo nativo del
// navegador, sin estilo, no se puede interactuar con él por script) en los sitios
// que solo necesitan pedir un nombre antes de crear algo. Mismo patrón visual que
// NewContextModal.tsx. Primer uso: «Nuevo agente»/«Nuevo prompt» en ElementsPanel.tsx.
import { createPortal } from 'react-dom'
import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  onClose: () => void
  onSubmit: (name: string) => void
  title: string
  icon: string
  placeholder: string
  /** Texto del botón de confirmar — por defecto el mismo `title`. */
  submitLabel?: string
}

export default function NewNamedItemModal({ onClose, onSubmit, title, icon, placeholder, submitLabel }: Props) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onSubmit(trimmed)
    onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose()
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-icon">{icon}</span>
          <h2>{title}</h2>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-field">
            <input
              ref={inputRef}
              type="text"
              className="modal-input"
              placeholder={placeholder}
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn-primary" disabled={!name.trim()}>{submitLabel || title}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
