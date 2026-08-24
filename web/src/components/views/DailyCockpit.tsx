// «Tu día» — sección calculada al inicio de la nota diaria de HOY.
// Muestra tareas atrasadas, tareas de hoy y seguimiento (sin fecha) como
// referencias a los nodos reales (nunca copia/materializa nada).
// Las filas se arrastran al planificador (dataTransfer 'nodeId') para ponerles hora,
// y al interactuar con el bloque la columna derecha cambia a planificador.
import { useState, useRef, useLayoutEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore, store } from '../../store/nodeStore'
import { collectDailyCockpit, collectUpcomingTasks } from '../../utils/dailyCockpit'
import { trashNode } from '../../utils/papeleraHelper'
import { renderInline } from '../outliner/InlineRenderer'
import { TaskPropsPopover } from '../panels/DiaryPanelComponents'
import TaskRow from '../panels/TaskRow'
import NewTaskModal from '../modals/NewTaskModal'
import type { Node } from '../../types'

const COLLAPSE_KEY = 'from_daily_cockpit_collapsed'

export default function DailyCockpit({ disablePlanner = false, bare = false, hideToday = false, hideFuture = false }: { disablePlanner?: boolean; bare?: boolean; hideToday?: boolean; hideFuture?: boolean } = {}) {
  useStore() // suscripción: re-render con cada cambio del store
  const { t, i18n } = useTranslation()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1')
  // Modal de fecha+recurrencia al tocar el badge de fecha de una tarea
  const [propsNodeId, setPropsNodeId] = useState<string | null>(null)
  // Modal de nueva tarea — «+» de la cabecera «Para hacer». Siempre HOY (esta
  // sección solo existe para el día de hoy).
  const [showNewTask, setShowNewTask] = useState(false)
  // Colapsado por bloque (cabecera clicable). Persistente.
  const [collapsedG, setCollapsedG] = useState<Set<string>>(() => {
    let set: Set<string>
    try { set = new Set(JSON.parse(localStorage.getItem('from_dc_groups_collapsed') || '[]')) } catch { set = new Set() }
    // ALGÚN DÍA colapsado por defecto (una sola vez): lo diferido no debe
    // molestar. Después se respeta la preferencia del usuario al desplegar/plegar.
    if (localStorage.getItem('from_dc_algundia_collapsed_init') !== '1') {
      set.add('algundia')
      localStorage.setItem('from_dc_groups_collapsed', JSON.stringify([...set]))
      localStorage.setItem('from_dc_algundia_collapsed_init', '1')
    }
    if (localStorage.getItem('from_dc_futuro_collapsed_init') !== '1') {
      set.add('futuro')
      localStorage.setItem('from_dc_groups_collapsed', JSON.stringify([...set]))
      localStorage.setItem('from_dc_futuro_collapsed_init', '1')
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
  const data = collectDailyCockpit()
  // Tareas con fecha en próximos días (completan «Futuro» junto a status='future').
  const upcoming = collectUpcomingTasks()

  // (Aquí se agrupaban las tareas de hoy/atrasadas por contexto. «Para hacer» pasó a
  //  ser una lista plana con el contexto como chip en cada fila, así que el mapa solo
  //  seguía vivo para excluir contextos de «Seguimiento» — ver más abajo.)

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

  function parentLabel(n: Node): string | null {
    if (!n.parentId) return null
    const p = store.getNode(n.parentId)
    if (!p || p.isDiaryEntry) return null
    return p.text || null
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
    <button className="dc-del" title={t('common.delete')} onClick={e => { e.stopPropagation(); trashNode(n.id) }}>
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10" /></svg>
    </button>
  )

  // TaskRow ÚNICO compartido con toda la app (Elementos, Contexto, otros días):
  // mismo checkbox, texto, chips de hora/día/repetición, contexto y hover en todas
  // partes — un solo componente, no una copia por pestaña que se pueda desviar.
  const renderTaskRow = (n: Node, opts: { showDue?: boolean }) => (
    <TaskRow
      key={n.id}
      node={n}
      onOpenDate={nn => setPropsNodeId(id => id === nn.id ? null : nn.id)}
      showDue={!!opts.showDue}
      dragProps={dragProps(n)}
      rowRef={registerRow(n.id)}
    />
  )

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
      {/* PARA HACER — unifica atrasadas + hoy + contextos. Las tareas se agrupan
          bajo su contexto; las que no tienen contexto, bajo «Sin contexto». Cabecera
          SIEMPRE visible (aunque no haya tareas) para poder crear la primera con el «+».
          `hideToday`: las tareas de HOY ya viven en «Eventos de hoy» (DayColumn las
          fusiona ahí con checkbox — Alberto, 22 jul: "la tarea solamente en el
          bloque eventos de hoy"), aquí solo quedan las atrasadas. */}
      {(() => {
        // Lista PLANA: todas las tareas (atrasadas + hoy) en filas de una línea, cada una
        // con su contexto como chip al lado. Sin agrupar por contexto (más concentrado).
        const open = !collapsedG.has('porhacer')
        // hideToday: TODAS las tareas de hoy (con hora o sin ella) ya viven en
        // DayColumn — con hora en «Eventos de hoy», sin hora en el bloque
        // unificado «Todo el día» (Alberto, 22 jul: "agrupar ambas cosas... que
        // se llame Todo el día"). Aquí solo quedan las atrasadas, así que el
        // título cambia de "Tareas para hoy" a "Atrasadas" para que no mienta.
        return (
          <div className="dc-group">
            <div className="dc-group-headrow">
              {gHeader('porhacer', hideToday ? t('daily.overdue', 'Atrasadas') : t('daily.tasksToday', 'Tareas para hoy'))}
              <button className="dc-group-add" onClick={() => setShowNewTask(true)} title={t('modal.newTask')}>+</button>
            </div>
            {open && data.overdue.map(n => renderTaskRow(n, { showDue: true }))}
            {open && !hideToday && data.today.map(n => renderTaskRow(n, { showDue: true }))}
          </div>
        )
      })()}
      {/* FUTURO — tareas aparcadas explícitamente (status='future') PRIMERO, y debajo
          las tareas con fecha en próximos días en orden cronológico (Alberto, 22 jul:
          "así, realmente, el bloque futuro se completa"). Colapsado por defecto. */}
      {!hideFuture && (data.future.length > 0 || upcoming.length > 0) && (
        <div className="dc-group">
          {gHeader('futuro', `Futuro · ${data.future.length + upcoming.length}`)}
          {!collapsedG.has('futuro') && data.future.map(n => renderTaskRow(n, { showDue: true }))}
          {!collapsedG.has('futuro') && upcoming.map(n => renderTaskRow(n, { showDue: true }))}
        </div>
      )}
      {/* SIN FECHA — SIEMPRE el último bloque de la columna, colapsado por defecto.
          Tareas abiertas sin fecha (excluye status='future', que ya vive en Futuro —
          Alberto, 22 jul: "excluye aquí las tareas con estado futuro"). */}
      {data.seguimiento.length > 0 && (
        <div className="dc-group">
          {gHeader('algundia', `${t('daily.noDate', 'Sin fecha')} · ${data.seguimiento.length}`)}
          {!collapsedG.has('algundia') && data.seguimiento.map(n => renderTaskRow(n, {}))}
        </div>
      )}
    </>
  )

  // Modal de fecha+recurrencia (al tocar el badge de fecha de una tarea).
  const propsNode = propsNodeId
    ? [...data.overdue, ...data.today, ...data.seguimiento, ...data.future, ...upcoming].find(n => n.id === propsNodeId)
    : null
  const propsModal = propsNode
    ? <TaskPropsPopover node={propsNode} allowRename allowDelete onClose={() => setPropsNodeId(null)} />
    : null

  // Modal de nueva tarea — «Tareas para hoy» solo vive en el día de hoy, así que
  // la fecha por defecto es HOY (Alberto, 22 jul: "se deben crear en el día de
  // hoy por defecto. Ahora mismo se crean sin fecha").
  const newTaskModal = showNewTask ? <NewTaskModal onClose={() => setShowNewTask(false)} defaultDueToday /> : null

  // Modo «bare»: sin caja blanca ni header — bloques sueltos (panel del día pizarra)
  if (bare) {
    return <div className="daily-cockpit-bare" onMouseDown={openPlanner}>{groups}{propsModal}{newTaskModal}</div>
  }

  return (
    <div
      className={`daily-cockpit ${collapsed ? 'daily-cockpit--collapsed' : ''}`}
      onMouseDown={openPlanner}
    >
      <button className="dc-header" onClick={toggleCollapsed} aria-expanded={!collapsed}>
        <span className="dc-title">{t('daily.cockpitTitle')}</span>
        <span className="dc-counts">
          {data.overdue.length > 0 && <span className="dc-count dc-count--overdue">{data.overdue.length} {t('daily.overdueShort')}</span>}
          {data.today.length > 0 && <span className="dc-count">{data.today.length} {t('daily.todayShort')}</span>}
          {data.seguimiento.length > 0 && <span className="dc-count dc-count--followup">{data.seguimiento.length} {t('daily.followupShort')}</span>}
        </span>
        <span className="dc-chevron">{collapsed ? '›' : '▾'}</span>
      </button>

      {!collapsed && <div className="dc-body">{groups}</div>}
      {propsModal}
      {newTaskModal}
    </div>
  )
}
