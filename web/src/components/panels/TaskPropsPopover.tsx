import React, { useRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { store } from '../../store/nodeStore'
import type { Node } from '../../types'
import { isoToLocalDate, isoToLocalTime, hasLocalTime, makeDueISO } from '../../utils/dates'

interface TaskPropsPopoverProps {
  node: Node
  onClose: () => void
  anchorRef: React.RefObject<HTMLButtonElement>
}

export default function TaskPropsPopover({ node, onClose, anchorRef }: TaskPropsPopoverProps) {
  const { t } = useTranslation()
  const popoverRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect()
      setPos({
        top: rect.bottom + 6,
        left: Math.max(8, Math.min(rect.right - 280, window.innerWidth - 292)),
      })
    }
    function handler(e: MouseEvent) {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as globalThis.Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as globalThis.Node)
      ) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose, anchorRef])

  const dueDate = isoToLocalDate(node.due)
  const dueTime = isoToLocalTime(node.due)

  function setDue(date: string, time: string) {
    if (!date) { store.updateNode(node.id, { due: null }); return }
    store.updateNode(node.id, { due: makeDueISO(date, time) })
  }

  function parseRec(r: string) {
    const [unit, nStr] = r.split(':')
    return { n: parseInt(nStr || '1') || 1, unit }
  }
  function applyRec(n: number, unit: string) {
    const safe = Math.max(1, n)
    store.updateNode(node.id, { recurrence: safe === 1 ? unit : `${unit}:${safe}` })
  }
  const recUnits: [string, string][] = [['daily', t('nodeRightPanel.unitDays')], ['weekly', t('nodeRightPanel.unitWeeksShort')], ['monthly', t('taskProps.unitMonthsShort')], ['yearly', t('taskProps.unitYearShort')]]
  const qNextMondayDays = (() => { const d = new Date().getDay(); return d === 1 ? 7 : (8 - d) % 7 || 7 })()
  const priorityOpts: { v: Node['priority']; l: string; c: string }[] = [
    { v: null,     l: '–',    c: '' },
    { v: 'low',    l: t('nodeRightPanel.prioLow'),  c: '#6b7280' },
    { v: 'medium', l: t('nodeRightPanel.prioMedium'), c: '#f59e0b' },
    { v: 'high',   l: t('nodeRightPanel.prioHigh'),  c: '#ef4444' },
  ]

  if (!pos) return null

  return createPortal(
    <div
      ref={popoverRef}
      className="task-props-popup"
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 500 }}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      <div className="tpp-title">{node.text || t('common.noTitle')}</div>

      <div className="tpp-section-label">{t('modal.dueDate')}</div>
      <div className="nqp-quick-row">
        {[
          { label: t('common.today'), days: 0 },
          { label: t('nodeRightPanel.tomorrow'), days: 1 },
          { label: t('taskProps.monday'), days: qNextMondayDays },
          { label: '+7d', days: 7 },
        ].map(({ label, days }) => {
          const d = new Date(); d.setDate(d.getDate() + days)
          const iso = [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-')
          return (
            <button key={label} className={`nqp-qbtn${dueDate === iso ? ' active' : ''}`}
              onClick={() => setDue(iso, hasLocalTime(node.due) ? dueTime : '')}>{label}</button>
          )
        })}
        {node.due && <button className="nqp-qbtn nqp-clear" onClick={() => store.updateNode(node.id, { due: null })}>✕</button>}
      </div>

      <div className="nqp-inputs-row">
        <input type="date" className="nqp-date-input" value={dueDate}
          onChange={e => setDue(e.target.value, hasLocalTime(node.due) ? dueTime : '')} />
        <input type="time" className="nqp-time-input"
          value={hasLocalTime(node.due) ? dueTime : ''}
          onChange={e => setDue(dueDate, e.target.value)} disabled={!dueDate} placeholder="HH:MM" />
        {hasLocalTime(node.due) && (
          <button className="nqp-qbtn nqp-clear" style={{ fontSize: 10, padding: '2px 5px' }}
            onClick={() => setDue(dueDate, '')} title={t('common.removeTime')}>✕h</button>
        )}
      </div>

      <div className="tpp-section-label">{t('kanban.byPriority')}</div>
      <div className="nqp-chips-row">
        {priorityOpts.map(opt => (
          <button key={String(opt.v)}
            className={`nqp-chip${node.priority === opt.v ? ' active' : ''}`}
            style={opt.c ? { color: opt.c, ...(node.priority === opt.v ? { borderColor: opt.c, background: opt.c + '20' } : {}) } : {}}
            onClick={() => store.updateNode(node.id, { priority: opt.v })}
          >{opt.l}</button>
        ))}
      </div>

      <div className="tpp-section-label">{t('common.repeat')}</div>
      <div className="nqp-rec-row">
        <button className={`nqp-chip${!node.recurrence ? ' active' : ''}`}
          onClick={() => store.updateNode(node.id, { recurrence: null })}>–</button>
        <input type="number" className="nqp-rec-n" min={1} max={999}
          value={node.recurrence ? parseRec(node.recurrence).n : 1}
          disabled={!node.recurrence}
          onClick={e => e.stopPropagation()}
          onChange={e => {
            const n = Math.max(1, parseInt(e.target.value) || 1)
            const unit = node.recurrence ? parseRec(node.recurrence).unit : 'daily'
            applyRec(n, unit)
          }}
        />
        {recUnits.map(([unit, label]) => (
          <button key={unit}
            className={`nqp-chip${!!node.recurrence && parseRec(node.recurrence).unit === unit ? ' active' : ''}`}
            onClick={() => applyRec(node.recurrence ? parseRec(node.recurrence).n : 1, unit)}
          >{label}</button>
        ))}
      </div>

      <div className="tpp-section-label">{t('search.filterStatus')}</div>
      <div className="nqp-chips-row">
        {([
          { v: 'pending' as const, l: `○ ${t('nodeRightPanel.statusPending')}` },
          { v: 'done'    as const, l: `✓ ${t('taskProps.statusDoneF')}` },
          { v: 'future'  as const, l: `◆ ${t('taskProps.statusFutureF')}` },
          { v: null,               l: `– ${t('nodeRightPanel.statusNone')}` },
        ] as { v: Node['status']; l: string }[]).map(opt => (
          <button key={String(opt.v)}
            className={`nqp-chip${node.status === opt.v ? ' active' : ''}`}
            onClick={() => { store.updateNode(node.id, { status: opt.v }); if (opt.v !== null) onClose() }}
          >{opt.l}</button>
        ))}
      </div>
    </div>,
    document.body
  )
}
