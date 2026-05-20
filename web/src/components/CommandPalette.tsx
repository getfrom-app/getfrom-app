import { createPortal } from 'react-dom'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { store } from '../store/nodeStore'
import { useToast } from './Toast'

interface Props {
  onClose: () => void
}

interface PaletteItem {
  id: string
  icon: string
  label: string
  sublabel?: string
  type: 'action' | 'note' | 'recent' | 'create'
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

// ── Natural language parsing ─────────────────────────────────────────────────

interface ParsedQuery {
  /** Texto limpio sin flags ni tokens de fecha */
  cleanText: string
  isTask: boolean
  isEvent: boolean
  isBucle: boolean
  isFavorite: boolean
  due: string | null        // ISO string or null
  /** Label legible de fecha para el chip, e.g. "mañana" */
  dateLabel: string | null
}

const DAY_NAMES: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, miércoles: 3,
  jueves: 4, viernes: 5, sábado: 6,
}

function nextWeekday(dayIndex: number): Date {
  const now = new Date()
  const today = now.getDay()
  let diff = dayIndex - today
  if (diff <= 0) diff += 7
  const result = new Date(now)
  result.setDate(result.getDate() + diff)
  result.setHours(0, 0, 0, 0)
  return result
}

function parseNaturalDate(tokens: string[]): { date: Date | null; usedTokens: Set<number> } {
  const used = new Set<number>()
  let date: Date | null = null

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i].toLowerCase()

    if (t === 'hoy') {
      const d = new Date(); d.setHours(0, 0, 0, 0)
      date = d; used.add(i); continue
    }
    if (t === 'mañana') {
      const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(0, 0, 0, 0)
      date = d; used.add(i); continue
    }
    if (DAY_NAMES[t] !== undefined) {
      date = nextWeekday(DAY_NAMES[t]); used.add(i); continue
    }
    // dd/mm
    if (/^\d{1,2}\/\d{1,2}$/.test(t)) {
      const [dd, mm] = t.split('/').map(Number)
      const d = new Date()
      d.setMonth(mm - 1, dd)
      d.setHours(0, 0, 0, 0)
      // If date already passed this year, go next year
      if (d < new Date()) d.setFullYear(d.getFullYear() + 1)
      date = d; used.add(i); continue
    }
    // HH:MM
    if (/^\d{1,2}:\d{2}$/.test(t)) {
      const [hh, min] = t.split(':').map(Number)
      if (!date) { date = new Date(); date.setHours(0, 0, 0, 0) }
      date.setHours(hh, min, 0, 0)
      used.add(i); continue
    }
  }

  return { date, usedTokens: used }
}

function parseQuery(raw: string): ParsedQuery {
  // Extract flags at the end (order insensitive, anywhere after last word)
  const flagRegex = /\s+-(t|e|b|f)\b/gi
  let isTask = false
  let isEvent = false
  let isBucle = false
  let isFavorite = false

  let stripped = raw
  let match: RegExpExecArray | null
  const re = /\s*-(t|e|b|f)\b/gi
  while ((match = re.exec(raw)) !== null) {
    const flag = match[1].toLowerCase()
    if (flag === 't') isTask = true
    else if (flag === 'e') isEvent = true
    else if (flag === 'b') isBucle = true
    else if (flag === 'f') isFavorite = true
  }
  stripped = raw.replace(flagRegex, '').trim()
  // Also handle flags at end without leading space but with leading dash
  stripped = stripped.replace(/\s*-(t|e|b|f)\b/gi, '').trim()

  // Parse date tokens
  const tokens = stripped.split(/\s+/)
  const { date, usedTokens } = parseNaturalDate(tokens)

  const cleanTokens = tokens.filter((_, i) => !usedTokens.has(i))
  const cleanText = cleanTokens.join(' ').trim()

  // Build date label
  let dateLabel: string | null = null
  if (date) {
    const now = new Date(); now.setHours(0, 0, 0, 0)
    const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1)
    if (date.toDateString() === now.toDateString()) dateLabel = 'hoy'
    else if (date.toDateString() === tomorrow.toDateString()) dateLabel = 'mañana'
    else {
      const dayNames = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
      const dayN = dayNames[date.getDay()]
      const dd = String(date.getDate()).padStart(2, '0')
      const mm = String(date.getMonth() + 1).padStart(2, '0')
      dateLabel = `${dayN} ${dd}/${mm}`
    }
  }

  return {
    cleanText,
    isTask,
    isEvent,
    isBucle,
    isFavorite,
    due: date ? date.toISOString() : null,
    dateLabel,
  }
}

function getCreateLabel(parsed: ParsedQuery): { icon: string; label: string } {
  if (parsed.isEvent) return { icon: '📅', label: 'Evento' }
  if (parsed.isBucle) return { icon: '↺', label: 'Bucle' }
  if (parsed.isTask) return { icon: '○', label: 'Tarea' }
  return { icon: '📄', label: 'Nota' }
}

export default function CommandPalette({ onClose }: Props) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const parsed = parseQuery(query)
  const hasFlags = parsed.isTask || parsed.isEvent || parsed.isBucle || parsed.isFavorite
  const { icon: createIcon, label: createLabel } = getCreateLabel(parsed)

  const doCreate = useCallback(() => {
    const text = parsed.cleanText || query.trim()
    if (!text) return

    const diaryNode = store.todayDiary()
    const types: string[] = parsed.isBucle ? ['bucle'] : []

    const node = store.createNode({
      text,
      parentId: diaryNode?.id || null,
      isTask: parsed.isTask || parsed.isBucle,
      due: parsed.due,
      types,
    })

    if (parsed.isEvent) store.updateNode(node.id, { isEvent: true })
    if (parsed.isFavorite) store.updateNode(node.id, { isFavorite: true })

    const label = createLabel
    showToast(`✓ ${label} creada`)
    onClose()
  }, [parsed, query, createLabel, showToast, onClose])

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
        id: 'action-followup',
        icon: '↺',
        label: 'Ir a seguimiento',
        type: 'action',
        action: () => { navigate('/followup'); onClose() },
      },
      {
        id: 'action-chat',
        icon: '✦',
        label: 'Ir al chat IA',
        type: 'action',
        action: () => { navigate('/chat'); onClose() },
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
      .map(n => {
        const parentText = n.parentId ? store.getNode(n.parentId)?.text : undefined
        return {
          id: `recent-${n.id}`,
          icon: n.isDiaryEntry ? '📓' : n.status === 'done' ? '✅' : n.status === 'pending' ? '○' : (n.types || []).includes('bucle') ? '↺' : n.isEvent ? '📅' : n.isFavorite ? '★' : '📄',
          label: n.text || 'Sin título',
          sublabel: parentText || undefined,
          type: 'recent' as const,
          action: () => {
            recordRecentNode(n.id)
            navigate(`/node/${n.id}`)
            onClose()
          },
        }
      })

    // All notes for search — ordenadas por updatedAt (más recientes primero)
    const allNotes: PaletteItem[] = store.allActive()
      .filter(n => !n.isDiaryEntry && !recentIds.includes(n.id))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(n => {
        const parentText = n.parentId ? store.getNode(n.parentId)?.text : undefined
        return {
          id: `note-${n.id}`,
          icon: n.status === 'done' ? '✅' : n.status === 'pending' ? '○' : (n.types || []).includes('bucle') ? '↺' : n.isEvent ? '📅' : n.isFavorite ? '★' : '📄',
          label: n.text || 'Sin título',
          sublabel: parentText || undefined,
          type: 'note' as const,
          action: () => {
            recordRecentNode(n.id)
            navigate(`/node/${n.id}`)
            onClose()
          },
        }
      })

    if (!query.trim()) {
      // No query: actions + recent
      items.push(...actions, ...recentItems)
    } else {
      // First item: crear (siempre que haya query)
      const displayText = parsed.cleanText || query.trim()
      items.push({
        id: 'create-item',
        icon: createIcon,
        label: `Crear ${createLabel.toLowerCase()}: ${displayText}`,
        type: 'create',
        action: doCreate,
      })

      // Si el query empieza con #, buscar por tag
      if (parsed.cleanText.startsWith('#')) {
        const tagQuery = parsed.cleanText.slice(1).toLowerCase()
        const taggedNodes = store.allActive().filter(n =>
          !n.deletedAt && (n.types || []).some(t => t.toLowerCase().includes(tagQuery))
        )
        items.push(...taggedNodes.map(n => {
          const matchedTag = (n.types || []).find(t => t.toLowerCase().includes(tagQuery)) || tagQuery
          const parentText = n.parentId ? store.getNode(n.parentId)?.text : undefined
          return {
            id: `tag-${n.id}`,
            icon: n.status === 'done' ? '✅' : n.status === 'pending' ? '○' : (n.types || []).includes('bucle') ? '↺' : n.isEvent ? '📅' : n.isFavorite ? '★' : '📄',
            label: `${n.text || 'Sin título'} · #${matchedTag}`,
            sublabel: parentText || undefined,
            type: 'note' as const,
            action: () => { recordRecentNode(n.id); navigate(`/node/${n.id}`); onClose() },
          }
        }))
        return items
      }

      // Filter rest by fuzzy match against CLEAN text (sin flags)
      const searchTerm = parsed.cleanText || query.trim()
      const filteredActions = actions.filter(a => fuzzyMatch(a.label, searchTerm))
      const filteredRecent = recentItems.filter(r => fuzzyMatch(r.label, searchTerm))
      const filteredNotes = allNotes.filter(n => fuzzyMatch(n.label, searchTerm))
      items.push(...filteredActions, ...filteredRecent, ...filteredNotes)
    }

    return items
  }, [query, parsed, createIcon, createLabel, doCreate, navigate, onClose])

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

  const showChips = query.trim() && (hasFlags || parsed.due)

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
            placeholder="Buscar o crear... (-t tarea, -e evento, -b bucle, -f favorito)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {query && (
            <button className="cmdpalette-clear" onClick={() => setQuery('')}>×</button>
          )}
        </div>

        {showChips && (
          <div className="cmdpalette-chips">
            {parsed.isTask && <span className="cmdpalette-chip">○ Tarea</span>}
            {parsed.isEvent && <span className="cmdpalette-chip">📅 Evento</span>}
            {parsed.isBucle && <span className="cmdpalette-chip">↺ Bucle</span>}
            {parsed.isFavorite && <span className="cmdpalette-chip">★ Favorito</span>}
            {parsed.dateLabel && (
              <span className="cmdpalette-chip cmdpalette-chip--date">📅 {parsed.dateLabel}</span>
            )}
          </div>
        )}

        <div ref={listRef} className="cmdpalette-results">
          {items.length === 0 && (
            <div className="cmdpalette-empty">Sin resultados para "{query}"</div>
          )}
          {!query.trim() ? (() => {
            // Split items into actions and recents for sectioned display
            const actionItems = items.filter(i => i.type === 'action')
            const recentItems = items.filter(i => i.type === 'recent')
            let globalIdx = 0
            return (
              <>
                {actionItems.length > 0 && (
                  <>
                    <div className="cmdpalette-section-label">Acciones rápidas</div>
                    {actionItems.slice(0, 5).map(item => {
                      const idx = globalIdx++
                      return (
                        <button
                          key={item.id}
                          className={`cmdpalette-item ${idx === activeIdx ? 'active' : ''} cmdpalette-item--${item.type}`}
                          onClick={item.action}
                          onMouseEnter={() => setActiveIdx(idx)}
                        >
                          <span className="cmdpalette-item-icon">{item.icon}</span>
                          <div className="cmdpalette-item-info">
                            <span className="cmdpalette-item-label">{item.label}</span>
                          </div>
                          {item.id === 'action-new-note' && (
                            <span className="cmdpalette-item-kbd">⌘N</span>
                          )}
                        </button>
                      )
                    })}
                  </>
                )}
                {recentItems.length > 0 && (
                  <>
                    <div className="cmdpalette-section-label">Recientes</div>
                    {recentItems.map(item => {
                      const idx = globalIdx++
                      return (
                        <button
                          key={item.id}
                          className={`cmdpalette-item ${idx === activeIdx ? 'active' : ''} cmdpalette-item--${item.type}`}
                          onClick={item.action}
                          onMouseEnter={() => setActiveIdx(idx)}
                        >
                          <span className="cmdpalette-item-icon">{item.icon}</span>
                          <div className="cmdpalette-item-info">
                            <span className="cmdpalette-item-label">{item.label}</span>
                            {item.sublabel && <span className="cmdpalette-item-sublabel">{item.sublabel}</span>}
                          </div>
                        </button>
                      )
                    })}
                  </>
                )}
              </>
            )
          })() : items.map((item, idx) => (
            <button
              key={item.id}
              className={`cmdpalette-item ${idx === activeIdx ? 'active' : ''} cmdpalette-item--${item.type}`}
              onClick={item.action}
              onMouseEnter={() => setActiveIdx(idx)}
            >
              <span className="cmdpalette-item-icon">{item.icon}</span>
              <div className="cmdpalette-item-info">
                <span className="cmdpalette-item-label">{item.label}</span>
                {item.sublabel && <span className="cmdpalette-item-sublabel">{item.sublabel}</span>}
              </div>
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
