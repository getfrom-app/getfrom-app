import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { parseNaturalDate, getSuggestion } from '../../utils/naturalDate'
import type { RecurrenceConfig } from '../../utils/naturalDate'

export type SlashAction =
  | 'text' | 'task' | 'expand' | 'event' | 'note' | 'nota' | 'bullet'
  | 'heading-1' | 'heading-2' | 'heading-3'
  | 'view-table' | 'view-kanban' | 'view-calendar' | 'view-list'
  | 'agent' | 'prompt' | 'resource'
  | 'move-today' | 'move-tomorrow' | 'move-next-week' | 'move-to' | 'move-to-prompt'
  | 'expand-all' | 'collapse-all'
  | 'count-children'
  | 'ai-summarize' | 'ai-find-tasks' | 'ai-draft-outline' | 'ai-fix-grammar' | 'ai-make-shorter'
  | 'duplicate' | 'delete'
  | 'add-date'
  | 'mirror'
  | 'add-shortcut'
  | 'recurrence'
  | 'whiteboard'

export interface SlashMenuOption {
  label: string
  icon: string | React.ReactNode
  prefix: string
  description: string
  action?: SlashAction
  group?: string
  recurrence?: RecurrenceConfig
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
  { group: 'Objetos', label: 'Pizarra',  icon: '🖊',  prefix: '',      description: 'Pizarra digital para dibujar', action: 'whiteboard' },
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
  // ── Fecha ─────────────────────────────────────────────────────────────────
  { group: 'Fecha', label: 'Fecha…', icon: '📅', prefix: 'mover a ', description: 'Poner fecha: viernes · 29 mayo · en 3 días…', action: 'move-to-prompt' },
  { group: 'Fecha', label: 'Fecha: hoy', icon: '☀️', prefix: '', description: 'Asignar fecha de hoy', action: 'move-today' },
  { group: 'Fecha', label: 'Fecha: mañana', icon: '📆', prefix: '', description: 'Asignar fecha de mañana', action: 'move-tomorrow' },
  { group: 'Fecha', label: 'Fecha: próx. semana', icon: '📋', prefix: '', description: 'Asignar fecha al inicio de la próxima semana', action: 'move-next-week' },
  // ── Árbol ─────────────────────────────────────────────────────────────────
  { group: 'Árbol', label: 'Expandir todo', icon: '▿', prefix: '', description: 'Expandir todos los hijos', action: 'expand-all' },
  { group: 'Árbol', label: 'Colapsar todo', icon: '▸', prefix: '', description: 'Colapsar todos los hijos', action: 'collapse-all' },
  { group: 'Árbol', label: 'Contar hijos', icon: '#', prefix: '', description: 'Mostrar número de nodos hijos', action: 'count-children' },
  { group: 'Árbol', label: 'Duplicar', icon: '⧉', prefix: '', description: 'Duplicar este nodo y sus hijos', action: 'duplicate' },
  { group: 'Árbol', label: 'Espejo',   icon: '⬡', prefix: '', description: 'Insertar un espejo de otra nota aquí', action: 'mirror' },
  // ── IA ────────────────────────────────────────────────────────────────────
  { group: 'IA', label: 'Resumir', icon: '📝', prefix: '', description: 'Resumir el contenido con IA', action: 'ai-summarize' },
  { group: 'IA', label: 'Encontrar tareas', icon: '✓', prefix: '', description: 'Extraer tareas del contenido', action: 'ai-find-tasks' },
  { group: 'IA', label: 'Crear esquema', icon: '📋', prefix: '', description: 'Generar un outline del contenido', action: 'ai-draft-outline' },
  { group: 'IA', label: 'Corregir gramática', icon: '✏️', prefix: '', description: 'Corregir errores gramaticales', action: 'ai-fix-grammar' },
  { group: 'IA', label: 'Hacer más corto', icon: '↔', prefix: '', description: 'Resumir a versión más concisa', action: 'ai-make-shorter' },
  // ── Gestión ───────────────────────────────────────────────────────────────
  // Añadir a atajos eliminado — usar Favorito desde ··· más opciones
  { group: 'Gestión', label: 'Añadir fecha', icon: '🗓', prefix: '', description: 'Asignar fecha de vencimiento', action: 'add-date' },
  { group: 'Gestión', label: 'Eliminar', icon: '🗑', prefix: '', description: 'Eliminar este nodo', action: 'delete' },
]

export interface SlashSelectPayload {
  prefix: string
  action: SlashAction
  moveToDate?: Date
  moveToRecurrence?: RecurrenceConfig
  recurrence?: RecurrenceConfig
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

  // ── Detectar "mover a [fecha]" dinámicamente ──────────────────────────────
  // Activar con o sin espacio final: "mover a", "mover a viernes", "enviar a ..."
  const MOVE_PREFIXES = ['mover a', 'mover al', 'move to', 'enviar a', 'enviar al']
  const ql = query.toLowerCase().trim()
  const movePrefix = MOVE_PREFIXES.find(p => ql.startsWith(p))
  const moveDateQuery = movePrefix ? query.slice(query.toLowerCase().indexOf(movePrefix) + movePrefix.length).trim() : null
  const parsedMove = moveDateQuery ? parseNaturalDate(moveDateQuery) : null
  const isMoveMode = !!movePrefix

  // Filter by query — en modo mover, no mostrar opciones normales
  const filtered = isMoveMode ? [] : OPTIONS.filter(opt =>
    !query ||
    opt.label.toLowerCase().includes(query.toLowerCase()) ||
    opt.description.toLowerCase().includes(query.toLowerCase())
  )

  const [activeIdx, setActiveIdx] = useState(0)

  // Reset selection when filter changes
  useEffect(() => { setActiveIdx(0) }, [query])

  // Position below anchor — evitar cortes en bordes
  useEffect(() => {
    if (!anchorEl) return
    const rect = anchorEl.getBoundingClientRect()
    const menuW = 260
    const menuH = 320
    const margin = 8
    // Vertical: abajo si hay espacio, arriba si no
    const spaceBelow = window.innerHeight - rect.bottom - margin
    const top = spaceBelow >= Math.min(menuH, 200)
      ? rect.bottom + 4
      : Math.max(margin, rect.top - Math.min(menuH, spaceBelow < 120 ? 280 : menuH) - 4)
    // Horizontal: alinear a la izquierda del cursor, sin salirse por la derecha
    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - menuW - margin))
    setPos({ top, left })
  }, [anchorEl])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault(); e.stopPropagation()
        setActiveIdx(i => Math.min(i + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault(); e.stopPropagation()
        setActiveIdx(i => Math.max(i - 1, 0))
      } else if (e.key === 'Tab' && isMoveMode) {
        e.preventDefault(); e.stopPropagation()
        if (parsedMove) {
          onSelect({ prefix: '', action: 'move-to', moveToDate: parsedMove.date, moveToRecurrence: parsedMove.recurrence })
        }
        return
      } else if (e.key === 'Enter') {
        e.preventDefault(); e.stopPropagation()
        if (isMoveMode && parsedMove) {
          onSelect({ prefix: '', action: 'move-to', moveToDate: parsedMove.date, moveToRecurrence: parsedMove.recurrence })
          return
        }
        if (filtered[activeIdx]) {
          const opt = filtered[activeIdx]
          onSelect({ prefix: opt.prefix, action: opt.action, recurrence: opt.recurrence })
        }
      } else if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey, true)
    return () => window.removeEventListener('keydown', handleKey, true)
  }, [activeIdx, filtered, onSelect, onClose, isMoveMode, parsedMove])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])


  // ── Render modo "mover a" ──────────────────────────────────────────────────
  if (isMoveMode) {
    const suggestion = moveDateQuery ? getSuggestion(moveDateQuery) : null
    const EXAMPLES = ['mañana', 'lunes', '29 mayo', 'todos los martes', 'cada mes', 'al 1 de cada mes']

    return createPortal(
      <div ref={menuRef} className="slash-menu slash-menu--move" style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 1000, minWidth: 220 }}>
        {/* Campo con texto tapiz predictivo */}
        <div className="slash-menu-move-field">
          <span className="slash-menu-move-icon">📅</span>
          <span className="slash-menu-move-typed">{moveDateQuery || ''}</span>
          {suggestion && <span className="slash-menu-move-ghost">{suggestion}</span>}
          {!moveDateQuery && <span className="slash-menu-move-placeholder">escribe una fecha…</span>}
        </div>

        {/* Resultado parseado — usa el sistema from-ghost */}
        {parsedMove ? (
          <div style={{ padding: '4px 6px 2px' }}>
            <span className="from-ghost" style={{ marginLeft: 0 }}>
              <span className="from-ghost-text">{parsedMove.label}</span>
              <span className="from-ghost-sep">·</span>
              <span className="from-ghost-key">↵</span>
            </span>
          </div>
        ) : moveDateQuery ? (
          <div className="slash-menu-move-no-match">No reconocido</div>
        ) : (
          <div className="slash-menu-move-examples">
            {EXAMPLES.map(ex => (
              <span key={ex} className="slash-menu-move-example"
                onMouseDown={e => { e.preventDefault(); onSelect({ prefix: '', action: 'move-to', moveToDate: parseNaturalDate(ex)?.date || new Date(), moveToRecurrence: parseNaturalDate(ex)?.recurrence }) }}
              >{ex}</span>
            ))}
          </div>
        )}
      </div>,
      document.body
    )
  }

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
                    onSelect({ prefix: opt.prefix, action: opt.action, recurrence: opt.recurrence })
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
