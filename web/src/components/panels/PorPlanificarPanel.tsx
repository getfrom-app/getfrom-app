/**
 * PorPlanificarPanel — cola de planificación (columna derecha del modo Planificar).
 *
 * Filosofía Fromly: NADA se queda sin programar. Aquí viven las tareas que aún no
 * tienen un cuándo: ATRASADAS (su fecha ya pasó → hay que decidir) + SIN FECHA.
 * Se arrastran al calendario central para programar/reprogramar, o se usan los
 * botones rápidos (Hoy · +1 · +7). Cada reagendado se cuenta (anti-treadmill).
 */
import { useStore, store } from '../../store/nodeStore'
import { openNodeDetail } from '../../utils/canvasNav'
import { useTranslation } from 'react-i18next'
import { collectDailyCockpit, scheduleTask, rescheduleCount, toggleTaskDone } from '../../utils/dailyCockpit'
import { renderInline } from '../outliner/InlineRenderer'
import RowContextChip from './RowContextChip'
import type { Node } from '../../types'

export default function PorPlanificarPanel() {
  useStore()
  const { t } = useTranslation()
  const data = collectDailyCockpit()
  // Atrasadas (fecha pasada, pendientes) + sin fecha (seguimiento). Lo de hoy ya
  // está programado, así que NO entra en la cola.
  const overdue = data.overdue.filter(n => n.status !== 'done')
  const sinFecha = data.seguimiento

  function dueLabel(n: Node): string {
    if (!n.due) return ''
    return new Date(n.due).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  const row = (n: Node) => {
    const rc = rescheduleCount(n)
    return (
      <div
        key={n.id}
        className="dc-row pp-queue-row"
        draggable
        onDragStart={e => { e.dataTransfer.setData('nodeId', n.id); e.dataTransfer.effectAllowed = 'move' }}
        onClick={() => openNodeDetail(n.id)}
        onContextMenu={e => { e.preventDefault(); e.stopPropagation(); window.dispatchEvent(new CustomEvent('from:open-rowmenu', { detail: { nodeId: n.id, x: e.clientX, y: e.clientY } })) }}
        title={t('tip.dragToCalendar')}
      >
        <span className="pp-queue-grip" aria-hidden>⋮⋮</span>
        <button className="dc-check" onClick={e => { e.stopPropagation(); toggleTaskDone(n) }} title={t('tip.done')} />
        <div className="dc-row-main">
          <div className="dc-row-l1">
            <span className="dc-text">{n.text ? renderInline(n.text) : t('tip.noText')}</span>
            <span style={{ marginLeft: 4, flexShrink: 0 }}><RowContextChip node={n} /></span>
            <span className="dc-actions">
              <button className="dc-action" title={t('tip.scheduleToday')} onClick={e => { e.stopPropagation(); scheduleTask(n, 0) }}>{t('common.today')}</button>
              <button className="dc-action" title={t('common.tomorrow')} onClick={e => { e.stopPropagation(); scheduleTask(n, 1) }}>+1</button>
              <button className="dc-action" title={t('tip.inSevenDays')} onClick={e => { e.stopPropagation(); scheduleTask(n, 7) }}>+7</button>
            </span>
          </div>
          <div className="dc-row-l2">
            {n.due && <span className="dc-due" style={{ color: '#e03131' }}>{dueLabel(n)}</span>}
            {rc > 0 && (
              <span className="pp-reschedule-badge" title={t('tip.rescheduledCount', { count: rc })}>
                ↻ {rc}
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }

  const total = overdue.length + sinFecha.length

  return (
    <div className="pp-queue">
      <div className="pp-queue-head">
        <span className="pp-queue-title">{t('tip.toPlan')}</span>
        <span className="pp-queue-count">{total}</span>
      </div>
      {total === 0 ? (
        <div className="pp-queue-empty">
          <div style={{ fontSize: 30, marginBottom: 8 }}>✓</div>
          {t('tip.allScheduled')}
        </div>
      ) : (
        <div className="pp-queue-body">
          {overdue.length > 0 && (
            <div className="pp-queue-section">
              <div className="rc-section-label" style={{ color: '#e03131' }}>{t('daily.overdue')} · {overdue.length}</div>
              {overdue.map(row)}
            </div>
          )}
          {sinFecha.length > 0 && (
            <div className="pp-queue-section">
              <div className="rc-section-label">{t('daily.noDate')} · {sinFecha.length}</div>
              {sinFecha.map(row)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
