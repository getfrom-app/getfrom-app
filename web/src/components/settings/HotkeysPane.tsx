/**
 * HotkeysPane — Sección de Ajustes para editar atajos de teclado
 */
import { useState, useEffect } from 'react'
import { getAllHotkeys, setHotkeyKey, resetAllHotkeys, formatHotkeyDisplay, DEFAULT_HOTKEYS } from '../../store/hotkeysStore'

export default function HotkeysPane() {
  const [hotkeys, setHotkeys] = useState(getAllHotkeys)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pendingKey, setPendingKey] = useState('')

  // Recargar cuando cambien
  useEffect(() => {
    function refresh() { setHotkeys(getAllHotkeys()) }
    window.addEventListener('from:hotkeys-changed', refresh)
    return () => window.removeEventListener('from:hotkeys-changed', refresh)
  }, [])

  const categories = Array.from(new Set(hotkeys.map(h => h.category)))
  const configurables = hotkeys.filter(h => h.configurable)
  const hasCustom = configurables.some(h => h.isCustom)

  function startEdit(id: string, currentKey: string) {
    setEditingId(id)
    setPendingKey(currentKey)
  }

  function handleKeyCapture(e: React.KeyboardEvent, id: string) {
    e.preventDefault()
    e.stopPropagation()
    if (e.key === 'Escape') {
      setEditingId(null)
      return
    }
    if (e.key === 'Enter') {
      // Confirmar
      if (pendingKey && pendingKey !== 'Escape' && pendingKey !== 'Enter') {
        setHotkeyKey(id, pendingKey)
      }
      setEditingId(null)
      return
    }
    // Capturar la tecla
    setPendingKey(e.key)
  }

  function saveEdit(id: string) {
    if (pendingKey && pendingKey !== 'Escape' && pendingKey !== 'Enter') {
      setHotkeyKey(id, pendingKey)
    }
    setEditingId(null)
  }

  function resetHotkey(id: string) {
    const def = DEFAULT_HOTKEYS.find(h => h.id === id)
    if (def) setHotkeyKey(id, def.defaultKey)
  }

  return (
    <div className="hotkeys-pane">
      <div className="hotkeys-header">
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Atajos de teclado</h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
            Los atajos marcados con ✎ son configurables. Haz clic en la tecla para cambiarla.
          </p>
        </div>
        {hasCustom && (
          <button
            className="hotkeys-reset-all"
            onClick={() => { resetAllHotkeys(); setHotkeys(getAllHotkeys()) }}
          >
            Restaurar todo
          </button>
        )}
      </div>

      {categories.map(cat => (
        <div key={cat} className="hotkeys-category">
          <div className="hotkeys-category-title">{cat}</div>
          {hotkeys.filter(h => h.category === cat).map(h => (
            <div key={h.id} className="hotkeys-row">
              <div className="hotkeys-info">
                <span className="hotkeys-label">{h.label}</span>
                <span className="hotkeys-desc">{h.description}</span>
              </div>
              <div className="hotkeys-key-wrap">
                {h.configurable ? (
                  editingId === h.id ? (
                    <kbd
                      className="shortcut-key shortcut-key--editing"
                      tabIndex={0}
                      autoFocus
                      onKeyDown={e => handleKeyCapture(e, h.id)}
                      onBlur={() => saveEdit(h.id)}
                    >
                      {pendingKey
                        ? formatHotkeyDisplay({ ...h, currentKey: pendingKey })
                        : '· pulsa tecla ·'}
                    </kbd>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <kbd
                        className={`shortcut-key shortcut-key--editable ${h.isCustom ? 'shortcut-key--custom' : ''}`}
                        title="Clic para cambiar"
                        onClick={() => startEdit(h.id, h.currentKey)}
                      >
                        {formatHotkeyDisplay(h)}
                      </kbd>
                      {h.isCustom && (
                        <button
                          className="hotkeys-reset-btn"
                          title="Restaurar por defecto"
                          onClick={() => resetHotkey(h.id)}
                        >
                          ↺
                        </button>
                      )}
                      <span className="hotkeys-edit-hint">✎</span>
                    </div>
                  )
                ) : (
                  <kbd className="shortcut-key">
                    {formatHotkeyDisplay(h)}
                  </kbd>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
