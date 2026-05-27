import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { getAllHotkeys, formatHotkeyDisplay } from '../../store/hotkeysStore'

interface Props {
  onClose: () => void
}

export default function KeyboardShortcutsModal({ onClose }: Props) {
  const hotkeys = getAllHotkeys()

  // Agrupar por categoría
  const categories = Array.from(new Set(hotkeys.map(h => h.category)))

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
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
          {categories.map(cat => (
            <div key={cat} className="shortcuts-group">
              <h3 className="shortcuts-group-title">{cat}</h3>
              <ul className="shortcuts-list">
                {hotkeys.filter(h => h.category === cat).map(h => (
                  <li key={h.id} className="shortcuts-item">
                    <kbd className={`shortcut-key ${h.isCustom ? 'shortcut-key--custom' : ''}`}>
                      {formatHotkeyDisplay(h)}
                    </kbd>
                    <span className="shortcut-desc">
                      {h.label}
                      {h.configurable && <span className="shortcut-configurable-hint"> · configurable en Ajustes</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="shortcuts-hint">
          Pulsa <kbd className="shortcut-key">?</kbd> para abrir este panel ·
          {' '}<span style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => { onClose(); window.location.href = '/app/settings?tab=hotkeys' }}>Editar atajos →</span>
        </p>
      </div>
    </div>,
    document.body
  )
}
