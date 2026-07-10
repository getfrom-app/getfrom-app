import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'

interface Props { parentId: string }

const NODE_BUILTIN_TYPES = new Set(['agente','prompt','evento','tarea','enlace','archivo','panel','busqueda','chat','favorito','seguimiento','quick','magic','rec'])

function dateBucket(d: Date): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today.getTime() + 86400000)
  const weekEnd = new Date(today.getTime() + 7 * 86400000)
  if (d < today) return 'overdue'
  if (d < tomorrow) return 'today'
  if (d < weekEnd) return 'thisweek'
  return 'later'
}

function dateForBucket(bucket: string): Date | null {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (bucket === 'overdue') return new Date(today.getTime() - 86400000)
  if (bucket === 'today') return today
  if (bucket === 'thisweek') return new Date(today.getTime() + 3 * 86400000)
  if (bucket === 'later') return new Date(today.getTime() + 14 * 86400000)
  return null
}

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
  const { t } = useTranslation()
  const [newCardCol, setNewCardCol] = useState<string | null>(null)
  const [newCardText, setNewCardText] = useState('')
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)

  const children = store.children(parentId).filter(n => !n.deletedAt)
  const customCols = store.getPropSchema(parentId)
  const selectCols = customCols.filter(c => c.type === 'select')
  const dateCols = customCols.filter(c => c.type === 'date')

  const [groupBy, setGroupBy] = useState<GroupBy>('__status')

  // Build columns dynamically based on groupBy field
  const columns: ColDef[] = useMemo(() => {
    if (groupBy === '__status') {
      return [
        { key: '__null', label: t('kanban.noStatus') },
        { key: 'pending', label: t('status.pending'), color: '#fcd34d' },
        { key: 'future',  label: t('status.future'),  color: '#93c5fd' },
        { key: 'done',    label: t('status.done'),    color: '#86efac' },
      ]
    }
    if (groupBy === '__priority') {
      return [
        { key: '__null', label: t('priority.none') },
        { key: 'low',    label: '↓ ' + t('priority.low'),    color: '#86efac' },
        { key: 'medium', label: '→ ' + t('priority.medium'), color: '#fcd34d' },
        { key: 'high',   label: '↑ ' + t('priority.high'),   color: '#fda4af' },
      ]
    }
    // Group by built-in due date OR custom date col → buckets temporales
    const col = customCols.find(c => c.id === groupBy)
    if (groupBy === '__due' || col?.type === 'date') {
      return [
        { key: 'overdue',  label: t('kanban.bucketOverdue'),  color: '#fda4af' },
        { key: 'today',    label: t('common.today'),          color: '#fcd34d' },
        { key: 'thisweek', label: t('kanban.bucketThisWeek'), color: '#86efac' },
        { key: 'later',    label: t('kanban.bucketLater'),    color: '#93c5fd' },
        { key: '__null',   label: t('panel.noDate') },
      ]
    }
    if (!col || col.type !== 'select') return []
    return [
      { key: '__null', label: t('table.noValue') },
      ...((col.options || []).map(o => ({ key: o.id, label: o.label, color: o.color }))),
    ]
  }, [groupBy, customCols])

  function getCardKey(node: Node): string {
    if (groupBy === '__status') return node.status === null ? '__null' : String(node.status)
    if (groupBy === '__priority') return node.priority === null ? '__null' : String(node.priority)
    // Date bucket: built-in due o columna custom date
    const col = customCols.find(c => c.id === groupBy)
    if (groupBy === '__due' || col?.type === 'date') {
      const dateVal = groupBy === '__due' ? node.due : (store.getPropValue(node.id, groupBy) as string | undefined)
      if (!dateVal) return '__null'
      return dateBucket(new Date(String(dateVal)))
    }
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
    // Date grouping: drag to bucket → asignar fecha representativa
    const col = customCols.find(c => c.id === groupBy)
    if (groupBy === '__due' || col?.type === 'date') {
      const newDate = dateForBucket(colKey)
      const isoOrNull = newDate ? newDate.toISOString() : null
      if (groupBy === '__due') {
        store.updateNode(nodeId, { due: isoOrNull })
      } else {
        store.setPropValue(nodeId, groupBy, isoOrNull)
      }
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
    const name = prompt(t('kanban.promptNewGroup'))
    if (!name || !name.trim()) return
    const id = store.addPropColumn(parentId, name.trim(), 'select')
    setGroupBy(id)
  }

  function handleAddColumnOption() {
    if (groupBy === '__status' || groupBy === '__priority') {
      alert(t('kanban.alertNeedCustomGroup'))
      return
    }
    const label = prompt(t('kanban.promptNewColumn'))
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
    const newLabel = prompt(t('kanban.promptRename'), currentLabel)
    if (!newLabel || !newLabel.trim()) return
    const schema = store.getPropSchema(parentId)
    const colDef = schema.find(c => c.id === groupBy)
    if (!colDef) return
    colDef.options = (colDef.options || []).map(o => o.id === key ? { ...o, label: newLabel.trim() } : o)
    store.setPropSchema(parentId, schema)
  }

  function handleDeleteColumn(key: string) {
    if (groupBy === '__status' || groupBy === '__priority') return
    if (!confirm(t('kanban.confirmDeleteColumn'))) return
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
        <label className="node-kanban-toolbar-label">{t('kanban.groupBy')}</label>
        <select className="node-kanban-toolbar-select" value={groupBy} onChange={e => {
          if (e.target.value === '__new__') { handleAddNewGroupProperty(); return }
          setGroupBy(e.target.value)
        }}>
          <option value="__status">{t('kanban.byStatus')}</option>
          <option value="__priority">{t('kanban.byPriority')}</option>
          <option value="__due">{t('kanban.byDate')}</option>
          {dateCols.length > 0 && (
            <optgroup label={t('kanban.customDates')}>
              {dateCols.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </optgroup>
          )}
          {selectCols.length > 0 && (
            <optgroup label={t('kanban.customSelect')}>
              {selectCols.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </optgroup>
          )}
          <option value="__new__">＋ {t('kanban.newGroup')}</option>
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
                  const action = prompt(t('kanban.promptColumnAction'), '')
                  if (action === 'r') handleRenameColumn(col.key, col.label)
                  if (action === 'd') handleDeleteColumn(col.key)
                } : undefined}
                title={isCustom ? t('tip.rightClickColumn') : undefined}
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
                    <span className="node-kanban-card-title">{node.text || t('common.noTitle')}</span>
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
                      placeholder={t('kanban.taskPlaceholder')}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleAddCard(col.key)
                        if (e.key === 'Escape') { setNewCardCol(null); setNewCardText('') }
                      }}
                      onBlur={() => handleAddCard(col.key)}
                    />
                  </div>
                ) : (
                  <button className="node-kanban-add-btn" onClick={() => setNewCardCol(col.key)}>
                    + {t('common.add')}
                  </button>
                )}
              </div>
            </div>
          )
        })}
        {/* + Columna: solo si la agrupación actual es un select custom (no fechas/builtin) */}
        {(() => {
          const col = customCols.find(c => c.id === groupBy)
          const canAdd = col?.type === 'select'
          if (!canAdd) return null
          return (
            <button className="node-kanban-add-col" onClick={handleAddColumnOption} title={t('tip.addColumn')}>
              ＋ {t('kanban.column')}
            </button>
          )
        })()}
      </div>
    </div>
  )
}
