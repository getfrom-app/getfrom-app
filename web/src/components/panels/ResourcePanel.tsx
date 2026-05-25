import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, store } from '../../store/nodeStore'
import type { Node } from '../../types'
import { unfurlUrl, type UnfurlMeta } from '../../api/unfurl'
import TaskPropsPopover from './TaskPropsPopover'

export type ResourceType = 'url' | 'youtube' | 'book' | 'podcast' | 'document'
export type ResourceStatus = 'pending' | 'consuming' | 'done' | 'archived'

const RESOURCE_TYPES: { key: ResourceType; icon: string; label: string }[] = [
  { key: 'url',      icon: '🔗', label: 'Enlace' },
  { key: 'youtube',  icon: '▶️', label: 'Vídeo' },
  { key: 'book',     icon: '📚', label: 'Libro' },
  { key: 'podcast',  icon: '🎙', label: 'Podcast' },
  { key: 'document', icon: '📄', label: 'Documento' },
]

const STATUS_OPTIONS: { key: ResourceStatus; label: string; color: string }[] = [
  { key: 'pending',   label: 'Pendiente',    color: '#f59e0b' },
  { key: 'consuming', label: 'Leyendo/viendo', color: '#3b82f6' },
  { key: 'done',      label: 'Hecho',         color: '#22c55e' },
  { key: 'archived',  label: 'Archivado',     color: '#94a3b8' },
]

function getResourceData(node: Node) {
  try {
    const ed = JSON.parse(node.extraData || '{}')
    return {
      type: (ed._resourceType || 'url') as ResourceType,
      status: (ed._resourceStatus || 'pending') as ResourceStatus,
      url: (ed._resourceUrl || '') as string,
      meta: (ed._resourceMeta || null) as UnfurlMeta | null,
    }
  } catch {
    return { type: 'url' as ResourceType, status: 'pending' as ResourceStatus, url: '', meta: null }
  }
}

function setResourceField(node: Node, fields: Record<string, unknown>) {
  let ed: Record<string, unknown> = {}
  try { ed = JSON.parse(node.extraData || '{}') } catch {}
  Object.assign(ed, fields)
  store.updateNode(node.id, { extraData: JSON.stringify(ed) })
}

interface Props { node: Node }

export default function ResourcePanel({ node }: Props) {
  const s = useStore()
  const navigate = useNavigate()
  const { type, status, url, meta } = getResourceData(node)
  const [urlInput, setUrlInput] = useState(url)
  const [loadingMeta, setLoadingMeta] = useState(false)
  const [newTaskText, setNewTaskText] = useState('')
  const [showTaskInput, setShowTaskInput] = useState(false)
  const [popoverTask, setPopoverTask] = useState<Node | null>(null)
  const popoverBtnRef = useRef<HTMLButtonElement>(null!)

  const linkedTasks = s.linkedTasks(node.id)

  // Auto-fetch meta si hay URL pero no hay meta
  useEffect(() => {
    if (url && !meta && !loadingMeta) {
      setLoadingMeta(true)
      unfurlUrl(url)
        .then(m => setResourceField(node, { _resourceMeta: m, _resourceType: m.type }))
        .catch(() => {})
        .finally(() => setLoadingMeta(false))
    }
  }, [url]) // eslint-disable-line

  function handleFetchMeta() {
    if (!urlInput.trim()) return
    setLoadingMeta(true)
    setResourceField(node, { _resourceUrl: urlInput.trim() })
    unfurlUrl(urlInput.trim())
      .then(m => setResourceField(node, { _resourceMeta: m, _resourceType: m.type }))
      .catch(() => {})
      .finally(() => setLoadingMeta(false))
  }

  function createLinkedTask() {
    if (!newTaskText.trim()) return
    const today = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
    const task = store.createNode({ text: newTaskText.trim(), parentId: node.id, isTask: true, due: today })
    let ed: Record<string, unknown> = {}
    try { ed = JSON.parse(task.extraData || '{}') } catch {}
    ed._linkedNodeId = node.id
    store.updateNode(task.id, { extraData: JSON.stringify(ed) })
    setNewTaskText('')
    setShowTaskInput(false)
  }

  const currentStatus = STATUS_OPTIONS.find(s => s.key === status)!

  return (
    <div className="resource-panel">
      {/* Tipo de recurso */}
      <div className="resource-panel-section">
        <div className="resource-panel-label">Tipo</div>
        <div className="resource-type-chips">
          {RESOURCE_TYPES.map(t => (
            <button
              key={t.key}
              className={`resource-type-chip${type === t.key ? ' active' : ''}`}
              onClick={() => setResourceField(node, { _resourceType: t.key })}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
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

      {/* Vista previa / tarjeta */}
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

      {/* Estado */}
      <div className="resource-panel-section">
        <div className="resource-panel-label">Estado</div>
        <div className="resource-status-chips">
          {STATUS_OPTIONS.map(s => (
            <button
              key={s.key}
              className={`resource-status-chip${status === s.key ? ' active' : ''}`}
              style={status === s.key ? { background: s.color, borderColor: s.color, color: 'white' } : {}}
              onClick={() => setResourceField(node, { _resourceStatus: s.key })}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tareas asociadas */}
      <div className="resource-panel-section resource-tasks-section">
        <div className="resource-panel-label-row">
          <span className="resource-panel-label">Tareas asociadas</span>
          <button className="resource-add-task-btn" onClick={() => setShowTaskInput(v => !v)} title="Añadir tarea vinculada">＋</button>
        </div>

        {showTaskInput && (
          <div className="resource-new-task-row">
            <input
              autoFocus
              className="resource-new-task-input"
              placeholder="Nueva tarea..."
              value={newTaskText}
              onChange={e => setNewTaskText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') createLinkedTask()
                if (e.key === 'Escape') { setShowTaskInput(false); setNewTaskText('') }
              }}
            />
            <button className="resource-new-task-confirm" onClick={createLinkedTask}>✓</button>
          </div>
        )}

        {linkedTasks.length === 0 && !showTaskInput ? (
          <div className="resource-tasks-empty">Sin tareas asociadas</div>
        ) : (
          linkedTasks.map(task => (
            <div
              key={task.id}
              className={`resource-linked-task${task.status === 'done' ? ' done' : ''}`}
              onClick={() => navigate(`/node/${task.id}`)}
              onContextMenu={e => {
                e.preventDefault()
                if (confirm(`¿Eliminar tarea "${task.text || 'Sin título'}"?`)) {
                  store.updateNode(task.id, { deletedAt: new Date().toISOString() })
                }
              }}
            >
              <button
                className={`resource-linked-task-check${task.status === 'done' ? ' done' : ''}`}
                onClick={e => {
                  e.stopPropagation()
                  store.updateNode(task.id, { status: task.status === 'done' ? 'pending' : 'done' })
                }}
              >
                {task.status === 'done' ? '✓' : '○'}
              </button>
              <span className="resource-linked-task-text">{task.text || 'Sin título'}</span>
              {task.due && (
                <span className="resource-linked-task-date">
                  {new Date(task.due).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                </span>
              )}
              {/* Botón de propiedades — visible en hover */}
              <button
                ref={popoverTask?.id === task.id ? popoverBtnRef : undefined}
                className="resource-linked-task-props"
                onClick={e => {
                  e.stopPropagation()
                  setPopoverTask(prev => prev?.id === task.id ? null : task)
                }}
                title="Propiedades"
              >⋯</button>
            </div>
          ))
        )}

        {/* Popover de propiedades */}
        {popoverTask && (
          <TaskPropsPopover
            node={popoverTask}
            anchorRef={popoverBtnRef}
            onClose={() => setPopoverTask(null)}
          />
        )}
      </div>
    </div>
  )
}
