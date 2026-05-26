/**
 * WFTopBar — Top bar estilo Workflowy para la rama experiment/workflowy
 * Minimal: back/forward + home + breadcrumb + filter + menú
 */
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { useStore } from '../../store/nodeStore'
import { useTheme } from '../../hooks/useTheme'
import { useState, useRef, useEffect } from 'react'
import { addFilterShortcut, getShortcuts } from '../../store/shortcutsStore'

interface Props {
  onFilter: (text: string) => void
  filterText: string
  onCommandPalette: () => void
  onLogout: () => void
  onOpenSettings: () => void
  onToggleSidebar: () => void
  sidebarOpen: boolean
}

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
  const [filterFocused, setFilterFocused] = useState(false)
  const filterRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Breadcrumb — build path for /node/:id
  const path = location.pathname.replace(/^\/app/, '') || '/'
  const isNodeView = path.startsWith('/node/')
  const nodeId = isNodeView ? path.split('/node/')[1] : null

  function getBreadcrumbs(): Array<{ label: string; path: string }> {
    if (!nodeId) return []
    const crumbs: Array<{ label: string; path: string }> = []
    let cur = s.getNode(nodeId)
    const visited = new Set<string>()
    while (cur && cur.parentId && !visited.has(cur.id)) {
      visited.add(cur.id)
      crumbs.unshift({ label: cur.text || 'Sin título', path: `/node/${cur.id}` })
      cur = s.getNode(cur.parentId) ?? undefined
    }
    return crumbs
  }

  const breadcrumbs = getBreadcrumbs()
  // Only show ancestors, not current node (shown as big title in view)
  const ancestorCrumbs = breadcrumbs.slice(0, -1)

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  // ⌘F → focus filter
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        filterRef.current?.focus()
        filterRef.current?.select()
      }
      if (e.key === 'Escape' && filterFocused) {
        onFilter('')
        filterRef.current?.blur()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [filterFocused, onFilter])

  function goHome() { navigate('/') }
  function goToday() {
    const diary = s.todayDiary()
    if (diary) navigate(`/node/${diary.id}`)
  }

  return (
    <div className="wf-topbar">
      {/* Nav: back + forward + home */}
      <div className="wf-topbar-nav">
        <button
          className="wf-topbar-btn"
          onClick={() => window.history.back()}
          title="Atrás (⌘[)"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </button>
        <button
          className="wf-topbar-btn"
          onClick={() => window.history.forward()}
          title="Adelante (⌘])"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </button>
        <button
          className="wf-topbar-btn wf-topbar-home"
          onClick={goHome}
          title="Inicio"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
          </svg>
        </button>
      </div>

      {/* Breadcrumb */}
      {ancestorCrumbs.length > 0 && (
        <div className="wf-topbar-breadcrumb">
          {ancestorCrumbs.map((crumb, i) => (
            <span key={crumb.path}>
              {i > 0 && <span className="wf-topbar-crumb-sep">›</span>}
              <button
                className="wf-topbar-crumb-btn"
                onClick={() => navigate(crumb.path)}
              >
                {crumb.label.length > 24 ? crumb.label.slice(0, 24) + '…' : crumb.label}
              </button>
            </span>
          ))}
          <span className="wf-topbar-crumb-sep">›</span>
        </div>
      )}

      <div className="wf-topbar-spacer" />

      {/* Filter input */}
      <div className={`wf-topbar-filter ${filterFocused || filterText ? 'focused' : ''}`}>
        <svg className="wf-topbar-filter-icon" width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
        </svg>
        <input
          ref={filterRef}
          className="wf-topbar-filter-input"
          placeholder="Filtrar… (⌘F)"
          value={filterText}
          onChange={e => onFilter(e.target.value)}
          onFocus={() => setFilterFocused(true)}
          onBlur={() => setFilterFocused(false)}
        />
        {filterText && (
          <button
            className="wf-topbar-filter-clear"
            onClick={() => { onFilter(''); filterRef.current?.focus() }}
          >
            ×
          </button>
        )}
      </div>

      {/* ⭐ Guardar filtro como atajo — solo visible cuando hay texto en el filtro */}
      {filterText && (() => {
        const alreadySaved = getShortcuts().some(s => s.query === filterText)
        return (
          <button
            className={`wf-topbar-btn wf-topbar-star${alreadySaved ? ' starred' : ''}`}
            title={alreadySaved ? 'Ya guardado como atajo' : 'Guardar filtro como atajo (⭐)'}
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
        )
      })()}

      {/* ⌘K */}
      <button
        className="wf-topbar-btn"
        onClick={onCommandPalette}
        title="Búsqueda rápida (⌘K)"
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
        </svg>
        <span className="wf-topbar-shortcut-hint">⌘K</span>
      </button>

      {/* Menú general */}
      <div className="wf-topbar-menu-wrap" ref={menuRef}>
        <button
          className={`wf-topbar-btn wf-topbar-menu-btn ${menuOpen ? 'active' : ''}`}
          onClick={() => setMenuOpen(v => !v)}
          title="Menú"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
          </svg>
        </button>
        {menuOpen && (
          <div className="wf-topbar-dropdown">
            <button className="wf-topbar-dropdown-item" onClick={() => { goToday(); setMenuOpen(false) }}>
              <span>📓</span> Ir a hoy
            </button>
            <button className="wf-topbar-dropdown-item" onClick={() => { navigate('/calendar'); setMenuOpen(false) }}>
              <span>📅</span> Calendario
            </button>
            <button className="wf-topbar-dropdown-item" onClick={() => { navigate('/trash'); setMenuOpen(false) }}>
              <span>🗑</span> Papelera
            </button>
            <div className="wf-topbar-dropdown-sep" />
            <button className="wf-topbar-dropdown-item" onClick={() => { setTheme(theme === 'dark' ? 'light' : 'dark'); setMenuOpen(false) }}>
              <span>{theme === 'dark' ? '☀️' : '🌙'}</span> {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            </button>
            <button className="wf-topbar-dropdown-item" onClick={() => { onOpenSettings(); setMenuOpen(false) }}>
              <span>⚙️</span> Ajustes
            </button>
            <div className="wf-topbar-dropdown-sep" />
            <button className="wf-topbar-dropdown-item wf-topbar-dropdown-danger" onClick={() => { onLogout(); setMenuOpen(false) }}>
              <span>↩</span> Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
