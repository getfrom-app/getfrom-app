import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'

// Tipos reservados que no son tags de usuario
const RESERVED_TYPES = new Set(['bucle', 'tarea', 'evento', 'agente', 'prompt', 'nota',
  'enlace', 'archivo', 'panel', 'busqueda', 'chat', 'favorito', 'seguimiento',
  'quick', 'magic', 'rec', 'area'])

function formatDue(due: string): string {
  const d = new Date(due)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'Hoy'
  if (diff === -1) return 'Ayer'
  if (diff === 1) return 'Mañana'
  if (diff < 0) return `Hace ${Math.abs(diff)}d`
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

function getUserTags(node: Node): string[] {
  return (node.types || []).filter(t => !RESERVED_TYPES.has(t))
}

interface FollowupRowProps {
  node: Node
}

function FollowupRow({ node }: FollowupRowProps) {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)

  function handleClose(e: React.MouseEvent) {
    e.stopPropagation()
    // Quitar seguimiento: limpiar isSeguimiento y quitar tipo bucle si lo tiene
    const types = (node.types || []).filter(t => t !== 'bucle')
    store.updateNode(node.id, { isSeguimiento: false, types })
  }

  return (
    <div
      className="followup-seguimiento-item"
      onClick={() => navigate(`/node/${node.id}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="followup-loop-icon" style={{ opacity: 0.5 }}>👁</span>
      <span className="followup-bucle-title">{node.text || 'Sin título'}</span>
      {node.due && (
        <span className={`followup-due ${new Date(node.due) < new Date() ? 'followup-due--overdue' : ''}`}>
          📅 {formatDue(node.due)}
        </span>
      )}
      {node.priority === 'high' && <span style={{ color: '#ef4444', fontSize: 11 }}>▲</span>}
      {node.priority === 'medium' && <span style={{ color: '#f59e0b', fontSize: 11 }}>●</span>}
      {hovered && (
        <button
          className="followup-close-btn"
          onClick={handleClose}
          title="Quitar seguimiento"
        >
          ✓ Cerrar
        </button>
      )}
    </div>
  )
}

export default function FollowupView() {
  const s = useStore()
  const [search, setSearch] = useState('')

  // Todos los nodos en seguimiento: isSeguimiento=true O tipo bucle activo
  const allSeguimiento = useMemo(() => {
    return s.allActive().filter(n =>
      !n.deletedAt &&
      n.status !== 'done' &&
      (n.isSeguimiento || (n.types || []).includes('bucle'))
    ).sort((a, b) => {
      // Alta prioridad primero, luego por fecha de modificación
      const pa = a.priority === 'high' ? 0 : a.priority === 'medium' ? 1 : 2
      const pb = b.priority === 'high' ? 0 : b.priority === 'medium' ? 1 : 2
      if (pa !== pb) return pa - pb
      return b.updatedAt.localeCompare(a.updatedAt)
    })
  }, [s])

  const filtered = useMemo(() => {
    if (!search.trim()) return allSeguimiento
    const q = search.toLowerCase()
    return allSeguimiento.filter(n => (n.text || '').toLowerCase().includes(q))
  }, [allSeguimiento, search])

  // Agrupar por tag de usuario
  const groups = useMemo(() => {
    const tagMap = new Map<string, Node[]>()
    const sinTag: Node[] = []

    for (const node of filtered) {
      const tags = getUserTags(node)
      if (tags.length === 0) {
        sinTag.push(node)
      } else {
        // Usar el primer tag como clave de grupo
        const tag = tags[0]
        if (!tagMap.has(tag)) tagMap.set(tag, [])
        tagMap.get(tag)!.push(node)
      }
    }

    const result: Array<{ tag: string | null; nodes: Node[] }> = []
    // Ordenar tags por número de nodos desc
    const sorted = [...tagMap.entries()].sort((a, b) => b[1].length - a[1].length)
    for (const [tag, nodes] of sorted) {
      result.push({ tag, nodes })
    }
    if (sinTag.length > 0) result.push({ tag: null, nodes: sinTag })
    return result
  }, [filtered])

  return (
    <div className="view followup-view">
      <div className="view-header">
        <h1 className="view-title">
          <span style={{ marginRight: 8 }}>👁</span>
          Seguimiento
          {allSeguimiento.length > 0 && (
            <span className="followup-total-count">{allSeguimiento.length}</span>
          )}
        </h1>
        <p className="view-subtitle">Notas marcadas para revisión diaria, agrupadas por tema</p>
      </div>

      <div className="view-body">
        <div className="followup-filters">
          <input
            type="text"
            className="followup-search"
            placeholder="Buscar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {allSeguimiento.length === 0 && (
          <div className="view-empty">
            <p>Sin notas en seguimiento.</p>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 8 }}>
              Abre cualquier nota y activa "Seguimiento" para que aparezca aquí.
            </p>
          </div>
        )}

        {filtered.length === 0 && allSeguimiento.length > 0 && (
          <div className="view-empty">Sin resultados para "{search}"</div>
        )}

        {groups.map(({ tag, nodes }) => (
          <div key={tag ?? '__sin_tag__'} className="followup-group">
            <div className="followup-group-header">
              <span
                className="followup-group-label"
                style={{ color: tag ? store.tagColor(tag) : undefined }}
              >
                {tag ? `#${tag}` : 'Sin tag'}
              </span>
              <span className="followup-group-count">{nodes.length}</span>
            </div>
            {nodes.map(node => (
              <FollowupRow key={node.id} node={node} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
