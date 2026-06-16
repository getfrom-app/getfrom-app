import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'

interface Props { parentId: string }

type ColType = 'text' | 'number' | 'select' | 'multi_select' | 'date' | 'checkbox' | 'url' | 'tag' | 'task' | 'reminder'
type SelectOption = { id: string; label: string; color?: string }
type PropDef = { id: string; name: string; type: string; options?: SelectOption[] }
type SortDir = 'asc' | 'desc' | null

const COL_TYPE_LABELS: Record<ColType, string> = {
  text: 'Texto', number: 'Número', select: 'Select', multi_select: 'Multi-select',
  date: 'Fecha', checkbox: 'Checkbox', url: 'URL', tag: 'Tag', task: 'Tarea', reminder: 'Recordatorio',
}

const BUILTIN_COLS = [
  { id: '__status',   name: 'Estado' },
  { id: '__due',      name: 'Fecha' },
  { id: '__priority', name: 'Prioridad' },
  { id: '__tags',     name: 'Tags' },
]

const NODE_BUILTIN_TYPES = new Set(['bucle', 'agente', 'prompt', 'evento', 'tarea', 'enlace', 'archivo', 'panel', 'busqueda', 'chat', 'favorito', 'seguimiento', 'quick', 'magic', 'rec'])

// ── Cell renderers/editors ───────────────────────────────────────────────────

function SelectEditor({ currentValueId, options, onPick, onCreate, onClose }: {
  currentValueId: string
  options: SelectOption[]
  onPick: (id: string) => void
  onCreate: (label: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])
  const filtered = options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
  const exact = options.find(o => o.label.toLowerCase() === query.trim().toLowerCase())
  return (
    <div className="select-editor" onMouseDown={e => e.stopPropagation()}>
      <input
        ref={inputRef}
        className="node-table-cell-editor"
        placeholder={t('table.searchOrCreate')}
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            if (filtered.length > 0) onPick(filtered[0].id)
            else if (query.trim()) onCreate(query.trim())
          }
          if (e.key === 'Escape') onClose()
        }}
      />
      <div className="select-editor-list">
        {currentValueId && (
          <button className="select-editor-item select-editor-item--clear" onClick={() => onPick('')}>{t('table.noValue')}</button>
        )}
        {filtered.map(o => (
          <button key={o.id} className="select-editor-item" onClick={() => onPick(o.id)}>
            <span className="select-editor-dot" style={{ background: o.color || '#94a3b8' }} />
            {o.label}
          </button>
        ))}
        {query.trim() && !exact && (
          <button className="select-editor-item select-editor-item--create" onClick={() => onCreate(query.trim())}>
            ＋ Crear "{query.trim()}"
          </button>
        )}
        {filtered.length === 0 && !query.trim() && (
          <div className="select-editor-empty">Sin opciones todavía. Escribe para crear una.</div>
        )}
      </div>
    </div>
  )
}

function ReminderEditor({ existing, colName, onSave, onClear, onClose }: {
  existing: Node | null
  colName: string
  onSave: (data: { due: string; recurrence: string | null }) => void
  onClear: () => void
  onClose: () => void
}) {
  const initialDate = existing?.due ? existing.due.slice(0, 10) : ''
  const initialTime = existing?.due ? (() => {
    const d = new Date(existing.due!)
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return d.getHours() === 0 && d.getMinutes() === 0 ? '' : `${hh}:${mm}`
  })() : ''
  // Parsear recurrencia legacy: "daily" | "weekly" | "daily:3" | "weekly:2" | null
  type RecUnit = 'daily' | 'weekly' | 'monthly' | 'yearly' | ''
  const parseRec = (r: string | null | undefined): { n: number; unit: RecUnit } => {
    if (!r) return { n: 1, unit: '' }
    const [unit, nStr] = r.split(':')
    const n = parseInt(nStr || '1') || 1
    if (unit === 'daily' || unit === 'weekly' || unit === 'monthly' || unit === 'yearly') {
      return { n, unit }
    }
    return { n: 1, unit: '' }
  }
  const initRec = parseRec(existing?.recurrence)
  const [date, setDate] = useState(initialDate)
  const [time, setTime] = useState(initialTime)
  const [recN, setRecN] = useState<number>(initRec.n)
  const [recUnit, setRecUnit] = useState<RecUnit>(initRec.unit)

  function quickDate(days: number) {
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() + days)
    setDate(d.toISOString().slice(0, 10))
  }

  function commit() {
    if (!date) return
    const iso = time
      ? new Date(`${date}T${time}:00`).toISOString()
      : new Date(`${date}T00:00:00`).toISOString()
    const recurrence = recUnit ? (recN === 1 ? recUnit : `${recUnit}:${recN}`) : null
    onSave({ due: iso, recurrence })
  }

  const recUnits: { key: 'daily' | 'weekly' | 'monthly' | 'yearly'; label: string }[] = [
    { key: 'daily',   label: 'días' },
    { key: 'weekly',  label: 'sem.' },
    { key: 'monthly', label: 'mes.' },
    { key: 'yearly',  label: 'años' },
  ]

  return (
    <div className="reminder-editor" onMouseDown={e => e.stopPropagation()}>
      <div className="reminder-editor-title">⏰ {colName}</div>

      <div className="reminder-editor-label">Fecha rápida</div>
      <div className="reminder-editor-quick">
        {[['Hoy', 0], ['Mañana', 1], ['+7d', 7], ['+30d', 30]].map(([label, days]) => (
          <button key={String(label)} className="reminder-editor-chip" onClick={() => quickDate(days as number)}>
            {label}
          </button>
        ))}
      </div>

      <div className="reminder-editor-row">
        <input type="date" className="node-table-cell-editor" value={date} onChange={e => setDate(e.target.value)} />
        <input type="time" className="node-table-cell-editor" value={time} onChange={e => setTime(e.target.value)} disabled={!date} />
      </div>

      <div className="reminder-editor-label">Repetir cada</div>
      <div className="reminder-editor-rec-row">
        <button
          className={`reminder-editor-chip ${!recUnit ? 'active' : ''}`}
          onClick={() => setRecUnit('')}
        >No</button>
        <input
          type="number"
          min={1}
          max={999}
          className="reminder-editor-rec-n"
          value={recN}
          disabled={!recUnit}
          onChange={e => {
            const v = Math.max(1, parseInt(e.target.value) || 1)
            setRecN(v)
            if (!recUnit) setRecUnit('daily')
          }}
        />
        {recUnits.map(({ key, label }) => (
          <button
            key={key}
            className={`reminder-editor-chip ${recUnit === key ? 'active' : ''}`}
            onClick={() => setRecUnit(key)}
          >{label}</button>
        ))}
      </div>

      <div className="reminder-editor-actions">
        {existing && <button className="reminder-editor-clear" onClick={onClear}>🗑 Borrar</button>}
        <button className="reminder-editor-cancel" onClick={onClose}>Cancelar</button>
        <button className="reminder-editor-save" onClick={commit} disabled={!date}>Guardar</button>
      </div>
    </div>
  )
}

function TaskListEditor({ tasks, onAdd, onToggle, onClose }: {
  tasks: Node[]
  onAdd: (text: string) => void
  onToggle: (t: Node) => void
  onClose: () => void
}) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])
  return (
    <div className="task-list-editor" onMouseDown={e => e.stopPropagation()}>
      <div className="task-list-editor-rows">
        {tasks.map(t => (
          <div key={t.id} className="task-list-editor-row">
            <button
              className={`task-list-editor-check ${t.status === 'done' ? 'done' : ''}`}
              onClick={() => onToggle(t)}
            >{t.status === 'done' ? '✓' : ''}</button>
            <span className={`task-list-editor-text ${t.status === 'done' ? 'done' : ''}`}>{t.text || 'Sin título'}</span>
          </div>
        ))}
      </div>
      <input
        ref={inputRef}
        className="node-table-cell-editor"
        placeholder="＋ Nueva tarea (Enter para añadir)"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            if (text.trim()) { onAdd(text.trim()); setText('') }
            else onClose()
          }
          if (e.key === 'Escape') onClose()
        }}
        onBlur={() => { if (!text.trim()) onClose() }}
      />
    </div>
  )
}

function CellEditor({ node, def, parentId, onClose }: { node: Node; def: PropDef; parentId: string; onClose: () => void }) {
  const current = store.getPropValue(node.id, def.id)
  const [val, setVal] = useState<string>(current === undefined || current === null ? '' : String(current))
  const ref = useRef<HTMLInputElement | HTMLSelectElement>(null)
  useEffect(() => { ref.current?.focus(); if (ref.current && 'select' in ref.current && def.type !== 'select') ref.current.select() }, [def.type])
  function commit(v: string) {
    let stored: unknown = v
    if (def.type === 'number') stored = v === '' ? null : Number(v)
    if (def.type === 'checkbox') stored = v === 'true'
    store.setPropValue(node.id, def.id, stored)
    onClose()
  }
  if (def.type === 'select') {
    const options = def.options || []
    return (
      <SelectEditor
        currentValueId={String(current ?? '')}
        options={options}
        onPick={optId => { commit(optId) }}
        onCreate={(label) => {
          // Crear nueva opción en el schema
          const newOpt: SelectOption = { id: 'opt_' + Math.random().toString(36).slice(2, 8), label }
          const schema = store.getPropSchema(parentId)
          const colDef = schema.find(c => c.id === def.id)
          if (colDef) {
            colDef.options = [...(colDef.options || []), newOpt]
            store.setPropSchema(parentId, schema)
          }
          commit(newOpt.id)
        }}
        onClose={onClose}
      />
    )
  }
  if (def.type === 'reminder') {
    const reminderTask = findReminderTaskForCol(node.id, def.id)
    return (
      <ReminderEditor
        existing={reminderTask}
        colName={def.name}
        onSave={({ due, recurrence }) => {
          if (reminderTask) {
            store.updateNode(reminderTask.id, { due, recurrence, status: 'pending' })
          } else {
            const child = store.createNode({
              text: def.name,
              parentId: node.id,
              siblingOrder: Date.now(),
            })
            // Marcar con _reminderColId para asociar a esta columna
            const ed: Record<string, unknown> = { _reminderColId: def.id }
            store.updateNode(child.id, {
              status: 'pending',
              due,
              recurrence,
              extraData: JSON.stringify(ed),
            })
          }
          onClose()
        }}
        onClear={() => {
          if (reminderTask) store.deleteNode(reminderTask.id)
          onClose()
        }}
        onClose={onClose}
      />
    )
  }
  if (def.type === 'task') {
    // Task editor: lista de tareas hijo + input para crear nueva
    const tasks = store.children(node.id).filter(c => !c.deletedAt && c.status !== null)
    return (
      <TaskListEditor
        tasks={tasks}
        onAdd={text => {
          const child = store.createNode({ text: text.trim(), parentId: node.id, siblingOrder: Date.now() })
          store.updateNode(child.id, { status: 'pending' })
        }}
        onToggle={t => store.updateNode(t.id, { status: t.status === 'done' ? 'pending' : 'done' })}
        onClose={onClose}
      />
    )
  }
  if (def.type === 'tag') {
    // Tag editor: input texto con autocompletar de tags globales, escribe en node.types[]
    const allTags = store.allUsedTags ? store.allUsedTags() : []
    const currentTags = (node.types || []).filter(t => !NODE_BUILTIN_TYPES.has(t))
    return (
      <input
        ref={ref as React.RefObject<HTMLInputElement>}
        type="text"
        defaultValue={currentTags.join(' ')}
        list="all-tags-datalist"
        placeholder="tag1 tag2..."
        className="node-table-cell-editor"
        onBlur={e => {
          const newTags = e.target.value.split(/\s+/).map(t => t.replace(/^#/, '').trim()).filter(Boolean)
          const builtin = (node.types || []).filter(t => NODE_BUILTIN_TYPES.has(t))
          store.updateNode(node.id, { types: [...builtin, ...newTags] })
          // dataset autocompletar opcional via datalist global (no esencial)
          void allTags
          onClose()
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') onClose()
        }}
      />
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

// Helpers para Recordatorio: busca la tarea hija que pertenece a esta columna
function findReminderTaskForCol(rowId: string, colId: string): Node | null {
  for (const child of store.children(rowId)) {
    if (child.deletedAt) continue
    try {
      const ed = JSON.parse(child.extraData || '{}')
      if (ed._reminderColId === colId) return child
    } catch { /* ignore */ }
  }
  return null
}

function formatReminderDate(iso: string, recurrence: string | null | undefined): string {
  const d = new Date(iso)
  const datePart = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0
  const timePart = hasTime ? ` ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : ''
  const recPart = recurrence ? ' · ↻' : ''
  return `${datePart}${timePart}${recPart}`
}

function CellView({ node, def, onEdit }: { node: Node; def: PropDef; onEdit: () => void }) {
  // Reminder: muestra próxima fecha del recordatorio asociado a esta columna
  if (def.type === 'reminder') {
    const reminderTask = findReminderTaskForCol(node.id, def.id)
    if (!reminderTask || !reminderTask.due) {
      return <span className="node-table-empty-cell" onClick={onEdit}>＋ Recordatorio</span>
    }
    const isDone = reminderTask.status === 'done'
    return (
      <div className={`node-table-reminder ${isDone ? 'done' : ''}`} onClick={onEdit}>
        <span className="node-table-reminder-icon">{isDone ? '✓' : '⏰'}</span>
        <span className="node-table-reminder-date">{formatReminderDate(reminderTask.due, reminderTask.recurrence)}</span>
      </div>
    )
  }
  // Task: lista compacta de tareas hijas del row (status:pending) + botón añadir
  if (def.type === 'task') {
    const tasks = store.children(node.id).filter(c => !c.deletedAt && c.status !== null)
    return (
      <div className="node-table-tasks-cell" onClick={e => { e.stopPropagation(); onEdit() }}>
        {tasks.slice(0, 3).map(t => (
          <div key={t.id} className="node-table-tasks-item">
            <span className={`node-table-tasks-check ${t.status === 'done' ? 'done' : ''}`}>
              {t.status === 'done' ? '✓' : '○'}
            </span>
            <span className={`node-table-tasks-text ${t.status === 'done' ? 'done' : ''}`}>
              {(t.text || 'Sin título').slice(0, 28)}
            </span>
          </div>
        ))}
        {tasks.length > 3 && <span className="node-table-tasks-more">+{tasks.length - 3} más</span>}
        {tasks.length === 0 && <span className="node-table-empty-cell">＋ Tarea</span>}
      </div>
    )
  }
  // Tag: lee de node.types[] no de _props
  if (def.type === 'tag') {
    const tags = (node.types || []).filter(t => !NODE_BUILTIN_TYPES.has(t))
    if (tags.length === 0) return <span className="node-table-empty-cell" onClick={onEdit}>—</span>
    return (
      <div className="node-table-tags" onClick={onEdit}>
        {tags.map(t => (
          <span key={t} className="node-table-tag" style={{ background: store.tagColor(t) + '20', color: store.tagColor(t) }}>#{t}</span>
        ))}
      </div>
    )
  }
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
  const { t } = useTranslation()
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)
  const [editingCell, setEditingCell] = useState<{ nodeId: string; colId: string } | null>(null)
  const [newColOpen, setNewColOpen] = useState(false)
  const [colMenu, setColMenu] = useState<string | null>(null)
  const [groupBy, setGroupBy] = useState<string | null>(null)   // null = sin agrupar
  const [filterText, setFilterText] = useState('')

  const children = store.children(parentId).filter(n => !n.deletedAt)
  const customCols = store.getPropSchema(parentId)
  const groupableCols = [
    { id: '__status', name: 'Estado' },
    { id: '__priority', name: 'Prioridad' },
    ...customCols.filter(c => c.type === 'select'),
  ]

  // Detect builtin cols that have data
  const hasStatus = children.some(n => n.status !== null)
  const hasDue = children.some(n => n.due)
  const hasPriority = children.some(n => n.priority)
  const hasTags = children.some(n => (n.types || []).some(t => !NODE_BUILTIN_TYPES.has(t)))

  // Filter + Sort children
  const filteredChildren = useMemo(() => {
    const q = filterText.trim().toLowerCase()
    if (!q) return children
    return children.filter(n => (n.text || '').toLowerCase().includes(q))
  }, [children, filterText])

  const sortedChildren = useMemo(() => {
    if (!sortBy || !sortDir) return filteredChildren
    const list = [...filteredChildren]
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
  }, [filteredChildren, sortBy, sortDir, customCols])

  // Group children if groupBy set
  const groupedChildren: Array<{ key: string; label: string; rows: Node[] }> = useMemo(() => {
    if (!groupBy) return [{ key: '__all', label: '', rows: sortedChildren }]
    const groups = new Map<string, Node[]>()
    for (const n of sortedChildren) {
      const k = getGroupKey(n, groupBy, customCols)
      if (!groups.has(k)) groups.set(k, [])
      groups.get(k)!.push(n)
    }
    return Array.from(groups.entries()).map(([key, rows]) => ({
      key,
      label: getGroupLabel(key, groupBy, customCols),
      rows,
    }))
  }, [sortedChildren, groupBy, customCols])

  function toggleSort(colId: string) {
    if (sortBy !== colId) { setSortBy(colId); setSortDir('asc'); return }
    if (sortDir === 'asc') { setSortDir('desc'); return }
    if (sortDir === 'desc') { setSortBy(null); setSortDir(null); return }
  }

  function handleAddRow() {
    // Crear fila VACÍA y editar su título inline (sin salir de la tabla).
    const node = store.createNode({ text: '', parentId, siblingOrder: Date.now() })
    setEditingCell({ nodeId: node.id, colId: '__title' })
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
      <div className="node-table-toolbar">
        <input
          className="node-table-filter"
          placeholder={`${t('common.search')}…`}
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
        />
        <div className="node-table-toolbar-spacer" />
        <label className="node-table-toolbar-label">{t('sidebar.groupLabel')}:</label>
        <select className="node-table-toolbar-select" value={groupBy || ''} onChange={e => setGroupBy(e.target.value || null)}>
          <option value="">{t('sidebar.groupNone')}</option>
          {groupableCols.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {sortBy && (
          <button className="node-table-toolbar-clear" onClick={() => { setSortBy(null); setSortDir(null) }} title="Quitar ordenación">
            ↕ {sortBy === '__title' ? 'Título' : groupableCols.find(c => c.id === sortBy)?.name || sortBy} {sortDir === 'asc' ? '▲' : '▼'} ✕
          </button>
        )}
      </div>
      <table className="node-table">
        <thead>
          <tr>
            <th className="node-table-th node-table-th--title" onClick={() => toggleSort('__title')}>
              {t('kanban.title')}{sortIcon('__title')}
            </th>
            {hasStatus && (
              <th className="node-table-th" onClick={() => toggleSort('__status')}>{t('kanban.byStatus')}{sortIcon('__status')}</th>
            )}
            {hasDue && (
              <th className="node-table-th" onClick={() => toggleSort('__due')}>{t('modal.dueDate')}{sortIcon('__due')}</th>
            )}
            {hasPriority && (
              <th className="node-table-th" onClick={() => toggleSort('__priority')}>{t('kanban.byPriority')}{sortIcon('__priority')}</th>
            )}
            {hasTags && (
              <th className="node-table-th">{t('sidebar.groupTag')}s</th>
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
          {groupedChildren.map(group => (
            <>
              {groupBy && (
                <tr key={`group-${group.key}`} className="node-table-group-header">
                  <td colSpan={1 + (hasStatus?1:0) + (hasDue?1:0) + (hasPriority?1:0) + (hasTags?1:0) + customCols.length + 1}>
                    <span className="node-table-group-label">{group.label}</span>
                    <span className="node-table-group-count">{group.rows.length}</span>
                  </td>
                </tr>
              )}
              {group.rows.map(node => {
            const grandchildren = store.children(node.id).filter(n => !n.deletedAt).length
            const tags = (node.types || []).filter(t => !NODE_BUILTIN_TYPES.has(t))
            const isBuiltinEditing = (col: string) => editingCell?.nodeId === node.id && editingCell.colId === col
            return (
              <tr
                key={node.id}
                className={`node-table-row ${node.status === 'done' ? 'node-table-row--done' : ''}`}
              >
                <td
                  className="node-table-td node-table-td--title"
                  style={{ position: 'relative' }}
                >
                  {isBuiltinEditing('__title') ? (
                    <input
                      autoFocus
                      className="node-table-cell-editor"
                      defaultValue={node.text}
                      placeholder={t('common.noTitle')}
                      onBlur={e => { store.updateNode(node.id, { text: e.target.value }); setEditingCell(null) }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { store.updateNode(node.id, { text: (e.target as HTMLInputElement).value }); setEditingCell(null) }
                        if (e.key === 'Escape') setEditingCell(null)
                      }}
                    />
                  ) : (
                    <span className="node-table-title" style={{ cursor: 'text' }}
                      onClick={() => setEditingCell({ nodeId: node.id, colId: '__title' })}>
                      {node.text || <span className="node-table-empty-cell">{t('common.noTitle')}</span>}
                    </span>
                  )}
                  {grandchildren > 0 && <span className="node-table-children-badge">{grandchildren}</span>}
                  <button
                    onClick={e => { e.stopPropagation(); navigate(`/node/${node.id}`) }}
                    title="Abrir nota"
                    style={{ position: 'absolute', right: 6, top: '50%', marginTop: -10, width: 20, height: 20, border: 'none', background: 'transparent', color: 'var(--text-tertiary,#bbb)', cursor: 'pointer', borderRadius: 4, fontSize: 13, lineHeight: 1 }}
                  >↗</button>
                </td>
                {hasStatus && (
                  <td className="node-table-td" onClick={() => setEditingCell({ nodeId: node.id, colId: '__status' })} style={{ position: 'relative' }}>
                    {node.status === null ? <span className="node-table-empty-cell">—</span>
                      : node.status === 'pending' ? <span className="node-table-status node-table-status--pending">○ Pendiente</span>
                      : node.status === 'done' ? <span className="node-table-status node-table-status--done">✓ Hecho</span>
                      : node.status === 'future' ? <span className="node-table-status">◆ Futuro</span>
                      : <span className="node-table-status">{node.status}</span>}
                    {isBuiltinEditing('__status') && (
                      <div className="node-table-cell-overlay">
                        <select
                          autoFocus
                          className="node-table-cell-editor"
                          defaultValue={String(node.status ?? '')}
                          onBlur={() => setEditingCell(null)}
                          onChange={e => {
                            const v = e.target.value
                            store.updateNode(node.id, { status: v === '' ? null : (v as 'pending' | 'future' | 'done') })
                            setEditingCell(null)
                          }}
                        >
                          <option value="">Sin estado</option>
                          <option value="pending">Pendiente</option>
                          <option value="future">Futuro</option>
                          <option value="done">Hecho</option>
                        </select>
                      </div>
                    )}
                  </td>
                )}
                {hasDue && (
                  <td className="node-table-td" onClick={() => setEditingCell({ nodeId: node.id, colId: '__due' })} style={{ position: 'relative' }}>
                    {node.due ? <span className="node-table-due">{new Date(node.due).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
                      : <span className="node-table-empty-cell">—</span>}
                    {isBuiltinEditing('__due') && (
                      <div className="node-table-cell-overlay">
                        <input
                          autoFocus
                          type="date"
                          className="node-table-cell-editor"
                          defaultValue={node.due ? node.due.slice(0, 10) : ''}
                          onBlur={e => {
                            const v = e.target.value
                            store.updateNode(node.id, { due: v ? new Date(v + 'T00:00:00').toISOString() : null })
                            setEditingCell(null)
                          }}
                          onKeyDown={e => { if (e.key === 'Escape') setEditingCell(null) }}
                        />
                      </div>
                    )}
                  </td>
                )}
                {hasPriority && (
                  <td className="node-table-td" onClick={() => setEditingCell({ nodeId: node.id, colId: '__priority' })} style={{ position: 'relative' }}>
                    {node.priority === 'high' ? <span className="node-table-priority high">↑ Alta</span>
                      : node.priority === 'medium' ? <span className="node-table-priority medium">→ Media</span>
                      : node.priority === 'low' ? <span className="node-table-priority low">↓ Baja</span>
                      : <span className="node-table-empty-cell">—</span>}
                    {isBuiltinEditing('__priority') && (
                      <div className="node-table-cell-overlay">
                        <select
                          autoFocus
                          className="node-table-cell-editor"
                          defaultValue={String(node.priority ?? '')}
                          onBlur={() => setEditingCell(null)}
                          onChange={e => {
                            const v = e.target.value
                            store.updateNode(node.id, { priority: v === '' ? null : (v as 'low' | 'medium' | 'high') })
                            setEditingCell(null)
                          }}
                        >
                          <option value="">Sin prioridad</option>
                          <option value="low">Baja</option>
                          <option value="medium">Media</option>
                          <option value="high">Alta</option>
                        </select>
                      </div>
                    )}
                  </td>
                )}
                {hasTags && (
                  <td className="node-table-td" onClick={() => setEditingCell({ nodeId: node.id, colId: '__tags' })} style={{ position: 'relative' }}>
                    {tags.length > 0 ? (
                      <div className="node-table-tags">
                        {tags.map(t => (
                          <span key={t} className="node-table-tag" style={{ background: s.tagColor(t) + '20', color: s.tagColor(t) }}>#{t}</span>
                        ))}
                      </div>
                    ) : <span className="node-table-empty-cell">—</span>}
                    {isBuiltinEditing('__tags') && (
                      <div className="node-table-cell-overlay">
                        <input
                          autoFocus
                          className="node-table-cell-editor"
                          defaultValue={tags.join(' ')}
                          placeholder="tag1 tag2 tag3"
                          onBlur={e => {
                            const newTags = e.target.value.split(/\s+/).map(t => t.replace(/^#/, '').trim()).filter(Boolean)
                            const currentTypes = node.types || []
                            const builtinPreserved = currentTypes.filter(t => NODE_BUILTIN_TYPES.has(t))
                            store.updateNode(node.id, { types: [...builtinPreserved, ...newTags] })
                            setEditingCell(null)
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                            if (e.key === 'Escape') setEditingCell(null)
                          }}
                        />
                      </div>
                    )}
                  </td>
                )}
                {customCols.map(col => {
                  const isEditing = editingCell?.nodeId === node.id && editingCell.colId === col.id
                  // Reminder/Task/Tag/Select usan modal centrado en vez de cell overlay
                  // porque su UI es más rica y se ve mal pegada a la celda
                  const useModal = col.type === 'reminder' || col.type === 'task' || col.type === 'tag' || col.type === 'select'
                  return (
                    <td
                      key={col.id}
                      className="node-table-td node-table-td--custom"
                      onClick={e => { e.stopPropagation(); if (!isEditing) setEditingCell({ nodeId: node.id, colId: col.id }) }}
                      style={{ position: 'relative' }}
                    >
                      <CellView node={node} def={col} onEdit={() => setEditingCell({ nodeId: node.id, colId: col.id })} />
                      {isEditing && !useModal && (
                        <div className="node-table-cell-overlay">
                          <CellEditor node={node} def={col} parentId={parentId} onClose={() => setEditingCell(null)} />
                        </div>
                      )}
                      {isEditing && useModal && (
                        <div className="modal-backdrop" onClick={() => setEditingCell(null)}>
                          <div className="modal modal--editor" onClick={e => e.stopPropagation()}>
                            <CellEditor node={node} def={col} parentId={parentId} onClose={() => setEditingCell(null)} />
                          </div>
                        </div>
                      )}
                    </td>
                  )
                })}
                <td className="node-table-td" />
              </tr>
            )
              })}
            </>
          ))}
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

function getGroupKey(node: Node, colId: string, customCols: PropDef[]): string {
  if (colId === '__status') return node.status === null ? '__null' : String(node.status)
  if (colId === '__priority') return node.priority === null ? '__null' : String(node.priority)
  const v = store.getPropValue(node.id, colId)
  if (v === undefined || v === null || v === '') return '__null'
  return String(v)
}

function getGroupLabel(key: string, colId: string, customCols: PropDef[]): string {
  if (key === '__null') return 'Sin valor'
  if (colId === '__status') {
    return key === 'pending' ? 'Pendiente'
      : key === 'future' ? 'Futuro'
      : key === 'done' ? 'Hecho'
      : key
  }
  if (colId === '__priority') {
    return key === 'high' ? 'Alta'
      : key === 'medium' ? 'Media'
      : key === 'low' ? 'Baja'
      : key
  }
  const col = customCols.find(c => c.id === colId)
  if (col?.type === 'select') {
    const opt = col.options?.find(o => o.id === key)
    if (opt) return opt.label
  }
  return key
}

// Use it (avoid lint warning)
void BUILTIN_COLS
