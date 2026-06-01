/**
 * QuickCaptureNode — nodo flotante para captura rápida.
 * Espacio (sin input) → abre este modal → escribe → Enter → guarda en diario de hoy.
 * Soporta slash commands, fechas, recurrencia — igual que cualquier nodo del outliner.
 */
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { store } from '../../store/nodeStore'
import { getTodayDiaryUnderAgenda } from '../../utils/agendaHelper'

interface Props {
  onClose: () => void
}

export default function QuickCaptureNode({ onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'Enter') {
      const text = inputRef.current?.value.trim() || ''
      if (text) {
        const today = getTodayDiaryUnderAgenda()
        const sibs = store.children(today.id)
        const lastOrder = sibs.length > 0 ? Math.max(...sibs.map(s => s.siblingOrder)) : 0
        store.createNode({ text, parentId: today.id, siblingOrder: lastOrder + 1000 })
        store.sync(true).catch(() => {})
      }
      onClose()
    }
  }

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(2px)',
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        boxShadow: '0 8px 40px rgba(0,0,0,0.25)',
        padding: '12px 16px',
        width: 520,
        maxWidth: '90vw',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <span style={{ color: 'var(--text-tertiary)', fontSize: 13, flexShrink: 0 }}>•</span>
        <input
          ref={inputRef}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 15,
            color: 'var(--text-primary)',
            fontFamily: 'inherit',
          }}
          placeholder="Escribe un nodo, tarea o idea... (Enter para guardar)"
          onKeyDown={handleKeyDown}
        />
        <kbd style={{
          fontSize: 10, color: 'var(--text-tertiary)',
          border: '1px solid var(--border)', borderRadius: 4,
          padding: '2px 5px', flexShrink: 0,
        }}>ESC</kbd>
      </div>
    </div>,
    document.body
  )
}
