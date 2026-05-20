import { useEffect } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  onClose: () => void
}

interface ShortcutGroup {
  title: string
  shortcuts: { keys: string; desc: string }[]
}

const GROUPS: ShortcutGroup[] = [
  {
    title: 'Navegación',
    shortcuts: [
      { keys: 'Esc', desc: 'Ir a hoy' },
      { keys: '⌘K', desc: 'Búsqueda / captura' },
      { keys: '⌘⇧S', desc: 'Toggle sidebar' },
    ],
  },
  {
    title: 'Notas',
    shortcuts: [
      { keys: '⌘N', desc: 'Nueva nota' },
      { keys: '⌘T', desc: 'Nueva tarea' },
      { keys: '⌘E', desc: 'Nuevo evento' },
      { keys: '⌘R', desc: 'Captura de voz' },
    ],
  },
  {
    title: 'Outliner',
    shortcuts: [
      { keys: 'Tab', desc: 'Indentar' },
      { keys: '⇧Tab', desc: 'Desindentar' },
      { keys: '⌘↑ / ⌘↓', desc: 'Mover nodo' },
      { keys: '⌘D', desc: 'Duplicar' },
      { keys: '⌘B / ⌘I', desc: 'Negrita / cursiva' },
      { keys: '⌘T', desc: 'Toggle tarea (sin selección)' },
      { keys: '⌘Enter', desc: 'Marcar done' },
      { keys: '⌘Space', desc: 'IA inline' },
      { keys: '⌘⇧C', desc: 'Colapsar/expandir todo' },
      { keys: '/', desc: 'Menú de bloques' },
    ],
  },
  {
    title: 'Formato',
    shortcuts: [
      { keys: '⌘Z / ⌘⇧Z', desc: 'Deshacer / Rehacer' },
      { keys: '⌘F', desc: 'Buscar en documento' },
    ],
  },
]

export default function KeyboardShortcutsModal({ onClose }: Props) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box shortcuts-modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Atajos de teclado"
      >
        <div className="modal-header">
          <h2 className="modal-title">Atajos de teclado</h2>
          <button className="modal-close-btn" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className="shortcuts-grid">
          {GROUPS.map(group => (
            <div key={group.title} className="shortcuts-group">
              <h3 className="shortcuts-group-title">{group.title}</h3>
              <ul className="shortcuts-list">
                {group.shortcuts.map(s => (
                  <li key={s.keys} className="shortcuts-item">
                    <kbd className="shortcut-key">{s.keys}</kbd>
                    <span className="shortcut-desc">{s.desc}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="shortcuts-hint">Pulsa <kbd className="shortcut-key">?</kbd> para abrir este panel</p>
      </div>
    </div>,
    document.body
  )
}
