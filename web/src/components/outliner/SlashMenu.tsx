import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export type SlashAction =
  | 'text' | 'task' | 'expand' | 'event' | 'note' | 'nota' | 'bullet'
  | 'heading-1' | 'heading-2' | 'heading-3'
  | 'view-table' | 'view-kanban' | 'view-calendar' | 'view-list'
  | 'agent' | 'prompt' | 'resource'

export interface SlashMenuOption {
  label: string
  icon: string | React.ReactNode
  prefix: string
  description: string
  action?: SlashAction
  group?: string
}

const OPTIONS: (SlashMenuOption & { action: SlashAction; group: string })[] = [
  // ── Texto ──────────────────────────────────────────────────────────────
  { group: 'Texto', label: 'Texto',      icon: 'T',   prefix: '',      description: 'Párrafo normal',         action: 'text' },
  { group: 'Texto', label: 'Lista',     icon: '–',   prefix: '',      description: 'Lista con guión',        action: 'bullet' },
  { group: 'Texto', label: 'Título 1',   icon: 'H1',  prefix: '# ',    description: 'Encabezado grande',      action: 'heading-1' },
  { group: 'Texto', label: 'Título 2',   icon: 'H2',  prefix: '## ',   description: 'Encabezado mediano',     action: 'heading-2' },
  { group: 'Texto', label: 'Título 3',   icon: 'H3',  prefix: '### ',  description: 'Encabezado pequeño',     action: 'heading-3' },
  { group: 'Texto', label: 'Cita',       icon: '"',   prefix: '> ',    description: 'Bloque de cita',         action: 'text' },
  { group: 'Texto', label: 'Código',     icon: '</>',  prefix: '` ',   description: 'Texto monoespaciado',    action: 'text' },
  { group: 'Texto', label: 'Separador',  icon: '—',   prefix: '---',   description: 'Línea divisoria',        action: 'text' },
  // ── Objetos ─────────────────────────────────────────────────────────────
  { group: 'Objetos', label: 'Nota',     icon: '📄',  prefix: '',      description: 'Sub-nota / página hija', action: 'nota' },
  { group: 'Objetos', label: 'Tarea',    icon: '☑',   prefix: '',      description: 'Convertir en tarea',     action: 'task' },
  { group: 'Objetos', label: 'Evento',   icon: '📅',   prefix: '',      description: 'Evento con fecha/hora',   action: 'event' },
  { group: 'Objetos', label: 'Recurso',  icon: '🔗',   prefix: '',      description: 'Enlace / video / artículo', action: 'resource' },
  { group: 'Objetos', label: 'Ampliar',  icon: '↑',   prefix: '',      description: 'Convierte la tarea en una nota que la contiene', action: 'expand' },
  // ── IA (paridad Mac) ────────────────────────────────────────────────────
  { group: 'IA',      label: 'Agente',   icon: '🤖',  prefix: '',      description: 'Agente que ejecuta tareas con IA', action: 'agent' },
  { group: 'IA',      label: 'Prompt',   icon: '✨',  prefix: '',      description: 'Plantilla de prompt reutilizable', action: 'prompt' },
  // ── Vistas (inline blocks) ──────────────────────────────────────────────
  { group: 'Vistas',  label: 'Lista',      icon: '☰', prefix: '', description: 'Vista lista inline con hijos',  action: 'view-list' },
  { group: 'Vistas',  label: 'Tabla',      icon: '⊞', prefix: '', description: 'Vista tabla inline con hijos', action: 'view-table' },
  { group: 'Vistas',  label: 'Kanban',     icon: '⫴', prefix: '', description: 'Tablero kanban inline',         action: 'view-kanban' },
  { group: 'Vistas',  label: 'Calendario', icon: '📅', prefix: '', description: 'Calendario inline',             action: 'view-calendar' },
]

export interface SlashSelectPayload {
  prefix: string
  action: SlashAction
}

interface Props {
  anchorEl: HTMLElement | null
  query: string   // texto que el usuario ha escrito tras '/'
  onSelect: (payload: SlashSelectPayload) => void
  onClose: () => void
}

export default function SlashMenu({ anchorEl, query, onSelect, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  // Filter by query
  const filtered = OPTIONS.filter(opt =>
    !query ||
    opt.label.toLowerCase().includes(query.toLowerCase()) ||
    opt.description.toLowerCase().includes(query.toLowerCase())
  )

  const [activeIdx, setActiveIdx] = useState(0)

  // Reset selection when filter changes
  useEffect(() => { setActiveIdx(0) }, [query])

  // Position below anchor
  useEffect(() => {
    if (!anchorEl) return
    const rect = anchorEl.getBoundingClientRect()
    const menuH = 280
    const spaceBelow = window.innerHeight - rect.bottom - 8
    const top = spaceBelow > menuH ? rect.bottom + 4 : rect.top - menuH - 4
    setPos({ top, left: Math.min(rect.left, window.innerWidth - 240) })
  }, [anchorEl])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault(); e.stopPropagation()
        setActiveIdx(i => Math.min(i + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault(); e.stopPropagation()
        setActiveIdx(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault(); e.stopPropagation()
        if (filtered[activeIdx]) {
          const opt = filtered[activeIdx]
          onSelect({ prefix: opt.prefix, action: opt.action })
        }
      } else if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey, true)
    return () => window.removeEventListener('keydown', handleKey, true)
  }, [activeIdx, filtered, onSelect, onClose])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  // Group items
  const groups = Array.from(new Set(filtered.map(o => o.group)))

  if (filtered.length === 0) {
    return createPortal(
      <div ref={menuRef} className="slash-menu" style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 1000 }}>
        <div className="slash-menu-empty">Sin resultados para &quot;{query}&quot;</div>
      </div>,
      document.body
    )
  }

  let globalIdx = 0
  return createPortal(
    <div ref={menuRef} className="slash-menu" style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 1000 }}>
      {groups.map(group => {
        const groupItems = filtered.filter(o => o.group === group)
        return (
          <div key={group}>
            <div className="slash-menu-group">{group}</div>
            {groupItems.map(opt => {
              const idx = globalIdx++
              return (
                <button
                  key={opt.label}
                  className={`slash-menu-item ${idx === activeIdx ? 'active' : ''}`}
                  onMouseEnter={() => setActiveIdx(idx)}
                  onMouseDown={e => {
                    e.preventDefault()
                    onSelect({ prefix: opt.prefix, action: opt.action })
                  }}
                >
                  <span className="slash-menu-icon">{opt.icon}</span>
                  <div className="slash-menu-text">
                    <span className="slash-menu-label">{opt.label}</span>
                    <span className="slash-menu-desc">{opt.description}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )
      })}
    </div>,
    document.body
  )
}
