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
  label: string
  sublabel?: string
  type: 'note' | 'recent' | 'create'
  /** null = no task, 'pending' = tarea pendiente, 'done' = tarea hecha */
  taskStatus?: 'pending' | 'done' | null
  action: () => void
  score: number
}

const RECENT_KEY = 'from_recent_nodes'

function getRecentNodes(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch { return [] }
}

export function recordRecentNode(id: string) {
  const recent = getRecentNodes().filter(r => r !== id)
  recent.unshift(id)
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 10)))
}

// ── Scoring ──────────────────────────────────────────────────────────────────

function scoreMatch(haystack: string, needle: string): number {
  if (!needle) return 1
  const h = haystack.toLowerCase()
  const n = needle.toLowerCase()
  if (h === n) return 100
  if (h.startsWith(n)) return 80
  if (h.includes(n)) return 60
  // fuzzy
  let hi = 0, consec = 0, score = 0
  for (let i = 0; i < n.length; i++) {
    const idx = h.indexOf(n[i], hi)
    if (idx === -1) return 0
    consec = idx === hi ? consec + 1 : 0
    score += consec * 2
    hi = idx + 1
  }
  return score + 10
}

// ── Natural language parsing ─────────────────────────────────────────────────

interface ParsedQuery {
  cleanText: string
  isTask: boolean
  isEvent: boolean
  isSeguimiento: boolean
  isFavorite: boolean
  due: string | null
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
    if (t === 'hoy') { const d = new Date(); d.setHours(0,0,0,0); date = d; used.add(i); continue }
    if (t === 'mañana') { const d = new Date(); d.setDate(d.getDate()+1); d.setHours(0,0,0,0); date = d; used.add(i); continue }
    if (DAY_NAMES[t] !== undefined) { date = nextWeekday(DAY_NAMES[t]); used.add(i); continue }
    if (/^\d{1,2}\/\d{1,2}$/.test(t)) {
      const [dd, mm] = t.split('/').map(Number)
      const d = new Date(); d.setMonth(mm-1, dd); d.setHours(0,0,0,0)
      if (d < new Date()) d.setFullYear(d.getFullYear()+1)
      date = d; used.add(i); continue
    }
    if (/^\d{1,2}:\d{2}$/.test(t)) {
      const [hh, min] = t.split(':').map(Number)
      if (!date) { date = new Date(); date.setHours(0,0,0,0) }
      date.setHours(hh, min, 0, 0); used.add(i); continue
    }
  }
  return { date, usedTokens: used }
}

function parseQuery(raw: string): ParsedQuery {
  const flagRegex = /\s+-(t|e|s|f)\b/gi
  let isTask = false, isEvent = false, isSeguimiento = false, isFavorite = false
  let match: RegExpExecArray | null
  const re = /\s*-(t|e|s|f)\b/gi
  while ((match = re.exec(raw)) !== null) {
    const flag = match[1].toLowerCase()
    if (flag === 't') isTask = true
    else if (flag === 'e') isEvent = true
    else if (flag === 's') isSeguimiento = true
    else if (flag === 'f') isFavorite = true
  }
  const stripped = raw.replace(flagRegex, '').replace(/\s*-(t|e|s|f)\b/gi, '').trim()
  const tokens = stripped.split(/\s+/)
  const { date, usedTokens } = parseNaturalDate(tokens)
  const cleanText = tokens.filter((_, i) => !usedTokens.has(i)).join(' ').trim()
  let dateLabel: string | null = null
  if (date) {
    const now = new Date(); now.setHours(0,0,0,0)
    const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate()+1)
    if (date.toDateString() === now.toDateString()) dateLabel = 'hoy'
    else if (date.toDateString() === tomorrow.toDateString()) dateLabel = 'mañana'
    else {
      const days = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
      dateLabel = `${days[date.getDay()]} ${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}`
    }
  }
  return { cleanText, isTask, isEvent, isSeguimiento, isFavorite, due: date ? date.toISOString() : null, dateLabel }
}

// ─────────────────────────────────────────────────────────────────────────────

export default function CommandPalette({ onClose }: Props) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const parsed = parseQuery(query)
  const hasFlags = parsed.isTask || parsed.isEvent || parsed.isSeguimiento || parsed.isFavorite

  const doCreate = useCallback(() => {
    const text = parsed.cleanText || query.trim()
    if (!text) return
    const diary = store.todayDiary()
    const types: string[] = parsed.isSeguimiento ? ['bucle'] : []
    const node = store.createNode({
      text, parentId: diary?.id || null,
      isTask: parsed.isTask || parsed.isSeguimiento, due: parsed.due, types,
    })
    if (parsed.isEvent) store.updateNode(node.id, { isEvent: true })
    if (parsed.isFavorite) store.updateNode(node.id, { isFavorite: true })
    const label = parsed.isEvent ? 'Evento' : parsed.isSeguimiento ? 'Seguimiento' : parsed.isTask ? 'Tarea' : 'Nota'
    showToast(`✓ ${label} creada`)
    onClose()
  }, [parsed, query, showToast, onClose])

  const buildItems = useCallback((): PaletteItem[] => {
    const recentIds = getRecentNodes()

    const toItem = (n: ReturnType<typeof store.getNode>, type: 'recent' | 'note', scoreVal: number): PaletteItem | null => {
      if (!n || n.deletedAt) return null
      const parentText = n.parentId ? store.getNode(n.parentId)?.text : undefined
      return {
        id: `${type}-${n.id}`,
        label: n.text || 'Sin título',
        sublabel: parentText || undefined,
        type,
        taskStatus: n.status as 'pending' | 'done' | null ?? null,
        score: scoreVal,
        action: () => { recordRecentNode(n.id); navigate(`/node/${n.id}`); onClose() },
      }
    }

    if (!query.trim()) {
      // Sin query: solo recientes
      return recentIds
        .map(id => toItem(store.getNode(id), 'recent', 0))
        .filter((x): x is PaletteItem => x !== null)
    }

    const searchTerm = parsed.cleanText || query.trim()

    // Recientes que coincidan
    const recentMatches: PaletteItem[] = recentIds
      .map(id => {
        const n = store.getNode(id)
        if (!n || n.deletedAt) return null
        const sc = scoreMatch(n.text || '', searchTerm)
        if (sc === 0) return null
        return toItem(n, 'recent', sc + 10)  // +10 bonus por ser reciente
      })
      .filter((x): x is PaletteItem => x !== null)

    // Resto de notas
    const noteMatches: PaletteItem[] = store.allActive()
      .filter(n => !n.isDiaryEntry && !recentIds.includes(n.id))
      .map(n => {
        const sc = scoreMatch(n.text || '', searchTerm)
        if (sc === 0) return null
        return toItem(n, 'note', sc)
      })
      .filter((x): x is PaletteItem => x !== null)

    const all = [...recentMatches, ...noteMatches].sort((a, b) => b.score - a.score)

    // "Crear nota" solo si NO hay resultados
    if (all.length === 0) {
      const displayText = parsed.cleanText || query.trim()
      const label = parsed.isEvent ? 'Evento' : parsed.isSeguimiento ? 'Seguimiento' : parsed.isTask ? 'Tarea' : 'Nota'
      all.push({
        id: 'create-item',
        label: `Crear ${label.toLowerCase()}: ${displayText}`,
        type: 'create',
        taskStatus: null,
        score: -1,
        action: doCreate,
      })
    }

    return all
  }, [query, parsed, doCreate, navigate, onClose])

  const items = buildItems()

  useEffect(() => { setActiveIdx(0) }, [query])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, items.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter') { e.preventDefault(); if (items[activeIdx]) items[activeIdx].action() }
  }

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
        role="dialog" aria-modal="true" aria-label="Búsqueda"
      >
        {/* Search row */}
        <div className="cmdpalette-search-row">
          <svg className="cmdpalette-search-icon" width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="8" cy="8" r="6"/><path d="M14 14l4 4"/>
          </svg>
          <input
            ref={inputRef}
            className="cmdpalette-input"
            placeholder="Buscar... (-t tarea, -e evento, -s seguimiento, -f favorito)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {query && (
            <button className="cmdpalette-clear" onClick={() => setQuery('')}>×</button>
          )}
        </div>

        {/* Flags chips */}
        {showChips && (
          <div className="cmdpalette-chips">
            {parsed.isTask && <span className="cmdpalette-chip">○ Tarea</span>}
            {parsed.isEvent && <span className="cmdpalette-chip">📅 Evento</span>}
            {parsed.isSeguimiento && <span className="cmdpalette-chip">👁 Seguimiento</span>}
            {parsed.isFavorite && <span className="cmdpalette-chip">★ Favorito</span>}
            {parsed.dateLabel && <span className="cmdpalette-chip cmdpalette-chip--date">📅 {parsed.dateLabel}</span>}
          </div>
        )}

        {/* Results */}
        <div ref={listRef} className="cmdpalette-results">
          {items.length === 0 && (
            <div className="cmdpalette-empty">Sin resultados</div>
          )}
          {!query.trim() && items.length > 0 && (
            <div className="cmdpalette-section-label">Recientes</div>
          )}
          {items.map((item, idx) => (
            <button
              key={item.id}
              className={`cmdpalette-item ${idx === activeIdx ? 'active' : ''} cmdpalette-item--${item.type}`}
              onClick={item.action}
              onMouseEnter={() => setActiveIdx(idx)}
            >
              {/* Indicador de estado — solo para tareas */}
              {item.taskStatus !== null && item.taskStatus !== undefined ? (
                <span className={`cmdpalette-task-dot ${item.taskStatus === 'done' ? 'done' : 'pending'}`} />
              ) : item.type === 'create' ? (
                <span className="cmdpalette-create-icon">+</span>
              ) : null}
              <div className="cmdpalette-item-info">
                <span className={`cmdpalette-item-label ${item.taskStatus === 'done' ? 'done' : ''}`}>{item.label}</span>
                {item.sublabel && <span className="cmdpalette-item-sublabel">{item.sublabel}</span>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}
