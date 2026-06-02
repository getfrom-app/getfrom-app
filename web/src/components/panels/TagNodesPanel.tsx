import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useStore, store } from '../../store/nodeStore'
import type { Node } from '../../types'

type SortKey = 'updated' | 'created' | 'alpha' | 'status'

interface TagNodesPanelProps {
  tagName: string
}

const TAG_COLORS = [
  '#8b5cf6', '#7c3aed', '#6d28d9',
  '#3b82f6', '#2563eb', '#1d4ed8',
  '#06b6d4', '#0891b2',
  '#10b981', '#059669', '#16a34a',
  '#f59e0b', '#d97706', '#f97316',
  '#ef4444', '#dc2626',
  '#ec4899', '#db2777',
  '#84cc16', '#64748b',
  '#a78bfa', '#fb923c',
]

function nodeIcon(n: Node): string {
  if (n.isEvent) return '📅'
  if ((n.types || []).includes('bucle')) return '↺'
  if (n.status === 'done') return '✓'
  if (n.status !== null) return '○'
  return '📄'
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return 'ahora'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
  const days = Math.floor(diff / 86400000)
  if (days < 7) return `${days}d`
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

export default function TagNodesPanel({ tagName }: TagNodesPanelProps) {
  const s = useStore()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [sort, setSort] = useState<SortKey>('updated')
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'done' | 'notes'>('all')
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null)

  // Nodo definición del tag y sus prompts hijos
  const tagDefNode = useMemo(() => store.getTagDefNode(tagName), [s, tagName])
  const tagPrompts = useMemo(() => {
    if (!tagDefNode) return []
    return store.children(tagDefNode.id).filter(child => {
      try { return JSON.parse(child.extraData || '{}')._tagPrompt === '1' } catch { return false }
    })
  }, [s, tagDefNode])

  function addPrompt() {
    if (!tagDefNode) return
    const created = store.createNode({
      text: 'Nuevo prompt',
      parentId: tagDefNode.id,
      extraData: { _tagPrompt: '1' },
    })
    setEditingPromptId(created.id)
    navigate(`/node/${created.id}`)
  }

  function deletePrompt(id: string) {
    const node = store.nodes.get(id)
    if (node) store.deleteNode(id)
  }

  const currentColor = s.tagColor(tagName)

  const nodes = useMemo(() => {
    let items = s.allActive().filter(n =>
      !n.deletedAt &&
      (n.types || []).includes(tagName) &&
      !n.isDiaryEntry
    )
    if (filterStatus === 'pending') items = items.filter(n => n.status === 'pending')
    else if (filterStatus === 'done') items = items.filter(n => n.status === 'done')
    else if (filterStatus === 'notes') items = items.filter(n => n.status === null && !n.isEvent)

    return [...items].sort((a, b) => {
      if (sort === 'updated') return b.updatedAt.localeCompare(a.updatedAt)
      if (sort === 'created') return b.createdAt.localeCompare(a.createdAt)
      if (sort === 'alpha') return (a.text || '').localeCompare(b.text || '', 'es')
      if (sort === 'status') {
        const rank = (n: Node) => n.status === 'pending' ? 0 : n.status === 'done' ? 2 : 1
        return rank(a) - rank(b)
      }
      return 0
    })
  }, [s, tagName, sort, filterStatus])

  const counts = useMemo(() => {
    const all = s.allActive().filter(n => !n.deletedAt && (n.types || []).includes(tagName) && !n.isDiaryEntry)
    return {
      all: all.length,
      pending: all.filter(n => n.status === 'pending').length,
      done: all.filter(n => n.status === 'done').length,
      notes: all.filter(n => n.status === null && !n.isEvent).length,
    }
  }, [s, tagName])

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: 'updated', label: 'Editado' },
    { key: 'created', label: 'Creado' },
    { key: 'alpha', label: 'A–Z' },
    { key: 'status', label: 'Estado' },
  ]

  return (
    <div className="tag-nodes-panel">
      {/* Color del tag */}
      <div className="tag-nodes-color-section">
        <span className="tag-nodes-color-label">{t('panel.color')}</span>
        <div className="tag-nodes-color-grid">
          {TAG_COLORS.map(c => (
            <button
              key={c}
              className="tag-nodes-color-swatch"
              style={{
                background: c,
                outline: currentColor === c ? `2px solid ${c}` : 'none',
                outlineOffset: 2,
                opacity: currentColor === c ? 1 : 0.75,
              }}
              onClick={() => store.setTagColor(tagName, c)}
              title={c}
            />
          ))}
          <button
            className="tag-nodes-color-swatch tag-nodes-color-reset"
            onClick={() => store.setTagColor(tagName, null)}
            title={t('panel.resetColor')}
          >↺</button>
        </div>
      </div>

      <div className="tag-nodes-divider" />

      {/* Prompts de IA */}
      <div style={{ padding: '10px 12px 6px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          marginBottom: 6,
        }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
            PROMPTS DE IA
          </span>
          <button
            onClick={addPrompt}
            title={t('panel.addAIPrompt')}
            style={{
              background: 'none', border: '1px solid var(--border)',
              borderRadius: 5, padding: '1px 6px', fontSize: 11,
              color: 'var(--text-secondary)', cursor: 'pointer',
              lineHeight: 1.4,
            }}
          >＋</button>
        </div>
        {tagPrompts.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.6, paddingBottom: 4 }}>
            Sin prompts — pulsa ＋ para añadir
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {tagPrompts.map(p => (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'var(--bg-secondary)', borderRadius: 6,
                padding: '4px 8px',
              }}>
                <span style={{ fontSize: 12 }}>✨</span>
                <button
                  onClick={() => navigate(`/node/${p.id}`)}
                  style={{
                    background: 'none', border: 'none', padding: 0,
                    fontSize: 12, color: 'var(--text-primary)',
                    cursor: 'pointer', flex: 1, textAlign: 'left',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                  title={p.body ? `${p.text}\n\n${p.body.slice(0, 200)}` : p.text}
                >
                  {p.text || 'Sin título'}
                </button>
                <button
                  onClick={() => deletePrompt(p.id)}
                  style={{
                    background: 'none', border: 'none', padding: '0 2px',
                    fontSize: 12, color: 'var(--text-secondary)',
                    cursor: 'pointer', opacity: 0.5,
                    flexShrink: 0,
                  }}
                  title="Eliminar prompt"
                >✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="tag-nodes-divider" />

      {/* Filtros */}
      <div className="tag-nodes-panel-filters">
        {(['all', 'pending', 'done', 'notes'] as const).map(f => (
          <button
            key={f}
            className={`tag-nodes-filter-btn${filterStatus === f ? ' active' : ''}`}
            style={filterStatus === f ? { background: currentColor, borderColor: currentColor } : {}}
            onClick={() => setFilterStatus(f)}
          >
            {f === 'all' ? `Todo (${counts.all})`
              : f === 'pending' ? `Tareas (${counts.pending})`
              : f === 'done' ? `Hechas (${counts.done})`
              : `Notas (${counts.notes})`}
          </button>
        ))}
      </div>

      {/* Ordenación */}
      <div className="tag-nodes-panel-sort">
        <span className="tag-nodes-sort-label">Orden:</span>
        {SORT_OPTIONS.map(o => (
          <button
            key={o.key}
            className={`tag-nodes-sort-btn${sort === o.key ? ' active' : ''}`}
            onClick={() => setSort(o.key)}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="tag-nodes-list">
        {nodes.length === 0 ? (
          <div className="tag-nodes-empty">Sin resultados</div>
        ) : (
          nodes.map(n => (
            <button
              key={n.id}
              className={`tag-nodes-item${n.status === 'done' ? ' done' : ''}`}
              onClick={() => navigate(`/node/${n.id}`)}
              title={n.text || t('common.noTitle')}
            >
              <span className="tag-nodes-item-icon">{nodeIcon(n)}</span>
              <span className="tag-nodes-item-text">{n.text || t('common.noTitle')}</span>
              <span className="tag-nodes-item-date">{formatDate(n.updatedAt)}</span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
