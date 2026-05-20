import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useStore } from '../../store/nodeStore'
import type { Node } from '../../types'
import { apiRequest, aiInlineStream, getToken } from '../../api/client'

// ── DSL Parser ───────────────────────────────────────────────────────────────

interface ParsedQuery {
  filters: Filter[]
  text: string
}

interface Filter {
  type: 'status' | 'date' | 'priority' | 'kind'
  value: string
  raw: string // original token, e.g. "estado:pendiente"
}

const DSL_PATTERNS: Array<{ regex: RegExp; parse: (m: RegExpMatchArray) => Filter | null }> = [
  {
    regex: /estado:(pendiente|hecho)/gi,
    parse: m => ({ type: 'status', value: m[1].toLowerCase(), raw: m[0] }),
  },
  {
    regex: /fecha:(hoy|vencida)/gi,
    parse: m => ({ type: 'date', value: m[1].toLowerCase(), raw: m[0] }),
  },
  {
    regex: /prioridad:(alta|media|baja)/gi,
    parse: m => ({ type: 'priority', value: m[1].toLowerCase(), raw: m[0] }),
  },
  {
    regex: /tipo:(tarea|bucle|evento|favorito)/gi,
    parse: m => ({ type: 'kind', value: m[1].toLowerCase(), raw: m[0] }),
  },
]

function parseQuery(raw: string): ParsedQuery {
  const filters: Filter[] = []
  let remaining = raw

  for (const { regex, parse } of DSL_PATTERNS) {
    regex.lastIndex = 0
    let m: RegExpMatchArray | null
    const copy = new RegExp(regex.source, regex.flags)
    while ((m = copy.exec(remaining)) !== null) {
      const filter = parse(m)
      if (filter) filters.push(filter)
    }
    remaining = remaining.replace(new RegExp(regex.source, 'gi'), '').trim()
  }

  return { filters, text: remaining.trim() }
}

function applyFilters(nodes: Node[], parsed: ParsedQuery): Node[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let result = nodes

  for (const f of parsed.filters) {
    if (f.type === 'status') {
      const status = f.value === 'pendiente' ? 'pending' : 'done'
      result = result.filter(n => n.status === status)
    } else if (f.type === 'date') {
      if (f.value === 'hoy') {
        result = result.filter(n => {
          if (!n.due) return false
          const d = new Date(n.due)
          d.setHours(0, 0, 0, 0)
          return d.getTime() === today.getTime()
        })
      } else if (f.value === 'vencida') {
        result = result.filter(n => {
          if (!n.due) return false
          const d = new Date(n.due)
          d.setHours(0, 0, 0, 0)
          return d.getTime() < today.getTime()
        })
      }
    } else if (f.type === 'priority') {
      const map: Record<string, 'high' | 'medium' | 'low'> = {
        alta: 'high',
        media: 'medium',
        baja: 'low',
      }
      result = result.filter(n => n.priority === map[f.value])
    } else if (f.type === 'kind') {
      if (f.value === 'tarea') {
        result = result.filter(n => n.status !== null)
      } else if (f.value === 'bucle') {
        result = result.filter(n => n.types.includes('bucle'))
      } else if (f.value === 'evento') {
        result = result.filter(n => n.isEvent)
      } else if (f.value === 'favorito') {
        result = result.filter(n => n.isFavorite)
      }
    }
  }

  if (parsed.text) {
    const q = parsed.text.toLowerCase()
    result = result.filter(
      n => n.text.toLowerCase().includes(q) || (n.body || '').toLowerCase().includes(q)
    )
  }

  return result
}

// ── Search history ────────────────────────────────────────────────────────────

const SEARCH_HISTORY_KEY = 'from_search_history'

function getHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]') } catch { return [] }
}

function addToHistory(q: string) {
  if (!q.trim() || q.trim().length < 2) return
  const h = getHistory().filter(item => item !== q.trim()).slice(0, 4)
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify([q.trim(), ...h]))
}

function removeFromHistory(q: string) {
  const h = getHistory().filter(item => item !== q)
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(h))
}

// ── Quick chips ───────────────────────────────────────────────────────────────

const QUICK_CHIPS: Array<{ label: string; dsl: string }> = [
  { label: 'Pendientes', dsl: 'estado:pendiente' },
  { label: 'Vencidas', dsl: 'fecha:vencida' },
  { label: 'Favoritos', dsl: 'tipo:favorito' },
  { label: 'Tareas', dsl: 'tipo:tarea' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDue(due: string): string {
  const d = new Date(due)
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

const PRIORITY_LABEL: Record<string, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
}

const PRIORITY_CLASS: Record<string, string> = {
  high: 'priority-high',
  medium: 'priority-medium',
  low: 'priority-low',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SearchView() {
  const s = useStore()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const inputRef = useRef<HTMLInputElement>(null)

  const [query, setQuery] = useState(() => searchParams.get('q') || '')
  const [magicSearching, setMagicSearching] = useState(false)
  const [magicSummary, setMagicSummary] = useState('')
  const [history, setHistory] = useState<string[]>(() => getHistory())

  // Sync URL with query state
  useEffect(() => {
    const urlQ = searchParams.get('q') || ''
    if (urlQ !== query) setQuery(urlQ)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  function handleQueryChange(value: string) {
    setQuery(value)
    setMagicSummary('')
    if (value) setSearchParams({ q: value }, { replace: true })
    else setSearchParams({}, { replace: true })
  }

  // Save to history when query is committed (blur or Enter)
  const commitSearch = useCallback((q: string) => {
    if (q.trim().length >= 2) {
      addToHistory(q)
      setHistory(getHistory())
    }
  }, [])

  function handleRemoveHistory(item: string, e: React.MouseEvent) {
    e.stopPropagation()
    removeFromHistory(item)
    setHistory(getHistory())
  }

  useEffect(() => { inputRef.current?.focus() }, [])

  const parsed = useMemo(() => parseQuery(query), [query])

  const allNodes = useMemo(() => s.allActive(), [s])
  const totalNodeCount = allNodes.length

  const results = useMemo(() => {
    if (!query.trim()) return []
    return applyFilters(allNodes, parsed).slice(0, 50)
  }, [query, parsed, allNodes])

  // For empty-state tag suggestions
  const availableTags = useMemo(() => s.allUsedTags().slice(0, 8), [s])

  // Remove a single DSL filter chip
  function removeFilter(raw: string) {
    const newQuery = query.replace(raw, '').replace(/\s+/g, ' ').trim()
    handleQueryChange(newQuery)
  }

  // Apply a quick chip — toggle if already active
  function applyQuickChip(dsl: string) {
    if (query.toLowerCase().includes(dsl.toLowerCase())) {
      handleQueryChange(query.replace(new RegExp(dsl, 'gi'), '').replace(/\s+/g, ' ').trim())
    } else {
      handleQueryChange(query.trim() ? `${query} ${dsl}` : dsl)
    }
  }

  // Search only by free text, removing DSL filters
  function searchFreeText() {
    handleQueryChange(parsed.text || query)
  }

  async function handleMagicSearch() {
    if (!query.trim() || !getToken()) return
    setMagicSearching(true)
    setMagicSummary('')
    try {
      const serverResults = await apiRequest<{ nodes: Array<{ id: string; text: string; body: string | null }> }>(
        `/search/nodes?q=${encodeURIComponent(query)}&limit=10`
      )
      const contextText = (serverResults.nodes || [])
        .map(n => `**${n.text}**${n.body ? '\n' + n.body.slice(0, 200) : ''}`)
        .join('\n\n')

      const prompt = `El usuario busca: "${query}"\n\nContenido relevante de su vault:\n\n${contextText}\n\nResponde en español con una síntesis útil y concisa (máximo 150 palabras).`

      await aiInlineStream(prompt, undefined, (chunk) => {
        setMagicSummary(prev => prev + chunk)
      })
    } catch (err) {
      console.error('Magic search error', err)
    } finally {
      setMagicSearching(false)
    }
  }

  const isLoggedIn = !!getToken()
  const hasActiveFilters = parsed.filters.length > 0
  const hasQuery = query.trim().length > 0
  const noResults = hasQuery && results.length === 0

  return (
    <div className="view search-view">
      <div className="view-header">
        <div className="search-bar">
          <svg width="16" height="16" viewBox="0 0 16 16" className="search-icon">
            <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder="Buscar… o usa estado:pendiente, fecha:hoy, prioridad:alta…"
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            onBlur={e => commitSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitSearch(query) }}
          />
          {query && (
            <button className="search-clear" onClick={() => handleQueryChange('')}>×</button>
          )}
        </div>

        {/* Quick chips */}
        <div className="search-quick-chips">
          {QUICK_CHIPS.map(chip => {
            const active = query.toLowerCase().includes(chip.dsl.toLowerCase())
            return (
              <button
                key={chip.dsl}
                className={`search-chip ${active ? 'search-chip--active' : ''}`}
                onClick={() => applyQuickChip(chip.dsl)}
              >
                {chip.label}
              </button>
            )
          })}
        </div>

        {/* Active DSL filter chips */}
        {hasActiveFilters && (
          <div className="search-active-filters">
            {parsed.filters.map((f, i) => (
              <span key={i} className="search-filter-chip">
                {f.raw}
                <button
                  className="search-filter-chip-remove"
                  onClick={() => removeFilter(f.raw)}
                  aria-label={`Quitar filtro ${f.raw}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {isLoggedIn && hasQuery && (
          <button
            className={`magic-search-btn${magicSearching ? ' loading' : ''}`}
            onClick={handleMagicSearch}
            disabled={magicSearching || !hasQuery}
          >
            {magicSearching ? '✨ Analizando...' : '✨ Búsqueda IA'}
          </button>
        )}
      </div>

      <div className="view-body">
        {magicSummary && (
          <div className="magic-search-summary">
            <div className="magic-search-label">✨ Síntesis IA</div>
            <div className="magic-search-text">{magicSummary}</div>
          </div>
        )}

        {/* Result count */}
        {hasQuery && results.length > 0 && (
          <div className="search-result-count">
            {results.length === 50 ? '50+ resultados' : `${results.length} ${results.length === 1 ? 'resultado' : 'resultados'}`}
          </div>
        )}

        {/* Empty state with suggestions */}
        {noResults && (
          <div className="search-empty-state">
            <div className="view-empty">Sin resultados para "{query}"</div>

            {hasActiveFilters && (
              <button className="search-free-text-btn" onClick={searchFreeText}>
                Buscar solo por texto libre
              </button>
            )}

            {availableTags.length > 0 && (
              <div className="search-tag-suggestions">
                <div className="search-tag-suggestions-label">Prueba buscando por tag:</div>
                <div className="search-tag-suggestions-chips">
                  {availableTags.map(tag => (
                    <button
                      key={tag}
                      className="search-chip"
                      onClick={() => handleQueryChange(tag)}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="search-vault-count">
              {totalNodeCount} {totalNodeCount === 1 ? 'nota' : 'notas'} en tu vault
            </div>
          </div>
        )}

        {/* Search history — shown when input is empty */}
        {!hasQuery && history.length > 0 && (
          <div className="search-history">
            <div className="search-history-label">Búsquedas recientes</div>
            {history.map(item => (
              <div
                key={item}
                className="search-history-item"
                onClick={() => handleQueryChange(item)}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" className="search-history-icon">
                  <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                  <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <span className="search-history-text">{item}</span>
                <button
                  className="search-history-remove"
                  onClick={e => handleRemoveHistory(item, e)}
                  aria-label={`Eliminar "${item}" del historial`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {!hasQuery && history.length === 0 && (
          <div className="view-empty">Escribe para buscar o usa los filtros rápidos</div>
        )}

        {results.length > 0 && (() => {
          const tasks = results.filter(n => n.status !== null)
          const events = results.filter(n => n.status === null && n.isEvent)
          const notes = results.filter(n => n.status === null && !n.isEvent)

          const groups: Array<{ label: string; icon: string; nodes: typeof results }> = []
          if (tasks.length > 0) groups.push({ label: 'Tareas', icon: '✓', nodes: tasks })
          if (events.length > 0) groups.push({ label: 'Eventos', icon: '📅', nodes: events })
          if (notes.length > 0) groups.push({ label: 'Notas', icon: '📄', nodes: notes })

          return groups.map(group => (
            <div key={group.label} className="search-result-group">
              <div className="search-result-group-header">
                <span className="search-result-group-icon">{group.icon}</span>
                <span className="search-result-group-label">{group.label}</span>
                <span className="search-result-group-count">{group.nodes.length}</span>
              </div>
              {group.nodes.map(node => (
                <div
                  key={node.id}
                  className="search-result"
                  onClick={() => navigate(`/node/${node.id}`)}
                >
                  <div className="search-result-main">
                    <span className="result-text">
                      {parsed.text
                        ? highlight(node.text, parsed.text)
                        : node.text}
                    </span>
                    {node.isFavorite && <span className="result-badge favorite" title="Favorito">★</span>}
                  </div>
                  <div className="search-result-meta">
                    {node.status !== null && (
                      <span className={`result-badge status-badge ${node.status}`}>
                        {node.status === 'pending' ? '○ Pendiente' : '✓ Hecho'}
                      </span>
                    )}
                    {node.priority && (
                      <span className={`result-badge priority-badge ${PRIORITY_CLASS[node.priority]}`}>
                        {PRIORITY_LABEL[node.priority]}
                      </span>
                    )}
                    {node.due && (
                      <span className="result-badge due-badge">
                        📅 {formatDue(node.due)}
                      </span>
                    )}
                    {node.isEvent && (
                      <span className="result-badge event-badge">Evento</span>
                    )}
                    {node.types.includes('bucle') && (
                      <span className="result-badge loop-badge">Bucle</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))
        })()}
      </div>
    </div>
  )
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text
  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, 'gi'))
  return parts.map((p, i) =>
    p.toLowerCase() === query.toLowerCase()
      ? <mark key={i}>{p}</mark>
      : p
  )
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
