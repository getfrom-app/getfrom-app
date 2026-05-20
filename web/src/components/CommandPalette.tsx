import { createPortal } from 'react-dom'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { store } from '../store/nodeStore'

interface Props {
  onClose: () => void
}

interface PaletteItem {
  id: string
  icon: string
  label: string
  type: 'action' | 'note' | 'recent'
  action: () => void
}

const RECENT_KEY = 'from_recent_nodes'

function getRecentNodes(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
  } catch { return [] }
}

export function recordRecentNode(id: string) {
  const recent = getRecentNodes().filter(r => r !== id)
  recent.unshift(id)
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 10)))
}

function fuzzyMatch(haystack: string, needle: string): boolean {
  if (!needle) return true
  const h = haystack.toLowerCase()
  const n = needle.toLowerCase()
  let hi = 0
  for (let i = 0; i < n.length; i++) {
    const idx = h.indexOf(n[i], hi)
    if (idx === -1) return false
    hi = idx + 1
  }
  return true
}

export default function CommandPalette({ onClose }: Props) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const buildItems = useCallback((): PaletteItem[] => {
    const items: PaletteItem[] = []

    // Quick actions
    const actions: PaletteItem[] = [
      {
        id: 'action-new-note',
        icon: '✎',
        label: 'Nueva nota',
        type: 'action',
        action: () => {
          const node = store.createNode({ text: '', parentId: null })
          navigate(`/node/${node.id}`)
          onClose()
        },
      },
      {
        id: 'action-diary',
        icon: '📓',
        label: 'Ir al diario de hoy',
        type: 'action',
        action: () => { navigate('/'); onClose() },
      },
      {
        id: 'action-tasks',
        icon: '✓',
        label: 'Abrir tareas',
        type: 'action',
        action: () => { navigate('/tasks'); onClose() },
      },
      {
        id: 'action-search',
        icon: '🔍',
        label: 'Abrir búsqueda',
        type: 'action',
        action: () => { navigate('/search'); onClose() },
      },
      {
        id: 'action-account',
        icon: '⚙',
        label: 'Ajustes',
        type: 'action',
        action: () => { navigate('/account'); onClose() },
      },
      {
        id: 'action-calendar',
        icon: '📅',
        label: 'Abrir calendario',
        type: 'action',
        action: () => { navigate('/calendar'); onClose() },
      },
      {
        id: 'action-kanban',
        icon: '📋',
        label: 'Abrir kanban',
        type: 'action',
        action: () => { navigate('/kanban'); onClose() },
      },
      {
        id: 'action-agents',
        icon: '🤖',
        label: 'Agentes IA',
        type: 'action',
        action: () => { navigate('/agents'); onClose() },
      },
      {
        id: 'action-new-task',
        icon: '☑',
        label: 'Nueva tarea rápida',
        type: 'action',
        action: () => {
          const today = store.todayDiary()
          const node = store.createNode({ text: '', parentId: today?.id || null, isTask: true })
          navigate(`/node/${node.id}`)
          onClose()
        },
      },
      {
        id: 'action-toggle-theme',
        icon: '🌙',
        label: 'Cambiar tema (claro/oscuro)',
        type: 'action',
        action: () => {
          const current = document.documentElement.getAttribute('data-theme')
          document.documentElement.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark')
          localStorage.setItem('from_theme', current === 'dark' ? 'light' : 'dark')
          onClose()
        },
      },
    ]

    // Recent nodes
    const recentIds = getRecentNodes()
    const recentItems: PaletteItem[] = recentIds
      .map(id => store.getNode(id))
      .filter(Boolean)
      .map(n => n!)
      .filter(n => !n.deletedAt)
      .map(n => ({
        id: `recent-${n.id}`,
        icon: n.isDiaryEntry ? '📓' : n.status !== null ? '✓' : '→',
        label: n.text || 'Sin título',
        type: 'recent' as const,
        action: () => {
          recordRecentNode(n.id)
          navigate(`/node/${n.id}`)
          onClose()
        },
      }))

    // All notes for search
    const allNotes: PaletteItem[] = store.allActive()
      .filter(n => !n.isDiaryEntry && !recentIds.includes(n.id))
      .map(n => ({
        id: `note-${n.id}`,
        icon: n.status !== null ? '✓' : '→',
        label: n.text || 'Sin título',
        type: 'note' as const,
        action: () => {
          recordRecentNode(n.id)
          navigate(`/node/${n.id}`)
          onClose()
        },
      }))

    if (!query) {
      // No query: actions + recent
      items.push(...actions, ...recentItems)
    } else {
      // Filter everything by fuzzy match
      const filteredActions = actions.filter(a => fuzzyMatch(a.label, query))
      const filteredRecent = recentItems.filter(r => fuzzyMatch(r.label, query))
      const filteredNotes = allNotes.filter(n => fuzzyMatch(n.label, query))
      items.push(...filteredActions, ...filteredRecent, ...filteredNotes)
    }

    return items
  }, [query, navigate, onClose])

  const items = buildItems()

  useEffect(() => {
    setActiveIdx(0)
  }, [query])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, items.length - 1))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (items[activeIdx]) {
        items[activeIdx].action()
      }
    }
  }

  // Scroll active item into view
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const active = list.querySelector('.cmdpalette-item.active') as HTMLElement | null
    active?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  return createPortal(
    <div className="cmdpalette-overlay" onClick={onClose}>
      <div
        className="cmdpalette-modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <div className="cmdpalette-search-row">
          <span className="cmdpalette-search-icon">🔍</span>
          <input
            ref={inputRef}
            className="cmdpalette-input"
            placeholder="Buscar o crear..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {query && (
            <button className="cmdpalette-clear" onClick={() => setQuery('')}>×</button>
          )}
        </div>

        <div ref={listRef} className="cmdpalette-results">
          {items.length === 0 && (
            <div className="cmdpalette-empty">Sin resultados para "{query}"</div>
          )}
          {items.map((item, idx) => (
            <button
              key={item.id}
              className={`cmdpalette-item ${idx === activeIdx ? 'active' : ''} cmdpalette-item--${item.type}`}
              onClick={item.action}
              onMouseEnter={() => setActiveIdx(idx)}
            >
              <span className="cmdpalette-item-icon">{item.icon}</span>
              <span className="cmdpalette-item-label">{item.label}</span>
              {item.type === 'action' && item.id === 'action-new-note' && (
                <span className="cmdpalette-item-kbd">⌘N</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}
