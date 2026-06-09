import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useStore, store } from '../../store/nodeStore'
import type { Node } from '../../types'
import type { ResourceType } from '../panels/ResourcePanel'
// Estados unificados con el resto de Fromly: null/pending/future/done
// "Sin estado" se trata como pendiente para filtros
type StatusKey = 'all' | 'pending' | 'future' | 'done'

const TYPE_ICONS: Record<string, string> = {
  youtube: '▶️', url: '🔗', book: '📚', podcast: '🎙', document: '📄',
}
const TYPE_LABELS: Record<string, string> = {
  youtube: 'Vídeo', url: 'Enlace', book: 'Libro', podcast: 'Podcast', document: 'Documento',
}
// Colores pastel iguales al panel del calendario/agenda
const STATUS_COLORS: Record<string, string> = {
  pending: '#fcd34d',   // amarillo pastel
  future:  '#93c5fd',   // azul pastel
  done:    '#86efac',   // verde pastel
}
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente', future: 'Futuro', done: 'Hecho',
}

function effectiveStatus(node: Node): 'pending' | 'future' | 'done' {
  // 1. Columna promovida resourceStatus (v8.29+)
  if (node.resourceStatus === 'done') return 'done'
  if (node.resourceStatus === 'consuming') return 'pending' // consuming → pendiente en UI
  if (node.resourceStatus === 'future') return 'future'
  if (node.resourceStatus === 'pending') return 'pending'
  // 2. Status de tarea
  if (node.status === 'done') return 'done'
  if (node.status === 'future') return 'future'
  if (node.status === 'pending') return 'pending'
  // 3. Legacy extraData._resourceStatus
  try {
    const legacy = JSON.parse(node.extraData || '{}')._resourceStatus
    if (legacy === 'done' || legacy === 'archived') return 'done'
    if (legacy === 'consuming') return 'pending'
  } catch { /* ignore */ }
  return 'pending'
}

function getResourceData(node: Node) {
  try {
    const ed = JSON.parse(node.extraData || '{}')
    return {
      type: (ed._resourceType || 'url') as ResourceType,
      status: effectiveStatus(node),
      url: (ed._resourceUrl || '') as string,
      meta: ed._resourceMeta as { title?: string; description?: string; image?: string; domain?: string; channel?: string } | null,
    }
  } catch {
    return { type: 'url' as ResourceType, status: effectiveStatus(node), url: '', meta: null }
  }
}

export default function ResourcesView() {
  const s = useStore()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [typeFilter, setTypeFilter] = useState<ResourceType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<StatusKey>('all')
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [tagSearch, setTagSearch] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const resources = s.allResources()

  // Todos los tags usados en recursos
  const allTags = useMemo(() => {
    const tags = new Set<string>()
    resources.forEach(n => (n.types || []).forEach(t => tags.add(t)))
    return Array.from(tags).sort()
  }, [resources])

  // Tags filtrados por búsqueda predictiva
  const filteredTags = useMemo(() => {
    if (!tagSearch.trim()) return allTags
    const q = tagSearch.toLowerCase()
    return allTags.filter(t => t.toLowerCase().includes(q))
  }, [allTags, tagSearch])

  const filtered = useMemo(() => {
    return resources.filter(n => {
      const { type, status } = getResourceData(n)
      if (typeFilter !== 'all' && type !== typeFilter) return false
      if (statusFilter !== 'all' && status !== statusFilter) return false
      if (selectedTags.size > 0) {
        const nodeTags = new Set(n.types || [])
        if (![...selectedTags].some(t => nodeTags.has(t))) return false
      }
      return true
    }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [resources, typeFilter, statusFilter, selectedTags])

  function toggleTag(tag: string) {
    setSelectedTags(prev => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag); else next.add(tag)
      return next
    })
  }

  function clearFilters() {
    setTypeFilter('all')
    setStatusFilter('all')
    setSelectedTags(new Set())
    setTagSearch('')
  }

  const hasActiveFilters = typeFilter !== 'all' || statusFilter !== 'all' || selectedTags.size > 0

  function setStatus(node: Node, status: 'pending' | 'future' | 'done') {
    // Atadura: future/done limpian due
    const updates: Partial<Node> = { status }
    if (status === 'future' || status === 'done') updates.due = null
    store.updateNode(node.id, updates)
    // Limpiar legacy _resourceStatus si existe (no se vuelve a usar)
    try {
      const ed = JSON.parse(node.extraData || '{}')
      if (ed._resourceStatus) {
        delete ed._resourceStatus
        store.updateNode(node.id, { extraData: JSON.stringify(ed) })
      }
    } catch { /* ignore */ }
  }

  function createLinkedTask(node: Node) {
    const today = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
    const { meta, type } = getResourceData(node)
    const label = type === 'youtube' ? 'Ver vídeo' : type === 'book' ? 'Leer' : type === 'podcast' ? 'Escuchar' : 'Revisar'
    const task = store.createNode({ text: `${label}: ${meta?.title || node.text || 'recurso'}`, parentId: node.id, isTask: true, due: today })
    let ed: Record<string, unknown> = {}
    try { ed = JSON.parse(task.extraData || '{}') } catch {}
    ed._linkedNodeId = node.id
    store.updateNode(task.id, { extraData: JSON.stringify(ed) })
  }

  return (
    <div className="resources-view-layout">

      {/* ── Centro: recursos ─────────────────────────────────────────────── */}
      <div className="resources-main">
        <div className="resources-main-header">
          <div className="resources-main-title-row">
            <h1 className="resources-title">{t('resources.title')}</h1>
            <span className="resources-count">{filtered.length}</span>
          </div>
          <div className="resources-view-toggle">
            <button className={`resources-toggle-btn${viewMode === 'grid' ? ' active' : ''}`} onClick={() => setViewMode('grid')} title={t('resources.gridView')}>⊞</button>
            <button className={`resources-toggle-btn${viewMode === 'list' ? ' active' : ''}`} onClick={() => setViewMode('list')} title={t('resources.listView')}>☰</button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="resources-empty">
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
            <div style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 8 }}>
              {hasActiveFilters ? 'Sin resultados para estos filtros' : 'Sin recursos aún'}
            </div>
            {!hasActiveFilters && (
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                Pega una URL como título de una nota, o usa el botón 🔗 Recurso en el panel derecho.
              </div>
            )}
            {hasActiveFilters && (
              <button className="resources-filter-btn" style={{ marginTop: 12 }} onClick={clearFilters}>
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'resources-grid' : 'resources-list'}>
            {filtered.map(node => {
              const { type, status, url, meta } = getResourceData(node)
              const linkedCount = s.linkedTasks(node.id).length
              return (
                <div key={node.id} className="resource-card" onClick={() => navigate(`/node/${node.id}`)}>
                  {meta?.image ? (
                    <img src={meta.image} alt={meta.title || ''} className="resource-card-thumb"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  ) : (
                    <div className="resource-card-thumb-placeholder">{TYPE_ICONS[type] || '🔗'}</div>
                  )}
                  <div className="resource-card-body">
                    <div className="resource-card-type">
                      <span>{TYPE_ICONS[type]} {TYPE_LABELS[type]}</span>
                      {meta?.domain && <span className="resource-card-domain">{meta.channel || meta.domain}</span>}
                    </div>
                    <div className="resource-card-title">{meta?.title || node.text || t('common.noTitle')}</div>
                    {meta?.description && (
                      <div className="resource-card-desc">{meta.description.slice(0, 80)}…</div>
                    )}
                    {(node.types || []).length > 0 && (
                      <div className="resource-card-tags">
                        {(node.types || []).slice(0, 3).map(t => (
                          <span key={t} className="resource-card-tag">#{t}</span>
                        ))}
                      </div>
                    )}
                    <div className="resource-card-footer">
                      <select
                        className="resource-card-status"
                        style={{ borderColor: STATUS_COLORS[status], color: '#333', background: STATUS_COLORS[status] }}
                        value={status}
                        onClick={e => e.stopPropagation()}
                        onChange={e => { e.stopPropagation(); setStatus(node, e.target.value as 'pending' | 'future' | 'done') }}
                      >
                        <option value="pending">Pendiente</option>
                        <option value="future">Futuro</option>
                        <option value="done">Hecho</option>
                      </select>
                      <div className="resource-card-actions">
                        {linkedCount > 0 && (
                          <span className="resource-card-tasks-badge" title={`${linkedCount} tarea${linkedCount !== 1 ? 's' : ''}`}>
                            ✓ {linkedCount}
                          </span>
                        )}
                        <button className="resource-card-add-task" title="Crear tarea asociada"
                          onClick={e => { e.stopPropagation(); createLinkedTask(node) }}>
                          ＋ Tarea
                        </button>
                        {url && (
                          <a href={url} target="_blank" rel="noopener noreferrer"
                            className="resource-card-open" onClick={e => e.stopPropagation()}>↗</a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Columna derecha: filtros ─────────────────────────────────────── */}
      <div className="resources-sidebar">

        {hasActiveFilters && (
          <button className="resources-clear-btn" onClick={clearFilters}>✕ Limpiar filtros</button>
        )}

        {/* Tipo */}
        <div className="resources-sidebar-section">
          <div className="resources-sidebar-label">Tipo</div>
          {(['all', 'youtube', 'url', 'book', 'podcast', 'document'] as const).map(t => (
            <button
              key={t}
              className={`resources-sidebar-btn${typeFilter === t ? ' active' : ''}`}
              onClick={() => setTypeFilter(t)}
            >
              {t === 'all' ? '🔍 Todo' : `${TYPE_ICONS[t]} ${TYPE_LABELS[t]}`}
              {t !== 'all' && (
                <span className="resources-sidebar-count">
                  {resources.filter(n => getResourceData(n).type === t).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Estado */}
        <div className="resources-sidebar-section">
          <div className="resources-sidebar-label">Estado</div>
          {(['all', 'pending', 'future', 'done'] as const).map(st => (
            <button
              key={st}
              className={`resources-sidebar-btn${statusFilter === st ? ' active' : ''}`}
              style={statusFilter === st && st !== 'all'
                ? { background: STATUS_COLORS[st] + '40', color: '#333', borderColor: STATUS_COLORS[st] }
                : {}}
              onClick={() => setStatusFilter(st)}
            >
              {st === 'all' ? '📋 Todos' : (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: STATUS_COLORS[st], display: 'inline-block', flexShrink: 0 }} />
                  {STATUS_LABELS[st]}
                </span>
              )}
              <span className="resources-sidebar-count">
                {st === 'all' ? resources.length : resources.filter(n => getResourceData(n).status === st).length}
              </span>
            </button>
          ))}
        </div>

        {/* Tags — siempre visible */}
        <div className="resources-sidebar-section">
          <div className="resources-sidebar-label">Tags</div>
          <input
            className="resources-tag-search"
            placeholder="Buscar tag..."
            value={tagSearch}
            onChange={e => setTagSearch(e.target.value)}
          />
          <div className="resources-tag-list">
            {allTags.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '4px 0' }}>
                Los recursos sin tag aparecerán aquí
              </div>
            ) : filteredTags.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '4px 0' }}>Sin resultados para "{tagSearch}"</div>
            ) : (
              filteredTags.map(tag => {
                const count = resources.filter(n => (n.types || []).includes(tag)).length
                const active = selectedTags.has(tag)
                return (
                  <button
                    key={tag}
                    className={`resources-sidebar-btn resources-tag-btn${active ? ' active' : ''}`}
                    onClick={() => toggleTag(tag)}
                  >
                    <span>#{tag}</span>
                    <span className="resources-sidebar-count">{count}</span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
