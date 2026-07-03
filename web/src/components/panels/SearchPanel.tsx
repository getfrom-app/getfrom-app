/**
 * SearchPanel — Panel de búsqueda lateral derecho
 * Reemplaza el buscador expandible del topbar con un panel tipo MagicChat
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import { openNodeDetail } from '../../utils/canvasNav'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'
import { createFilterShortcut, getAtajosNode, getShortcutData } from '../../utils/atajosHelper'
import { findContextRoot } from '../../utils/rootLookup'
import { isDocNode, firstLineTitle } from '../../utils/docNode'
import { isMarkedContext } from '../../utils/cajones'

interface Props {
  filterText: string
  onFilter: (text: string) => void
  onClose: () => void
  // Filtro especial "Sin clasificar" (contextNodeId), gestionado por MainLayout.
  onSelectContext?: (id: string) => void
  activeContextId?: string | null
}

/** Constante del filtro especial "Sin clasificar" (debe coincidir con ContextListPanel). */
const UNCLASSIFIED_FILTER_ID = '__unclassified__'

// ── Taxonomía canvas-first: los tipos REALES de elementos del lienzo ──────────
// (Fusiona nota+documento en «texto»; fuera «cajón». Todo es un elemento del lienzo.)
type ElemKind = 'text' | 'task' | 'event' | 'pdf' | 'image' | 'link' | 'context'
const KIND_ICON: Record<ElemKind, string> = { text: '📝', task: '☑️', event: '📅', pdf: '📄', image: '🖼', link: '🔗', context: '📁' }
const TYPE_CHIPS: { k: ElemKind; labelKey: string }[] = [
  { k: 'text',    labelKey: 'search.chipText' },
  { k: 'task',    labelKey: 'search.chipTask' },
  { k: 'event',   labelKey: 'search.chipEvent' },
  { k: 'pdf',     labelKey: 'search.chipPdf' },
  { k: 'image',   labelKey: 'search.chipImage' },
  { k: 'link',    labelKey: 'search.chipLink' },
  { k: 'context', labelKey: 'search.chipContext' },
]
const TIME_CHIPS = [
  { q: 'hoy',     labelKey: 'search.chipToday' },
  { q: 'semana',  labelKey: 'search.chipThisWeek' },
  { q: 'mes',     labelKey: 'search.chipThisMonth' },
  { q: 'pasado',  labelKey: 'search.chipPast' },
  { q: 'futuro',  labelKey: 'search.chipFuture' },
]
const STATUS_CHIPS = [
  { q: 'pendiente', labelKey: 'search.chipPending' },
  { q: 'hecho',     labelKey: 'search.chipDone' },
  { q: 'sin-fecha', labelKey: 'search.chipNoDate' },
]

const ed = (n: Node): Record<string, unknown> => { try { return JSON.parse(n.extraData || '{}') } catch { return {} } }
const stripHtml = (html?: string | null) => (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Clasifica un nodo en un tipo de elemento del lienzo, o null si NO es un elemento buscable
 *  (línea suelta, nodo de sistema, nodo ya absorbido dentro de una tarjeta…). */
function classify(n: Node): ElemKind | null {
  if (n.deletedAt) return null
  const e = ed(n)
  if (e._absorbedBy != null) return null        // oculto dentro de un bloque → no es elemento suelto
  if (isMarkedContext(n)) return 'context'
  if (n.status != null) return 'task'
  if (n.isEvent) return 'event'
  const rt = e._resourceType as string | undefined
  if (rt === 'image' || e._imageUrl) return 'image'
  if (rt === 'pdf') return 'pdf'
  if (n.isResource || e._resourceUrl || e._resource) return 'link'
  if (isDocNode(n) || store.isNote(n)) return 'text'
  return null
}

/** ¿Pasa el filtro de TIEMPO (por `due`)? Sin fecha nunca pasa un filtro temporal. */
function matchesTime(n: Node, times: Set<string>): boolean {
  if (times.size === 0) return true
  if (!n.due) return false
  const d = new Date(n.due); const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const day = 24 * 3600 * 1000
  for (const t of times) {
    if (t === 'hoy' && d >= startOfToday && d < new Date(startOfToday.getTime() + day)) return true
    if (t === 'semana' && d >= startOfToday && d < new Date(startOfToday.getTime() + 7 * day)) return true
    if (t === 'mes' && d >= startOfToday && d < new Date(startOfToday.getTime() + 31 * day)) return true
    if (t === 'pasado' && d < startOfToday) return true
    if (t === 'futuro' && d >= new Date(startOfToday.getTime() + day)) return true
  }
  return false
}

/** ¿Pasa el filtro de ESTADO (pendiente/hecho/sin-fecha)? */
function matchesStatus(n: Node, statuses: Set<string>): boolean {
  if (statuses.size === 0) return true
  for (const s of statuses) {
    if (s === 'pendiente' && n.status === 'pending') return true
    if (s === 'hecho' && n.status === 'done') return true
    if (s === 'sin-fecha' && !n.due) return true
  }
  return false
}

export default function SearchPanel({ filterText, onFilter, onClose, onSelectContext, activeContextId }: Props) {
  const s = useStore()
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)

  const [query, setQuery] = useState('')
  const [types, setTypes] = useState<Set<ElemKind>>(new Set())
  const [times, setTimes] = useState<Set<string>>(new Set())
  const [statuses, setStatuses] = useState<Set<string>>(new Set())
  const [limit, setLimit] = useState(60)

  // Contextos del nodo 🧠 Contexto → chip que VUELA a la zona del contexto en el lienzo.
  const contextRoot = findContextRoot()
  const contextChips = contextRoot
    ? s.children(contextRoot.id).filter(n => !n.deletedAt && n.text?.trim()).map(n => ({ id: n.id, label: n.text }))
    : []

  // Al montar: enfocar + limpiar el filtro de RUTA (para que el lienzo quede visible; la
  // búsqueda ahora vive DENTRO del panel y vuela a los elementos, no cambia la vista central).
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50)
    onFilter('')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const active = query.trim() !== '' || types.size > 0 || times.size > 0 || statuses.size > 0

  // Resultados: TODOS los elementos del lienzo que casan (texto/tarea/evento/pdf/imagen/
  // enlace/contexto). Sin búsqueda → los más recientes. Clic → vuela al lienzo + abre panel.
  const results = useMemo(() => {
    void s.nodesVersion
    const nq = norm(query.trim())
    const out: { id: string; kind: ElemKind; title: string; snippet: string; updatedAt: string }[] = []
    for (const n of store.allActive()) {
      const kind = classify(n); if (!kind) continue
      if (types.size && !types.has(kind)) continue
      if ((times.size || statuses.size) && kind !== 'task' && kind !== 'event') continue // tiempo/estado = solo tareas/eventos
      if (!matchesTime(n, times)) continue
      if (!matchesStatus(n, statuses)) continue
      // Cuerpos que NO son texto (trazos de pizarra) → sin snippet (mostrarían JSON feo).
      const snippet = (n.body || '').trimStart().startsWith('```from-pizarra') ? '' : stripHtml(n.body)
      const title = (n.text || firstLineTitle(n.body) || snippet.slice(0, 60) || t('common.noTitle'))
      if (nq && !norm(title).includes(nq) && !norm(snippet).includes(nq)) continue
      out.push({ id: n.id, kind, title, snippet, updatedAt: n.updatedAt || '' })
    }
    out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    return out
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, types, times, statuses, s.nodesVersion, t])

  const shown = results.slice(0, limit)

  function toggle<T>(set: Set<T>, setter: (s: Set<T>) => void, v: T) {
    const next = new Set(set); next.has(v) ? next.delete(v) : next.add(v); setter(next); setLimit(60)
  }
  function openResult(id: string) {
    openNodeDetail(id) // abre el panel derecho según el tipo
    window.dispatchEvent(new CustomEvent('from:pizarra-flyto', { detail: { nodeId: id } })) // y vuela a él
  }
  function clearAll() { setQuery(''); setTypes(new Set()); setTimes(new Set()); setStatuses(new Set()); setLimit(60) }

  return (
    <div
      className="search-panel"
      onClick={e => {
        const target = e.target as HTMLElement
        if (!target.closest('button') && !target.closest('a') && !target.closest('input')) {
          inputRef.current?.focus()
        }
      }}
    >
      {/* Buscador */}
      <div className="search-panel-input-wrap">
        <input
          ref={inputRef}
          type="text"
          className="search-panel-input"
          placeholder={t('search.searchPlaceholder')}
          value={query}
          onChange={e => { setQuery(e.target.value); setLimit(60) }}
        />
        {active && <button className="search-panel-clear" onClick={clearAll}>×</button>}
      </div>

      {/* Chips de TIPO (reales) + tiempo/estado + contextos (vuelan) */}
      <div className="search-panel-chips">
        <div className="search-panel-row">
          {TYPE_CHIPS.map(c => (
            <button key={c.k} className={`search-panel-chip ${types.has(c.k) ? 'active' : ''}`} onClick={() => toggle(types, setTypes, c.k)}>{t(c.labelKey)}</button>
          ))}
        </div>
        <div className="search-panel-row">
          {TIME_CHIPS.map(c => (
            <button key={c.q} className={`search-panel-chip ${times.has(c.q) ? 'active' : ''}`} onClick={() => toggle(times, setTimes, c.q)}>{t(c.labelKey)}</button>
          ))}
        </div>
        <div className="search-panel-row">
          {STATUS_CHIPS.map(c => (
            <button key={c.q} className={`search-panel-chip ${statuses.has(c.q) ? 'active' : ''}`} onClick={() => toggle(statuses, setStatuses, c.q)}>{t(c.labelKey)}</button>
          ))}
          {onSelectContext && (
            <button
              className={`search-panel-chip ${activeContextId === UNCLASSIFIED_FILTER_ID ? 'active' : ''}`}
              onClick={() => onSelectContext(UNCLASSIFIED_FILTER_ID)}
            >
              {t('autoCtx.unclassifiedFilter')}
            </button>
          )}
        </div>
        {contextChips.length > 0 && (
          <div className="search-panel-row">
            {contextChips.map(c => (
              <button key={c.id} className="search-panel-chip" title={t('search.jumpToContext', 'Ir al contexto')} onClick={() => openResult(c.id)}>{c.label}</button>
            ))}
          </div>
        )}
      </div>

      {/* Resultados — todos los elementos del lienzo que casan; clic vuela + abre panel */}
      <div className="rc-section-label" style={{ marginTop: 4 }}>
        {active ? t('search.resultsCount', { count: results.length, defaultValue: '{{count}} resultados' }) : t('search.recentElements', 'Recientes')}
      </div>
      {shown.length === 0 ? (
        <div style={{ padding: '8px 12px', fontSize: 13, color: 'var(--text-tertiary)' }}>{t('search.noResults', 'Sin resultados')}</div>
      ) : shown.map(r => (
        <div
          key={r.id}
          onClick={() => openResult(r.id)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px 5px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)', borderRadius: 6 }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <span style={{ fontSize: 14, flexShrink: 0 }}>{KIND_ICON[r.kind]}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text,#222)' }}>{r.title}</div>
            {r.snippet && r.snippet !== r.title && (
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.snippet}</div>
            )}
          </div>
        </div>
      ))}
      {results.length > limit && (
        <button
          onClick={() => setLimit(l => l + 60)}
          style={{ display: 'block', width: '100%', padding: '6px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--accent)' }}
        >
          {t('elements.loadMore', { count: results.length - limit, defaultValue: 'Ver más ({{count}})' })}
        </button>
      )}

      {/* Filtros guardados (listas inteligentes) + Favoritos — siempre accesibles */}
      <SavedPanelsList onApply={(q) => onFilter(q)} activeQuery={filterText} />
      <FavoritesSection />
    </div>
  )
}

// ── Lista de paneles guardados ────────────────────────────────────────────────
function SavedPanelsList({ onApply, activeQuery }: { onApply: (q: string) => void; activeQuery: string }) {
  const { t } = useTranslation()
  const s = useStore()
  const [savingPanel, setSavingPanel] = useState(false)
  const [panelName, setPanelName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const panelInputRef = useRef<HTMLInputElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  // Sin useMemo: nodes.size no cambia al marcar deletedAt (muta el Map),
  // así que la lista se recalcula en cada re-render del store (ya garantizado por useStore)
  const atajosNode = getAtajosNode()
  const panels: { id: string; name: string; query: string }[] = atajosNode
    ? s.children(atajosNode.id)
        .filter(n => !n.deletedAt)
        .sort((a, b) => a.siblingOrder - b.siblingOrder)
        .map(n => {
          const sc = getShortcutData(n.id)
          // Solo filtros de query reales; excluye punteros legacy a nodos (_shortcutNodeId)
          return sc?.query !== undefined && !sc.nodeId ? { id: n.id, name: n.text, query: sc.query } : null
        })
        .filter(Boolean) as { id: string; name: string; query: string }[]
    : []

  function deletePanel(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    store.deleteNode(id)
  }

  function startRename(p: { id: string; name: string }, e: React.MouseEvent) {
    e.stopPropagation()
    setRenamingId(p.id)
    setRenameValue(p.name)
    setTimeout(() => { renameInputRef.current?.focus(); renameInputRef.current?.select() }, 20)
  }

  function confirmRename() {
    if (!renamingId) return
    const trimmed = renameValue.trim()
    if (trimmed) store.updateNode(renamingId, { text: trimmed })
    setRenamingId(null)
    setRenameValue('')
  }

  function cancelRename() {
    setRenamingId(null)
    setRenameValue('')
  }

  function startSaving() {
    setSavingPanel(true)
    setPanelName(activeQuery)
    setTimeout(() => { panelInputRef.current?.focus(); panelInputRef.current?.select() }, 30)
  }

  function confirmSave() {
    if (panelName.trim()) createFilterShortcut(panelName.trim(), activeQuery)
    setSavingPanel(false)
    setPanelName('')
  }

  if (panels.length === 0 && !activeQuery) return null

  return (
    <div style={{ borderTop: '1px solid var(--border)', marginTop: 4 }}>
      {panels.length > 0 && (
        <div className="rc-section-label">
          {t('searchPanel.filters')}
        </div>
      )}
      {panels.map(p => {
        const isActive = activeQuery === p.query
        const isRenaming = renamingId === p.id
        const isHovered = hoveredId === p.id

        return (
          <div
            key={p.id}
            onClick={() => { if (!isRenaming) onApply(isActive ? '' : p.query) }}
            onMouseEnter={() => setHoveredId(p.id)}
            onMouseLeave={() => setHoveredId(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 8px 5px 12px', cursor: isRenaming ? 'default' : 'pointer', fontSize: 13,
              color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
              background: isActive ? 'var(--bg-hover)' : isHovered ? 'var(--bg-hover)' : 'transparent',
            }}
          >
            <span style={{ fontSize: 12, opacity: 0.6, flexShrink: 0 }}>◈</span>

            {isRenaming ? (
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onClick={e => e.stopPropagation()}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); confirmRename() }
                  if (e.key === 'Escape') { e.preventDefault(); cancelRename() }
                }}
                onBlur={confirmRename}
                style={{
                  flex: 1, border: 'none', outline: 'none',
                  background: 'transparent', fontSize: 13,
                  color: 'var(--text-primary)', fontFamily: 'inherit',
                }}
              />
            ) : (
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.name}
              </span>
            )}

            {/* Botones: sólo visibles en hover o cuando se está renombrando */}
            {!isRenaming && (isHovered || isActive) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                <button
                  title={t('common.rename')}
                  onClick={e => startRename(p, e)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-tertiary)', fontSize: 12,
                    padding: '2px 4px', borderRadius: 3, lineHeight: 1,
                    display: 'flex', alignItems: 'center',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                >
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11.5 2.5a1.5 1.5 0 0 1 2.12 2.12L5 13.25l-3 .75.75-3z"/>
                  </svg>
                </button>
                <button
                  title={t('common.delete')}
                  onClick={e => deletePanel(p.id, e)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-tertiary)', fontSize: 14,
                    padding: '2px 4px', borderRadius: 3, lineHeight: 1,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-error, #e53e3e)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                >×</button>
              </div>
            )}
          </div>
        )
      })}

      {/* Fila para guardar la búsqueda activa como filtro */}
      {activeQuery && !savingPanel && (
        <div
          onClick={startSaving}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', cursor: 'text', fontSize: 13, color: 'var(--text-tertiary)' }}
        >
          <span style={{ fontSize: 12, opacity: 0.4, flexShrink: 0 }}>◈</span>
          <span style={{ fontStyle: 'italic', opacity: 0.5 }}>{t('searchPanel.newFilter')}</span>
        </div>
      )}
      {activeQuery && savingPanel && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px' }}>
          <span style={{ fontSize: 12, opacity: 0.6, flexShrink: 0 }}>◈</span>
          <input
            ref={panelInputRef}
            value={panelName}
            onChange={e => setPanelName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); confirmSave() }
              if (e.key === 'Escape') { setSavingPanel(false); setPanelName('') }
            }}
            onBlur={() => { if (panelName.trim()) confirmSave(); else { setSavingPanel(false); setPanelName('') } }}
            placeholder={t('searchPanel.filterNamePlaceholder')}
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit' }}
          />
        </div>
      )}
    </div>
  )
}

// ── Sección de Favoritos ─────────────────────────────────────────────────────

function FavoritesSection() {
  const { t } = useTranslation()
  const s = useStore()
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  const favorites = s.allActive().filter(n => n.isFavorite && !n.deletedAt && n.text)
  if (favorites.length === 0) return null

  function startRename(n: { id: string; text: string }, e: React.MouseEvent) {
    e.stopPropagation()
    setRenamingId(n.id)
    setRenameValue(n.text)
    setTimeout(() => { renameInputRef.current?.focus(); renameInputRef.current?.select() }, 20)
  }

  function confirmRename() {
    if (!renamingId) return
    const trimmed = renameValue.trim()
    if (trimmed) store.updateNode(renamingId, { text: trimmed })
    setRenamingId(null)
    setRenameValue('')
  }

  function cancelRename() {
    setRenamingId(null)
    setRenameValue('')
  }

  function unfavorite(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    store.updateNode(id, { isFavorite: false })
  }

  return (
    <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 4 }}>
      <div className="rc-section-label">
        {t('searchPanel.favorites')}
      </div>
      {favorites.slice(0, 15).map(n => {
        const isRenaming = renamingId === n.id
        const isHovered = hoveredId === n.id
        return (
          <div
            key={n.id}
            onClick={() => { if (!isRenaming) openNodeDetail(n.id) }}
            onMouseEnter={() => setHoveredId(n.id)}
            onMouseLeave={() => setHoveredId(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '4px 8px 4px 12px', cursor: isRenaming ? 'default' : 'pointer', fontSize: 13,
              color: 'var(--text-secondary)',
              background: isHovered && !isRenaming ? 'var(--bg-hover)' : 'transparent',
            }}
          >
            <span style={{ fontSize: 11, opacity: 0.5, flexShrink: 0 }}>★</span>

            {isRenaming ? (
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onClick={e => e.stopPropagation()}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); confirmRename() }
                  if (e.key === 'Escape') { e.preventDefault(); cancelRename() }
                }}
                onBlur={confirmRename}
                style={{
                  flex: 1, border: 'none', outline: 'none',
                  background: 'transparent', fontSize: 13,
                  color: 'var(--text-primary)', fontFamily: 'inherit',
                }}
              />
            ) : (
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {n.text}
              </span>
            )}

            {!isRenaming && isHovered && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                <button
                  title={t('common.rename')}
                  onClick={e => startRename(n, e)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-tertiary)', fontSize: 12,
                    padding: '2px 4px', borderRadius: 3, lineHeight: 1,
                    display: 'flex', alignItems: 'center',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                >
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11.5 2.5a1.5 1.5 0 0 1 2.12 2.12L5 13.25l-3 .75.75-3z"/>
                  </svg>
                </button>
                <button
                  title={t('common.removeFavorite')}
                  onClick={e => unfavorite(n.id, e)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-tertiary)', fontSize: 14,
                    padding: '2px 4px', borderRadius: 3, lineHeight: 1,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-error, #e53e3e)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                >×</button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
