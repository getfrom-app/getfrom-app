// «Tu día» — sección calculada al inicio de la nota diaria de HOY.
// Muestra tareas atrasadas, tareas de hoy y seguimiento (sin fecha) como
// referencias a los nodos reales (nunca copia/materializa nada).
// Las filas se arrastran al planificador (dataTransfer 'nodeId') para ponerles hora,
// y al interactuar con el bloque la columna derecha cambia a planificador.
import { useState, useRef, useLayoutEffect, type CSSProperties } from 'react'
import { openNodeDetail } from '../../utils/canvasNav'
import { useTranslation } from 'react-i18next'
import { useStore, store } from '../../store/nodeStore'
import { collectDailyCockpit } from '../../utils/dailyCockpit'
import { trashNode } from '../../utils/papeleraHelper'
import { renderInline } from '../outliner/InlineRenderer'
import { TaskPropsPopover } from '../panels/DiaryPanelComponents'
import TaskRow from '../panels/TaskRow'
import NewTaskModal from '../modals/NewTaskModal'
import { listActiveContexts, contextColor, contextParent, nodesInContext, isContextClosed, setContextClosed, firstContextOf, clearContextParent, convertToTask } from '../../utils/cajones'
import ContextChip from '../panels/ContextChip'
import type { Node } from '../../types'

const COLLAPSE_KEY = 'from_daily_cockpit_collapsed'

const ctxMenuItem: CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none',
  cursor: 'pointer', font: 'inherit', fontSize: 13, color: 'var(--text-primary)',
  padding: '7px 10px', borderRadius: 6,
}

export default function DailyCockpit({ disablePlanner = false, bare = false }: { disablePlanner?: boolean; bare?: boolean } = {}) {
  useStore() // suscripción: re-render con cada cambio del store
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1')
  // Menú contextual de las filas de CONTEXTO + animación de salida.
  const [ctxMenu, setCtxMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const [ctxClosing, setCtxClosing] = useState<{ id: string; action: 'close' | 'delete' } | null>(null)
  // Modal de fecha+recurrencia al tocar el badge de fecha de una tarea
  const [propsNodeId, setPropsNodeId] = useState<string | null>(null)
  // Modal de nueva tarea — «+» de la cabecera «Para hacer». Siempre HOY (esta
  // sección solo existe para el día de hoy).
  const [showNewTask, setShowNewTask] = useState(false)
  // Colapsado por bloque (cabecera clicable). Persistente.
  const [collapsedG, setCollapsedG] = useState<Set<string>>(() => {
    let set: Set<string>
    try { set = new Set(JSON.parse(localStorage.getItem('from_dc_groups_collapsed') || '[]')) } catch { set = new Set() }
    // SEGUIMIENTO y ALGÚN DÍA colapsados por defecto (una sola vez): lo diferido no
    // debe molestar. Después se respeta la preferencia del usuario al desplegar/plegar.
    if (localStorage.getItem('from_dc_seg_collapsed_init') !== '1') {
      set.add('seguimiento')
      localStorage.setItem('from_dc_groups_collapsed', JSON.stringify([...set]))
      localStorage.setItem('from_dc_seg_collapsed_init', '1')
    }
    if (localStorage.getItem('from_dc_algundia_collapsed_init') !== '1') {
      set.add('algundia')
      localStorage.setItem('from_dc_groups_collapsed', JSON.stringify([...set]))
      localStorage.setItem('from_dc_algundia_collapsed_init', '1')
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

  // ── Tareas de hoy/atrasadas que pertenecen a un CONTEXTO ──────────────────
  // Se muestran bajo su contexto (sección Contextos), NO en las listas planas de
  // Atrasadas / Para hoy. Las que no tienen contexto siguen en sus listas.
  // ctxTasks: qué contextos tienen tareas de hoy/atrasadas (para separar «Seguimiento»,
  // que son los contextos SIN tareas de hoy). Las tareas ya se muestran planas en «Para hacer».
  const ctxTasks = new Map<string, { ctx: Node; overdue: Node[]; today: Node[] }>()
  const bucket = (n: Node, kind: 'overdue' | 'today') => {
    const c = firstContextOf(n)
    if (!c) return
    let e = ctxTasks.get(c.id)
    if (!e) { e = { ctx: c, overdue: [], today: [] }; ctxTasks.set(c.id, e) }
    e[kind].push(n)
  }
  for (const n of data.overdue) bucket(n, 'overdue')
  for (const n of data.today) bucket(n, 'today')

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

  // ── Reparto de contextos ───────────────────────────────────────────────────
  // «Para hacer» = contextos con tareas de hoy/atrasadas. «Seguimiento» = SOLO
  // subcontextos abiertos sin tareas de hoy (los RAÍZ son entidad superior y nunca
  // salen salvo que tengan tareas de hoy → «Para hacer»). Los contextos en estado
  // «Algún día» viven en su árbol, no en la columna del día.
  const activeCtxs = listActiveContexts()
  const seguimientoCtxs = activeCtxs.filter(c => !ctxTasks.has(c.id) && !!contextParent(c.id))

  // Fila de un contexto (dot color + padre + contadores + tareas anidadas si las
  // hay). Reutilizada en «Para hacer» y «Seguimiento».
  const renderCtxRow = (c: Node) => {
    const color = contextColor(c.id)
    const parent = contextParent(c.id)
    const n = nodesInContext(c.id).length
    const closing = ctxClosing?.id === c.id
    const due = ctxTasks.get(c.id)
    return (
      <div key={c.id}>
        <div className={`dc-row dc-row--cajon${closing ? ' dc-row--closing' : ''}`}
          draggable
          onDragStart={e => { e.dataTransfer.setData('nodeId', c.id); e.dataTransfer.effectAllowed = 'copy' }}
          onClick={() => openNodeDetail(c.id)}
          onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ id: c.id, x: e.clientX, y: e.clientY }) }}
          onAnimationEnd={closing ? () => {
            if (ctxClosing!.action === 'close') setContextClosed(c.id, true)
            else trashNode(c.id)
            setCtxClosing(null)
          } : undefined}>
          {/* Dot del color del contexto — mismo estilo/grosor/alineamiento
              que los dots del bloque «Eventos de hoy» (.dc-event-dot). */}
          <span className="dc-event-dot" style={{ background: color }} aria-label={t('common.context')} />
          <span className="dc-text">{c.text || 'Contexto'}</span>
          {parent && (
            <ContextChip context={parent} title={t('dailyCockpit.goParentContext')}
              removeTitle="Quitar del contexto padre"
              onClick={e => { e.stopPropagation(); openNodeDetail(parent.id) }}
              onRemove={() => clearContextParent(c.id)} />
          )}
          <span style={{ flex: 1 }} />
          {due && (due.overdue.length + due.today.length) > 0 && (
            <span style={{ fontSize: 11, fontWeight: 600, color: due.overdue.length > 0 ? 'var(--danger,#e03131)' : color }}>
              {due.overdue.length + due.today.length}
            </span>
          )}
          {n > 0 && <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 6 }}>{n}</span>}
        </div>
        {due && (
          <div className="dc-ctx-tasks" style={{ paddingLeft: 18 }}>
            {due.overdue.map(t => renderTaskRow(t, { showDue: true }))}
            {due.today.map(t => renderTaskRow(t, {}))}
          </div>
        )}
      </div>
    )
  }

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
          SIEMPRE visible (aunque no haya tareas) para poder crear la primera con el «+». */}
      {(() => {
        // Lista PLANA: todas las tareas (atrasadas + hoy) en filas de una línea, cada una
        // con su contexto como chip al lado. Sin agrupar por contexto (más concentrado).
        const open = !collapsedG.has('porhacer')
        return (
          <div className="dc-group">
            <div className="dc-group-headrow">
              {gHeader('porhacer', 'Para hacer')}
              <button className="dc-group-add" onClick={() => setShowNewTask(true)} title={t('modal.newTask')}>+</button>
            </div>
            {open && data.overdue.map(n => renderTaskRow(n, { showDue: true }))}
            {open && data.today.map(n => renderTaskRow(n, { showDue: true }))}
          </div>
        )
      })()}
      {/* SEGUIMIENTO — solo contextos abiertos sin tareas de hoy (las tareas sin
          fecha ya NO viven aquí: bajan a «Por planificar»). */}
      {seguimientoCtxs.length > 0 && (
        <div className="dc-group">
          {gHeader('seguimiento', `${t('daily.followup')} · ${seguimientoCtxs.length}`, 'dc-group-label--followup')}
          {!collapsedG.has('seguimiento') && seguimientoCtxs.map(renderCtxRow)}
        </div>
      )}
      {/* POR PLANIFICAR — colapsado por defecto. Tareas SIN FECHA que hay que agendar
          (filosofía Fromly: nada se queda sin un cuándo). Los contextos en estado
          «Algún día» NO viven aquí: están en su árbol de contextos. */}
      {data.seguimiento.length > 0 && (
        <div className="dc-group">
          {gHeader('algundia', `Por planificar · ${data.seguimiento.length}`)}
          {!collapsedG.has('algundia') && data.seguimiento.map(n => renderTaskRow(n, {}))}
        </div>
      )}

      {/* Menú contextual de una fila de contexto: abrir/cerrar · eliminar */}
      {ctxMenu && (() => {
        const c = store.getNode(ctxMenu.id)
        if (!c) return null
        const closed = isContextClosed(c)
        const canClose = !!contextParent(c.id) // SOLO subcontextos cambian de estado (los raíz no)
        return (
          <>
            <div onClick={() => setCtxMenu(null)} onContextMenu={e => { e.preventDefault(); setCtxMenu(null) }}
              style={{ position: 'fixed', inset: 0, zIndex: 1998 }} />
            <div style={{ position: 'fixed', top: ctxMenu.y, left: ctxMenu.x, zIndex: 1999, minWidth: 170,
              background: 'var(--bg-elevated,#fff)', border: '1px solid var(--border,#e2e2e2)', borderRadius: 10, padding: 5, boxShadow: '0 8px 28px rgba(0,0,0,0.16)' }}>
              {canClose && (
                <button className="dc-ctxmenu-item" style={ctxMenuItem}
                  onClick={() => { if (closed) { setContextClosed(ctxMenu.id, false); setCtxMenu(null) } else { setCtxClosing({ id: ctxMenu.id, action: 'close' }); setCtxMenu(null) } }}>
                  {closed ? '↻ Reabrir contexto' : '✓ Cerrar contexto'}
                </button>
              )}
              <button className="dc-ctxmenu-item" style={ctxMenuItem}
                onClick={() => { convertToTask(ctxMenu.id); setCtxMenu(null) }}>
                ☑ Convertir en tarea
              </button>
              <button className="dc-ctxmenu-item" style={{ ...ctxMenuItem, color: 'var(--danger,#e03131)' }}
                onClick={() => { setCtxClosing({ id: ctxMenu.id, action: 'delete' }); setCtxMenu(null) }}>
                🗑 Eliminar
              </button>
            </div>
          </>
        )
      })()}
    </>
  )

  // Modal de fecha+recurrencia (al tocar el badge de fecha de una tarea).
  const propsNode = propsNodeId
    ? [...data.overdue, ...data.today, ...data.seguimiento].find(n => n.id === propsNodeId)
    : null
  const propsModal = propsNode
    ? <TaskPropsPopover node={propsNode} allowRename allowDelete onClose={() => setPropsNodeId(null)} />
    : null

  // Modal de nueva tarea (siempre HOY — «Para hacer» solo vive en el día de hoy).
  const newTaskModal = showNewTask ? <NewTaskModal onClose={() => setShowNewTask(false)} /> : null

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
