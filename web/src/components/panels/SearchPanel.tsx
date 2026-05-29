/**
 * SearchPanel — Panel de búsqueda lateral derecho
 * Reemplaza el buscador expandible del topbar con un panel tipo MagicChat
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import { store, useStore } from '../../store/nodeStore'

interface Props {
  filterText: string
  onFilter: (text: string) => void
  onClose: () => void
}

const TYPE_CHIPS = [
  { label: 'Nota',    query: 'nota' },
  { label: 'Tarea',   query: 'tarea' },
  { label: 'Evento',  query: 'evento' },
  { label: 'Archivo', query: 'archivo' },
  { label: 'Enlace',  query: 'enlace' },
]
const TIME_CHIPS = [
  { label: 'Hoy',         query: 'hoy' },
  { label: 'Esta semana', query: 'semana' },
  { label: 'Este mes',    query: 'mes' },
  { label: 'Pasado',      query: 'pasado' },
  { label: 'Futuro',      query: 'futuro' },
]
const STATUS_CHIPS = [
  { label: 'Pendiente', query: 'pendiente' },
  { label: 'Hecho',     query: 'hecho' },
]

function cartesian(arrays: string[][]): string[][] {
  return arrays.reduce<string[][]>(
    (acc, arr) => acc.flatMap(combo => arr.map(item => [...combo, item])),
    [[]]
  )
}

export default function SearchPanel({ filterText, onFilter, onClose }: Props) {
  const s = useStore()
  const inputRef = useRef<HTMLInputElement>(null)

  const [chipTypes,    setChipTypes]    = useState<Set<string>>(new Set())
  const [chipTimes,    setChipTimes]    = useState<Set<string>>(new Set())
  const [chipStatuses, setChipStatuses] = useState<Set<string>>(new Set())
  const [chipContexts, setChipContexts] = useState<Set<string>>(new Set())

  // Top 5 contextos del nodo 🧠 Contexto
  const contextChips = useMemo(() => {
    const root = s.allActive().find(n => n.text === '🧠 Contexto' && n.parentId === null)
    if (!root) return []
    return s.children(root.id)
      .filter(n => !n.deletedAt && n.text?.trim())
      .slice(0, 5)
      .map(n => {
        const slug = n.text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '')
        return { label: n.text, query: `@${slug}` }
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.nodes.size])

  // Focus on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleClose() {
    onFilter('')
    clearAllChips()
    onClose()
  }

  function clearAllChips() {
    setChipTypes(new Set())
    setChipTimes(new Set())
    setChipStatuses(new Set())
    setChipContexts(new Set())
  }

  function toggleChip(query: string, group: 'type' | 'time' | 'status' | 'context') {
    const setter = { type: setChipTypes, time: setChipTimes, status: setChipStatuses, context: setChipContexts }[group]
    setter(prev => {
      const next = new Set(prev)
      next.has(query) ? next.delete(query) : next.add(query)
      return next
    })
  }

  function isChipSelected(query: string) {
    return chipTypes.has(query) || chipTimes.has(query) || chipStatuses.has(query) || chipContexts.has(query)
  }

  // Recalcular query cuando cambian los chips
  useEffect(() => {
    const types    = [...chipTypes]
    const times    = [...chipTimes]
    const statuses = [...chipStatuses]
    const contexts = [...chipContexts]

    if (!types.length && !times.length && !statuses.length && !contexts.length) {
      // Solo limpiar si no hay texto manual en el input
      if (!inputRef.current?.value) {
        onFilter('')
      }
      return
    }

    const groups = [types, times, statuses, contexts].filter(g => g.length > 0)
    const combos = cartesian(groups)
    const query = combos.map(combo => combo.join(' y ')).join(' o ')
    onFilter(query + ' ')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chipTypes, chipTimes, chipStatuses, chipContexts])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    onFilter(e.target.value)
  }

  return (
    <div
      className="search-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-primary)',
        borderLeft: '1px solid var(--border)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Buscar</span>
        <button
          className="wf-topbar-btn"
          onClick={handleClose}
          title="Cerrar (Escape)"
          style={{ marginRight: -4 }}
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Search input */}
      <div style={{ padding: '12px 14px 8px', flexShrink: 0 }}>
        <input
          ref={inputRef}
          type="text"
          className="wf-topbar-filter-input"
          placeholder="Buscar..."
          value={filterText}
          onChange={handleInputChange}
          style={{
            width: '100%',
            fontSize: 15,
            padding: '8px 10px',
            border: '1.5px solid var(--border)',
            borderRadius: 8,
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Chips */}
      <div style={{ padding: '4px 14px 12px', overflowY: 'auto', flex: 1 }}>
        {/* TYPE */}
        <div style={{ marginBottom: 6 }}>
          {TYPE_CHIPS.map(c => (
            <button
              key={c.query}
              className={`wf-filter-chip ${isChipSelected(c.query) ? 'active' : ''}`}
              onClick={() => toggleChip(c.query, 'type')}
            >
              {c.label}
            </button>
          ))}
        </div>

        <span className="wf-filter-chip-sep" />

        {/* TIME */}
        <div style={{ marginBottom: 6 }}>
          {TIME_CHIPS.map(c => (
            <button
              key={c.query}
              className={`wf-filter-chip ${isChipSelected(c.query) ? 'active' : ''}`}
              onClick={() => toggleChip(c.query, 'time')}
            >
              {c.label}
            </button>
          ))}
        </div>

        <span className="wf-filter-chip-sep" />

        {/* STATUS */}
        <div style={{ marginBottom: 6 }}>
          {STATUS_CHIPS.map(c => (
            <button
              key={c.query}
              className={`wf-filter-chip ${isChipSelected(c.query) ? 'active' : ''}`}
              onClick={() => toggleChip(c.query, 'status')}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* CONTEXTS */}
        {contextChips.length > 0 && (
          <>
            <span className="wf-filter-chip-sep" />
            <div style={{ marginBottom: 6 }}>
              {contextChips.map(c => (
                <button
                  key={c.query}
                  className={`wf-filter-chip ${isChipSelected(c.query) ? 'active' : ''}`}
                  onClick={() => toggleChip(c.query, 'context')}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
