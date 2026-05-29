/**
 * WFTopBar — Top bar estilo Workflowy
 * 🏠 › Padre › Nodo actual   [filtro con categorías]   ⌘K  ···
 */
import { useNavigate, useLocation } from 'react-router-dom'
import { useStore } from '../../store/nodeStore'
import { useTheme } from '../../hooks/useTheme'
import { useState, useRef, useEffect, useMemo } from 'react'
import { getShortcuts } from '../../store/shortcutsStore'
import { createFilterShortcut } from '../../utils/atajosHelper'
import { ensureDayPath } from '../../utils/agendaHelper'
import { interpretFilterQuery, needsInterpretation, cancelInterpretation, normalizeSynonyms } from '../../utils/filterInterpreter'

interface Props {
  onFilter: (text: string) => void
  filterText: string
  onCommandPalette: () => void
  onLogout: () => void
  onOpenSettings: () => void
  onToggleSidebar: () => void
  sidebarOpen: boolean
  onTogglePlanner?: () => void
  plannerOpen?: boolean
  magicPanelW?: number   // ancho del panel Magic para alinear el buscador
}

// ── Categorías del filtro ──────────────────────────────────────────────────
type FilterCategory = 'tags' | 'dates' | 'tasks' | null

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

// Para isSmartQuery y compatibilidad con código antiguo
const DATE_CHIPS = TIME_CHIPS
const TASK_CHIPS = [...TYPE_CHIPS, ...STATUS_CHIPS]

export default function WFTopBar({
  onFilter,
  filterText,
  onCommandPalette,
  onLogout,
  onOpenSettings,
  onToggleSidebar,
  sidebarOpen,
  onTogglePlanner,
  plannerOpen,
  magicPanelW = 0,
}: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const s = useStore()
  const { theme, setTheme } = useTheme()

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
  const [menuOpen, setMenuOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterExpanded, setFilterExpanded] = useState(false)
  const [filterCategory, setFilterCategory] = useState<FilterCategory>(null)
  const [interpreting, setInterpreting] = useState(false)
  const filterRef = useRef<HTMLInputElement>(null)

  // ── Selección estructurada de chips ──────────────────────────────────────
  // Cada grupo usa OR internamente; entre grupos se usa AND.
  // Ej: tipos=[tarea] tiempos=[hoy,pasado] estados=[pendiente]
  //   → "(tarea y hoy y pendiente) o (tarea y pasado y pendiente)"
  const [chipTypes,    setChipTypes]    = useState<Set<string>>(new Set())
  const [chipTimes,    setChipTimes]    = useState<Set<string>>(new Set())
  const [chipStatuses, setChipStatuses] = useState<Set<string>>(new Set())
  const [chipContexts, setChipContexts] = useState<Set<string>>(new Set())

  function toggleChip(query: string, group: 'type' | 'time' | 'status' | 'context') {
    const setter = { type: setChipTypes, time: setChipTimes, status: setChipStatuses, context: setChipContexts }[group]
    setter(prev => {
      const next = new Set(prev)
      next.has(query) ? next.delete(query) : next.add(query)
      return next
    })
  }

  // Recalcular filterText cuando cambian los chips
  useEffect(() => {
    const types    = [...chipTypes]
    const times    = [...chipTimes]
    const statuses = [...chipStatuses]
    const contexts = [...chipContexts]

    // Si no hay ningún chip activo, limpiar
    if (!types.length && !times.length && !statuses.length && !contexts.length) {
      // Solo limpiar si el texto actual venía de chips (no texto manual)
      // Para simplificar: limpiar siempre cuando todos vacíos
      onFilter('')
      return
    }

    // Construir grupos: cada grupo es una lista de tokens en OR
    // La combinación entre grupos es AND via producto cartesiano
    const groups = [types, times, statuses, contexts].filter(g => g.length > 0)

    // Producto cartesiano de los grupos → cada combinación es un AND
    // Luego los combinamos con "o" (OR)
    function cartesian(arrays: string[][]): string[][] {
      return arrays.reduce<string[][]>(
        (acc, arr) => acc.flatMap(combo => arr.map(item => [...combo, item])),
        [[]]
      )
    }

    const combos = cartesian(groups)
    const query = combos.map(combo => combo.join(' y ')).join(' o ')
    // Trailing space → el usuario puede escribir texto adicional sin pegar con el token
    onFilter(query + ' ')
    // Poner foco y cursor al final para que el usuario pueda escribir inmediatamente
    setTimeout(() => {
      if (filterRef.current) {
        filterRef.current.focus()
        const len = filterRef.current.value.length
        filterRef.current.setSelectionRange(len, len)
      }
    }, 0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chipTypes, chipTimes, chipStatuses, chipContexts])

  function clearAllChips() {
    setChipTypes(new Set())
    setChipTimes(new Set())
    setChipStatuses(new Set())
    setChipContexts(new Set())
  }

  function isChipSelectedInGroup(query: string) {
    return chipTypes.has(query) || chipTimes.has(query) || chipStatuses.has(query) || chipContexts.has(query)
  }

  function getChipGroup(query: string): 'type' | 'time' | 'status' | 'context' {
    if (TYPE_CHIPS.some(c => c.query === query)) return 'type'
    if (TIME_CHIPS.some(c => c.query === query)) return 'time'
    if (STATUS_CHIPS.some(c => c.query === query)) return 'status'
    return 'context'
  }
  const filterWrapRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // El filtro se expande si está abierto O tiene texto
  const isFilterExpanded = filterExpanded || !!filterText

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
        setFilterExpanded(false)
        setFilterCategory(null)
        onFilter('')
        clearAllChips()
        if (filterRef.current) filterRef.current.value = ''
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // ── Limpiar filtro completo (texto + estado local) desde cualquier parte ──
  useEffect(() => {
    function handleClear() {
      onFilter('')
      setFilterOpen(false)
      setFilterExpanded(false)
      setFilterCategory(null)
      filterRef.current?.blur()
      if (filterRef.current) filterRef.current.value = ''
      clearAllChips()
    }
    window.addEventListener('wf:clear-filter', handleClear)
    return () => window.removeEventListener('wf:clear-filter', handleClear)
  }, [onFilter])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        // En NodeView, el Cmd+F lo gestiona el nodo (búsqueda en el nodo).
        // Solo abrir el filtro global si NO estamos en /node/
        const path = window.location.pathname.replace(/^\/app/, '') || '/'
        if (path.startsWith('/node/')) return
        e.preventDefault()
        filterRef.current?.focus()
        filterRef.current?.select()
        setFilterOpen(true)
      }
      if (e.key === 'Escape' && (filterOpen || filterExpanded)) {
        onFilter('')
        clearAllChips()
        setFilterOpen(false)
        setFilterExpanded(false)
        setFilterCategory(null)
        filterRef.current?.blur()
        if (filterRef.current) filterRef.current.value = ''
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [filterOpen, onFilter])

  // ── Interpretación automática de lenguaje natural ──────────────────────────
  // Cuando el usuario escribe algo que no es una query técnica conocida,
  // esperamos 800ms y lo interpretamos con Haiku (gratuito, systemBudget).
  // El resultado sustituye el texto del filtro y se aplica automáticamente.
  useEffect(() => {
    if (!filterText || !needsInterpretation(filterText)) {
      cancelInterpretation()
      setInterpreting(false)
      return
    }

    setInterpreting(true)
    const timer = setTimeout(async () => {
      const query = await interpretFilterQuery(filterText)
      setInterpreting(false)
      if (query && query !== filterText) {
        onFilter(query)
        // Actualizar el input visualmente para mostrar la query técnica
        if (filterRef.current) filterRef.current.value = query
      }
    }, 800)

    return () => {
      clearTimeout(timer)
      cancelInterpretation()
      setInterpreting(false)
    }
  }, [filterText]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Apply chip filter — combina tokens en lugar de reemplazar ────────────
  function applyChip(token: string) {
    const tokens = filterText.trim().split(/\s+/).filter(Boolean)
    const idx = tokens.indexOf(token)
    if (idx !== -1) {
      // Toggle off: quitar el token
      tokens.splice(idx, 1)
    } else {
      tokens.push(token)
    }
    onFilter(tokens.join(' '))
  }

  function applyContextFilter(nodeText: string) {
    const slug = nodeText.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9\-\/]/g, '')
    applyChip(`@${slug}`)
  }

  // Comprueba si un token está activo — normaliza sinónimos internamente
  // para que "pendientes", "tareas", etc. resalten el chip correcto
  function isChipActive(token: string) {
    const tokens = filterText.trim().split(/\s+/)
    return tokens.some(t => {
      const norm = normalizeSynonyms(t) ?? t
      return norm === token
    })
  }

  function goHome() { navigate('/') }

  const alreadySaved = filterText ? getShortcuts().some(s => s.query === filterText) : false

  return (
    <div className="wf-topbar-root">
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
        <div
          className={`wf-topbar-filter ${isFilterExpanded ? 'focused expanded' : ''}`}
          style={isFilterExpanded && magicPanelW > 0 ? { width: magicPanelW - 16 } : undefined}
        >
          <input
            ref={filterRef}
            className="wf-topbar-filter-input"
            placeholder="Buscar"
            value={filterText}
            onChange={e => onFilter(e.target.value)}
            onFocus={() => {
              setFilterOpen(true)
              setFilterExpanded(true)
              // Cerrar panel Magic si está abierto — no son compatibles
              window.dispatchEvent(new Event('from:close-magic'))
            }}
          />
          {/* Indicador IA con puntos pulsantes */}
          {interpreting && (
            <span className="wf-topbar-filter-ai-indicator" title="Interpretando con IA…">
              <span className="wf-filter-ai-dot" />
              <span className="wf-filter-ai-dot" />
              <span className="wf-filter-ai-dot" />
            </span>
          )}
          {filterText && (
            <>
              <button
                className="wf-topbar-filter-save"
                title="Guardar como panel"
                onMouseDown={e => {
                  e.preventDefault()
                  const query = filterText.trim()
                  if (!query) return
                  const name = query.startsWith('@') || query.startsWith('#')
                    ? query
                    : query.charAt(0).toUpperCase() + query.slice(1)
                  createFilterShortcut(name, query, 'list')
                  window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: `Panel guardado: "${name}"`, type: 'success' } }))
                  filterRef.current?.focus()
                }}
              >
                <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M3 2a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v13l-5-3-5 3V2z"/>
                </svg>
              </button>
              <button
                className="wf-topbar-filter-clear"
                onMouseDown={e => {
                  e.preventDefault()
                  onFilter('')
                  clearAllChips()
                  setFilterExpanded(false)
                  setFilterOpen(false)
                  filterRef.current?.blur()
                  if (filterRef.current) filterRef.current.value = ''
                }}
              >×</button>
            </>
          )}
        </div>

        {/* Chips flotantes bajo el buscador — agrupados, multi-selección */}
        {isFilterExpanded && (
          <div className="wf-filter-chips-dropdown">
            {TYPE_CHIPS.map(c => (
              <button key={c.query}
                className={`wf-filter-chip ${isChipSelectedInGroup(c.query) ? 'active' : ''}`}
                onMouseDown={e => { e.preventDefault(); toggleChip(c.query, 'type') }}
              >{c.label}</button>
            ))}
            <span className="wf-filter-chip-sep" />
            {TIME_CHIPS.map(c => (
              <button key={c.query}
                className={`wf-filter-chip ${isChipSelectedInGroup(c.query) ? 'active' : ''}`}
                onMouseDown={e => { e.preventDefault(); toggleChip(c.query, 'time') }}
              >{c.label}</button>
            ))}
            <span className="wf-filter-chip-sep" />
            {STATUS_CHIPS.map(c => (
              <button key={c.query}
                className={`wf-filter-chip ${isChipSelectedInGroup(c.query) ? 'active' : ''}`}
                onMouseDown={e => { e.preventDefault(); toggleChip(c.query, 'status') }}
              >{c.label}</button>
            ))}
            {contextChips.length > 0 && (
              <>
                <span className="wf-filter-chip-sep" />
                {contextChips.map(c => (
                  <button key={c.query}
                    className={`wf-filter-chip ${isChipSelectedInGroup(c.query) ? 'active' : ''}`}
                    onMouseDown={e => { e.preventDefault(); toggleChip(c.query, 'context') }}
                  >{c.label}</button>
                ))}
              </>
            )}
          </div>
        )}

        {/* Panel completo — categorías extra (@, fechas, tags) cuando hay categoría seleccionada */}
        {filterOpen && filterCategory && (
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
                  const token = `@${slug}`
                  return (
                    <button
                      key={n.id}
                      className={`wf-filter-chip ${isChipActive(token) ? 'active' : ''}`}
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
                    className={`wf-filter-chip ${isChipActive(c.query) ? 'active' : ''}`}
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
                    className={`wf-filter-chip ${isChipActive(c.query) ? 'active' : ''}`}
                    onMouseDown={e => { e.preventDefault(); applyChip(c.query) }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}

            {/* Sin categoría seleccionada: chips rápidos combinables */}
            {!filterCategory && (
              <div className="wf-filter-chips">
                {DATE_CHIPS.map(c => (
                  <button key={c.query} className={`wf-filter-chip ${isChipActive(c.query) ? 'active' : ''}`}
                    onMouseDown={e => { e.preventDefault(); applyChip(c.query) }}>
                    {c.label}
                  </button>
                ))}
                {TASK_CHIPS.map(c => (
                  <button key={c.query} className={`wf-filter-chip ${isChipActive(c.query) ? 'active' : ''}`}
                    onMouseDown={e => { e.preventDefault(); applyChip(c.query) }}>
                    {c.label}
                  </button>
                ))}
                {contextoNodes.slice(0, 6).map(n => {
                  const slug = (n.text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9\-\/]/g, '')
                  const token = `@${slug}`
                  return (
                    <button key={n.id}
                      className={`wf-filter-chip wf-filter-chip--tag ${isChipActive(token) ? 'active' : ''}`}
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

      {/* ⭐ Guardar como panel */}
      {filterText && (
        <button
          className={`wf-topbar-btn wf-topbar-star${alreadySaved ? ' starred' : ''}`}
          title={alreadySaved ? 'Ya guardado' : 'Guardar filtro como panel'}
          onClick={() => {
            if (alreadySaved) return
            const name = prompt('Nombre para este panel:', filterText)
            if (!name) return
            createFilterShortcut(name, filterText, 'list')
          }}
        >
          {alreadySaved ? '★' : '☆'}
        </button>
      )}

      {/* Hoy */}
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

      {/* Planificador */}
      <button
        className={`wf-topbar-btn wf-topbar-planner-btn ${plannerOpen ? 'active' : ''}`}
        onClick={onTogglePlanner}
        title="Planificador"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <rect x="3" y="4" width="9" height="4" rx="1" fill="currentColor" stroke="none"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <rect x="7" y="10" width="12" height="4" rx="1" fill="currentColor" stroke="none"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
          <rect x="3" y="16" width="6" height="4" rx="1" fill="currentColor" stroke="none"/>
        </svg>
      </button>

      {/* ⌘K — solo rayo, sin texto */}
      <button className="wf-topbar-btn" onClick={onCommandPalette} title="Acciones rápidas (⌘K)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
      </button>

      {/* Modo claro/oscuro */}
      <button
        className="wf-topbar-btn"
        title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        style={{ fontSize: 13 }}
      >
        {theme === 'dark' ? '☀️' : '🌙'}
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

    </div>
  )
}
