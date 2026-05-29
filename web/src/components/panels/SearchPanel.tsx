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

  // Chip renderer — texto puro, sin caja, igual que el dropdown flotante anterior
  function renderChip(c: { label: string; query: string }, group: 'type' | 'time' | 'status' | 'context') {
    return (
      <button
        key={c.query}
        className={`search-panel-chip ${isChipSelected(c.query) ? 'active' : ''}`}
        onClick={() => toggleChip(c.query, group)}
      >
        {c.label}
      </button>
    )
  }

  return (
    <div className="search-panel">
      {/* Chips arriba — como el saludo en Magic */}
      <div className="search-panel-chips">
        <div className="search-panel-row">{TYPE_CHIPS.map(c => renderChip(c, 'type'))}</div>
        <div className="search-panel-row">{TIME_CHIPS.map(c => renderChip(c, 'time'))}</div>
        <div className="search-panel-row">{STATUS_CHIPS.map(c => renderChip(c, 'status'))}</div>
        {contextChips.length > 0 && (
          <div className="search-panel-row">{contextChips.map(c => renderChip(c, 'context'))}</div>
        )}
      </div>

      {/* Input abajo — como el textarea en Magic, cursor alineado */}
      <div className="search-panel-input-wrap">
        <input
          ref={inputRef}
          type="text"
          className="search-panel-input"
          placeholder="Buscar…"
          value={filterText}
          onChange={handleInputChange}
        />
        {filterText && (
          <button className="search-panel-clear" onClick={() => { onFilter(''); clearAllChips() }}>×</button>
        )}
      </div>
    </div>
  )
}
