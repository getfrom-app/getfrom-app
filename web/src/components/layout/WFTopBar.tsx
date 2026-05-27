/**
 * WFTopBar — Top bar estilo Workflowy
 * 🏠 › Padre › Nodo actual   [filtro con categorías]   ⌘K  ···
 */
import { useNavigate, useLocation } from 'react-router-dom'
import { useStore } from '../../store/nodeStore'
import { useTheme } from '../../hooks/useTheme'
import { useState, useRef, useEffect, useMemo } from 'react'
import { addFilterShortcut, getShortcuts } from '../../store/shortcutsStore'
import { ensureDayPath } from '../../utils/agendaHelper'

interface Props {
  onFilter: (text: string) => void
  filterText: string
  onCommandPalette: () => void
  onLogout: () => void
  onOpenSettings: () => void
  onToggleSidebar: () => void
  sidebarOpen: boolean
}

// ── Categorías del filtro ──────────────────────────────────────────────────
type FilterCategory = 'tags' | 'dates' | 'tasks' | null

const DATE_CHIPS = [
  { label: 'Hoy',        query: 'hoy' },
  { label: 'Mañana',     query: 'mañana' },
  { label: 'Esta semana',query: 'semana' },
  { label: 'Vencido',    query: 'vencido' },
]
const TASK_CHIPS = [
  { label: 'Pendientes', query: 'pendiente' },
  { label: 'Hechos',     query: 'hecho' },
  { label: 'Tareas hoy', query: 'hoy tarea' },
  { label: 'Eventos',    query: 'evento' },
]

export default function WFTopBar({
  onFilter,
  filterText,
  onCommandPalette,
  onLogout,
  onOpenSettings,
  onToggleSidebar,
  sidebarOpen,
}: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const s = useStore()
  const { theme, setTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterCategory, setFilterCategory] = useState<FilterCategory>(null)
  const filterRef = useRef<HTMLInputElement>(null)
  const filterWrapRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // ── Breadcrumb ────────────────────────────────────────────────────────────
  const path = location.pathname.replace(/^\/app/, '') || '/'
  const isNodeView = path.startsWith('/node/')
  const nodeId = isNodeView ? path.split('/node/')[1] : null

  const { ancestors, current } = useMemo(() => {
    if (!nodeId) return { ancestors: [], current: null }
    // Build path walking UP from current node
    const fullPath: Array<{ label: string; id: string }> = []
    let cur = s.getNode(nodeId)
    const visited = new Set<string>()
    while (cur && !visited.has(cur.id)) {
      visited.add(cur.id)
      fullPath.unshift({ label: cur.text || 'Sin título', id: cur.id })
      if (!cur.parentId) break
      cur = s.getNode(cur.parentId) ?? undefined
    }
    // fullPath = [root, ..., parent, current]
    const current = fullPath[fullPath.length - 1] ?? null
    const ancestors = fullPath.slice(0, -1)
    return { ancestors, current }
  }, [nodeId, s]) // eslint-disable-line react-hooks/exhaustive-deps

  // Truncate long labels for display
  const truncate = (label: string, max = 22) =>
    label.length > max ? label.slice(0, max) + '…' : label

  // ── Contextos de 🧠 Contexto (para el filtro @) ──────────────────────────
  // Sin useMemo([s]): s es siempre el mismo objeto, el memo nunca se re-evalúa.
  // WFTopBar ya re-renderiza en cada cambio del store (useStore sin selector).
  const contextoNodes = (() => {
    const root = s.children(null).find(n => !n.deletedAt && (n.text === '🧠 Contexto' || n.text === '🏷 Tags'))
    if (!root) return []
    return s.children(root.id).filter(n => !n.deletedAt && n.text)
  })()

  // ── Close on outside click ────────────────────────────────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false)
      if (filterWrapRef.current && !filterWrapRef.current.contains(e.target as Node)) {
        setFilterOpen(false)
        setFilterCategory(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        filterRef.current?.focus()
        filterRef.current?.select()
        setFilterOpen(true)
      }
      if (e.key === 'Escape' && filterOpen) {
        onFilter('')
        setFilterOpen(false)
        setFilterCategory(null)
        filterRef.current?.blur()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [filterOpen, onFilter])

  // ── Apply chip filter ─────────────────────────────────────────────────────
  function applyChip(query: string) {
    // Toggle: if already active, remove it; otherwise set it
    if (filterText === query) {
      onFilter('')
    } else {
      onFilter(query)
    }
    filterRef.current?.blur()
    setFilterOpen(false)
    setFilterCategory(null)
  }

  function applyContextFilter(nodeText: string) {
    const slug = nodeText.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9\-\/]/g, '')
    applyChip(`@${slug}`)
  }

  function goHome() { navigate('/') }

  const alreadySaved = filterText ? getShortcuts().some(s => s.query === filterText) : false

  return (
    <div className="wf-topbar">

      {/* ── Nav: back + forward ── */}
      <div className="wf-topbar-nav">
        <button className="wf-topbar-btn" onClick={() => window.history.back()} title="Atrás (⌘[)">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </button>
        <button className="wf-topbar-btn" onClick={() => window.history.forward()} title="Adelante (⌘])">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* ── Breadcrumb integrado con casa ── */}
      <div className="wf-topbar-breadcrumb">
        {/* Casa — siempre visible, lleva al raíz */}
        <button className="wf-topbar-crumb-home" onClick={goHome} title="Inicio">
          <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
          </svg>
        </button>

        {/* Ancestros clickables */}
        {ancestors.map(a => (
          <span key={a.id} className="wf-topbar-crumb-segment">
            <span className="wf-topbar-crumb-sep">›</span>
            <button
              className="wf-topbar-crumb-btn"
              onClick={() => navigate(`/node/${a.id}`)}
              title={a.label}
            >
              {truncate(a.label)}
            </button>
          </span>
        ))}

        {/* Nodo actual — no clickable, diferenciado */}
        {current && (
          <span className="wf-topbar-crumb-segment">
            <span className="wf-topbar-crumb-sep">›</span>
            <span className="wf-topbar-crumb-current" title={current.label}>
              {truncate(current.label, 28)}
            </span>
          </span>
        )}
      </div>

      <div className="wf-topbar-spacer" />

      {/* ── Filtro tipo Workflowy ── */}
      <div className="wf-topbar-filter-wrap" ref={filterWrapRef}>
        <div className={`wf-topbar-filter ${filterOpen || filterText ? 'focused' : ''}`}>
          <svg className="wf-topbar-filter-icon" width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
          <input
            ref={filterRef}
            className="wf-topbar-filter-input"
            placeholder="Filtrar… (⌘F)"
            value={filterText}
            onChange={e => onFilter(e.target.value)}
            onFocus={() => setFilterOpen(true)}
          />
          {filterText && (
            <button
              className="wf-topbar-filter-clear"
              onMouseDown={e => { e.preventDefault(); onFilter(''); filterRef.current?.focus() }}
            >×</button>
          )}
        </div>

        {/* Panel de filtro — se muestra al hacer focus */}
        {filterOpen && (
          <div className="wf-filter-panel">
            {/* Fila de categorías */}
            <div className="wf-filter-cats">
              <button
                className={`wf-filter-cat ${filterCategory === 'tags' ? 'active' : ''}`}
                onMouseDown={e => { e.preventDefault(); setFilterCategory(c => c === 'tags' ? null : 'tags') }}
                title="Filtrar por contexto (@)"
              >
                <span style={{ fontWeight: 700 }}>@</span>
              </button>
              <button
                className={`wf-filter-cat ${filterCategory === 'dates' ? 'active' : ''}`}
                onMouseDown={e => { e.preventDefault(); setFilterCategory(c => c === 'dates' ? null : 'dates') }}
                title="Filtrar por fecha"
              >
                <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
              </button>
              <button
                className={`wf-filter-cat ${filterCategory === 'tasks' ? 'active' : ''}`}
                onMouseDown={e => { e.preventDefault(); setFilterCategory(c => c === 'tasks' ? null : 'tasks') }}
                title="Filtrar por tipo"
              >
                <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Chips de la categoría activa */}
            {filterCategory === 'tags' && (
              <div className="wf-filter-chips">
                {contextoNodes.length === 0 && (
                  <span className="wf-filter-chips-empty">Sin contextos en 🧠 Contexto</span>
                )}
                {contextoNodes.map(n => {
                  const slug = (n.text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9\-\/]/g, '')
                  const query = `@${slug}`
                  return (
                    <button
                      key={n.id}
                      className={`wf-filter-chip ${filterText === query ? 'active' : ''}`}
                      onMouseDown={e => { e.preventDefault(); applyContextFilter(n.text || '') }}
                    >
                      @{n.text}
                    </button>
                  )
                })}
              </div>
            )}

            {filterCategory === 'dates' && (
              <div className="wf-filter-chips">
                {DATE_CHIPS.map(c => (
                  <button
                    key={c.query}
                    className={`wf-filter-chip ${filterText === c.query ? 'active' : ''}`}
                    onMouseDown={e => { e.preventDefault(); applyChip(c.query) }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}

            {filterCategory === 'tasks' && (
              <div className="wf-filter-chips">
                {TASK_CHIPS.map(c => (
                  <button
                    key={c.query}
                    className={`wf-filter-chip ${filterText === c.query ? 'active' : ''}`}
                    onMouseDown={e => { e.preventDefault(); applyChip(c.query) }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}

            {/* Sin categoría seleccionada: mostrar todos los tags del usuario */}
            {!filterCategory && (
              <div className="wf-filter-chips">
                {DATE_CHIPS.slice(0,2).map(c => (
                  <button key={c.query} className={`wf-filter-chip ${filterText === c.query ? 'active' : ''}`}
                    onMouseDown={e => { e.preventDefault(); applyChip(c.query) }}>
                    {c.label}
                  </button>
                ))}
                <button className={`wf-filter-chip ${filterText === 'tarea' ? 'active' : ''}`}
                  onMouseDown={e => { e.preventDefault(); applyChip('tarea') }}>
                  Tareas
                </button>
                <button className={`wf-filter-chip ${filterText === 'pendiente' ? 'active' : ''}`}
                  onMouseDown={e => { e.preventDefault(); applyChip('pendiente') }}>
                  Pendientes
                </button>
                {contextoNodes.slice(0, 5).map(n => {
                  const slug = (n.text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9\-\/]/g, '')
                  return (
                    <button key={n.id}
                      className={`wf-filter-chip wf-filter-chip--tag ${filterText === `@${slug}` ? 'active' : ''}`}
                      onMouseDown={e => { e.preventDefault(); applyContextFilter(n.text || '') }}>
                      @{n.text}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ⭐ Guardar como atajo */}
      {filterText && (
        <button
          className={`wf-topbar-btn wf-topbar-star${alreadySaved ? ' starred' : ''}`}
          title={alreadySaved ? 'Ya guardado' : 'Guardar filtro como atajo'}
          onClick={() => {
            if (alreadySaved) return
            const name = prompt('Nombre para este atajo:', filterText)
            if (!name) return
            addFilterShortcut(name, filterText)
            window.dispatchEvent(new Event('wf:shortcuts-changed'))
          }}
        >
          {alreadySaved ? '★' : '☆'}
        </button>
      )}

      {/* Nota diaria de hoy */}
      <button
        className="wf-topbar-btn"
        title="Ir a la nota de hoy"
        onClick={() => {
          const dayNode = ensureDayPath(new Date())
          navigate(`/node/${dayNode.id}`)
        }}
      >
        <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Toggle tema claro/oscuro */}
      <button
        className="wf-topbar-btn"
        title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        style={{ fontSize: 13 }}
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      {/* ⌘K */}
      <button className="wf-topbar-btn" onClick={onCommandPalette} title="Búsqueda rápida (⌘K)">
        <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
        </svg>
        <span className="wf-topbar-shortcut-hint">⌘K</span>
      </button>

      {/* ··· Menú general — solo Papelera, Ajustes, Cerrar sesión */}
      <div className="wf-topbar-menu-wrap" ref={menuRef}>
        <button
          className={`wf-topbar-btn ${menuOpen ? 'active' : ''}`}
          onClick={() => setMenuOpen(v => !v)}
          title="Menú"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
          </svg>
        </button>
        {menuOpen && (
          <div className="wf-topbar-dropdown">
            <button className="wf-topbar-dropdown-item" onClick={() => { navigate('/trash'); setMenuOpen(false) }}>
              <span>🗑</span> Papelera
            </button>
            <button className="wf-topbar-dropdown-item" onClick={() => { onOpenSettings(); setMenuOpen(false) }}>
              <span>⚙️</span> Ajustes
            </button>
            <div className="wf-topbar-dropdown-sep" />
            <button className="wf-topbar-dropdown-item wf-topbar-dropdown-danger" onClick={onLogout}>
              <span>↩</span> Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
