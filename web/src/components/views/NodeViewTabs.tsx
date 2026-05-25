import { useState } from 'react'
import { store, useStore } from '../../store/nodeStore'

interface Props {
  parentId: string
  activeViewId: string
  onSelect: (id: string) => void
}

type ViewKind = 'list' | 'table' | 'kanban' | 'calendar'

const KIND_ICONS: Record<ViewKind, string> = {
  list: '☰', table: '⊞', kanban: '⫴', calendar: '📅',
}
const KIND_LABELS: Record<ViewKind, string> = {
  list: 'Lista', table: 'Tabla', kanban: 'Kanban', calendar: 'Calendario',
}

interface NewViewModalProps {
  onClose: () => void
  onCreate: (name: string, kind: ViewKind) => void
}

function NewViewModal({ onClose, onCreate }: NewViewModalProps) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<ViewKind>('table')
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--small" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">Nueva vista</h3>
        <div className="modal-field">
          <label>Nombre</label>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onCreate(name.trim(), kind); if (e.key === 'Escape') onClose() }}
            placeholder={KIND_LABELS[kind]}
          />
        </div>
        <div className="modal-field">
          <label>Tipo</label>
          <div className="node-view-kind-grid">
            {(['list', 'table', 'kanban', 'calendar'] as ViewKind[]).map(k => (
              <button
                key={k}
                className={`node-view-kind-btn ${kind === k ? 'active' : ''}`}
                onClick={() => setKind(k)}
              >
                <span style={{ fontSize: 20 }}>{KIND_ICONS[k]}</span>
                <span>{KIND_LABELS[k]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="modal-actions">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={() => onCreate((name.trim() || KIND_LABELS[kind]), kind)} className="btn-primary">Crear</button>
        </div>
      </div>
    </div>
  )
}

export default function NodeViewTabs({ parentId, activeViewId, onSelect }: Props) {
  useStore()  // re-render on store changes
  const views = store.getViews(parentId)
  const [newOpen, setNewOpen] = useState(false)
  const [tabMenu, setTabMenu] = useState<string | null>(null)

  // Si no hay views, sintetizar una default "Lista"
  const effective = views.length > 0 ? views : [{ id: 'default', name: 'Lista', kind: 'list' as ViewKind }]

  function handleCreate(name: string, kind: ViewKind) {
    const id = 'v' + Math.random().toString(36).slice(2, 10)
    const newViews = [...views, { id, name, kind }]
    store.setViews(parentId, newViews)
    store.setActiveViewId(parentId, id)
    onSelect(id)
    setNewOpen(false)
  }

  function handleRename(viewId: string) {
    const v = views.find(x => x.id === viewId)
    if (!v) return
    const newName = prompt('Nuevo nombre:', v.name)
    if (newName && newName.trim()) {
      const newViews = views.map(x => x.id === viewId ? { ...x, name: newName.trim() } : x)
      store.setViews(parentId, newViews)
    }
    setTabMenu(null)
  }

  function handleDelete(viewId: string) {
    if (!confirm('¿Eliminar esta vista? La configuración se perderá.')) return
    const newViews = views.filter(x => x.id !== viewId)
    store.setViews(parentId, newViews)
    if (activeViewId === viewId && newViews.length > 0) {
      store.setActiveViewId(parentId, newViews[0].id)
      onSelect(newViews[0].id)
    } else if (newViews.length === 0) {
      store.setActiveViewId(parentId, 'default')
      onSelect('default')
    }
    setTabMenu(null)
  }

  function handleDuplicate(viewId: string) {
    const v = views.find(x => x.id === viewId)
    if (!v) return
    const id = 'v' + Math.random().toString(36).slice(2, 10)
    const newViews = [...views, { ...v, id, name: v.name + ' (copia)' }]
    store.setViews(parentId, newViews)
    setTabMenu(null)
  }

  return (
    <div className="node-view-tabs">
      <div className="node-view-tabs-list">
        {effective.map(v => (
          <div key={v.id} className="node-view-tab-wrap">
            <button
              className={`node-view-tab ${activeViewId === v.id ? 'active' : ''}`}
              onClick={() => onSelect(v.id)}
              onContextMenu={e => { e.preventDefault(); if (v.id !== 'default') setTabMenu(v.id) }}
            >
              <span className="node-view-tab-icon">{KIND_ICONS[v.kind as ViewKind] || '☰'}</span>
              <span className="node-view-tab-label">{v.name}</span>
            </button>
            {tabMenu === v.id && (
              <div className="node-view-tab-menu" onClick={e => e.stopPropagation()}>
                <button onClick={() => handleRename(v.id)}>Renombrar</button>
                <button onClick={() => handleDuplicate(v.id)}>Duplicar</button>
                <button onClick={() => handleDelete(v.id)} className="danger">Eliminar</button>
                <button onClick={() => setTabMenu(null)}>Cerrar</button>
              </div>
            )}
          </div>
        ))}
        <button className="node-view-tab node-view-tab--add" onClick={() => setNewOpen(true)} title="Nueva vista">＋</button>
      </div>

      {newOpen && (
        <NewViewModal onClose={() => setNewOpen(false)} onCreate={handleCreate} />
      )}
    </div>
  )
}

export function getViewKind(parentId: string, viewId: string): ViewKind {
  if (viewId === 'default') return 'list'
  const views = store.getViews(parentId)
  const v = views.find(x => x.id === viewId)
  return (v?.kind as ViewKind) || 'list'
}
