// «Tu día» — sección calculada al inicio de la nota diaria de HOY.
// Muestra el 🎯 Foco del día, tareas atrasadas, tareas de hoy y bucles abiertos
// como referencias a los nodos reales (nunca copia/materializa nada).
// Triaje matinal: 🎯 manda al foco, ⏭ pospone (mañana/+1 semana/sin fecha).
// Las filas se arrastran al planificador (dataTransfer 'nodeId') para ponerles hora,
// y al interactuar con el bloque la columna derecha cambia a planificador.
import { useState, useRef, useLayoutEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useStore, store } from '../../store/nodeStore'
import { collectDailyCockpit, toggleFocusToday, postponeTask, toggleTaskDone } from '../../utils/dailyCockpit'
import { passesLens, allContextKeys } from '../../utils/contextLens'
import { useLensContextId } from '../../store/contextLensStore'
import { trashNode } from '../../utils/papeleraHelper'
import { renderInline } from '../outliner/InlineRenderer'
import { TaskPropsPopover } from '../panels/DiaryPanelComponents'
import RowContextChip from '../panels/RowContextChip'
import { listActiveContexts, contextColor, contextParent, nodesInContext } from '../../utils/cajones'
import type { Node } from '../../types'

const COLLAPSE_KEY = 'from_daily_cockpit_collapsed'

export default function DailyCockpit({ disablePlanner = false, bare = false }: { disablePlanner?: boolean; bare?: boolean } = {}) {
  useStore() // suscripción: re-render con cada cambio del store
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1')
  const [postponeMenuId, setPostponeMenuId] = useState<string | null>(null)
  // Modal de fecha+recurrencia al tocar el badge de fecha de una tarea
  const [propsNodeId, setPropsNodeId] = useState<string | null>(null)
  // Colapsado por bloque (cabecera clicable). Persistente.
  const [collapsedG, setCollapsedG] = useState<Set<string>>(() => {
    let set: Set<string>
    try { set = new Set(JSON.parse(localStorage.getItem('from_dc_groups_collapsed') || '[]')) } catch { set = new Set() }
    // SEGUIMIENTO colapsado por defecto (una sola vez): suele tener muchas tareas
    // sin fecha. Después se respeta la preferencia del usuario al desplegar/plegar.
    if (localStorage.getItem('from_dc_seg_collapsed_init') !== '1') {
      set.add('seguimiento')
      localStorage.setItem('from_dc_groups_collapsed', JSON.stringify([...set]))
      localStorage.setItem('from_dc_seg_collapsed_init', '1')
    }
    return set
  })
  function toggleG(k: string) {
    setCollapsedG(prev => {
      const next = new Set(prev)
      next.has(k) ? next.delete(k) : next.add(k)
      localStorage.setItem('from_dc_groups_collapsed', JSON.stringify([...next]))
      return next
    })
  }

  // Recalculado en cada render — un pase O(n) sobre el store, barato (~6k nodos)
  const rawData = collectDailyCockpit()
  // LENTE DE CONTEXTO: filtra cada grupo por el contexto activo (lo «sin contexto»
  // siempre pasa). useLensContextId fuerza re-render al cambiar la lente.
  const lensId = useLensContextId()
  const data = (() => {
    if (!lensId) return rawData
    const k = allContextKeys()
    return {
      ...rawData,
      focus: rawData.focus.filter(n => passesLens(n, k)),
      overdue: rawData.overdue.filter(n => passesLens(n, k)),
      today: rawData.today.filter(n => passesLens(n, k)),
      seguimiento: rawData.seguimiento.filter(n => passesLens(n, k)),
    }
  })()

  // ── Animación FLIP: las filas se deslizan a su nueva posición al reordenar ──
  // (p.ej. al completar, la tarea baja al final de su grupo en vez de saltar).
  const rowEls = useRef(new Map<string, HTMLDivElement>())
  const prevTops = useRef(new Map<string, number>())
  useLayoutEffect(() => {
    const newTops = new Map<string, number>()
    for (const [id, el] of rowEls.current) {
      if (!el.isConnected) { rowEls.current.delete(id); continue }
      const top = el.getBoundingClientRect().top
      newTops.set(id, top)
      const prev = prevTops.current.get(id)
      if (prev !== undefined && Math.abs(prev - top) > 2) {
        // Invertir al punto de partida y dejar que la transición lo lleve a 0
        el.style.transition = 'none'
        el.style.transform = `translateY(${prev - top}px)`
        void el.offsetHeight // reflow
        el.style.transition = 'transform 0.35s cubic-bezier(0.25, 0.8, 0.35, 1)'
        el.style.transform = ''
      }
    }
    prevTops.current = newTops
  })

  function registerRow(id: string) {
    return (el: HTMLDivElement | null) => {
      if (el) rowEls.current.set(id, el)
      else rowEls.current.delete(id)
    }
  }

  const total = data.focus.length + data.overdue.length + data.today.length + data.seguimiento.length
  if (total === 0) return null

  function openPlanner() {
    // En el panel del día NO se salta al planner al interactuar (el chevron solo
    // expande/colapsa en la misma columna). Sí se mantiene al arrastrar fuera.
    if (disablePlanner) return
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
    toggleTaskDone(n) // estampa _doneAt=hoy → sigue visible (tachada) hasta mañana
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

  const delBtn = (n: Node) => (
    <button className="dc-del" title="Eliminar" onClick={e => { e.stopPropagation(); trashNode(n.id) }}>
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10" /></svg>
    </button>
  )

  const renderTaskRow = (n: Node, opts: { showDue?: boolean; inFocus?: boolean }) => (
    <div
      key={n.id}
      ref={registerRow(n.id)}
      className={`dc-row ${n.status === 'done' ? 'dc-row--done' : ''}`}
      onClick={() => navigate(`/node/${n.id}`)}
      onContextMenu={e => { e.preventDefault(); e.stopPropagation(); window.dispatchEvent(new CustomEvent('from:open-rowmenu', { detail: { nodeId: n.id, x: e.clientX, y: e.clientY } })) }}
      {...dragProps(n)}
    >
      <button
        className={`dc-check ${n.status === 'done' ? 'dc-check--done' : ''}`}
        onClick={e => completeTask(e, n)}
        title={t('daily.markDone')}
        aria-label={t('daily.markDone')}
      >{n.status === 'done' ? '✓' : ''}</button>
      <span className="dc-text">{n.text ? renderInline(n.text) : t('common.noTitle')}</span>
      {timeLabel(n) && <span className="dc-time">{timeLabel(n)}</span>}
      {opts.showDue && <span className="dc-due" style={{ cursor: 'pointer' }} title="Editar fecha y recurrencia"
        onClick={e => { e.stopPropagation(); setPropsNodeId(id => id === n.id ? null : n.id) }}>{dueLabel(n)}</span>}
      {parentLabel(n) && <span className="dc-parent">{parentLabel(n)}</span>}
      <RowContextChip node={n} />
      <span className="dc-actions">
        {opts.inFocus ? (
          <button className="dc-action" onClick={e => onFocusClick(e, n)} title={t('daily.unfocus')}>✕</button>
        ) : n.status === 'done' ? (
          null /* completada: sin triaje, solo des-completar con el checkbox */
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
      {delBtn(n)}
    </div>
  )

  const renderBucleRow = (n: Node) => (
    <div key={n.id} className="dc-row" onClick={() => navigate(`/node/${n.id}`)}
      onContextMenu={e => { e.preventDefault(); e.stopPropagation(); window.dispatchEvent(new CustomEvent('from:open-rowmenu', { detail: { nodeId: n.id, x: e.clientX, y: e.clientY } })) }}
      {...dragProps(n)}>
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
      <span className="dc-text">{n.text ? renderInline(n.text) : t('common.noTitle')}</span>
      {parentLabel(n) && <span className="dc-parent">{parentLabel(n)}</span>}
      {delBtn(n)}
    </div>
  )

  const pendingFocus = data.focus.filter(n => n.status !== 'done').length

  const gHeader = (k: string, label: string, cls = '') => (
    <button
      className={`dc-group-label dc-group-toggle ${cls}`}
      onClick={e => { e.stopPropagation(); toggleG(k) }}
    >
      <span className="dc-group-chevron">{collapsedG.has(k) ? '›' : '▾'}</span>{label}
    </button>
  )

  const groups = (
    <>
      {data.focus.length > 0 && (
        <div className="dc-group dc-group--focus">
          {gHeader('focus', t('daily.focus'), 'dc-group-label--focus')}
          {!collapsedG.has('focus') && data.focus.map(n => renderTaskRow(n, { inFocus: true }))}
          {!collapsedG.has('focus') && pendingFocus > 3 && <div className="dc-focus-hint">{t('daily.focusHint')}</div>}
        </div>
      )}
      {data.overdue.length > 0 && (
        <div className="dc-group">
          {gHeader('overdue', t('daily.overdue'), 'dc-group-label--overdue')}
          {!collapsedG.has('overdue') && data.overdue.map(n => renderTaskRow(n, { showDue: true }))}
        </div>
      )}
      {data.today.length > 0 && (
        <div className="dc-group">
          {gHeader('today', t('daily.todayTasks'))}
          {!collapsedG.has('today') && data.today.map(n => renderTaskRow(n, {}))}
        </div>
      )}
      {data.seguimiento.length > 0 && (
        <div className="dc-group">
          {gHeader('seguimiento', `${t('daily.followup')} · ${data.seguimiento.length}`, 'dc-group-label--followup')}
          {!collapsedG.has('seguimiento') && data.seguimiento.map(n => renderTaskRow(n, {}))}
        </div>
      )}
      {(() => {
        const subs = listActiveContexts() // contextos en uso (abiertos)
        if (subs.length === 0) return null
        return (
          <div className="dc-group">
            {gHeader('cajones', `Contextos · ${subs.length}`)}
            {!collapsedG.has('cajones') && subs.map(c => {
              const color = contextColor(c.id)
              const parent = contextParent(c.id)
              const n = nodesInContext(c.id).length
              return (
                <div key={c.id} className="dc-row dc-row--cajon" onClick={() => navigate(`/node/${c.id}`)}>
                  {/* Icono de contexto (en el sitio del checkbox), en su color */}
                  <span className="dc-check" style={{ cursor: 'pointer', color, border: 'none', background: 'none' }} aria-label="Contexto">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 7.4V3a1 1 0 0 1 1-1h4.4a1 1 0 0 1 .7.3l6 6a1 1 0 0 1 0 1.4l-4.4 4.4a1 1 0 0 1-1.4 0l-6-6a1 1 0 0 1-.3-.7z"/>
                      <circle cx="5.2" cy="5.2" r="1"/>
                    </svg>
                  </span>
                  <span className="dc-text">{c.text || 'Contexto'}</span>
                  {parent && (() => {
                    const pColor = contextColor(parent.id)
                    return (
                      <span onClick={e => { e.stopPropagation(); navigate(`/node/${parent.id}`) }}
                        style={{ background: pColor + '18', color: pColor, border: `1px solid ${pColor}40`, borderRadius: 4, fontSize: 11, fontWeight: 500, padding: '0 5px', cursor: 'pointer', flexShrink: 0 }}>
                        {parent.text}
                      </span>
                    )
                  })()}
                  <span style={{ flex: 1 }} />
                  {n > 0 && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{n}</span>}
                </div>
              )
            })}
          </div>
        )
      })()}
    </>
  )

  // Modal de fecha+recurrencia (al tocar el badge de fecha de una tarea).
  const propsNode = propsNodeId
    ? [...data.focus, ...data.overdue, ...data.today, ...data.seguimiento].find(n => n.id === propsNodeId)
    : null
  const propsModal = propsNode
    ? <TaskPropsPopover node={propsNode} allowRename allowDelete onClose={() => setPropsNodeId(null)} />
    : null

  // Modo «bare»: sin caja blanca ni header — bloques sueltos (panel del día pizarra)
  if (bare) {
    return <div className="daily-cockpit-bare" onMouseDown={openPlanner}>{groups}{propsModal}</div>
  }

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
          {data.seguimiento.length > 0 && <span className="dc-count dc-count--followup">{data.seguimiento.length} {t('daily.followupShort')}</span>}
        </span>
        <span className="dc-chevron">{collapsed ? '›' : '▾'}</span>
      </button>

      {!collapsed && <div className="dc-body">{groups}</div>}
      {propsModal}
    </div>
  )
}
