// «Tu día» — sección calculada al inicio de la nota diaria de HOY.
// Muestra el 🎯 Foco del día, tareas atrasadas, tareas de hoy y bucles abiertos
// como referencias a los nodos reales (nunca copia/materializa nada).
// Triaje matinal: 🎯 manda al foco, ⏭ pospone (mañana/+1 semana/sin fecha).
// Las filas se arrastran al planificador (dataTransfer 'nodeId') para ponerles hora,
// y al interactuar con el bloque la columna derecha cambia a planificador.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useStore, store } from '../../store/nodeStore'
import { collectDailyCockpit, toggleFocusToday, postponeTask } from '../../utils/dailyCockpit'
import type { Node } from '../../types'

const COLLAPSE_KEY = 'from_daily_cockpit_collapsed'

export default function DailyCockpit() {
  useStore() // suscripción: re-render con cada cambio del store
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1')
  const [postponeMenuId, setPostponeMenuId] = useState<string | null>(null)

  // Recalculado en cada render — un pase O(n) sobre el store, barato (~6k nodos)
  const data = collectDailyCockpit()

  const total = data.focus.length + data.overdue.length + data.today.length + data.bucles.length
  if (total === 0) return null

  function openPlanner() {
    window.dispatchEvent(new CustomEvent('from:open-planner'))
  }

  function toggleCollapsed() {
    setCollapsed(c => {
      localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1')
      return !c
    })
  }

  function completeTask(e: React.MouseEvent, n: Node) {
    e.stopPropagation()
    store.updateNode(n.id, { status: n.status === 'done' ? 'pending' : 'done' })
  }

  function closeBucle(e: React.MouseEvent, n: Node) {
    e.stopPropagation()
    store.updateNode(n.id, { status: 'done' })
  }

  function onFocusClick(e: React.MouseEvent, n: Node) {
    e.stopPropagation()
    toggleFocusToday(n)
    setPostponeMenuId(null)
  }

  function onPostpone(e: React.MouseEvent, n: Node, days: number | null) {
    e.stopPropagation()
    postponeTask(n, days)
    setPostponeMenuId(null)
  }

  function parentLabel(n: Node): string | null {
    if (!n.parentId) return null
    const p = store.getNode(n.parentId)
    if (!p || p.isDiaryEntry) return null
    return p.text || null
  }

  function dueLabel(n: Node): string {
    if (!n.due) return ''
    const d = new Date(n.due)
    return d.toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'es-ES', { weekday: 'short', day: 'numeric' })
  }

  /** Hora de ejecución si el due la lleva (asignada p.ej. arrastrando al planner) */
  function timeLabel(n: Node): string | null {
    if (!n.due) return null
    const d = new Date(n.due)
    if (d.getHours() === 0 && d.getMinutes() === 0) return null
    return d.toLocaleTimeString(i18n.language === 'en' ? 'en-US' : 'es-ES', { hour: '2-digit', minute: '2-digit' })
  }

  function dragProps(n: Node) {
    return {
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        e.dataTransfer.setData('nodeId', n.id)
        e.dataTransfer.effectAllowed = 'move'
        openPlanner() // arrastrar implica planificar — asegura el panel visible
      },
    }
  }

  const renderTaskRow = (n: Node, opts: { showDue?: boolean; inFocus?: boolean }) => (
    <div
      key={n.id}
      className={`dc-row ${n.status === 'done' ? 'dc-row--done' : ''}`}
      onClick={() => navigate(`/node/${n.id}`)}
      {...dragProps(n)}
    >
      <button
        className={`dc-check ${n.status === 'done' ? 'dc-check--done' : ''}`}
        onClick={e => completeTask(e, n)}
        title={t('daily.markDone')}
        aria-label={t('daily.markDone')}
      >{n.status === 'done' ? '✓' : ''}</button>
      <span className="dc-text">{n.text || t('common.noTitle')}</span>
      {timeLabel(n) && <span className="dc-time">{timeLabel(n)}</span>}
      {opts.showDue && <span className="dc-due">{dueLabel(n)}</span>}
      {parentLabel(n) && <span className="dc-parent">{parentLabel(n)}</span>}
      <span className="dc-actions">
        {opts.inFocus ? (
          <button className="dc-action" onClick={e => onFocusClick(e, n)} title={t('daily.unfocus')}>✕</button>
        ) : (
          <>
            <button className="dc-action dc-action--focus" onClick={e => onFocusClick(e, n)} title={t('daily.toFocus')}>🎯</button>
            <span className="dc-postpone-wrap">
              <button
                className="dc-action"
                onClick={e => { e.stopPropagation(); setPostponeMenuId(id => id === n.id ? null : n.id) }}
                title={t('daily.postpone')}
              >⏭</button>
              {postponeMenuId === n.id && (
                <span className="dc-postpone-menu" onClick={e => e.stopPropagation()}>
                  <button onClick={e => onPostpone(e, n, 1)}>{t('daily.tomorrow')}</button>
                  <button onClick={e => onPostpone(e, n, 7)}>{t('daily.nextWeek')}</button>
                  <button onClick={e => onPostpone(e, n, null)}>{t('daily.noDate')}</button>
                </span>
              )}
            </span>
          </>
        )}
      </span>
    </div>
  )

  const renderBucleRow = (n: Node) => (
    <div key={n.id} className="dc-row" onClick={() => navigate(`/node/${n.id}`)} {...dragProps(n)}>
      <button
        className="dc-bucle"
        onClick={e => closeBucle(e, n)}
        title={t('daily.closeBucle')}
        aria-label={t('daily.closeBucle')}
      >
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11.5 7a4.5 4.5 0 1 1-1.3-3.2" />
          <path d="M11.5 1.8v2.7H8.8" />
        </svg>
      </button>
      <span className="dc-text">{n.text || t('common.noTitle')}</span>
      {parentLabel(n) && <span className="dc-parent">{parentLabel(n)}</span>}
    </div>
  )

  const pendingFocus = data.focus.filter(n => n.status !== 'done').length

  return (
    <div
      className={`daily-cockpit ${collapsed ? 'daily-cockpit--collapsed' : ''}`}
      onMouseDown={openPlanner}
    >
      <button className="dc-header" onClick={toggleCollapsed} aria-expanded={!collapsed}>
        <span className="dc-title">{t('daily.cockpitTitle')}</span>
        <span className="dc-counts">
          {data.focus.length > 0 && <span className="dc-count dc-count--focus">🎯 {data.focus.length}</span>}
          {data.overdue.length > 0 && <span className="dc-count dc-count--overdue">{data.overdue.length} {t('daily.overdueShort')}</span>}
          {data.today.length > 0 && <span className="dc-count">{data.today.length} {t('daily.todayShort')}</span>}
          {data.bucles.length > 0 && <span className="dc-count dc-count--bucle">⟲ {data.bucles.length}</span>}
        </span>
        <span className="dc-chevron">{collapsed ? '›' : '▾'}</span>
      </button>

      {!collapsed && (
        <div className="dc-body">
          {data.focus.length > 0 && (
            <div className="dc-group dc-group--focus">
              <div className="dc-group-label dc-group-label--focus">{t('daily.focus')}</div>
              {data.focus.map(n => renderTaskRow(n, { inFocus: true }))}
              {pendingFocus > 3 && <div className="dc-focus-hint">{t('daily.focusHint')}</div>}
            </div>
          )}
          {data.overdue.length > 0 && (
            <div className="dc-group">
              <div className="dc-group-label dc-group-label--overdue">{t('daily.overdue')}</div>
              {data.overdue.map(n => renderTaskRow(n, { showDue: true }))}
            </div>
          )}
          {data.today.length > 0 && (
            <div className="dc-group">
              <div className="dc-group-label">{t('daily.todayTasks')}</div>
              {data.today.map(n => renderTaskRow(n, {}))}
            </div>
          )}
          {data.bucles.length > 0 && (
            <div className="dc-group">
              <div className="dc-group-label dc-group-label--bucle">{t('daily.openBucles')}</div>
              {data.bucles.map(renderBucleRow)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
