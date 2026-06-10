// «Tu día» — sección calculada al inicio de la nota diaria de HOY.
// Muestra tareas atrasadas, tareas de hoy y bucles abiertos como referencias
// a los nodos reales (nunca copia/materializa nada). Colapsable y discreta.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useStore, store } from '../../store/nodeStore'
import { collectDailyCockpit } from '../../utils/dailyCockpit'
import type { Node } from '../../types'

const COLLAPSE_KEY = 'from_daily_cockpit_collapsed'

export default function DailyCockpit() {
  useStore() // suscripción: re-render con cada cambio del store
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1')

  // Recalculado en cada render — un pase O(n) sobre el store, barato (~6k nodos)
  const data = collectDailyCockpit()

  const total = data.overdue.length + data.today.length + data.bucles.length
  if (total === 0) return null

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

  const renderTaskRow = (n: Node, showDue: boolean) => (
    <div key={n.id} className="dc-row" onClick={() => navigate(`/node/${n.id}`)}>
      <button
        className="dc-check"
        onClick={e => completeTask(e, n)}
        title={t('daily.markDone')}
        aria-label={t('daily.markDone')}
      />
      <span className="dc-text">{n.text || t('common.noTitle')}</span>
      {showDue && <span className="dc-due">{dueLabel(n)}</span>}
      {parentLabel(n) && <span className="dc-parent">{parentLabel(n)}</span>}
    </div>
  )

  const renderBucleRow = (n: Node) => (
    <div key={n.id} className="dc-row" onClick={() => navigate(`/node/${n.id}`)}>
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

  return (
    <div className={`daily-cockpit ${collapsed ? 'daily-cockpit--collapsed' : ''}`}>
      <button className="dc-header" onClick={toggleCollapsed} aria-expanded={!collapsed}>
        <span className="dc-title">{t('daily.cockpitTitle')}</span>
        <span className="dc-counts">
          {data.overdue.length > 0 && <span className="dc-count dc-count--overdue">{data.overdue.length} {t('daily.overdueShort')}</span>}
          {data.today.length > 0 && <span className="dc-count">{data.today.length} {t('daily.todayShort')}</span>}
          {data.bucles.length > 0 && <span className="dc-count dc-count--bucle">⟲ {data.bucles.length}</span>}
        </span>
        <span className="dc-chevron">{collapsed ? '›' : '▾'}</span>
      </button>

      {!collapsed && (
        <div className="dc-body">
          {data.overdue.length > 0 && (
            <div className="dc-group">
              <div className="dc-group-label dc-group-label--overdue">{t('daily.overdue')}</div>
              {data.overdue.map(n => renderTaskRow(n, true))}
            </div>
          )}
          {data.today.length > 0 && (
            <div className="dc-group">
              <div className="dc-group-label">{t('daily.todayTasks')}</div>
              {data.today.map(n => renderTaskRow(n, false))}
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
