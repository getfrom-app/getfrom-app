import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useStore } from '../../store/nodeStore'
import { apiRequest, aiInlineStream, getToken } from '../../api/client'

export default function SearchView() {
  const s = useStore()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const inputRef = useRef<HTMLInputElement>(null)

  const [query, setQuery] = useState(() => searchParams.get('q') || '')
  const [magicSearching, setMagicSearching] = useState(false)
  const [magicSummary, setMagicSummary] = useState('')

  // Sincroniza URL con el estado del query
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

  useEffect(() => { inputRef.current?.focus() }, [])

  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return s.allActive()
      .filter(n => n.text.toLowerCase().includes(q) || (n.body || '').toLowerCase().includes(q))
      .slice(0, 50)
  }, [query, s])

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
            placeholder="Buscar notas..."
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
          />
          {query && (
            <button className="search-clear" onClick={() => handleQueryChange('')}>×</button>
          )}
        </div>

        {isLoggedIn && query.trim() && (
          <button
            className={`magic-search-btn${magicSearching ? ' loading' : ''}`}
            onClick={handleMagicSearch}
            disabled={magicSearching || !query.trim()}
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

        {query && results.length === 0 && (
          <div className="view-empty">Sin resultados para "{query}"</div>
        )}
        {results.map(node => (
          <div
            key={node.id}
            className="search-result"
            onClick={() => navigate(`/node/${node.id}`)}
          >
            <span className="result-text">{highlight(node.text, query)}</span>
            {node.status !== null && (
              <span className={`result-badge ${node.status}`}>
                {node.status === 'pending' ? '○' : '✓'}
              </span>
            )}
          </div>
        ))}
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
