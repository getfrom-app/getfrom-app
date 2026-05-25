import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, store } from '../../store/nodeStore'
import type { Node } from '../../types'
import type { ResourceType, ResourceStatus } from '../panels/ResourcePanel'

const TYPE_ICONS: Record<string, string> = {
  youtube: '▶️', url: '🔗', book: '📚', podcast: '🎙', document: '📄',
}
const TYPE_LABELS: Record<string, string> = {
  youtube: 'Vídeo', url: 'Enlace', book: 'Libro', podcast: 'Podcast', document: 'Documento',
}
const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b', consuming: '#3b82f6', done: '#22c55e', archived: '#94a3b8',
}
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente', consuming: 'En progreso', done: 'Hecho', archived: 'Archivado',
}

function getResourceData(node: Node) {
  try {
    const ed = JSON.parse(node.extraData || '{}')
    return {
      type: (ed._resourceType || 'url') as ResourceType,
      status: (ed._resourceStatus || 'pending') as ResourceStatus,
      url: (ed._resourceUrl || '') as string,
      meta: ed._resourceMeta as { title?: string; description?: string; image?: string; domain?: string; channel?: string } | null,
    }
  } catch {
    return { type: 'url' as ResourceType, status: 'pending' as ResourceStatus, url: '', meta: null }
  }
}

export default function ResourcesView() {
  const s = useStore()
  const navigate = useNavigate()
  const [typeFilter, setTypeFilter] = useState<ResourceType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<ResourceStatus | 'all'>('all')
  const [tagFilter, setTagFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const resources = s.allResources()

  // Tags usados en recursos
  const usedTags = useMemo(() => {
    const tags = new Set<string>()
    resources.forEach(n => (n.types || []).forEach(t => tags.add(t)))
    return Array.from(tags).sort()
  }, [resources])

  const filtered = useMemo(() => {
    return resources.filter(n => {
      const { type, status } = getResourceData(n)
      if (typeFilter !== 'all' && type !== typeFilter) return false
      if (statusFilter !== 'all' && status !== statusFilter) return false
      if (tagFilter !== 'all' && !(n.types || []).includes(tagFilter)) return false
      return true
    }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [resources, typeFilter, statusFilter, tagFilter])

  function setStatus(node: Node, status: ResourceStatus) {
    let ed: Record<string, unknown> = {}
    try { ed = JSON.parse(node.extraData || '{}') } catch {}
    ed._resourceStatus = status
    store.updateNode(node.id, { extraData: JSON.stringify(ed) })
  }

  function createLinkedTask(node: Node) {
    const today = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
    const diary = store.todayDiary()
    const { meta, type } = getResourceData(node)
    const label = type === 'youtube' ? 'Ver vídeo' : type === 'book' ? 'Leer' : type === 'podcast' ? 'Escuchar' : 'Revisar'
    const task = store.createNode({ text: `${label}: ${meta?.title || node.text || 'recurso'}`, parentId: diary?.id || null, isTask: true, due: today })
    let ed: Record<string, unknown> = {}
    try { ed = JSON.parse(task.extraData || '{}') } catch {}
    ed._linkedNodeId = node.id
    store.updateNode(task.id, { extraData: JSON.stringify(ed) })
  }

  return (
    <div className="resources-view" role="main">
      {/* Header */}
      <div className="resources-header">
        <h1 className="resources-title">🔗 Recursos</h1>
        <div className="resources-view-toggle">
          <button className={`resources-toggle-btn${viewMode === 'grid' ? ' active' : ''}`} onClick={() => setViewMode('grid')}>⊞</button>
          <button className={`resources-toggle-btn${viewMode === 'list' ? ' active' : ''}`} onClick={() => setViewMode('list')}>☰</button>
        </div>
      </div>

      {/* Filtros */}
      <div className="resources-filters">
        {/* Tipo */}
        <div className="resources-filter-group">
          {(['all', 'youtube', 'url', 'book', 'podcast', 'document'] as const).map(t => (
            <button
              key={t}
              className={`resources-filter-btn${typeFilter === t ? ' active' : ''}`}
              onClick={() => setTypeFilter(t)}
            >
              {t === 'all' ? 'Todo' : `${TYPE_ICONS[t]} ${TYPE_LABELS[t]}`}
            </button>
          ))}
        </div>

        {/* Estado */}
        <div className="resources-filter-group">
          {(['all', 'pending', 'consuming', 'done', 'archived'] as const).map(st => (
            <button
              key={st}
              className={`resources-filter-btn${statusFilter === st ? ' active' : ''}`}
              style={statusFilter === st && st !== 'all' ? { background: STATUS_COLORS[st], borderColor: STATUS_COLORS[st], color: 'white' } : {}}
              onClick={() => setStatusFilter(st)}
            >
              {st === 'all' ? 'Todos los estados' : STATUS_LABELS[st]}
            </button>
          ))}
        </div>

        {/* Tags */}
        {usedTags.length > 0 && (
          <div className="resources-filter-group">
            <button className={`resources-filter-btn${tagFilter === 'all' ? ' active' : ''}`} onClick={() => setTagFilter('all')}>Todos los tags</button>
            {usedTags.map(t => (
              <button
                key={t}
                className={`resources-filter-btn${tagFilter === t ? ' active' : ''}`}
                onClick={() => setTagFilter(t)}
              >#{t}</button>
            ))}
          </div>
        )}
      </div>

      {/* Contador */}
      <div className="resources-count">{filtered.length} recurso{filtered.length !== 1 ? 's' : ''}</div>

      {/* Grid / Lista */}
      {filtered.length === 0 ? (
        <div className="resources-empty">
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
          <div style={{ fontSize: 16, color: 'var(--text-secondary)' }}>Sin recursos</div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 8 }}>
            Marca cualquier nota como Recurso desde el panel derecho, o pega una URL como título de un nodo.
          </div>
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'resources-grid' : 'resources-list'}>
          {filtered.map(node => {
            const { type, status, url, meta } = getResourceData(node)
            const linkedCount = s.linkedTasks(node.id).length
            return (
              <div key={node.id} className="resource-card" onClick={() => navigate(`/node/${node.id}`)}>
                {/* Thumbnail */}
                {meta?.image ? (
                  <img src={meta.image} alt={meta.title || ''} className="resource-card-thumb" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                ) : (
                  <div className="resource-card-thumb-placeholder">{TYPE_ICONS[type] || '🔗'}</div>
                )}

                {/* Info */}
                <div className="resource-card-body">
                  <div className="resource-card-type">
                    <span>{TYPE_ICONS[type]} {TYPE_LABELS[type]}</span>
                    {meta?.domain && <span className="resource-card-domain">{meta.channel || meta.domain}</span>}
                  </div>
                  <div className="resource-card-title">{meta?.title || node.text || 'Sin título'}</div>
                  {meta?.description && <div className="resource-card-desc">{meta.description.slice(0, 80)}…</div>}

                  {/* Tags */}
                  {(node.types || []).length > 0 && (
                    <div className="resource-card-tags">
                      {(node.types || []).slice(0, 3).map(t => (
                        <span key={t} className="resource-card-tag">#{t}</span>
                      ))}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="resource-card-footer">
                    {/* Status pill */}
                    <select
                      className="resource-card-status"
                      style={{ borderColor: STATUS_COLORS[status], color: STATUS_COLORS[status] }}
                      value={status}
                      onClick={e => e.stopPropagation()}
                      onChange={e => { e.stopPropagation(); setStatus(node, e.target.value as ResourceStatus) }}
                    >
                      <option value="pending">Pendiente</option>
                      <option value="consuming">En progreso</option>
                      <option value="done">Hecho</option>
                      <option value="archived">Archivado</option>
                    </select>

                    <div className="resource-card-actions">
                      {linkedCount > 0 && (
                        <span className="resource-card-tasks-badge" title={`${linkedCount} tarea${linkedCount !== 1 ? 's' : ''} asociada${linkedCount !== 1 ? 's' : ''}`}>
                          ✓ {linkedCount}
                        </span>
                      )}
                      <button
                        className="resource-card-add-task"
                        title="Crear tarea asociada"
                        onClick={e => { e.stopPropagation(); createLinkedTask(node) }}
                      >＋ Tarea</button>
                      {url && (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="resource-card-open" onClick={e => e.stopPropagation()}>↗</a>
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
  )
}
