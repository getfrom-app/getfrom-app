/**
 * SearchPanel — Panel de búsqueda lateral derecho
 * Reemplaza el buscador expandible del topbar con un panel tipo MagicChat
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import { createFilterShortcut, getAtajosNode, getShortcutData } from '../../utils/atajosHelper'

interface Props {
  filterText: string
  onFilter: (text: string) => void
  onClose: () => void
}

const TYPE_CHIPS = [
  { labelKey: 'search.chipNote',    query: 'nota' },
  { labelKey: 'search.chipTask',    query: 'tarea' },
  { labelKey: 'search.chipEvent',   query: 'evento' },
  { labelKey: 'search.chipFile',    query: 'archivo' },
  { labelKey: 'search.chipLink',    query: 'enlace' },
]
const TIME_CHIPS = [
  { labelKey: 'search.chipToday',     query: 'hoy' },
  { labelKey: 'search.chipThisWeek',  query: 'semana' },
  { labelKey: 'search.chipThisMonth', query: 'mes' },
  { labelKey: 'search.chipPast',      query: 'pasado' },
  { labelKey: 'search.chipFuture',    query: 'futuro' },
]
const STATUS_CHIPS = [
  { labelKey: 'search.chipPending', query: 'pendiente' },
  { labelKey: 'search.chipDone',    query: 'hecho' },
]

function cartesian(arrays: string[][]): string[][] {
  return arrays.reduce<string[][]>(
    (acc, arr) => acc.flatMap(combo => arr.map(item => [...combo, item])),
    [[]]
  )
}

export default function SearchPanel({ filterText, onFilter, onClose }: Props) {
  const s = useStore()
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)

  const [chipTypes,    setChipTypes]    = useState<Set<string>>(new Set())
  const [chipTimes,    setChipTimes]    = useState<Set<string>>(new Set())
  const [chipStatuses, setChipStatuses] = useState<Set<string>>(new Set())
  const [chipContexts, setChipContexts] = useState<Set<string>>(new Set())
  const [savingPanel, setSavingPanel]   = useState(false)
  const [panelName,   setPanelName]     = useState('')
  const panelInputRef = useRef<HTMLInputElement>(null)

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
    window.dispatchEvent(new CustomEvent('from:filter-changed', { detail: { value: query } }))
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
    const val = e.target.value
    onFilter(val)
    if (val.trim().length > 0) {
      window.dispatchEvent(new CustomEvent('from:filter-changed', { detail: { value: val } }))
    }
  }

  // Chip renderer — texto puro, sin caja, igual que el dropdown flotante anterior
  function renderChip(c: { labelKey?: string; label?: string; query: string }, group: 'type' | 'time' | 'status' | 'context') {
    return (
      <button
        key={c.query}
        className={`search-panel-chip ${isChipSelected(c.query) ? 'active' : ''}`}
        onClick={() => toggleChip(c.query, group)}
      >
        {c.labelKey ? t(c.labelKey) : c.label}
      </button>
    )
  }

  return (
    <div
      className="search-panel"
      onClick={e => {
        const target = e.target as HTMLElement
        if (!target.closest('button') && !target.closest('a') && !target.closest('input')) {
          inputRef.current?.focus()
        }
      }}
    >
      {/* Input arriba — cursor visible */}
      <div className="search-panel-input-wrap">
        <input
          ref={inputRef}
          type="text"
          className="search-panel-input"
          placeholder={t('search.searchPlaceholder')}
          value={filterText}
          onChange={handleInputChange}
        />
        {filterText && (
          <button className="search-panel-clear" onClick={() => { onFilter(''); clearAllChips() }}>×</button>
        )}
      </div>

      {/* Chips debajo */}
      <div className="search-panel-chips">
        <div className="search-panel-row">{TYPE_CHIPS.map(c => renderChip(c, 'type'))}</div>
        <div className="search-panel-row">{TIME_CHIPS.map(c => renderChip(c, 'time'))}</div>
        <div className="search-panel-row">{STATUS_CHIPS.map(c => renderChip(c, 'status'))}</div>
        {contextChips.length > 0 && (
          <div className="search-panel-row">{contextChips.map(c => renderChip(c, 'context'))}</div>
        )}
      </div>

      {/* Guardar como panel — visible cuando hay filtro activo */}
      {filterText && !savingPanel && (
        <div style={{ padding: '8px 12px 4px' }}>
          <button
            onClick={() => {
              setSavingPanel(true)
              setPanelName(filterText)
              setTimeout(() => { panelInputRef.current?.focus(); panelInputRef.current?.select() }, 30)
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'none', border: '1px solid var(--border)', borderRadius: 6,
              cursor: 'pointer', padding: '5px 10px', fontSize: 12,
              color: 'var(--text-secondary)', width: '100%',
            }}
          >
            <span style={{ fontSize: 14 }}>◈</span> Guardar como panel
          </button>
        </div>
      )}
      {filterText && savingPanel && (
        <div style={{ padding: '8px 12px', display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            ref={panelInputRef}
            value={panelName}
            onChange={e => setPanelName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && panelName.trim()) {
                createFilterShortcut(panelName.trim(), filterText)
                setSavingPanel(false)
                setPanelName('')
              }
              if (e.key === 'Escape') { setSavingPanel(false); setPanelName('') }
            }}
            placeholder="Nombre del panel…"
            style={{
              flex: 1, border: '1px solid var(--border)', borderRadius: 6,
              padding: '4px 8px', fontSize: 12, background: 'var(--bg-secondary)',
              color: 'var(--text-primary)', outline: 'none',
            }}
          />
          <button
            onClick={() => { if (panelName.trim()) { createFilterShortcut(panelName.trim(), filterText); setSavingPanel(false); setPanelName('') } }}
            style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}
          >◈</button>
          <button
            onClick={() => { setSavingPanel(false); setPanelName('') }}
            style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 16, padding: '0 2px' }}
          >×</button>
        </div>
      )}

      {/* Lista de paneles guardados */}
      <SavedPanelsList onApply={(q) => { onFilter(q); setSavingPanel(false) }} activeQuery={filterText} />
    </div>
  )
}

// ── Lista de paneles guardados ────────────────────────────────────────────────
function SavedPanelsList({ onApply, activeQuery }: { onApply: (q: string) => void; activeQuery: string }) {
  const s = useStore()

  const panels = useMemo(() => {
    const atajosNode = getAtajosNode()
    if (!atajosNode) return []
    return s.children(atajosNode.id)
      .filter(n => !n.deletedAt)
      .sort((a, b) => a.siblingOrder - b.siblingOrder)
      .map(n => {
        const sc = getShortcutData(n.id)
        return sc?.query !== undefined ? { id: n.id, name: n.text, query: sc.query } : null
      })
      .filter(Boolean) as { id: string; name: string; query: string }[]
  }, [s.nodes.size]) // eslint-disable-line react-hooks/exhaustive-deps

  if (panels.length === 0) return null

  function deletePanel(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    store.deleteNode(id)
  }

  return (
    <div style={{ borderTop: '1px solid var(--border)', marginTop: 4 }}>
      <div style={{ padding: '8px 12px 4px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)' }}>
        Paneles
      </div>
      {panels.map(p => {
        const isActive = activeQuery === p.query
        return (
          <div
            key={p.id}
            onClick={() => onApply(isActive ? '' : p.query)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 12px', cursor: 'pointer', fontSize: 13,
              color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
              background: isActive ? 'var(--bg-hover)' : 'transparent',
            }}
            onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
            onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            <span style={{ fontSize: 12, opacity: 0.6, flexShrink: 0 }}>◈</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            <button
              onClick={e => deletePanel(p.id, e)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 14, padding: '0 2px', opacity: 0, flexShrink: 0 }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
            >×</button>
          </div>
        )
      })}
    </div>
  )
}
