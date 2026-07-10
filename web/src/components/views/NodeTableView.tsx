import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'

interface Props { parentId: string }

type ColType = 'text' | 'number' | 'select' | 'multi_select' | 'date' | 'checkbox' | 'url' | 'tag' | 'task' | 'reminder'
type SelectOption = { id: string; label: string; color?: string }
type PropDef = { id: string; name: string; type: string; options?: SelectOption[] }
type SortDir = 'asc' | 'desc' | null

const COL_TYPE_LABEL_KEYS: Record<ColType, string> = {
  text: 'colType.text', number: 'colType.number', select: 'colType.select', multi_select: 'colType.multiSelect',
  date: 'colType.date', checkbox: 'colType.checkbox', url: 'colType.url', tag: 'colType.tag', task: 'colType.task', reminder: 'colType.reminder',
}

const BUILTIN_COLS = [
  { id: '__status',   name: 'Estado' },
  { id: '__due',      name: 'Fecha' },
  { id: '__priority', name: 'Prioridad' },
  { id: '__tags',     name: 'Tags' },
]

const NODE_BUILTIN_TYPES = new Set(['agente', 'prompt', 'evento', 'tarea', 'enlace', 'archivo', 'panel', 'busqueda', 'chat', 'favorito', 'seguimiento', 'quick', 'magic', 'rec'])

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
            ＋ {t('table.create', { label: query.trim() })}
          </button>
        )}
        {filtered.length === 0 && !query.trim() && (
          <div className="select-editor-empty">{t('table.noOptionsYet')}</div>
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
  const { t } = useTranslation()
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
    { key: 'daily',   label: t('reminder.unitDays') },
    { key: 'weekly',  label: t('reminder.unitWeeks') },
    { key: 'monthly', label: t('reminder.unitMonths') },
    { key: 'yearly',  label: t('reminder.unitYears') },
  ]

  return (
    <div className="reminder-editor" onMouseDown={e => e.stopPropagation()}>
      <div className="reminder-editor-title">⏰ {colName}</div>

      <div className="reminder-editor-label">{t('reminder.quickDate')}</div>
      <div className="reminder-editor-quick">
        {[[t('common.today'), 0], [t('common.tomorrow'), 1], ['+7d', 7], ['+30d', 30]].map(([label, days]) => (
          <button key={String(label)} className="reminder-editor-chip" onClick={() => quickDate(days as number)}>
            {label}
          </button>
        ))}
      </div>

      <div className="reminder-editor-row">
        <input type="date" className="node-table-cell-editor" value={date} onChange={e => setDate(e.target.value)} />
        <input type="time" className="node-table-cell-editor" value={time} onChange={e => setTime(e.target.value)} disabled={!date} />
      </div>

      <div className="reminder-editor-label">{t('reminder.repeatEvery')}</div>
      <div className="reminder-editor-rec-row">
        <button
          className={`reminder-editor-chip ${!recUnit ? 'active' : ''}`}
          onClick={() => setRecUnit('')}
        >{t('common.no')}</button>
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
        {existing && <button className="reminder-editor-clear" onClick={onClear}>🗑 {t('common.delete')}</button>}
        <button className="reminder-editor-cancel" onClick={onClose}>{t('common.cancel')}</button>
        <button className="reminder-editor-save" onClick={commit} disabled={!date}>{t('common.save')}</button>
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
  const { t: tr } = useTranslation()
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
            <span className={`task-list-editor-text ${t.status === 'done' ? 'done' : ''}`}>{t.text || tr('common.noTitle')}</span>
          </div>
        ))}
      </div>
      <input
        ref={inputRef}
        className="node-table-cell-editor"
        placeholder={tr('table.newTaskPlaceholder')}
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

function CellEditor({ node, def, parentId, onClose, onNav }: { node: Node; def: PropDef; parentId: string; onClose: () => void; onNav?: (dir: 'down' | 'right' | 'left') => void }) {
  const { t } = useTranslation()
  const current = store.getPropValue(node.id, def.id)
  const [val, setVal] = useState<string>(current === undefined || current === null ? '' : String(current))
  const ref = useRef<HTMLInputElement | HTMLSelectElement>(null)
  useEffect(() => { ref.current?.focus(); if (ref.current && 'select' in ref.current && def.type !== 'select') ref.current.select() }, [def.type])
  function storeVal(v: string) {
    let stored: unknown = v
    if (def.type === 'number') stored = v === '' ? null : Number(v)
    if (def.type === 'checkbox') stored = v === 'true'
    store.setPropValue(node.id, def.id, stored)
  }
  function commit(v: string) { storeVal(v); onClose() }
  // Enter/Tab: guarda y navega (hoja de cálculo). Escape: cierra.
  function navKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); storeVal(val); onNav ? onNav('down') : onClose() }
    else if (e.key === 'Tab') { e.preventDefault(); storeVal(val); onNav ? onNav(e.shiftKey ? 'left' : 'right') : onClose() }
    else if (e.key === 'Escape') onClose()
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
        placeholder={t('table.tagsPlaceholder')}
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
      onKeyDown={navKey}
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
  const { t: tr } = useTranslation()
  // Reminder: muestra próxima fecha del recordatorio asociado a esta columna
  if (def.type === 'reminder') {
    const reminderTask = findReminderTaskForCol(node.id, def.id)
    if (!reminderTask || !reminderTask.due) {
      return <span className="node-table-empty-cell" onClick={onEdit}>＋ {tr('table.reminder')}</span>
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
              {(t.text || tr('common.noTitle')).slice(0, 28)}
            </span>
          </div>
        ))}
        {tasks.length > 3 && <span className="node-table-tasks-more">+{tasks.length - 3} {tr('calendar.more')}</span>}
        {tasks.length === 0 && <span className="node-table-empty-cell">＋ {tr('search.chipTask')}</span>}
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

// ── Main view ────────────────────────────────────────────────────────────────

export default function NodeTableView({ parentId }: Props) {
  const s = useStore()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)
  const [editingCell, setEditingCell] = useState<{ nodeId: string; colId: string } | null>(null)
  const [editingColId, setEditingColId] = useState<string | null>(null)            // rename inline de columna
  const [colMenu, setColMenu] = useState<{ id: string; x: number; y: number } | null>(null)  // menú de columna
  const [rowMenu, setRowMenu] = useState<{ id: string; x: number; y: number } | null>(null)   // menú de fila
  const [groupBy, setGroupBy] = useState<string | null>(null)   // null = sin agrupar
  const [filterText, setFilterText] = useState('')
  const [resizeCol, setResizeCol] = useState<{ id: string; w: number } | null>(null)  // preview de ancho

  const children = store.children(parentId).filter(n => !n.deletedAt)
  const customCols = store.getPropSchema(parentId)

  // Minimalista: la fila inicial la crea quien crea la tabla (createViewElement), para
  // evitar carreras de carga. Aquí solo ENFOCAMOS la 1ª celda si la tabla está recién
  // creada (una única fila vacía, sin columnas personalizadas). Ref → una sola vez.
  const didFocusFirst = useRef(false)
  useEffect(() => {
    if (!didFocusFirst.current && children.length === 1 && !children[0].text && customCols.length === 0) {
      didFocusFirst.current = true
      setEditingCell({ nodeId: children[0].id, colId: '__title' })
    }
  }, [children, customCols.length])

  // Convertir Texto→Tabla con Tab (desde OutlinerNode): enfoca la celda indicada
  // (fila recién creada, 2ª columna) para seguir escribiendo al instante.
  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent).detail as { nodeId?: string; colId?: string }
      if (d?.nodeId && store.getNode(d.nodeId)?.parentId === parentId) {
        setEditingCell({ nodeId: d.nodeId, colId: d.colId || '__title' })
      }
    }
    window.addEventListener('from:table-focus-cell', h)
    return () => window.removeEventListener('from:table-focus-cell', h)
  }, [parentId])

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
      label: getGroupLabel(key, groupBy, customCols, t),
      rows,
    }))
  }, [sortedChildren, groupBy, customCols, t])

  function toggleSort(colId: string) {
    if (sortBy !== colId) { setSortBy(colId); setSortDir('asc'); return }
    if (sortDir === 'asc') { setSortDir('desc'); return }
    if (sortDir === 'desc') { setSortBy(null); setSortDir(null); return }
  }


  // ── Navegación tipo hoja de cálculo entre celdas de TEXTO/número ──
  // Columnas navegables: título + columnas de texto/número (donde se escribe).
  const navCols = ['__title', ...customCols.filter(c => c.type === 'text' || c.type === 'number').map(c => c.id)]
  const rowIds = sortedChildren.map(n => n.id)
  function moveCell(rowId: string, colId: string, dir: 'down' | 'right' | 'left') {
    const ri = rowIds.indexOf(rowId), ci = navCols.indexOf(colId)
    if (ri < 0 || ci < 0) { setEditingCell(null); return }
    if (dir === 'down') {
      if (ri + 1 < rowIds.length) setEditingCell({ nodeId: rowIds[ri + 1], colId })
      else { const n = store.createNode({ text: '', parentId, siblingOrder: Date.now() }); setEditingCell({ nodeId: n.id, colId }) }
    } else if (dir === 'right') {
      if (ci + 1 < navCols.length) setEditingCell({ nodeId: rowId, colId: navCols[ci + 1] })
      else if (ri + 1 < rowIds.length) setEditingCell({ nodeId: rowIds[ri + 1], colId: navCols[0] })
      else setEditingCell(null)
    } else {
      if (ci - 1 >= 0) setEditingCell({ nodeId: rowId, colId: navCols[ci - 1] })
      else if (ri - 1 >= 0) setEditingCell({ nodeId: rowIds[ri - 1], colId: navCols[navCols.length - 1] })
      else setEditingCell(null)
    }
  }
  // Maneja Enter/Tab/Shift+Tab en un input de celda: commitea (cb) y navega.
  function cellNavKey(e: React.KeyboardEvent, rowId: string, colId: string, commit: () => void) {
    e.stopPropagation() // que Esc/Backspace no disparen atajos globales (subir/borrar)
    if (e.key === 'Enter') { e.preventDefault(); commit(); moveCell(rowId, colId, 'down') }
    else if (e.key === 'Tab') { e.preventDefault(); commit(); moveCell(rowId, colId, e.shiftKey ? 'left' : 'right') }
    else if (e.key === 'Escape') { e.preventDefault(); setEditingCell(null) }
  }

  // ── Anchos de columna (persisten en extraData._colW del nodo-tabla) ──
  const colWidths: Record<string, number> = (() => {
    try { const w = JSON.parse(store.getNode(parentId)?.extraData || '{}')._colW; return (w && typeof w === 'object') ? w : {} } catch { return {} }
  })()
  function setColWidth(colId: string, px: number) {
    const n = store.getNode(parentId); if (!n) return
    let ed: Record<string, unknown> = {}
    try { ed = JSON.parse(n.extraData || '{}') } catch { /* vacío */ }
    ed._colW = { ...(ed._colW as object || {}), [colId]: Math.max(60, Math.round(px)) }
    store.updateNode(parentId, { extraData: JSON.stringify(ed) })
  }
  function onColResize(e: React.PointerEvent, colId: string) {
    e.preventDefault(); e.stopPropagation()
    const th = (e.currentTarget as HTMLElement).closest('th') as HTMLElement | null
    const startX = e.clientX, startW = th ? th.offsetWidth : (colWidths[colId] || 140)
    const move = (ev: PointerEvent) => setResizeCol({ id: colId, w: Math.max(60, startW + (ev.clientX - startX)) })
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up)
      setResizeCol(cur => { if (cur) setColWidth(cur.id, cur.w); return null })
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  const ColResizer = ({ colId }: { colId: string }) => (
    <span onPointerDown={e => onColResize(e, colId)} onClick={e => e.stopPropagation()}
      style={{ position: 'absolute', right: -3, top: 0, height: '100%', width: 6, cursor: 'col-resize', zIndex: 2 }} />
  )

  // Crear columna INSTANTÁNEA: sin modal. Nace con nombre por defecto y tipo texto;
  // se entra directamente a renombrarla en línea (el tipo se cambia por menú).
  function addColumnInstant() {
    const id = store.addPropColumn(parentId, `Columna ${customCols.length + 1}`, 'text')
    setEditingColId(id)
  }
  function commitColName(colId: string, name: string) {
    const n = name.trim()
    if (n) store.renamePropColumn(parentId, colId, n)
    setEditingColId(null)
  }
  function changeColType(colId: string, type: ColType) {
    const schema = store.getPropSchema(parentId)
    const col = schema.find(c => c.id === colId)
    if (col) { col.type = type; store.setPropSchema(parentId, schema) }
    setColMenu(null)
  }
  function handleDeleteCol(colId: string) {
    store.deletePropColumn(parentId, colId)
    setColMenu(null)
  }
  // ── Filas ──
  function addRow() {
    const n = store.createNode({ text: '', parentId, siblingOrder: Date.now() })
    setEditingCell({ nodeId: n.id, colId: '__title' })
  }
  function deleteRow(id: string) { store.deleteNode(id); setRowMenu(null) }
  function duplicateRow(id: string) {
    const src = store.getNode(id); if (!src) return
    const copy = store.createNode({ text: src.text, parentId, siblingOrder: src.siblingOrder + 1 })
    // copiar props personalizadas + estado/fecha/prioridad
    for (const col of customCols) {
      const v = store.getPropValue(id, col.id)
      if (v !== undefined && v !== null) store.setPropValue(copy.id, col.id, v)
    }
    store.updateNode(copy.id, { status: src.status, due: src.due, priority: src.priority, types: src.types })
    setRowMenu(null)
  }


  const sortIcon = (colId: string) =>
    sortBy !== colId ? '' : sortDir === 'asc' ? ' ▲' : sortDir === 'desc' ? ' ▼' : ''

  const colOrder: string[] = ['__title',
    ...(hasStatus ? ['__status'] : []), ...(hasDue ? ['__due'] : []), ...(hasPriority ? ['__priority'] : []),
    ...(hasTags ? ['__tags'] : []), ...customCols.map(c => c.id), '__add']

  return (
    <div className="node-table-wrapper">
      <table className="node-table" style={{ tableLayout: Object.keys(colWidths).length ? 'fixed' : undefined }}>
        <colgroup>
          {colOrder.map(id => { const w = resizeCol?.id === id ? resizeCol.w : colWidths[id]; return <col key={id} style={w ? { width: w } : undefined} /> })}
        </colgroup>
        <thead>
          <tr>
            <th className="node-table-th node-table-th--title" style={{ position: 'relative' }} onClick={() => toggleSort('__title')}>
              {t('kanban.title')}{sortIcon('__title')}<ColResizer colId="__title" />
            </th>
            {hasStatus && (
              <th className="node-table-th" style={{ position: 'relative' }} onClick={() => toggleSort('__status')}>{t('kanban.byStatus')}{sortIcon('__status')}<ColResizer colId="__status" /></th>
            )}
            {hasDue && (
              <th className="node-table-th" style={{ position: 'relative' }} onClick={() => toggleSort('__due')}>{t('modal.dueDate')}{sortIcon('__due')}<ColResizer colId="__due" /></th>
            )}
            {hasPriority && (
              <th className="node-table-th" style={{ position: 'relative' }} onClick={() => toggleSort('__priority')}>{t('kanban.byPriority')}{sortIcon('__priority')}<ColResizer colId="__priority" /></th>
            )}
            {hasTags && (
              <th className="node-table-th" style={{ position: 'relative' }}>{t('sidebar.groupTag')}s<ColResizer colId="__tags" /></th>
            )}
            {customCols.map(col => (
              <th
                key={col.id}
                className="node-table-th node-table-th--custom"
                style={{ position: 'relative' }}
                title={t('tip.tableColumnHeader')}
                onClick={() => { if (editingColId !== col.id) toggleSort(col.id) }}
                onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setColMenu({ id: col.id, x: e.clientX, y: e.clientY }) }}
              >
                {editingColId === col.id ? (
                  <input
                    autoFocus
                    className="node-table-colname-editor"
                    defaultValue={col.name}
                    onClick={e => e.stopPropagation()}
                    onPointerDown={e => e.stopPropagation()}
                    onFocus={e => e.currentTarget.select()}
                    onBlur={e => commitColName(col.id, e.target.value)}
                    onKeyDown={e => {
                      e.stopPropagation()
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                      else if (e.key === 'Escape') setEditingColId(null)
                    }}
                  />
                ) : (
                  <>
                    {/* Clic en el NOMBRE → renombrar; clic en el resto de la cabecera → ordenar. */}
                    <span className="node-table-colname" style={{ cursor: 'text' }}
                      onClick={e => { e.stopPropagation(); setEditingColId(col.id) }}>
                      {col.name}
                    </span>
                    <span className="node-table-sort-ind">{sortIcon(col.id)}</span>
                  </>
                )}
                <ColResizer colId={col.id} />
              </th>
            ))}
            <th className="node-table-th node-table-th--add">
              <button className="node-table-add-col" onClick={addColumnInstant} title={t('tip.addColumn')}>＋</button>
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
                onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setRowMenu({ id: node.id, x: e.clientX, y: e.clientY }) }}
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
                      onBlur={e => { store.updateNode(node.id, { text: e.target.value }); setEditingCell(cur => (cur?.nodeId === node.id && cur?.colId === '__title') ? null : cur) }}
                      onKeyDown={e => cellNavKey(e, node.id, '__title', () => store.updateNode(node.id, { text: (e.target as HTMLInputElement).value }))}
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
                    title={t('context.openNote')}
                    style={{ position: 'absolute', right: 6, top: '50%', marginTop: -10, width: 20, height: 20, border: 'none', background: 'transparent', color: 'var(--text-tertiary,#bbb)', cursor: 'pointer', borderRadius: 4, fontSize: 13, lineHeight: 1 }}
                  >↗</button>
                </td>
                {hasStatus && (
                  <td className="node-table-td" onClick={() => setEditingCell({ nodeId: node.id, colId: '__status' })} style={{ position: 'relative' }}>
                    {node.status === null ? <span className="node-table-empty-cell">—</span>
                      : node.status === 'pending' ? <span className="node-table-status node-table-status--pending">○ {t('status.pending')}</span>
                      : node.status === 'done' ? <span className="node-table-status node-table-status--done">✓ {t('status.done')}</span>
                      : node.status === 'future' ? <span className="node-table-status">◆ {t('status.future')}</span>
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
                          <option value="">{t('kanban.noStatus')}</option>
                          <option value="pending">{t('status.pending')}</option>
                          <option value="future">{t('status.future')}</option>
                          <option value="done">{t('status.done')}</option>
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
                    {node.priority === 'high' ? <span className="node-table-priority high">↑ {t('priority.high')}</span>
                      : node.priority === 'medium' ? <span className="node-table-priority medium">→ {t('priority.medium')}</span>
                      : node.priority === 'low' ? <span className="node-table-priority low">↓ {t('priority.low')}</span>
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
                          <option value="">{t('priority.none')}</option>
                          <option value="low">{t('priority.low')}</option>
                          <option value="medium">{t('priority.medium')}</option>
                          <option value="high">{t('priority.high')}</option>
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
                          placeholder={t('table.tagsPlaceholder')}
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
                          <CellEditor node={node} def={col} parentId={parentId}
                            onClose={() => setEditingCell(cur => (cur?.nodeId === node.id && cur?.colId === col.id) ? null : cur)}
                            onNav={(dir) => moveCell(node.id, col.id, dir)} />
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
          {/* Añadir fila rápido (además de Enter en la última celda). */}
          <tr className="node-table-addrow" onClick={addRow}>
            <td className="node-table-td node-table-addrow-cell"
              colSpan={1 + (hasStatus?1:0) + (hasDue?1:0) + (hasPriority?1:0) + (hasTags?1:0) + customCols.length + 1}>
              ＋ {t('table.addRow')}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Menú de COLUMNA (clic derecho en la cabecera): renombrar, tipo, ordenar, eliminar.
          Portal a body: la tabla puede vivir dentro de una tarjeta del lienzo con
          transform:scale, donde position:fixed se ancla al ancestro transformado. */}
      {colMenu && (() => {
        const col = customCols.find(c => c.id === colMenu.id)
        if (!col) return null
        return createPortal((
          <>
            <div onPointerDown={() => setColMenu(null)} onContextMenu={e => { e.preventDefault(); setColMenu(null) }}
              style={{ position: 'fixed', inset: 0, zIndex: 2999 }} />
            <div className="node-ctx-menu" style={{ position: 'fixed', top: colMenu.y, left: colMenu.x, zIndex: 3000 }}
              onClick={e => e.stopPropagation()}>
              <button className="node-ctx-item" onClick={() => { setEditingColId(col.id); setColMenu(null) }}>✏️ {t('table.rename')}</button>
              <button className="node-ctx-item" onClick={() => { setSortBy(col.id); setSortDir('asc'); setColMenu(null) }}>▲ {t('table.sortAsc')}</button>
              <button className="node-ctx-item" onClick={() => { setSortBy(col.id); setSortDir('desc'); setColMenu(null) }}>▼ {t('table.sortDesc')}</button>
              <div className="node-ctx-sep" />
              <div className="node-ctx-label">{t('table.type')}</div>
              {(Object.entries(COL_TYPE_LABEL_KEYS) as [ColType, string][]).map(([k, v]) => (
                <button key={k} className={`node-ctx-item node-ctx-item--type ${col.type === k ? 'active' : ''}`}
                  onClick={() => changeColType(col.id, k)}>
                  {col.type === k ? '● ' : '○ '}{t(v)}
                </button>
              ))}
              <div className="node-ctx-sep" />
              <button className="node-ctx-item node-ctx-item--danger" onClick={() => handleDeleteCol(col.id)}>🗑 {t('table.deleteColumn')}</button>
            </div>
          </>
        ), document.body)
      })()}

      {/* Menú de FILA (clic derecho en la fila): abrir, duplicar, eliminar. Portal a body. */}
      {rowMenu && store.getNode(rowMenu.id) && createPortal((
        <>
          <div onPointerDown={() => setRowMenu(null)} onContextMenu={e => { e.preventDefault(); setRowMenu(null) }}
            style={{ position: 'fixed', inset: 0, zIndex: 2999 }} />
          <div className="node-ctx-menu" style={{ position: 'fixed', top: rowMenu.y, left: rowMenu.x, zIndex: 3000 }}
            onClick={e => e.stopPropagation()}>
            <button className="node-ctx-item" onClick={() => { navigate(`/node/${rowMenu.id}`); setRowMenu(null) }}>↗ {t('context.openNote')}</button>
            <button className="node-ctx-item" onClick={() => duplicateRow(rowMenu.id)}>⧉ {t('table.duplicateRow')}</button>
            <div className="node-ctx-sep" />
            <button className="node-ctx-item node-ctx-item--danger" onClick={() => deleteRow(rowMenu.id)}>🗑 {t('table.deleteRow')}</button>
          </div>
        </>
      ), document.body)}
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

function getGroupLabel(key: string, colId: string, customCols: PropDef[], t: (k: string) => string): string {
  if (key === '__null') return t('table.noValueLabel')
  if (colId === '__status') {
    return key === 'pending' ? t('status.pending')
      : key === 'future' ? t('status.future')
      : key === 'done' ? t('status.done')
      : key
  }
  if (colId === '__priority') {
    return key === 'high' ? t('priority.high')
      : key === 'medium' ? t('priority.medium')
      : key === 'low' ? t('priority.low')
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
