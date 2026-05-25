import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'

interface Props { parentId: string }

type ColType = 'text' | 'number' | 'select' | 'multi_select' | 'date' | 'checkbox' | 'url'
type SelectOption = { id: string; label: string; color?: string }
type PropDef = { id: string; name: string; type: string; options?: SelectOption[] }
type SortDir = 'asc' | 'desc' | null

const COL_TYPE_LABELS: Record<ColType, string> = {
  text: 'Texto', number: 'Número', select: 'Select', multi_select: 'Multi-select',
  date: 'Fecha', checkbox: 'Checkbox', url: 'URL',
}

const BUILTIN_COLS = [
  { id: '__status',   name: 'Estado' },
  { id: '__due',      name: 'Fecha' },
  { id: '__priority', name: 'Prioridad' },
  { id: '__tags',     name: 'Tags' },
]

const NODE_BUILTIN_TYPES = new Set(['bucle', 'agente', 'prompt', 'evento', 'tarea', 'enlace', 'archivo', 'panel', 'busqueda', 'chat', 'favorito', 'seguimiento', 'quick', 'magic', 'rec'])

// ── Cell renderers/editors ───────────────────────────────────────────────────

function CellEditor({ node, def, onClose }: { node: Node; def: PropDef; onClose: () => void }) {
  const current = store.getPropValue(node.id, def.id)
  const [val, setVal] = useState<string>(current === undefined || current === null ? '' : String(current))
  const ref = useRef<HTMLInputElement | HTMLSelectElement>(null)
  useEffect(() => { ref.current?.focus(); if (ref.current && 'select' in ref.current) ref.current.select() }, [])
  function commit(v: string) {
    let stored: unknown = v
    if (def.type === 'number') stored = v === '' ? null : Number(v)
    if (def.type === 'checkbox') stored = v === 'true'
    store.setPropValue(node.id, def.id, stored)
    onClose()
  }
  if (def.type === 'select') {
    return (
      <select
        ref={ref as React.RefObject<HTMLSelectElement>}
        defaultValue={String(current ?? '')}
        onBlur={onClose}
        onChange={e => commit(e.target.value)}
        className="node-table-cell-editor"
      >
        <option value="">—</option>
        {(def.options || []).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    )
  }
  if (def.type === 'checkbox') {
    return <input type="checkbox" defaultChecked={!!current} onChange={e => commit(String(e.target.checked))} onBlur={onClose} className="node-table-cell-editor" />
  }
  if (def.type === 'date') {
    return (
      <input
        ref={ref as React.RefObject<HTMLInputElement>}
        type="date"
        defaultValue={current ? String(current).slice(0, 10) : ''}
        onBlur={e => commit(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commit((e.target as HTMLInputElement).value); if (e.key === 'Escape') onClose() }}
        className="node-table-cell-editor"
      />
    )
  }
  return (
    <input
      ref={ref as React.RefObject<HTMLInputElement>}
      type={def.type === 'number' ? 'number' : 'text'}
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={() => commit(val)}
      onKeyDown={e => { if (e.key === 'Enter') commit(val); if (e.key === 'Escape') onClose() }}
      className="node-table-cell-editor"
    />
  )
}

function CellView({ node, def, onEdit }: { node: Node; def: PropDef; onEdit: () => void }) {
  const v = store.getPropValue(node.id, def.id)
  if (v === undefined || v === null || v === '') {
    return <span className="node-table-empty-cell" onClick={onEdit}>—</span>
  }
  if (def.type === 'select') {
    const opt = def.options?.find(o => o.id === v)
    if (!opt) return <span className="node-table-empty-cell" onClick={onEdit}>—</span>
    return (
      <span className="node-table-select-chip" style={{ background: (opt.color || '#94a3b8') + '30', color: opt.color || 'var(--text-primary)' }} onClick={onEdit}>
        {opt.label}
      </span>
    )
  }
  if (def.type === 'checkbox') {
    return <input type="checkbox" checked={!!v} onChange={() => store.setPropValue(node.id, def.id, !v)} onClick={e => e.stopPropagation()} />
  }
  if (def.type === 'date') {
    return <span onClick={onEdit}>{new Date(String(v)).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
  }
  if (def.type === 'url') {
    return <a href={String(v)} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>{String(v).slice(0, 30)}</a>
  }
  return <span onClick={onEdit}>{String(v)}</span>
}

// ── New column modal ─────────────────────────────────────────────────────────

function NewColumnModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, type: ColType) => void }) {
  const [name, setName] = useState('')
  const [type, setType] = useState<ColType>('text')
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--small" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">Nueva propiedad</h3>
        <div className="modal-field">
          <label>Nombre</label>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && name.trim()) { onCreate(name.trim(), type); } if (e.key === 'Escape') onClose() }}
            placeholder="Ej. Comentario"
          />
        </div>
        <div className="modal-field">
          <label>Tipo</label>
          <select value={type} onChange={e => setType(e.target.value as ColType)}>
            {(Object.entries(COL_TYPE_LABELS) as [ColType, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="modal-actions">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={() => name.trim() && onCreate(name.trim(), type)} disabled={!name.trim()} className="btn-primary">Crear</button>
        </div>
      </div>
    </div>
  )
}

// ── Main view ────────────────────────────────────────────────────────────────

export default function NodeTableView({ parentId }: Props) {
  const s = useStore()
  const navigate = useNavigate()
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)
  const [editingCell, setEditingCell] = useState<{ nodeId: string; colId: string } | null>(null)
  const [newColOpen, setNewColOpen] = useState(false)
  const [colMenu, setColMenu] = useState<string | null>(null)

  const children = store.children(parentId).filter(n => !n.deletedAt)
  const customCols = store.getPropSchema(parentId)

  // Detect builtin cols that have data
  const hasStatus = children.some(n => n.status !== null)
  const hasDue = children.some(n => n.due)
  const hasPriority = children.some(n => n.priority)
  const hasTags = children.some(n => (n.types || []).some(t => !NODE_BUILTIN_TYPES.has(t)))

  // Sort children
  const sortedChildren = useMemo(() => {
    if (!sortBy || !sortDir) return children
    const list = [...children]
    list.sort((a, b) => {
      const va = getCompareValue(a, sortBy, customCols)
      const vb = getCompareValue(b, sortBy, customCols)
      if (va === vb) return 0
      if (va === null || va === undefined) return 1
      if (vb === null || vb === undefined) return -1
      const cmp = va < vb ? -1 : 1
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [children, sortBy, sortDir, customCols])

  function toggleSort(colId: string) {
    if (sortBy !== colId) { setSortBy(colId); setSortDir('asc'); return }
    if (sortDir === 'asc') { setSortDir('desc'); return }
    if (sortDir === 'desc') { setSortBy(null); setSortDir(null); return }
  }

  function handleAddRow() {
    const node = store.createNode({ text: '', parentId, siblingOrder: Date.now() })
    navigate(`/node/${node.id}`)
  }

  function handleAddCol(name: string, type: ColType) {
    store.addPropColumn(parentId, name, type)
    setNewColOpen(false)
  }

  function handleDeleteCol(colId: string) {
    if (!confirm('¿Eliminar esta columna? Los valores se conservan en cada nodo pero dejarán de mostrarse.')) return
    store.deletePropColumn(parentId, colId)
    setColMenu(null)
  }

  function handleRenameCol(colId: string) {
    const cur = customCols.find(c => c.id === colId)
    if (!cur) return
    const newName = prompt('Nuevo nombre:', cur.name)
    if (newName && newName.trim()) store.renamePropColumn(parentId, colId, newName.trim())
    setColMenu(null)
  }

  if (children.length === 0 && customCols.length === 0) return (
    <div className="node-table-empty">
      <p>Sin elementos</p>
      <button className="btn-primary" onClick={handleAddRow} style={{ marginTop: 12 }}>＋ Añadir fila</button>
    </div>
  )

  const sortIcon = (colId: string) =>
    sortBy !== colId ? '' : sortDir === 'asc' ? ' ▲' : sortDir === 'desc' ? ' ▼' : ''

  return (
    <div className="node-table-wrapper">
      <table className="node-table">
        <thead>
          <tr>
            <th className="node-table-th node-table-th--title" onClick={() => toggleSort('__title')}>
              Título{sortIcon('__title')}
            </th>
            {hasStatus && (
              <th className="node-table-th" onClick={() => toggleSort('__status')}>Estado{sortIcon('__status')}</th>
            )}
            {hasDue && (
              <th className="node-table-th" onClick={() => toggleSort('__due')}>Fecha{sortIcon('__due')}</th>
            )}
            {hasPriority && (
              <th className="node-table-th" onClick={() => toggleSort('__priority')}>Prioridad{sortIcon('__priority')}</th>
            )}
            {hasTags && (
              <th className="node-table-th">Tags</th>
            )}
            {customCols.map(col => (
              <th
                key={col.id}
                className="node-table-th node-table-th--custom"
                onClick={() => toggleSort(col.id)}
                onContextMenu={e => { e.preventDefault(); setColMenu(col.id) }}
              >
                {col.name}{sortIcon(col.id)}
                {colMenu === col.id && (
                  <div className="node-table-col-menu" onClick={e => e.stopPropagation()}>
                    <button onClick={() => handleRenameCol(col.id)}>Renombrar</button>
                    <button onClick={() => handleDeleteCol(col.id)} className="danger">Eliminar</button>
                    <button onClick={() => setColMenu(null)}>Cerrar</button>
                  </div>
                )}
              </th>
            ))}
            <th className="node-table-th node-table-th--add">
              <button className="node-table-add-col" onClick={() => setNewColOpen(true)} title="Añadir propiedad">＋</button>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedChildren.map(node => {
            const grandchildren = store.children(node.id).filter(n => !n.deletedAt).length
            const tags = (node.types || []).filter(t => !NODE_BUILTIN_TYPES.has(t))
            return (
              <tr
                key={node.id}
                className={`node-table-row ${node.status === 'done' ? 'node-table-row--done' : ''}`}
                onClick={() => navigate(`/node/${node.id}`)}
              >
                <td className="node-table-td node-table-td--title">
                  <span className="node-table-title">{node.text || 'Sin título'}</span>
                  {grandchildren > 0 && <span className="node-table-children-badge">{grandchildren}</span>}
                </td>
                {hasStatus && (
                  <td className="node-table-td" onClick={e => {
                    e.stopPropagation()
                    if (node.status === null) store.updateNode(node.id, { status: 'pending' })
                    else if (node.status === 'pending') store.updateNode(node.id, { status: 'done' })
                    else store.updateNode(node.id, { status: null })
                  }}>
                    {node.status === null ? <span className="node-table-empty-cell">—</span>
                      : node.status === 'pending' ? <span className="node-table-status node-table-status--pending">○ Pendiente</span>
                      : node.status === 'done' ? <span className="node-table-status node-table-status--done">✓ Hecho</span>
                      : <span className="node-table-status">{node.status}</span>}
                  </td>
                )}
                {hasDue && (
                  <td className="node-table-td">
                    {node.due ? <span className="node-table-due">{new Date(node.due).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
                      : <span className="node-table-empty-cell">—</span>}
                  </td>
                )}
                {hasPriority && (
                  <td className="node-table-td">
                    {node.priority === 'high' ? <span className="node-table-priority high">↑ Alta</span>
                      : node.priority === 'medium' ? <span className="node-table-priority medium">→ Media</span>
                      : node.priority === 'low' ? <span className="node-table-priority low">↓ Baja</span>
                      : <span className="node-table-empty-cell">—</span>}
                  </td>
                )}
                {hasTags && (
                  <td className="node-table-td">
                    {tags.length > 0 ? (
                      <div className="node-table-tags">
                        {tags.map(t => (
                          <span key={t} className="node-table-tag" style={{ background: s.tagColor(t) + '20', color: s.tagColor(t) }}>#{t}</span>
                        ))}
                      </div>
                    ) : <span className="node-table-empty-cell">—</span>}
                  </td>
                )}
                {customCols.map(col => {
                  const isEditing = editingCell?.nodeId === node.id && editingCell.colId === col.id
                  return (
                    <td
                      key={col.id}
                      className="node-table-td node-table-td--custom"
                      onClick={e => { e.stopPropagation(); if (!isEditing) setEditingCell({ nodeId: node.id, colId: col.id }) }}
                    >
                      {isEditing
                        ? <CellEditor node={node} def={col} onClose={() => setEditingCell(null)} />
                        : <CellView node={node} def={col} onEdit={() => setEditingCell({ nodeId: node.id, colId: col.id })} />}
                    </td>
                  )
                })}
                <td className="node-table-td" />
              </tr>
            )
          })}
          <tr className="node-table-row node-table-row--add" onClick={handleAddRow}>
            <td className="node-table-td node-table-td--title" colSpan={1 + (hasStatus?1:0) + (hasDue?1:0) + (hasPriority?1:0) + (hasTags?1:0) + customCols.length + 1}>
              ＋ Añadir fila
            </td>
          </tr>
        </tbody>
      </table>

      {newColOpen && (
        <NewColumnModal onClose={() => setNewColOpen(false)} onCreate={handleAddCol} />
      )}
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getCompareValue(node: Node, colId: string, customCols: PropDef[]): string | number | null {
  if (colId === '__title') return (node.text || '').toLowerCase()
  if (colId === '__status') {
    const order: Record<string, number> = { pending: 1, future: 2, done: 3, null: 0 }
    return order[String(node.status ?? 'null')] ?? 99
  }
  if (colId === '__due') return node.due ? new Date(node.due).getTime() : Number.MAX_SAFE_INTEGER
  if (colId === '__priority') {
    const order: Record<string, number> = { high: 1, medium: 2, low: 3 }
    return order[String(node.priority ?? '')] ?? 99
  }
  const col = customCols.find(c => c.id === colId)
  if (!col) return null
  const v = store.getPropValue(node.id, colId)
  if (v === undefined || v === null) return null
  if (col.type === 'number') return Number(v)
  if (col.type === 'date') return v ? new Date(String(v)).getTime() : 0
  return String(v).toLowerCase()
}

// Use it (avoid lint warning)
void BUILTIN_COLS
