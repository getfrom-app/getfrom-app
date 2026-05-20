import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export interface SlashMenuOption {
  label: string
  icon: string
  prefix: string
  description: string
}

const OPTIONS: SlashMenuOption[] = [
  { label: 'Texto',      icon: 'T',  prefix: '',     description: 'Párrafo normal' },
  { label: 'Título 1',  icon: 'H1', prefix: '# ',   description: 'Encabezado grande' },
  { label: 'Título 2',  icon: 'H2', prefix: '## ',  description: 'Encabezado mediano' },
  { label: 'Título 3',  icon: 'H3', prefix: '### ', description: 'Encabezado pequeño' },
  { label: 'Tarea',     icon: '☑',  prefix: '',     description: 'Convertir en tarea', isTask: true } as SlashMenuOption & { isTask: boolean },
  { label: 'Cita',      icon: '"',  prefix: '> ',   description: 'Bloque de cita' },
  { label: 'Separador', icon: '—',  prefix: '---',  description: 'Línea divisoria' },
]

interface Props {
  anchorEl: HTMLElement | null
  onSelect: (prefix: string, isTask?: boolean) => void
  onClose: () => void
}

export default function SlashMenu({ anchorEl, onSelect, onClose }: Props) {
  const [activeIdx, setActiveIdx] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  // Position menu below anchor
  const [pos, setPos] = useState({ top: 0, left: 0 })
  useEffect(() => {
    if (!anchorEl) return
    const rect = anchorEl.getBoundingClientRect()
    setPos({ top: rect.bottom + 4, left: rect.left })
  }, [anchorEl])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx(i => (i + 1) % OPTIONS.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx(i => (i - 1 + OPTIONS.length) % OPTIONS.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const opt = OPTIONS[activeIdx] as SlashMenuOption & { isTask?: boolean }
        onSelect(opt.prefix, opt.isTask)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey, true)
    return () => window.removeEventListener('keydown', handleKey, true)
  }, [activeIdx, onSelect, onClose])

  // Click outside closes
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  return createPortal(
    <div
      ref={menuRef}
      className="slash-menu"
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 500 }}
    >
      {OPTIONS.map((opt, i) => (
        <button
          key={opt.label}
          className={`slash-menu-item ${i === activeIdx ? 'active' : ''}`}
          onMouseEnter={() => setActiveIdx(i)}
          onMouseDown={e => {
            e.preventDefault()
            const o = opt as SlashMenuOption & { isTask?: boolean }
            onSelect(o.prefix, o.isTask)
          }}
        >
          <span className="slash-menu-icon">{opt.icon}</span>
          <span className="slash-menu-label">{opt.label}</span>
          <span className="slash-menu-desc">{opt.description}</span>
        </button>
      ))}
    </div>,
    document.body
  )
}
