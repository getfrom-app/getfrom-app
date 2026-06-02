import { createPortal } from 'react-dom'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { store } from '../store/nodeStore'
import { useToast } from './Toast'
import { normalizeText } from '../utils/normalize'
import { getTodayDiaryUnderAgenda } from '../utils/agendaHelper'
import { getAtajosNode, getShortcutData } from '../utils/atajosHelper'

interface Props {
  onClose: () => void
  onSelectContext?: (nodeId: string) => void
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

type PaletteView = 'default' | 'filtros' | 'contextos'

export default function CommandPalette({ onClose, onSelectContext }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const { showToast } = useToast()
  // Nodo actual si estamos en /node/:id
  const currentNodeId = (() => {
    const m = location.pathname.match(/\/node\/([^/]+)/)
    return m ? m[1] : null
  })()
  const [query, setQuery] = useState('')
  const [view, setView] = useState<PaletteView>('default')
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

  // ── Helpers para sub-vistas ─────────────────────────────────────────────────
  const contextoRoot = store.children(null).find(n => !n.deletedAt && n.text === '🧠 Contexto') ?? null
  const atajosRoot = getAtajosNode()

  const allFilterNodes = useCallback((): { id: string; text: string; query: string }[] => {
    const out: { id: string; text: string; query: string }[] = []
    if (!atajosRoot) return out
    const collect = (parentId: string) => {
      for (const n of store.children(parentId).filter(c => !c.deletedAt)) {
        const sc = getShortcutData(n.id)
        if (sc?.query !== undefined) out.push({ id: n.id, text: n.text || '', query: sc.query })
        collect(n.id)
      }
    }
    collect(atajosRoot.id)
    return out
  }, [atajosRoot])

  const buildItems = useCallback((): PaletteItem[] => {
    const q = query.trim()
    const qNorm = normalizeText(q)

    // ══ Vista FILTROS ═══════════════════════════════════════════════════════
    if (view === 'filtros') {
      const filters = allFilterNodes()
      const filtered = q ? filters.filter(f => normalizeText(f.text).includes(qNorm)) : filters
      if (filtered.length === 0) return [{
        id: 'no-filtros', label: q ? `Sin filtros para "${q}"` : 'No hay filtros guardados',
        type: 'wf-action', taskStatus: null, score: 0, action: () => {},
      }]
      return filtered.map(f => ({
        id: `filtro-${f.id}`,
        label: f.text || t('common.noTitle'),
        sublabel: f.query,
        type: 'wf-action' as const,
        taskStatus: null,
        score: q ? scoreMatch(f.text, q) : 100,
        action: () => {
          window.dispatchEvent(new CustomEvent('wf:set-filter', { detail: { query: f.query } }))
          onClose()
        },
      }))
    }

    // ══ Vista CONTEXTOS ═════════════════════════════════════════════════════
    if (view === 'contextos') {
      if (!contextoRoot) return []
      const ctxAll = store.children(contextoRoot.id).filter(n => !n.deletedAt && n.text)
      const filtered = q ? ctxAll.filter(n => normalizeText(n.text).includes(qNorm)) : ctxAll
      if (filtered.length === 0) return [{
        id: 'no-ctx', label: q ? `Sin contextos para "${q}"` : 'No hay contextos',
        type: 'wf-action', taskStatus: null, score: 0, action: () => {},
      }]
      return filtered.map(n => ({
        id: `ctx-${n.id}`,
        label: n.text || '',
        sublabel: 'Abrir contexto',
        type: 'wf-action' as const,
        taskStatus: null as null,
        score: q ? scoreMatch(n.text || '', q) : 100,
        action: () => { onSelectContext?.(n.id); onClose() },
      }))
    }

    // ══ Vista DEFAULT sin query — categorías limpias ════════════════════════
    if (!q) {
      const todayLabel = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
      const tomorrowLabel = (() => { const d = new Date(); d.setDate(d.getDate()+1); return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) })()
      const items: PaletteItem[] = [
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
            import('../utils/agendaHelper').then(({ ensureDayPath }) => {
              const n = ensureDayPath(d); navigate(`/node/${n.id}`); onClose()
            })
          },
        },
        {
          id: 'cat-filtros',
          label: 'Filtros',
          sublabel: (() => { const c = allFilterNodes().length; return c > 0 ? `${c} filtros guardados` : 'Sin filtros guardados' })(),
          type: 'wf-action',
          taskStatus: null,
          score: 180,
          action: () => { setView('filtros'); setActiveIdx(0) },
        },
        {
          id: 'cat-contextos',
          label: 'Contextos',
          sublabel: (() => {
            if (!contextoRoot) return 'Sin contextos'
            const c = store.children(contextoRoot.id).filter(n => !n.deletedAt).length
            return c > 0 ? `${c} contextos` : 'Sin contextos'
          })(),
          type: 'wf-action',
          taskStatus: null,
          score: 170,
          action: () => { setView('contextos'); setActiveIdx(0) },
        },
      ]
      return items
    }

    // ══ Con query: búsqueda normal ══════════════════════════════════════════
    const qNormStr = qNorm

    // Hoy / Mañana shortcuts
    if (['hoy', 'today', 'ho'].some(kw => kw.startsWith(qNormStr) || qNormStr.startsWith(kw.slice(0, 2)))) {
      const todayLabel = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
      return [{ id: 'quick-today', label: t('cmdpalette.todayNote'), sublabel: todayLabel, type: 'wf-action', taskStatus: null, score: 300, action: () => { const n = getTodayDiaryUnderAgenda(); navigate(`/node/${n.id}`); onClose() } }]
    }
    if (['mañana', 'manana', 'tomorrow'].some(kw => qNormStr.length >= 2 && (kw.startsWith(qNormStr) || qNormStr.startsWith(kw.slice(0, 3))))) {
      const d = new Date(); d.setDate(d.getDate() + 1)
      const label = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
      return [{ id: 'quick-tomorrow', label: t('cmdpalette.tomorrowNote'), sublabel: label, type: 'wf-action', taskStatus: null, score: 300, action: () => { import('../utils/agendaHelper').then(({ ensureDayPath }) => { const n = ensureDayPath(d); navigate(`/node/${n.id}`); onClose() }) } }]
    }

    // "filtros" → switch a vista filtros
    if (['filtros', 'filtro', 'filter'].some(kw => kw.startsWith(qNormStr) || qNormStr === kw)) {
      return [{ id: 'cat-filtros', label: 'Filtros guardados', sublabel: 'Ver todos los filtros', type: 'wf-action', taskStatus: null, score: 300, action: () => { setView('filtros'); setQuery(''); setActiveIdx(0) } }]
    }

    // "contextos" → switch a vista contextos
    if (['contextos', 'contexto', 'context'].some(kw => kw.startsWith(qNormStr) || qNormStr === kw)) {
      return [{ id: 'cat-contextos', label: 'Contextos', sublabel: 'Ver todos los contextos', type: 'wf-action', taskStatus: null, score: 300, action: () => { setView('contextos'); setQuery(''); setActiveIdx(0) } }]
    }

    // Búsqueda por nombre de contexto
    if (contextoRoot) {
      const ctxNodes = store.children(contextoRoot.id).filter(n => !n.deletedAt && n.text && normalizeText(n.text).includes(qNormStr))
      if (ctxNodes.length > 0) {
        return ctxNodes.map(n => ({
          id: `ctx-${n.id}`, label: n.text || '', sublabel: 'Abrir contexto',
          type: 'wf-action' as const, taskStatus: null as null,
          score: scoreMatch(n.text || '', q),
          action: () => { onSelectContext?.(n.id); onClose() },
        }))
      }
    }

    // Modo tag: query empieza con #
    if (q.startsWith('#')) {
      const tagQuery = q.slice(1).toLowerCase()
      const allTags = store.allUsedTags()
      if (!tagQuery) {
        return allTags.map(tag => ({ id: `tag-${tag}`, label: `#${tag}`, type: 'tag' as const, taskStatus: null, score: 100, action: () => { const nodes = store.allActive().filter(n => !n.deletedAt && (n.types || []).includes(tag)); if (nodes.length === 1) { navigate(`/node/${nodes[0].id}`); onClose(); return }; navigate(`/tag/${tag}`); onClose() } }))
      }
      const matchingTags = allTags.filter(t => t.toLowerCase().includes(tagQuery))
      const tagItems: PaletteItem[] = matchingTags.map(tag => ({ id: `tag-${tag}`, label: `#${tag}`, sublabel: `${store.allActive().filter(n => !n.deletedAt && (n.types || []).includes(tag)).length} notas`, type: 'tag' as const, taskStatus: null, score: tag.toLowerCase().startsWith(tagQuery) ? 90 : 60, action: () => { navigate(`/tag/${tag}`); onClose() } }))
      const exactTag = matchingTags.find(t => t.toLowerCase() === tagQuery)
      const noteItems: PaletteItem[] = exactTag ? store.allActive().filter(n => !n.deletedAt && (n.types || []).includes(exactTag)).map(n => ({ id: `tagged-${n.id}`, label: n.text || 'Sin título', sublabel: `#${exactTag}`, type: 'note' as const, taskStatus: n.status as 'pending' | 'done' | null ?? null, score: 50, action: () => { recordRecentNode(n.id); navigate(`/node/${n.id}`); onClose() } })) : []
      return [...tagItems.sort((a, b) => b.score - a.score), ...noteItems]
    }

    // Búsqueda estricta por texto
    const searchTerm = parsed.cleanText || q
    const results: PaletteItem[] = []

    // Filtros guardados que coincidan
    for (const f of allFilterNodes()) {
      const sc2 = scoreMatch(f.text, searchTerm)
      if (sc2 > 0) results.push({ id: `filtro-${f.id}`, label: f.text || t('common.noTitle'), sublabel: `◈ ${f.query}`, type: 'wf-action' as const, taskStatus: null, score: sc2 + 10, action: () => { window.dispatchEvent(new CustomEvent('wf:set-filter', { detail: { query: f.query } })); onClose() } })
    }

    for (const n of store.allActive()) {
      if (n.isDiaryEntry || n.deletedAt) continue
      if (atajosRoot && (n.id === atajosRoot.id || n.parentId === atajosRoot.id)) continue
      const sc = scoreMatch(n.text || '', searchTerm)
      if (sc === 0) continue
      const parentText = n.parentId ? store.getNode(n.parentId)?.text : undefined
      results.push({ id: `note-${n.id}`, label: n.text || t('common.noTitle'), sublabel: parentText, type: 'note' as const, taskStatus: (n.status as 'pending' | 'done' | null) ?? null, score: sc, action: () => { recordRecentNode(n.id); navigate(`/node/${n.id}`); onClose() } })
    }
    results.sort((a, b) => b.score - a.score)
    results.splice(20)

    // Colapsar / Expandir
    const qLow = q.toLowerCase()
    if (['colapsar', 'collapse', 'plegar', 'contraer'].some(kw => kw.includes(qLow) || qLow.includes(kw.slice(0, 3)))) {
      results.unshift({ id: 'wf-collapse-all', label: t('cmdpalette.collapseAll'), sublabel: currentNodeId ? 'Colapsa todos los hijos del nodo actual' : 'Colapsa todos los nodos raíz', type: 'wf-action', taskStatus: null, score: 200, action: () => { store.collapseAll(currentNodeId); onClose(); showToast('Todo colapsado', 'success') } })
    }
    if (['expandir', 'expand', 'desplegar'].some(kw => kw.includes(qLow) || qLow.includes(kw.slice(0, 3)))) {
      results.unshift({ id: 'wf-expand-all', label: t('cmdpalette.expandAll'), sublabel: currentNodeId ? 'Expande todos los hijos del nodo actual' : 'Expande todos los nodos raíz', type: 'wf-action', taskStatus: null, score: 200, action: () => { store.expandAll(currentNodeId); onClose(); showToast('Todo expandido', 'success') } })
    }

    if (results.length === 0) {
      const displayText = parsed.cleanText || q
      const label = parsed.isEvent ? 'Evento' : parsed.isTask ? 'Tarea' : 'Nota'
      results.push({ id: 'create-item', label: `Crear ${label.toLowerCase()}: ${displayText}`, type: 'create', taskStatus: null, score: -1, action: doCreate })
    }

    results.push({ id: 'panel-save', label: 'Guardar como filtro', sublabel: `"${q}"`, type: 'panel-save', taskStatus: null, score: -99, action: () => { setPanelName(q); setCreatingPanel(true); setTimeout(() => panelNameRef.current?.focus(), 0) } })

    return results
  }, [query, view, parsed, doCreate, navigate, onClose, t, contextoRoot, atajosRoot, allFilterNodes, onSelectContext, currentNodeId, showToast])

  const items = buildItems()

  useEffect(() => { setActiveIdx(0) }, [query])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation(); e.nativeEvent.stopImmediatePropagation()
      if (view !== 'default') { setView('default'); setQuery(''); setActiveIdx(0); return }
      onClose(); return
    }
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
    showToast(`Filtro "${panelName.trim()}" guardado`)
    onClose()
  }

  return createPortal(
    <div className="cmdpalette-overlay" onClick={onClose}>
      <div className="cmdpalette-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">

        {/* Modo: guardar filtro */}
        {creatingPanel ? (
          <div className="cmdpalette-panel-create">
            <span className="cmdpalette-panel-create-label">Guardar como filtro</span>
            <input
              ref={panelNameRef}
              className="cmdpalette-panel-create-input"
              placeholder={`Nombre del filtro "${query}"`}
              value={panelName}
              onChange={e => setPanelName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); handleSavePanel() }
                if (e.key === 'Escape') { e.preventDefault(); setCreatingPanel(false); setTimeout(() => inputRef.current?.focus(), 0) }
              }}
            />
            <div className="cmdpalette-panel-create-actions">
              <button className="cmdpalette-panel-create-btn" onClick={handleSavePanel}>Guardar filtro</button>
              <button className="cmdpalette-panel-create-cancel" onClick={() => { setCreatingPanel(false); setTimeout(() => inputRef.current?.focus(), 0) }}>{t('common.cancel')}</button>
            </div>
          </div>
        ) : (
        <>
        {/* Subvista activa */}
        {view !== 'default' && (
          <button
            className="cmdpalette-subview-back"
            onClick={() => { setView('default'); setQuery(''); setActiveIdx(0) }}
          >
            ← {view === 'filtros' ? 'Filtros' : 'Contextos'}
          </button>
        )}

        <div className="cmdpalette-search-row">
          {view === 'default' ? (
            <svg className="cmdpalette-search-icon" width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="8" cy="8" r="6"/><path d="M14 14l4 4"/>
            </svg>
          ) : (
            <span className="cmdpalette-search-icon" style={{ fontSize: 14, display: 'flex', alignItems: 'center' }}>
              {view === 'filtros' ? '◈' : '🧠'}
            </span>
          )}
          <input
            ref={inputRef}
            className="cmdpalette-input"
            placeholder={view === 'filtros' ? 'Buscar filtro…' : view === 'contextos' ? 'Buscar contexto…' : t('cmdpalette.searchPlaceholder')}
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIdx(0) }}
            onKeyDown={handleKeyDown}
          />
          {query && <button className="cmdpalette-clear" onClick={() => setQuery('')}>×</button>}
        </div>

        {showChips && (
          <div className="cmdpalette-chips">
            {parsed.isTask && <span className="cmdpalette-chip">{t('cmdpalette.chipTask')}</span>}
            {parsed.isEvent && <span className="cmdpalette-chip">{t('cmdpalette.chipEvent')}</span>}
                        {parsed.isFavorite && <span className="cmdpalette-chip">{t('cmdpalette.chipFavorite')}</span>}
            {parsed.dateLabel && <span className="cmdpalette-chip cmdpalette-chip--date">📅 {parsed.dateLabel}</span>}
          </div>
        )}

        {items.length > 0 && (
          <div ref={listRef} className="cmdpalette-results">
            {/* Sección label para tags */}
            {query.startsWith('#') && items[0]?.type === 'tag' && (
              <div className="cmdpalette-section-label">{t('cmdpalette.tagsSectionLabel')}</div>
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
                      <span className="cmdpalette-create-icon">
                        {item.id.startsWith('ctx-') ? '🧠'
                          : item.id.startsWith('filtro-') ? '◈'
                          : item.id === 'cat-filtros' ? '◈'
                          : item.id === 'cat-contextos' ? '🧠'
                          : item.id.startsWith('quick-') ? '📅'
                          : '⌘'}
                      </span>
                    ) : null}
                    <div className="cmdpalette-item-info">
                      <span className={`cmdpalette-item-label ${item.taskStatus === 'done' ? 'done' : ''} ${isPanelSave ? 'panel-save' : ''}`}>{item.label}</span>
                      {item.sublabel && <span className="cmdpalette-item-sublabel">{item.sublabel}</span>}
                    </div>
                    {(item.id === 'cat-filtros' || item.id === 'cat-contextos') && (
                      <span style={{ color: 'var(--text-tertiary)', fontSize: 12, marginLeft: 'auto', paddingRight: 4 }}>→</span>
                    )}
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
