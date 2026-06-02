/**
 * SearchPanel — Panel de búsqueda lateral derecho
 * Reemplaza el buscador expandible del topbar con un panel tipo MagicChat
 */
import { useState, useEffect, useRef } from 'react'
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

  // Top 5 contextos del nodo 🧠 Contexto (sin useMemo: s.nodes.size no detecta deletedAt)
  const contextRoot = s.allActive().find(n => n.text === '🧠 Contexto' && n.parentId === null)
  const contextChips = contextRoot
    ? s.children(contextRoot.id)
        .filter(n => !n.deletedAt && n.text?.trim())
        .slice(0, 5)
        .map(n => {
          const slug = n.text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '')
          return { label: n.text, query: `@${slug}` }
        })
    : []

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

      {/* Lista de paneles guardados + nodo vacío para crear nuevo */}
      <SavedPanelsList onApply={(q) => onFilter(q)} activeQuery={filterText} />
    </div>
  )
}

// ── Lista de paneles guardados ────────────────────────────────────────────────
function SavedPanelsList({ onApply, activeQuery }: { onApply: (q: string) => void; activeQuery: string }) {
  const s = useStore()
  const [savingPanel, setSavingPanel] = useState(false)
  const [panelName, setPanelName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const panelInputRef = useRef<HTMLInputElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  // Sin useMemo: nodes.size no cambia al marcar deletedAt (muta el Map),
  // así que la lista se recalcula en cada re-render del store (ya garantizado por useStore)
  const atajosNode = getAtajosNode()
  const panels: { id: string; name: string; query: string }[] = atajosNode
    ? s.children(atajosNode.id)
        .filter(n => !n.deletedAt)
        .sort((a, b) => a.siblingOrder - b.siblingOrder)
        .map(n => {
          const sc = getShortcutData(n.id)
          return sc?.query !== undefined ? { id: n.id, name: n.text, query: sc.query } : null
        })
        .filter(Boolean) as { id: string; name: string; query: string }[]
    : []

  function deletePanel(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    store.deleteNode(id)
  }

  function startRename(p: { id: string; name: string }, e: React.MouseEvent) {
    e.stopPropagation()
    setRenamingId(p.id)
    setRenameValue(p.name)
    setTimeout(() => { renameInputRef.current?.focus(); renameInputRef.current?.select() }, 20)
  }

  function confirmRename() {
    if (!renamingId) return
    const trimmed = renameValue.trim()
    if (trimmed) store.updateNode(renamingId, { text: trimmed })
    setRenamingId(null)
    setRenameValue('')
  }

  function cancelRename() {
    setRenamingId(null)
    setRenameValue('')
  }

  function startSaving() {
    setSavingPanel(true)
    setPanelName(activeQuery)
    setTimeout(() => { panelInputRef.current?.focus(); panelInputRef.current?.select() }, 30)
  }

  function confirmSave() {
    if (panelName.trim()) createFilterShortcut(panelName.trim(), activeQuery)
    setSavingPanel(false)
    setPanelName('')
  }

  if (panels.length === 0 && !activeQuery) return null

  return (
    <div style={{ borderTop: '1px solid var(--border)', marginTop: 4 }}>
      {panels.map(p => {
        const isActive = activeQuery === p.query
        const isRenaming = renamingId === p.id
        const isHovered = hoveredId === p.id

        return (
          <div
            key={p.id}
            onClick={() => { if (!isRenaming) onApply(isActive ? '' : p.query) }}
            onMouseEnter={() => setHoveredId(p.id)}
            onMouseLeave={() => setHoveredId(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 8px 5px 12px', cursor: isRenaming ? 'default' : 'pointer', fontSize: 13,
              color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
              background: isActive ? 'var(--bg-hover)' : isHovered ? 'var(--bg-hover)' : 'transparent',
            }}
          >
            <span style={{ fontSize: 12, opacity: 0.6, flexShrink: 0 }}>◈</span>

            {isRenaming ? (
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onClick={e => e.stopPropagation()}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); confirmRename() }
                  if (e.key === 'Escape') { e.preventDefault(); cancelRename() }
                }}
                onBlur={confirmRename}
                style={{
                  flex: 1, border: 'none', outline: 'none',
                  background: 'transparent', fontSize: 13,
                  color: 'var(--text-primary)', fontFamily: 'inherit',
                }}
              />
            ) : (
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.name}
              </span>
            )}

            {/* Botones: sólo visibles en hover o cuando se está renombrando */}
            {!isRenaming && (isHovered || isActive) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                <button
                  title="Renombrar"
                  onClick={e => startRename(p, e)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-tertiary)', fontSize: 12,
                    padding: '2px 4px', borderRadius: 3, lineHeight: 1,
                    display: 'flex', alignItems: 'center',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                >
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11.5 2.5a1.5 1.5 0 0 1 2.12 2.12L5 13.25l-3 .75.75-3z"/>
                  </svg>
                </button>
                <button
                  title="Eliminar"
                  onClick={e => deletePanel(p.id, e)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-tertiary)', fontSize: 14,
                    padding: '2px 4px', borderRadius: 3, lineHeight: 1,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-error, #e53e3e)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                >×</button>
              </div>
            )}
          </div>
        )
      })}

      {/* Fila para guardar la búsqueda activa como filtro */}
      {activeQuery && !savingPanel && (
        <div
          onClick={startSaving}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', cursor: 'text', fontSize: 13, color: 'var(--text-tertiary)' }}
        >
          <span style={{ fontSize: 12, opacity: 0.4, flexShrink: 0 }}>◈</span>
          <span style={{ fontStyle: 'italic', opacity: 0.5 }}>Nuevo filtro…</span>
        </div>
      )}
      {activeQuery && savingPanel && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px' }}>
          <span style={{ fontSize: 12, opacity: 0.6, flexShrink: 0 }}>◈</span>
          <input
            ref={panelInputRef}
            value={panelName}
            onChange={e => setPanelName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); confirmSave() }
              if (e.key === 'Escape') { setSavingPanel(false); setPanelName('') }
            }}
            onBlur={() => { if (panelName.trim()) confirmSave(); else { setSavingPanel(false); setPanelName('') } }}
            placeholder="Nombre del filtro…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit' }}
          />
        </div>
      )}
    </div>
  )
}
