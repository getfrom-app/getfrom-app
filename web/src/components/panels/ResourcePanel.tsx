import { useState, useEffect } from 'react'
import { store } from '../../store/nodeStore'
import type { Node } from '../../types'
import { unfurlUrl, type UnfurlMeta } from '../../api/unfurl'

export type ResourceType = string  // ahora libre — usuario puede definir nuevos
export type ResourceTypeDef = { key: string; icon: string; label: string }

// Tipos built-in (no se pueden borrar)
const BUILTIN_TYPES: ResourceTypeDef[] = [
  { key: 'url',      icon: '🔗', label: 'Enlace' },
  { key: 'youtube',  icon: '▶️', label: 'Vídeo' },
  { key: 'book',     icon: '📚', label: 'Libro' },
  { key: 'podcast',  icon: '🎙', label: 'Podcast' },
  { key: 'document', icon: '📄', label: 'Documento' },
]

const CUSTOM_TYPES_KEY = 'from_custom_resource_types'

function loadCustomTypes(): ResourceTypeDef[] {
  try {
    const raw = localStorage.getItem(CUSTOM_TYPES_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr.filter(t => t && typeof t.key === 'string' && typeof t.label === 'string')
  } catch { return [] }
}
function saveCustomTypes(types: ResourceTypeDef[]) {
  localStorage.setItem(CUSTOM_TYPES_KEY, JSON.stringify(types))
  window.dispatchEvent(new Event('from-resource-types-updated'))
}

function getResourceData(node: Node) {
  try {
    const ed = JSON.parse(node.extraData || '{}')
    return {
      type: (ed._resourceType || 'url') as ResourceType,
      url: (ed._resourceUrl || '') as string,
      meta: (ed._resourceMeta || null) as UnfurlMeta | null,
    }
  } catch {
    return { type: 'url', url: '', meta: null }
  }
}

function setResourceField(node: Node, fields: Record<string, unknown>) {
  let ed: Record<string, unknown> = {}
  try { ed = JSON.parse(node.extraData || '{}') } catch { /* ignore */ }
  Object.assign(ed, fields)
  store.updateNode(node.id, { extraData: JSON.stringify(ed) })
}

interface Props { node: Node }

export default function ResourcePanel({ node }: Props) {
  const { type, url, meta } = getResourceData(node)
  const [urlInput, setUrlInput] = useState(url)
  const [loadingMeta, setLoadingMeta] = useState(false)
  const [customTypes, setCustomTypes] = useState<ResourceTypeDef[]>(() => loadCustomTypes())
  const [addingType, setAddingType] = useState(false)
  const [newTypeLabel, setNewTypeLabel] = useState('')
  const [newTypeIcon, setNewTypeIcon] = useState('📌')

  useEffect(() => {
    function refresh() { setCustomTypes(loadCustomTypes()) }
    window.addEventListener('from-resource-types-updated', refresh)
    return () => window.removeEventListener('from-resource-types-updated', refresh)
  }, [])

  const allTypes = [...BUILTIN_TYPES, ...customTypes]

  // Auto-fetch meta si hay URL pero no hay meta
  useEffect(() => {
    if (url && !meta && !loadingMeta) {
      setLoadingMeta(true)
      unfurlUrl(url)
        .then(m => setResourceField(node, { _resourceMeta: m, _resourceType: m.type }))
        .catch(() => { /* ignore */ })
        .finally(() => setLoadingMeta(false))
    }
  }, [url]) // eslint-disable-line

  function handleFetchMeta() {
    if (!urlInput.trim()) return
    setLoadingMeta(true)
    setResourceField(node, { _resourceUrl: urlInput.trim() })
    unfurlUrl(urlInput.trim())
      .then(m => setResourceField(node, { _resourceMeta: m, _resourceType: m.type }))
      .catch(() => { /* ignore */ })
      .finally(() => setLoadingMeta(false))
  }

  function addCustomType() {
    const label = newTypeLabel.trim()
    if (!label) return
    const key = 'custom_' + label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    if (allTypes.some(t => t.key === key)) {
      // Ya existe — solo seleccionar
      setResourceField(node, { _resourceType: key })
      setAddingType(false); setNewTypeLabel('')
      return
    }
    const updated = [...customTypes, { key, icon: newTypeIcon || '📌', label }]
    saveCustomTypes(updated)
    setCustomTypes(updated)
    setResourceField(node, { _resourceType: key })
    setAddingType(false)
    setNewTypeLabel('')
    setNewTypeIcon('📌')
  }

  function deleteCustomType(key: string, e: React.MouseEvent) {
    e.preventDefault()
    if (BUILTIN_TYPES.some(t => t.key === key)) return  // built-in no borrable
    const def = customTypes.find(t => t.key === key)
    if (!def) return
    if (!confirm(`¿Eliminar el tipo "${def.label}"? Las notas que lo usaban quedarán como "Enlace".`)) return
    const updated = customTypes.filter(t => t.key !== key)
    saveCustomTypes(updated)
    setCustomTypes(updated)
    if (type === key) setResourceField(node, { _resourceType: 'url' })
  }

  return (
    <div className="resource-panel">
      {/* Tipo de recurso (built-in + custom + añadir) */}
      <div className="resource-panel-section">
        <div className="resource-panel-label">Tipo</div>
        <div className="resource-type-chips">
          {allTypes.map(t => {
            const isCustom = !BUILTIN_TYPES.some(b => b.key === t.key)
            return (
              <button
                key={t.key}
                className={`resource-type-chip${type === t.key ? ' active' : ''}`}
                onClick={() => setResourceField(node, { _resourceType: t.key })}
                onContextMenu={isCustom ? e => deleteCustomType(t.key, e) : undefined}
                title={isCustom ? 'Clic derecho para eliminar' : t.label}
              >
                {t.icon} {t.label}
              </button>
            )
          })}
          {!addingType && (
            <button
              className="resource-type-chip resource-type-chip--add"
              onClick={() => setAddingType(true)}
              title="Añadir nuevo tipo"
            >＋</button>
          )}
        </div>
        {addingType && (
          <div className="resource-type-add-row">
            <input
              className="resource-type-icon-input"
              maxLength={2}
              placeholder="📌"
              value={newTypeIcon}
              onChange={e => setNewTypeIcon(e.target.value)}
            />
            <input
              className="resource-type-label-input"
              placeholder="Nombre del tipo..."
              value={newTypeLabel}
              autoFocus
              onChange={e => setNewTypeLabel(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') addCustomType()
                if (e.key === 'Escape') { setAddingType(false); setNewTypeLabel('') }
              }}
            />
            <button className="resource-type-add-confirm" onClick={addCustomType}>✓</button>
          </div>
        )}
      </div>

      {/* URL */}
      <div className="resource-panel-section">
        <div className="resource-panel-label">URL</div>
        <div className="resource-url-row">
          <input
            className="resource-url-input"
            placeholder="https://..."
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleFetchMeta()}
          />
          <button
            className="resource-url-fetch-btn"
            onClick={handleFetchMeta}
            disabled={loadingMeta || !urlInput.trim()}
            title="Obtener vista previa"
          >
            {loadingMeta ? '⏳' : '↗'}
          </button>
        </div>
      </div>

      {/* Vista previa */}
      {meta && (
        <div className="resource-meta-card">
          {meta.image && (
            <img
              src={meta.image}
              alt={meta.title}
              className={`resource-meta-thumb${meta.type === 'youtube' ? ' resource-meta-thumb--youtube' : ''}`}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}
          <div className="resource-meta-info">
            <div className="resource-meta-title">{meta.title}</div>
            {meta.channel && <div className="resource-meta-sub">📺 {meta.channel}</div>}
            {!meta.channel && meta.domain && <div className="resource-meta-sub">🌐 {meta.domain}</div>}
            {meta.description && <div className="resource-meta-desc">{meta.description.slice(0, 100)}{meta.description.length > 100 ? '…' : ''}</div>}
            {url && (
              <a href={url} target="_blank" rel="noopener noreferrer" className="resource-meta-link" onClick={e => e.stopPropagation()}>
                Abrir →
              </a>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
