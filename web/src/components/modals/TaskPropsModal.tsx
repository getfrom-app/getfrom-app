// Modal GLOBAL de propiedades de tarea (fecha / hora / recurrencia / prioridad).
// Lo abre MainLayout al recibir el evento `from:open-task-props` cuando el nodo NO
// está montado como fila de outliner (p. ej. desde la cabecera de la nota), donde el
// popup inline de OutlinerNode no puede anclarse. Guarda en vivo vía store.updateNode.

import { createPortal } from 'react-dom'
import { store, useStore } from '../../store/nodeStore'
import { useTranslation } from 'react-i18next'

const REC_UNITS: [string, string][] = [['daily', 'taskPropsModal.recDays'], ['weekly', 'taskPropsModal.recWeeks'], ['monthly', 'taskPropsModal.recMonths'], ['yearly', 'taskPropsModal.recYears']]
const PRIORITIES: [string, string][] = [['high', 'priority.high'], ['medium', 'priority.medium'], ['low', 'priority.low']]

export default function TaskPropsModal({ nodeId, onClose }: { nodeId: string; onClose: () => void }) {
  const { t } = useTranslation()
  useStore() // re-render al cambiar el nodo
  const node = store.getNode(nodeId)
  if (!node) return null

  const due = node.due ? new Date(node.due) : null
  const dateStr = node.due ? node.due.slice(0, 10) : ''
  const hasTime = !!due && (due.getHours() !== 0 || due.getMinutes() !== 0)
  const timeStr = hasTime
    ? `${String(due!.getHours()).padStart(2, '0')}:${String(due!.getMinutes()).padStart(2, '0')}`
    : ''
  const rec = node.recurrence || ''
  const recUnit = rec ? rec.split(':')[0] : ''
  const recN = rec ? (parseInt(rec.split(':')[1] || '1') || 1) : 1

  function setDateTime(d: string, t: string) {
    if (!d) { store.updateNode(nodeId, { due: null }); return }
    const iso = t ? new Date(`${d}T${t}:00`).toISOString() : new Date(`${d}T00:00:00`).toISOString()
    store.updateNode(nodeId, { due: iso, status: node!.status ?? 'pending' })
  }
  function quick(days: number) {
    const dd = new Date(); dd.setHours(0, 0, 0, 0); dd.setDate(dd.getDate() + days)
    setDateTime(dd.toISOString().slice(0, 10), timeStr)
  }
  function setRec(unit: string, n: number) {
    store.updateNode(nodeId, {
      recurrence: !unit ? null : (n === 1 ? unit : `${unit}:${n}`),
      status: node!.status ?? 'pending',
    })
  }
  function setPriority(p: 'low' | 'medium' | 'high' | null) {
    store.updateNode(nodeId, { priority: p })
  }

  const chip = (active: boolean): React.CSSProperties => ({
    padding: '5px 11px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
    border: `1px solid ${active ? 'var(--accent,#6c5ce7)' : 'var(--border,#e2e2e2)'}`,
    background: active ? 'var(--accent,#6c5ce7)' : 'transparent',
    color: active ? '#fff' : 'var(--text-primary)', lineHeight: 1.1,
  })
  const label: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary,#999)', textTransform: 'uppercase', letterSpacing: '0.03em', margin: '14px 0 6px' }
  const input: React.CSSProperties = { padding: '6px 9px', borderRadius: 8, border: '1px solid var(--border,#e2e2e2)', background: 'var(--bg-primary,#fff)', color: 'var(--text-primary)', font: 'inherit' }

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--small" onClick={e => e.stopPropagation()} style={{ minWidth: 320, maxWidth: 380 }}>
        <h3 className="modal-title" style={{ marginBottom: 2 }}>⚙ {t('taskPropsModal.title')}</h3>
        <div style={{ fontSize: 13, color: 'var(--text-secondary,#666)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.text || t('taskPropsModal.taskFallback')}</div>

        {/* Fecha rápida */}
        <div style={label}>{t('common.date')}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {([[t('taskPropsModal.quickToday'), 0], [t('taskPropsModal.quickTomorrow'), 1], ['+7d', 7], ['+30d', 30]] as [string, number][]).map(([lbl, d]) => (
            <button key={lbl} style={chip(false)} onClick={() => quick(d)}>{lbl}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="date" style={input} value={dateStr} onChange={e => setDateTime(e.target.value, timeStr)} />
          <input type="time" style={{ ...input, opacity: dateStr ? 1 : 0.5 }} value={timeStr} disabled={!dateStr}
            onChange={e => setDateTime(dateStr, e.target.value)} placeholder="HH:MM" />
          {node.due && <button style={{ ...chip(false), color: 'var(--danger,#e03131)' }} title={t('common.removeDate')} onClick={() => store.updateNode(nodeId, { due: null })}>✕</button>}
        </div>

        {/* Recurrencia */}
        <div style={label}>{t('taskPropsModal.repeatEvery')}</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <button style={chip(!recUnit)} onClick={() => setRec('', 1)}>{t('taskPropsModal.repeatNo')}</button>
          <input type="number" min={1} max={999} value={recN} disabled={!recUnit}
            style={{ ...input, width: 56 }}
            onChange={e => setRec(recUnit || 'daily', Math.max(1, parseInt(e.target.value) || 1))} />
          {REC_UNITS.map(([unit, lbl]) => (
            <button key={unit} style={chip(recUnit === unit)} onClick={() => setRec(unit, recN)}>{t(lbl)}</button>
          ))}
        </div>

        {/* Prioridad */}
        <div style={label}>{t('taskPropsModal.priority')}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button style={chip(!node.priority)} onClick={() => setPriority(null)}>{t('taskPropsModal.priorityNone')}</button>
          {PRIORITIES.map(([p, lbl]) => (
            <button key={p} style={chip(node.priority === p)} onClick={() => setPriority(p as 'low' | 'medium' | 'high')}>{t(lbl)}</button>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
          <button className="btn-primary" onClick={onClose}>{t('taskPropsModal.done')}</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
