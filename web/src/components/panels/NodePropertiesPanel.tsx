import { useState } from 'react'
import { store } from '../../store/nodeStore'
import type { Node } from '../../types'

interface Props {
  node: Node
  onClose: () => void
}

const COMMON_TYPES = ['tarea', 'proyecto', 'área', 'referencia', 'evento', 'nota']

export default function NodePropertiesPanel({ node, onClose }: Props) {
  const [newType, setNewType] = useState('')

  function toggleFavorite() {
    store.updateNode(node.id, { isFavorite: !node.isFavorite })
  }

  function setStatus(status: Node['status']) {
    store.updateNode(node.id, { status })
  }

  function setPriority(priority: Node['priority']) {
    store.updateNode(node.id, { priority })
  }

  function handleDueChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    store.updateNode(node.id, { due: val ? new Date(val).toISOString() : null })
  }

  function addType(type: string) {
    const trimmed = type.trim().toLowerCase()
    if (!trimmed) return
    if (node.types.includes(trimmed)) return
    store.updateNode(node.id, { types: [...node.types, trimmed] })
    setNewType('')
  }

  function removeType(type: string) {
    store.updateNode(node.id, { types: node.types.filter(t => t !== type) })
  }

  function handleTypeKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addType(newType)
    }
  }

  // Format ISO date to YYYY-MM-DD for <input type="date">
  const dueDateValue = node.due ? node.due.slice(0, 10) : ''

  const statusOptions: { value: Node['status']; label: string; icon: string }[] = [
    { value: null, label: 'Sin estado', icon: '○' },
    { value: 'pending', label: 'Pendiente', icon: '●' },
    { value: 'done', label: 'Hecho', icon: '✓' },
  ]

  const priorityOptions: { value: Node['priority']; label: string; color: string }[] = [
    { value: null, label: 'Ninguna', color: '' },
    { value: 'low', label: 'Baja', color: 'priority-badge--low' },
    { value: 'medium', label: 'Media', color: 'priority-badge--medium' },
    { value: 'high', label: 'Alta', color: 'priority-badge--high' },
  ]

  return (
    <div className="properties-panel">
      <div className="properties-panel-header">
        <span className="properties-panel-title">Propiedades</span>
        <button className="properties-close-btn" onClick={onClose} aria-label="Cerrar panel">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Favorito */}
      <div className="prop-row">
        <span className="prop-label">Favorito</span>
        <button
          className={`prop-fav-btn ${node.isFavorite ? 'active' : ''}`}
          onClick={toggleFavorite}
          title={node.isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
        >
          {node.isFavorite ? '★' : '☆'}
        </button>
      </div>

      {/* Estado */}
      <div className="prop-row prop-row--column">
        <span className="prop-label">Estado</span>
        <div className="prop-buttons">
          {statusOptions.map(opt => (
            <button
              key={String(opt.value)}
              className={`prop-btn ${node.status === opt.value ? 'active' : ''}`}
              onClick={() => setStatus(opt.value)}
              title={opt.label}
            >
              <span>{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Prioridad */}
      <div className="prop-row prop-row--column">
        <span className="prop-label">Prioridad</span>
        <div className="prop-buttons">
          {priorityOptions.map(opt => (
            <button
              key={String(opt.value)}
              className={`prop-btn ${node.priority === opt.value ? 'active' : ''} ${opt.color}`}
              onClick={() => setPriority(opt.value)}
              title={opt.label}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Fecha */}
      <div className="prop-row">
        <span className="prop-label">Fecha</span>
        <input
          type="date"
          className="prop-date-input"
          value={dueDateValue}
          onChange={handleDueChange}
        />
      </div>

      {/* Recurrencia — solo para tareas */}
      {node.status !== null && (
        <div className="prop-row">
          <span className="prop-label">Repetir</span>
          <select
            className="prop-select"
            value={node.recurrence || ''}
            onChange={e => store.updateNode(node.id, { recurrence: e.target.value || null })}
          >
            <option value="">Sin repetición</option>
            <option value="daily">Cada día</option>
            <option value="weekly">Cada semana</option>
            <option value="monthly">Cada mes</option>
            <option value="yearly">Cada año</option>
          </select>
        </div>
      )}

      {/* Tipos / Tags */}
      <div className="prop-row prop-row--column">
        <span className="prop-label">Tipos</span>
        <div className="prop-types">
          {node.types.map(t => (
            <span key={t} className="type-chip">
              {t}
              <button
                className="type-chip-remove"
                onClick={() => removeType(t)}
                aria-label={`Quitar tipo ${t}`}
              >
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
            className="prop-type-input"
            value={newType}
            onChange={e => setNewType(e.target.value)}
            onKeyDown={handleTypeKeyDown}
            placeholder="+ tipo"
            list="common-types"
          />
          <datalist id="common-types">
            {COMMON_TYPES.map(t => <option key={t} value={t} />)}
          </datalist>
        </div>
      </div>
    </div>
  )
}
