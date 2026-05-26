import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  onClose: () => void
  children: React.ReactNode
  className?: string
}

/**
 * Modal centrado reusable. Encapsula:
 *  - Backdrop semitransparente
 *  - Click fuera → onClose
 *  - ESC capture → onClose (atrapa ANTES que cualquier router/global handler)
 *  - Fade-in del backdrop + scale-in del contenido
 *
 * Uso: `<CenteredModal onClose={...}><div>contenido</div></CenteredModal>`
 *
 * El contenido recibe el className `.centered-modal-card` por defecto.
 * Pasa `className` para customizar el card (p.ej. `task-props-popup--modal`).
 */
export default function CenteredModal({ onClose, children, className }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey, { capture: true })
    return () => document.removeEventListener('keydown', onKey, { capture: true })
  }, [onClose])

  return createPortal(
    <div
      className="task-props-modal-backdrop"
      onMouseDown={onClose}
      onClick={onClose}
    >
      <div
        ref={cardRef}
        className={`centered-modal-card ${className || ''}`}
        onMouseDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}
