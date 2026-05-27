import { createPortal } from 'react-dom'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { store } from '../store/nodeStore'
import { useToast } from './Toast'
import { normalizeText } from '../utils/normalize'
import { getTodayDiaryUnderAgenda } from '../utils/agendaHelper'

interface Props {
  onClose: () => void
}

interface PaletteItem {
  id: string
  label: string
  sublabel?: string
  type: 'note' | 'tag' | 'create' | 'panel-save' | 'wf-action'
  taskStatus?: 'pending' | 'done' | null
  action: () => void
  score: number
}

// ── Panels storage ───────────────────────────────────────────────────────────
const PANELS_KEY = 'from_panels'
function addPanel(name: string, query: string) {
  try {
    const panels = JSON.parse(localStorage.getItem(PANELS_KEY) || '[]')
    panels.push({ id: Date.now().toString(), name, query, createdAt: new Date().toISOString() })
    localStorage.setItem(PANELS_KEY, JSON.stringify(panels))
    // Forzar re-render del sidebar via evento
    window.dispatchEvent(new Event('panels-updated'))
  } catch { /* ignore */ }
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

// ── Scoring estricto — sin fuzzy char-by-char ────────────────────────────────
// Solo coincide si el texto contiene la query (o todas sus palabras)

function scoreMatch(haystack: string, needle: string): number {
  if (!needle.trim()) return 0
  // Normalizar: sin tildes, sin mayúsculas — "Códigos" === "codigos" === "CODIGOS"
  const h = normalizeText(haystack)
  const n = normalizeText(needle.trim())

  if (h === n) return 100
  if (h.startsWith(n)) return 80
  if (h.includes(n)) return 60

  // Todas las palabras del query deben estar en el texto como substrings
  const words = n.split(/\s+/).filter(w => w.length > 1)
  if (words.length >= 2 && words.every(w => h.includes(w))) {
    return 30 + Math.round(20 * n.length / Math.max(h.length, 1))
  }

  // Una sola palabra corta → coincidencia parcial solo si ≥3 caracteres
  if (words.length === 1 && words[0].length >= 3 && h.includes(words[0])) {
    return 20
  }

  return 0 // Sin coincidencia
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
  const now = new Date(), today = now.getDay()
  let diff = dayIndex - today
  if (diff <= 0) diff += 7
  const d = new Date(now); d.setDate(d.getDate() + diff); d.setHours(0, 0, 0, 0); return d
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
      const [hh, mn] = t.split(':').map(Number)
      if (!date) { date = new Date(); date.setHours(0,0,0,0) }
      date.setHours(hh, mn, 0, 0); used.add(i); continue
    }
  }
  return { date, usedTokens: used }
}

function parseQuery(raw: string): ParsedQuery {
  let isTask = false, isEvent = false, isFavorite = false
  // v8.27: eliminados los flags -s y -a (bucle obsoleto).
  const re = /\s*-(t|e|f)\b/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(raw)) !== null) {
    const f = m[1].toLowerCase()
    if (f === 't') isTask = true
    else if (f === 'e') isEvent = true
    else if (f === 'f') isFavorite = true
  }
  const stripped = raw.replace(/\s*-(t|e|f)\b/gi, '').trim()
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
  return { cleanText, isTask, isEvent, isSeguimiento: false, isFavorite, due: date ? date.toISOString() : null, dateLabel }
}

// ─────────────────────────────────────────────────────────────────────────────

export default function CommandPalette({ onClose }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const { showToast } = useToast()
  // Nodo actual si estamos en /node/:id
  const currentNodeId = (() => {
    const m = location.pathname.match(/\/node\/([^/]+)/)
    return m ? m[1] : null
  })()
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const [creatingPanel, setCreatingPanel] = useState(false)
  const [panelName, setPanelName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const panelNameRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const parsed = parseQuery(query)
  const hasFlags = parsed.isTask || parsed.isEvent  || parsed.isFavorite

  const doCreate = useCallback(() => {
    const text = parsed.cleanText || query.trim()
    if (!text) return
    const diary = store.todayDiary()
    const todayISO = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
    const taskDue = parsed.isTask ? (parsed.due ?? todayISO) : parsed.due
    const node = store.createNode({ text, parentId: diary?.id || null, isTask: parsed.isTask, due: taskDue })
    if (parsed.isEvent) {
      const eventDue = parsed.due ?? new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
      store.updateNode(node.id, { isEvent: true, due: eventDue })
    }
    if (parsed.isFavorite) store.updateNode(node.id, { isFavorite: true })
    const label = parsed.isEvent ? 'Evento' : parsed.isTask ? 'Tarea' : 'Nota'
    showToast(`✓ ${label} creada`)
    onClose()
  }, [parsed, query, showToast, onClose])

  const buildItems = useCallback((): PaletteItem[] => {
    const q = query.trim()

    // ── Sin query: mostrar comandos rápidos fijos ──────────────────────────
    if (!q) {
      const todayLabel = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
      const tomorrowLabel = (() => { const d = new Date(); d.setDate(d.getDate()+1); return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) })()
      return [
        {
          id: 'quick-today',
          label: 'Hoy',
          sublabel: todayLabel,
          type: 'wf-action',
          taskStatus: null,
          score: 200,
          action: () => { const n = getTodayDiaryUnderAgenda(); navigate(`/node/${n.id}`); onClose() },
        },
        {
          id: 'quick-tomorrow',
          label: 'Mañana',
          sublabel: tomorrowLabel,
          type: 'wf-action',
          taskStatus: null,
          score: 190,
          action: () => {
            const d = new Date(); d.setDate(d.getDate()+1)
            // importar ensureDayPath dinámicamente
            import('../utils/agendaHelper').then(({ ensureDayPath }) => {
              const n = ensureDayPath(d); navigate(`/node/${n.id}`); onClose()
            })
          },
        },
        // Contextos de 🧠 Contexto
        ...(() => {
          const contextoRoot = store.children(null).find(n => !n.deletedAt && n.text === '🧠 Contexto')
          if (!contextoRoot) return []
          return store.children(contextoRoot.id).filter(n => !n.deletedAt).map(n => ({
            id: `ctx-${n.id}`,
            label: n.text || '',
            sublabel: 'Filtrar por este contexto',
            type: 'wf-action' as const,
            taskStatus: null as null,
            score: 150,
            action: () => {
              window.dispatchEvent(new CustomEvent('wf:set-filter', { detail: { query: `@${(n.text||'').toLowerCase().replace(/\s+/g, '-')}` } }))
              onClose()
            },
          }))
        })(),
      ]
    }

    const qNorm = normalizeText(q)

    // ── Comandos rápidos temporales (hoy, mañana...) ─────────────────────
    if (['hoy', 'today', 'ho'].some(t => t.startsWith(qNorm) || qNorm.startsWith(t.slice(0,2)))) {
      const todayLabel = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
      return [{
        id: 'quick-today',
        label: 'Hoy — nota del día',
        sublabel: todayLabel,
        type: 'wf-action',
        taskStatus: null,
        score: 300,
        action: () => { const n = getTodayDiaryUnderAgenda(); navigate(`/node/${n.id}`); onClose() },
      }]
    }
    if (['mañana', 'manana', 'tomorrow', 'ma'].some(t => qNorm.length >= 2 && (t.startsWith(qNorm) || qNorm.startsWith(t.slice(0,3))))) {
      const d = new Date(); d.setDate(d.getDate()+1)
      const label = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
      return [{
        id: 'quick-tomorrow',
        label: 'Mañana — nota del día',
        sublabel: label,
        type: 'wf-action',
        taskStatus: null,
        score: 300,
        action: () => {
          import('../utils/agendaHelper').then(({ ensureDayPath }) => {
            const n = ensureDayPath(d); navigate(`/node/${n.id}`); onClose()
          })
        },
      }]
    }

    // ── Contextos (🧠 Contexto): búsqueda por nombre del contexto ─────────
    const contextoRoot = store.children(null).find(n => !n.deletedAt && n.text === '🧠 Contexto')
    if (contextoRoot) {
      const ctxNodes = store.children(contextoRoot.id).filter(n =>
        !n.deletedAt && n.text && normalizeText(n.text).includes(qNorm)
      )
      if (ctxNodes.length > 0) {
        return ctxNodes.map(n => ({
          id: `ctx-${n.id}`,
          label: n.text || '',
          sublabel: 'Filtrar nodos con este contexto',
          type: 'wf-action' as const,
          taskStatus: null as null,
          score: 200,
          action: () => {
            const slug = (n.text||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,'-')
            window.dispatchEvent(new CustomEvent('wf:set-filter', { detail: { query: `@${slug}` } }))
            onClose()
          },
        }))
      }
    }

    // ── Modo tag: query empieza con # ──────────────────────────────────────
    if (q.startsWith('#')) {
      const tagQuery = q.slice(1).toLowerCase()
      const allTags = store.allUsedTags()

      if (!tagQuery) {
        // Solo '#' → mostrar todos los tags disponibles
        return allTags.map(tag => ({
          id: `tag-${tag}`,
          label: `#${tag}`,
          type: 'tag' as const,
          taskStatus: null,
          score: 100,
          action: () => {
            const nodes = store.allActive().filter(n => !n.deletedAt && (n.types || []).includes(tag))
            if (nodes.length === 1) { navigate(`/node/${nodes[0].id}`); onClose(); return }
            navigate(`/tag/${tag}`); onClose()
          },
        }))
      }

      // '#foo' → tags que coincidan + notas con ese tag
      const matchingTags = allTags.filter(t => t.toLowerCase().includes(tagQuery))
      const tagItems: PaletteItem[] = matchingTags.map(tag => ({
        id: `tag-${tag}`,
        label: `#${tag}`,
        sublabel: `${store.allActive().filter(n => !n.deletedAt && (n.types||[]).includes(tag)).length} notas`,
        type: 'tag' as const,
        taskStatus: null,
        score: tag.toLowerCase().startsWith(tagQuery) ? 90 : 60,
        action: () => { navigate(`/tag/${tag}`); onClose() },
      }))

      // Notas con ese tag exacto (si hay un match exacto)
      const exactTag = matchingTags.find(t => t.toLowerCase() === tagQuery)
      const noteItems: PaletteItem[] = exactTag
        ? store.allActive()
            .filter(n => !n.deletedAt && (n.types || []).includes(exactTag))
            .map(n => ({
              id: `tagged-${n.id}`,
              label: n.text || 'Sin título',
              sublabel: `#${exactTag}`,
              type: 'note' as const,
              taskStatus: n.status as 'pending' | 'done' | null ?? null,
              score: 50,
              action: () => { recordRecentNode(n.id); navigate(`/node/${n.id}`); onClose() },
            }))
        : []

      return [...tagItems.sort((a, b) => b.score - a.score), ...noteItems]
    }

    // ── Búsqueda estricta por texto ────────────────────────────────────────
    const searchTerm = parsed.cleanText || q

    const results: PaletteItem[] = []
    for (const n of store.allActive()) {
      if (n.isDiaryEntry || n.deletedAt) continue
      const sc = scoreMatch(n.text || '', searchTerm)
      if (sc === 0) continue
      const parentText = n.parentId ? store.getNode(n.parentId)?.text : undefined
      results.push({
        id: `note-${n.id}`,
        label: n.text || 'Sin título',
        sublabel: parentText,
        type: 'note' as const,
        taskStatus: (n.status as 'pending' | 'done' | null) ?? null,
        score: sc,
        action: () => { recordRecentNode(n.id); navigate(`/node/${n.id}`); onClose() },
      })
    }
    results.sort((a, b) => b.score - a.score)
    results.splice(20)

    // ── Comandos WF: colapsar/expandir todo ──────────────────────────────
    const collapseTerms = ['colapsar', 'collapse', 'plegar', 'contraer']
    const expandTerms = ['expandir', 'expand', 'desplegar', 'abrir todo']
    const qLow = q.toLowerCase()
    if (collapseTerms.some(t => t.includes(qLow) || qLow.includes(t.slice(0, 3)))) {
      results.unshift({
        id: 'wf-collapse-all',
        label: 'Colapsar todo',
        sublabel: currentNodeId ? 'Colapsa todos los hijos del nodo actual' : 'Colapsa todos los nodos raíz',
        type: 'wf-action',
        taskStatus: null,
        score: 200,
        action: () => {
          store.collapseAll(currentNodeId)
          onClose()
          showToast('Todo colapsado', 'success')
        },
      })
    }
    if (expandTerms.some(t => t.includes(qLow) || qLow.includes(t.slice(0, 3)))) {
      results.unshift({
        id: 'wf-expand-all',
        label: 'Expandir todo',
        sublabel: currentNodeId ? 'Expande todos los hijos del nodo actual' : 'Expande todos los nodos raíz',
        type: 'wf-action',
        taskStatus: null,
        score: 200,
        action: () => {
          store.expandAll(currentNodeId)
          onClose()
          showToast('Todo expandido', 'success')
        },
      })
    }

    // "Crear nota" solo si no hay resultados
    if (results.length === 0) {
      const displayText = parsed.cleanText || q
      const label = parsed.isEvent ? 'Evento' : parsed.isTask ? 'Tarea' : 'Nota'
      results.push({
        id: 'create-item',
        label: `Crear ${label.toLowerCase()}: ${displayText}`,
        type: 'create',
        taskStatus: null,
        score: -1,
        action: doCreate,
      })
    }

    // "Guardar como panel" siempre al final cuando hay query
    results.push({
      id: 'panel-save',
      label: `Guardar como panel`,
      sublabel: `"${q}"`,
      type: 'panel-save',
      taskStatus: null,
      score: -99,
      action: () => {
        setPanelName(q)
        setCreatingPanel(true)
        setTimeout(() => panelNameRef.current?.focus(), 0)
      },
    })

    return results
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

  function handleSavePanel() {
    if (!panelName.trim()) return
    addPanel(panelName.trim(), query)
    showToast(`Panel "${panelName.trim()}" guardado`)
    onClose()
  }

  return createPortal(
    <div className="cmdpalette-overlay" onClick={onClose}>
      <div className="cmdpalette-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">

        {/* Modo: crear panel */}
        {creatingPanel ? (
          <div className="cmdpalette-panel-create">
            <span className="cmdpalette-panel-create-label">Nombre del panel</span>
            <input
              ref={panelNameRef}
              className="cmdpalette-panel-create-input"
              placeholder={`Panel para "${query}"`}
              value={panelName}
              onChange={e => setPanelName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); handleSavePanel() }
                if (e.key === 'Escape') { e.preventDefault(); setCreatingPanel(false); setTimeout(() => inputRef.current?.focus(), 0) }
              }}
            />
            <div className="cmdpalette-panel-create-actions">
              <button className="cmdpalette-panel-create-btn" onClick={handleSavePanel}>Guardar panel</button>
              <button className="cmdpalette-panel-create-cancel" onClick={() => { setCreatingPanel(false); setTimeout(() => inputRef.current?.focus(), 0) }}>Cancelar</button>
            </div>
          </div>
        ) : (
        <>
        <div className="cmdpalette-search-row">
          <svg className="cmdpalette-search-icon" width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="8" cy="8" r="6"/><path d="M14 14l4 4"/>
          </svg>
          <input
            ref={inputRef}
            className="cmdpalette-input"
            placeholder="Buscar... (# para tags, -t tarea, -e evento, -a bucle)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {query && <button className="cmdpalette-clear" onClick={() => setQuery('')}>×</button>}
        </div>

        {showChips && (
          <div className="cmdpalette-chips">
            {parsed.isTask && <span className="cmdpalette-chip">○ Tarea</span>}
            {parsed.isEvent && <span className="cmdpalette-chip">📅 Evento</span>}
                        {parsed.isFavorite && <span className="cmdpalette-chip">★ Favorito</span>}
            {parsed.dateLabel && <span className="cmdpalette-chip cmdpalette-chip--date">📅 {parsed.dateLabel}</span>}
          </div>
        )}

        {items.length > 0 && (
          <div ref={listRef} className="cmdpalette-results">
            {/* Sección label para tags */}
            {query.startsWith('#') && items[0]?.type === 'tag' && (
              <div className="cmdpalette-section-label">Tags</div>
            )}
            {items.map((item, idx) => {
              const isPanelSave = item.type === 'panel-save'
              // Separador antes de "Guardar como panel"
              const prevItem = items[idx - 1]
              const showSep = isPanelSave && prevItem && prevItem.type !== 'panel-save'
              return (
                <div key={item.id}>
                  {showSep && <div className="cmdpalette-sep" />}
                  <button
                    className={`cmdpalette-item ${idx === activeIdx ? 'active' : ''} cmdpalette-item--${item.type}`}
                    onClick={item.action}
                    onMouseEnter={() => setActiveIdx(idx)}
                  >
                    {isPanelSave ? (
                      <span className="cmdpalette-panel-icon">◈</span>
                    ) : item.type === 'tag' ? (
                      <span className="cmdpalette-tag-dot" />
                    ) : item.taskStatus !== null && item.taskStatus !== undefined ? (
                      <span className={`cmdpalette-task-dot ${item.taskStatus === 'done' ? 'done' : 'pending'}`} />
                    ) : item.type === 'create' ? (
                      <span className="cmdpalette-create-icon">+</span>
                    ) : item.type === 'wf-action' ? (
                      <span className="cmdpalette-create-icon">⌘</span>
                    ) : null}
                    <div className="cmdpalette-item-info">
                      <span className={`cmdpalette-item-label ${item.taskStatus === 'done' ? 'done' : ''} ${isPanelSave ? 'panel-save' : ''}`}>{item.label}</span>
                      {item.sublabel && <span className="cmdpalette-item-sublabel">{item.sublabel}</span>}
                    </div>
                  </button>
                </div>
              )
            })}
          </div>
        )}
        </>
        )}
      </div>
    </div>,
    document.body
  )
}
