import { useState } from 'react'
import { openNodeDetail } from '../../utils/canvasNav'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'

interface Props {
  node: Node
  onClose: () => void
}

export default function NodePropertiesPanel({ node, onClose }: Props) {
  const s = useStore()
  const { t } = useTranslation()
  const [newType, setNewType] = useState('')
  const [areaInput, setAreaInput] = useState('')
  const nodeArea = store.getNodeArea(node.id)

  // Fecha/hora split
  const dueDate = node.due ? node.due.slice(0, 10) : ''
  const dueTime = node.due ? node.due.slice(11, 16) : ''
  const dueEndDate = node.dueEnd ? node.dueEnd.slice(0, 10) : ''
  const dueEndTime = node.dueEnd ? node.dueEnd.slice(11, 16) : ''

  function setDue(date: string, time: string) {
    if (!date) { store.updateNode(node.id, { due: null }); return }
    const iso = time ? new Date(`${date}T${time}:00`).toISOString() : new Date(`${date}T00:00:00`).toISOString()
    store.updateNode(node.id, { due: iso })
  }

  function setDueEnd(date: string, time: string) {
    if (!date) { store.updateNode(node.id, { dueEnd: null }); return }
    const iso = time ? new Date(`${date}T${time}:00`).toISOString() : new Date(`${date}T23:59:00`).toISOString()
    store.updateNode(node.id, { dueEnd: iso })
  }

  function setStatus(status: Node['status']) {
    store.updateNode(node.id, { status })
  }

  function setPriority(priority: Node['priority']) {
    store.updateNode(node.id, { priority })
  }

  function toggleFavorite() {
    store.updateNode(node.id, { isFavorite: !node.isFavorite })
  }

  function toggleEvent() {
    store.updateNode(node.id, { isEvent: !node.isEvent })
  }

  const isLocked = (() => {
    try { return JSON.parse(node.extraData || '{}').locked === true } catch { return false }
  })()

  function toggleLocked() {
    try {
      const ed = JSON.parse(node.extraData || '{}')
      ed.locked = !isLocked
      store.updateNode(node.id, { extraData: JSON.stringify(ed) })
    } catch {
      store.updateNode(node.id, { extraData: JSON.stringify({ locked: !isLocked }) })
    }
  }

  function addType(type: string) {
    const t = type.trim().toLowerCase()
    if (!t || (node.types || []).includes(t)) return
    store.updateNode(node.id, { types: [...(node.types || []), t] })
    setNewType('')
  }

  function removeType(type: string) {
    store.updateNode(node.id, { types: (node.types || []).filter(t => t !== type) })
  }

  const usedTags = s.allUsedTags()

  const statusOptions: { value: Node['status']; label: string }[] = [
    { value: null, label: `○ ${t('status.none')}` },
    { value: 'pending', label: `● ${t('status.pending')}` },
    { value: 'done', label: `✓ ${t('status.done')}` },
  ]

  const priorityOptions: { value: Node['priority']; label: string; style?: React.CSSProperties }[] = [
    { value: null, label: `— ${t('priority.none')}` },
    { value: 'low', label: `▽ ${t('priority.low')}` },
    { value: 'medium', label: `△ ${t('priority.medium')}`, style: { color: '#f59e0b' } },
    { value: 'high', label: `▲ ${t('priority.high')}`, style: { color: '#ef4444' } },
  ]

  const recurrenceOptions = [
    { value: '', label: t('rec.none') },
    { value: 'daily', label: `🔁 ${t('rec.daily')}` },
    { value: 'daily:2', label: `🔁 ${t('rec.every2Days')}` },
    { value: 'weekly', label: `🔁 ${t('rec.weekly')}` },
    { value: 'weekly:2', label: `🔁 ${t('rec.every2Weeks')}` },
    { value: 'monthly', label: `🔁 ${t('rec.monthly')}` },
    { value: 'monthly:3', label: `🔁 ${t('rec.quarterly')}` },
    { value: 'yearly', label: `🔁 ${t('rec.yearly')}` },
  ]

  return (
    <div className="properties-panel">
      <div className="properties-panel-header">
        <span className="properties-panel-title">{t('panel.properties')}</span>
        <button className="properties-close-btn" onClick={onClose} aria-label={t('common.close')}>
          ×
        </button>
      </div>

      {/* Favorito + Evento */}
      <div className="prop-row">
        <button
          className={`prop-icon-btn ${node.isFavorite ? 'active' : ''}`}
          onClick={toggleFavorite}
          title={node.isFavorite ? t('context.removeFavorite') : t('tip.pin')}
        >
          {node.isFavorite ? '★' : '☆'} {t('tip.pinned')}
        </button>
        <button
          className={`prop-icon-btn ${node.isEvent ? 'active event' : ''}`}
          onClick={toggleEvent}
          title={node.isEvent ? t('tip.removeEvent') : t('tip.markEvent')}
        >
          {t('panel.event')}
        </button>
        <button
          className={`prop-icon-btn ${isLocked ? 'active' : ''}`}
          onClick={toggleLocked}
          title={isLocked ? t('tip.unlockNote') : t('tip.lockNote')}
        >
          {isLocked ? `🔒 ${t('tip.locked')}` : `🔓 ${t('tip.lock')}`}
        </button>
      </div>

      {/* Estado */}
      <div className="prop-section">
        <div className="prop-section-label">{t('search.filterStatus')}</div>
        <div className="prop-pills">
          {statusOptions.map(opt => (
            <button
              key={String(opt.value)}
              className={`prop-pill ${node.status === opt.value ? 'active' : ''}`}
              onClick={() => setStatus(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Prioridad */}
      <div className="prop-section">
        <div className="prop-section-label">{t('kanban.byPriority')}</div>
        <div className="prop-pills">
          {priorityOptions.map(opt => (
            <button
              key={String(opt.value)}
              className={`prop-pill ${node.priority === opt.value ? 'active' : ''}`}
              onClick={() => setPriority(opt.value)}
              style={opt.style}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Fecha rápida */}
      <div className="prop-section">
        <div className="prop-section-label">{t('modal.dueDate')}</div>
        <div className="prop-quick-dates">
          {[
            { label: t('common.today'), days: 0 },
            { label: t('common.tomorrow'), days: 1 },
            { label: t('date.nextMonday'), days: (() => { const d = new Date().getDay(); return d === 1 ? 7 : (8-d) % 7 || 7 })() },
            { label: t('date.nextWeek'), days: 7 },
          ].map(({ label, days }) => {
            const d = new Date(); d.setDate(d.getDate() + days); d.setHours(9, 0, 0, 0)
            const iso = d.toISOString().slice(0, 10)
            const isSelected = dueDate === iso
            return (
              <button
                key={label}
                className={`prop-quick-date-btn ${isSelected ? 'active' : ''}`}
                onClick={() => setDue(iso, dueTime || '09:00')}
              >{label}</button>
            )
          })}
          {dueDate && (
            <button className="prop-quick-date-btn" onClick={() => setDue('', '')}>✕</button>
          )}
        </div>
        <div className="prop-datetime" style={{ marginTop: 6 }}>
          <input
            type="date"
            className="prop-date-input"
            value={dueDate}
            onChange={e => setDue(e.target.value, dueTime)}
          />
          <input
            type="time"
            className="prop-time-input"
            value={dueTime}
            onChange={e => setDue(dueDate, e.target.value)}
            disabled={!dueDate}
          />
        </div>
      </div>

      {/* Fecha fin (solo si es evento) */}
      {(node.isEvent || node.dueEnd) && (
        <div className="prop-section">
          <div className="prop-section-label">{t('prop.endDate')}</div>
          <div className="prop-datetime">
            <input
              type="date"
              className="prop-date-input"
              value={dueEndDate}
              onChange={e => setDueEnd(e.target.value, dueEndTime)}
            />
            <input
              type="time"
              className="prop-time-input"
              value={dueEndTime}
              onChange={e => setDueEnd(dueEndDate, e.target.value)}
              disabled={!dueEndDate}
            />
          </div>
        </div>
      )}

      {/* Recurrencia */}
      {node.status !== null && (
        <div className="prop-section">
          <div className="prop-section-label">{t('prop.recurrence')}</div>
          <div className="prop-recurrence-chips">
            {recurrenceOptions.map(opt => (
              <button
                key={opt.value}
                className={`prop-recurrence-chip ${(node.recurrence || '') === opt.value ? 'active' : ''}`}
                onClick={() => store.updateNode(node.id, { recurrence: opt.value || null })}
                title={opt.label}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Color del nodo */}
      {(() => {
        const nodeColor = (() => {
          try { return JSON.parse(node.extraData || '{}').color || null } catch { return null }
        })()

        const colors = [null, '#ef4444', '#f97316', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899']

        function setColor(color: string | null) {
          try {
            const ed = JSON.parse(node.extraData || '{}')
            if (color) ed.color = color
            else delete ed.color
            store.updateNode(node.id, { extraData: JSON.stringify(ed) })
          } catch {
            if (color) store.updateNode(node.id, { extraData: JSON.stringify({ color }) })
          }
        }

        return (
          <div className="prop-section">
            <div className="prop-section-label">{t('panel.color')}</div>
            <div className="prop-color-chips">
              {colors.map(c => (
                <button
                  key={c || 'none'}
                  className={`prop-color-chip ${(nodeColor || null) === c ? 'active' : ''}`}
                  style={{ background: c || 'transparent', border: c ? 'none' : '1px solid var(--border)' }}
                  onClick={() => setColor(c)}
                  title={c || t('prop.noColor')}
                >
                  {!c && <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>✕</span>}
                </button>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Área */}
      <div className="prop-section">
        <div className="prop-section-label">{t('prop.area')}</div>
        <div className="prop-tags">
          {nodeArea && (
            <span className="prop-tag-chip" style={{ background: 'rgba(139,92,246,0.1)', color: 'var(--text-accent)' }}>
              📁 {nodeArea}
              <button className="prop-tag-remove" onClick={() => store.setNodeArea(node.id, null)}>×</button>
            </span>
          )}
          {!nodeArea && (
            <>
              <input
                type="text"
                className="prop-type-input"
                value={areaInput}
                onChange={e => {
                  setAreaInput(e.target.value)
                  if (s.allAreas().includes(e.target.value)) {
                    store.setNodeArea(node.id, e.target.value)
                    setAreaInput('')
                  }
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && areaInput.trim()) {
                    store.setNodeArea(node.id, areaInput.trim())
                    setAreaInput('')
                  }
                }}
                placeholder={t('ph.addArea')}
                list="prop-areas-datalist"
              />
              <datalist id="prop-areas-datalist">
                {s.allAreas().map(a => <option key={a} value={a} />)}
              </datalist>
            </>
          )}
        </div>
      </div>

      {/* Tags */}
      <div className="prop-section">
        <div className="prop-section-label">{t('settings.tabTags')}</div>
        <div className="prop-tags">
          {(node.types || []).map(t => (
            <span key={t} className="prop-tag-chip" style={{ background: s.tagColor(t) + '20', color: s.tagColor(t) }}>
              #{t}
              <button className="prop-tag-remove" onClick={() => removeType(t)}>×</button>
            </span>
          ))}
          <input
            type="text"
            className="prop-type-input"
            value={newType}
            onChange={e => setNewType(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addType(newType) } }}
            placeholder={t('ph.addTag')}
            list="prop-tags-datalist"
          />
          <datalist id="prop-tags-datalist">
            {usedTags.filter(t => !node.types?.includes(t)).map(t => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
      </div>

      {/* Notas mencionadas / enlazadas */}
      {(() => {
        const refs: string[] = []
        try { refs.push(...(JSON.parse(node.extraData || '{}').refs || [])) } catch {}
        const mentionMatches = node.text.match(/@(\w+)/g) || []
        const mentionedNodes = mentionMatches.length > 0
          ? s.allActive().filter(n =>
              n.id !== node.id &&
              mentionMatches.some(m => n.text.toLowerCase().includes(m.slice(1).toLowerCase()))
            ).slice(0, 5)
          : []

        if (refs.length === 0 && mentionedNodes.length === 0) return null
        return (
          <div className="prop-section">
            <div className="prop-section-label">{t('prop.linked')}</div>
            {mentionedNodes.map(n => (
              <button key={n.id} className="prop-linked-btn" onClick={() => openNodeDetail(n.id)}>
                📄 {n.text || t('common.noTitle')}
              </button>
            ))}
          </div>
        )
      })()}
    </div>
  )
}
