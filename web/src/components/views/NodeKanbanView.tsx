import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'

interface Props { parentId: string }

const NODE_BUILTIN_TYPES = new Set(['bucle','agente','prompt','evento','tarea','enlace','archivo','panel','busqueda','chat','favorito','seguimiento','quick','magic','rec'])

type GroupBy = '__status' | '__priority' | string  // string = custom col id

interface ColDef {
  key: string                                  // valor del campo (status, priority, opt id)
  label: string
  color?: string
}

let _kanbanDragId: string | null = null

export default function NodeKanbanView({ parentId }: Props) {
  const s = useStore()
  const navigate = useNavigate()
  const [newCardCol, setNewCardCol] = useState<string | null>(null)
  const [newCardText, setNewCardText] = useState('')
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)

  const children = store.children(parentId).filter(n => !n.deletedAt)
  const customCols = store.getPropSchema(parentId)
  const selectCols = customCols.filter(c => c.type === 'select')

  const [groupBy, setGroupBy] = useState<GroupBy>('__status')

  // Build columns dynamically based on groupBy field
  const columns: ColDef[] = useMemo(() => {
    if (groupBy === '__status') {
      return [
        { key: '__null', label: 'Sin estado' },
        { key: 'pending', label: 'Pendiente', color: '#fcd34d' },
        { key: 'future',  label: 'Futuro',    color: '#93c5fd' },
        { key: 'done',    label: 'Hecho',     color: '#86efac' },
      ]
    }
    if (groupBy === '__priority') {
      return [
        { key: '__null', label: 'Sin prioridad' },
        { key: 'low',    label: '↓ Baja',  color: '#86efac' },
        { key: 'medium', label: '→ Media', color: '#fcd34d' },
        { key: 'high',   label: '↑ Alta',  color: '#fda4af' },
      ]
    }
    const col = customCols.find(c => c.id === groupBy)
    if (!col || col.type !== 'select') return []
    return [
      { key: '__null', label: 'Sin valor' },
      ...((col.options || []).map(o => ({ key: o.id, label: o.label, color: o.color }))),
    ]
  }, [groupBy, customCols])

  function getCardKey(node: Node): string {
    if (groupBy === '__status') return node.status === null ? '__null' : String(node.status)
    if (groupBy === '__priority') return node.priority === null ? '__null' : String(node.priority)
    const v = store.getPropValue(node.id, groupBy)
    return (v === undefined || v === null || v === '') ? '__null' : String(v)
  }

  function getCards(colKey: string): Node[] {
    return children.filter(n => getCardKey(n) === colKey)
  }

  function handleAddCard(colKey: string) {
    const text = newCardText.trim()
    if (!text) { setNewCardCol(null); return }
    const node = store.createNode({ text, parentId, siblingOrder: Date.now() })
    setValueForCol(node.id, colKey)
    setNewCardText('')
    setNewCardCol(null)
  }

  function setValueForCol(nodeId: string, colKey: string) {
    if (groupBy === '__status') {
      const status = colKey === '__null' ? null : (colKey as 'pending' | 'future' | 'done')
      store.updateNode(nodeId, { status })
      return
    }
    if (groupBy === '__priority') {
      const priority = colKey === '__null' ? null : (colKey as 'low' | 'medium' | 'high')
      store.updateNode(nodeId, { priority })
      return
    }
    store.setPropValue(nodeId, groupBy, colKey === '__null' ? null : colKey)
  }

  function handleDrop(colKey: string) {
    const id = _kanbanDragId
    _kanbanDragId = null
    setDragOverCol(null)
    if (!id) return
    setValueForCol(id, colKey)
  }

  function handleAddNewGroupProperty() {
    const name = prompt('Nombre de la nueva agrupación (ej. "Fase", "Cliente", "Área"):')
    if (!name || !name.trim()) return
    const id = store.addPropColumn(parentId, name.trim(), 'select')
    setGroupBy(id)
  }

  function handleAddColumnOption() {
    if (groupBy === '__status' || groupBy === '__priority') {
      alert('Para añadir columnas, primero crea una nueva agrupación custom (ej. "Fase").')
      return
    }
    const label = prompt('Nombre de la nueva columna:')
    if (!label || !label.trim()) return
    const schema = store.getPropSchema(parentId)
    const colDef = schema.find(c => c.id === groupBy)
    if (!colDef) return
    const newOpt = { id: 'opt_' + Math.random().toString(36).slice(2, 8), label: label.trim() }
    colDef.options = [...(colDef.options || []), newOpt]
    store.setPropSchema(parentId, schema)
  }

  function handleRenameColumn(key: string, currentLabel: string) {
    if (groupBy === '__status' || groupBy === '__priority') return
    const newLabel = prompt('Nuevo nombre:', currentLabel)
    if (!newLabel || !newLabel.trim()) return
    const schema = store.getPropSchema(parentId)
    const colDef = schema.find(c => c.id === groupBy)
    if (!colDef) return
    colDef.options = (colDef.options || []).map(o => o.id === key ? { ...o, label: newLabel.trim() } : o)
    store.setPropSchema(parentId, schema)
  }

  function handleDeleteColumn(key: string) {
    if (groupBy === '__status' || groupBy === '__priority') return
    if (!confirm('¿Eliminar esta columna? Los nodos en ella quedarán sin valor.')) return
    const schema = store.getPropSchema(parentId)
    const colDef = schema.find(c => c.id === groupBy)
    if (!colDef) return
    colDef.options = (colDef.options || []).filter(o => o.id !== key)
    store.setPropSchema(parentId, schema)
    // Limpiar valores de nodos que tenían esta opción
    for (const c of children) {
      if (store.getPropValue(c.id, groupBy) === key) {
        store.setPropValue(c.id, groupBy, null)
      }
    }
  }

  return (
    <div className="node-kanban-wrapper">
      <div className="node-kanban-toolbar">
        <label className="node-kanban-toolbar-label">Agrupar por:</label>
        <select className="node-kanban-toolbar-select" value={groupBy} onChange={e => {
          if (e.target.value === '__new__') { handleAddNewGroupProperty(); return }
          setGroupBy(e.target.value)
        }}>
          <option value="__status">Estado</option>
          <option value="__priority">Prioridad</option>
          {selectCols.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          <option value="__new__">＋ Nueva agrupación…</option>
        </select>
      </div>

      <div className="node-kanban">
        {columns.map(col => {
          const cards = getCards(col.key)
          const isDragOver = dragOverCol === col.key
          const isCustom = groupBy !== '__status' && groupBy !== '__priority' && col.key !== '__null'
          return (
            <div
              key={col.key}
              className={`node-kanban-col ${isDragOver ? 'node-kanban-col--drop' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOverCol(col.key) }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={e => { e.preventDefault(); handleDrop(col.key) }}
            >
              <div
                className="node-kanban-col-header"
                style={col.color ? { borderTop: `3px solid ${col.color}` } : {}}
                onContextMenu={isCustom ? e => {
                  e.preventDefault()
                  const action = prompt('Escribe: r para renombrar, d para eliminar', '')
                  if (action === 'r') handleRenameColumn(col.key, col.label)
                  if (action === 'd') handleDeleteColumn(col.key)
                } : undefined}
                title={isCustom ? 'Clic derecho para renombrar/eliminar' : undefined}
              >
                <span className="node-kanban-col-label">{col.label}</span>
                <span className="node-kanban-col-count">{cards.length}</span>
              </div>
              <div className="node-kanban-cards">
                {cards.map(node => (
                  <div
                    key={node.id}
                    className="node-kanban-card"
                    draggable
                    onDragStart={() => { _kanbanDragId = node.id }}
                    onDragEnd={() => { _kanbanDragId = null }}
                    onClick={() => navigate(`/node/${node.id}`)}
                  >
                    <span className="node-kanban-card-title">{node.text || 'Sin título'}</span>
                    {node.due && (
                      <span className="node-kanban-card-due">
                        📅 {new Date(node.due).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                    {(node.types || []).filter(t => !NODE_BUILTIN_TYPES.has(t)).map(t => (
                      <span key={t} className="node-kanban-card-tag" style={{ background: s.tagColor(t) + '20', color: s.tagColor(t) }}>#{t}</span>
                    ))}
                  </div>
                ))}
                {newCardCol === col.key ? (
                  <div className="node-kanban-add-input">
                    <input
                      autoFocus
                      className="node-kanban-card-input"
                      value={newCardText}
                      onChange={e => setNewCardText(e.target.value)}
                      placeholder="Título..."
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleAddCard(col.key)
                        if (e.key === 'Escape') { setNewCardCol(null); setNewCardText('') }
                      }}
                      onBlur={() => handleAddCard(col.key)}
                    />
                  </div>
                ) : (
                  <button className="node-kanban-add-btn" onClick={() => setNewCardCol(col.key)}>
                    + Añadir
                  </button>
                )}
              </div>
            </div>
          )
        })}
        {/* + Columna: solo si la agrupación actual es un select custom */}
        {groupBy !== '__status' && groupBy !== '__priority' && (
          <button className="node-kanban-add-col" onClick={handleAddColumnOption} title="Añadir columna">
            ＋ Columna
          </button>
        )}
      </div>
    </div>
  )
}
