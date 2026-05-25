import { useState, useRef } from 'react'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'
import { TaskPropsPopover } from './DiaryRightPanel'

interface Props {
  periodStart: Date    // inicio del periodo visible
  periodEnd?: Date     // fin EXCLUSIVO del periodo visible
  view: 'day' | 'week' | 'month' | 'year'
}

// Helper: detecta si un nodo es recurso
function isResourceNode(n: Node): boolean {
  try { return !!JSON.parse(n.extraData || '{}')._resource } catch { return false }
}

// Clase de checkbox al estilo agenda diaria (colores pastel, cuadrados rellenos)
function checkboxClassForNode(n: Node, todayStart: Date, todayEnd: Date): string {
  if (n.status === 'done') return 'diary-agenda-checkbox diary-agenda-checkbox--done'
  // Recurso: cian (mantiene su identidad de recurso aunque tenga o no fecha)
  if (isResourceNode(n)) return 'diary-agenda-checkbox diary-agenda-checkbox--resource'
  // Activa (seguimiento) — lila
  if (n.isSeguimiento) return 'diary-agenda-checkbox diary-agenda-checkbox--seguimiento'
  if (n.status === 'future') return 'diary-agenda-checkbox diary-agenda-checkbox--future'
  if (n.due) {
    const d = new Date(n.due)
    if (d < todayStart) return 'diary-agenda-checkbox diary-agenda-checkbox--overdue'  // naranja
    if (d <= todayEnd)  return 'diary-agenda-checkbox diary-agenda-checkbox--today'    // amarillo
    return 'diary-agenda-checkbox diary-agenda-checkbox--future'                       // azul (futura)
  }
  return 'diary-agenda-checkbox diary-agenda-checkbox--today'                          // sin fecha → amarillo
}
function getResourceStatus(n: Node): string {
  // Modelo unificado: node.status manda. Si no hay, leemos legacy _resourceStatus
  // y mapeamos: pending→pending, consuming→pending, done→done, archived→done
  if (n.status === 'done') return 'done'
  if (n.status === 'future') return 'future'
  if (n.status === 'pending') return 'pending'
  try {
    const legacy = JSON.parse(n.extraData || '{}')._resourceStatus
    if (legacy === 'done' || legacy === 'archived') return 'done'
    if (legacy === 'pending' || legacy === 'consuming' || !legacy) return 'pending'
  } catch { /* ignore */ }
  return 'pending'
}

// ID de arrastre compartido (módulo-level, igual que en OutlinerNode)
export let calDragNodeId: string | null = null

// ── Helpers ───────────────────────────────────────────────────────────────────

function isTemporalNode(node: Node): boolean {
  return !!node.isDiaryEntry
}

interface TaskGroup {
  parentId: string | null
  parentText: string
  parentIsSeguimiento: boolean
  tasks: Node[]
}

function buildGroups(tasks: Node[], allNodes: Node[]): TaskGroup[] {
  const groups = new Map<string | null, TaskGroup>()

  for (const task of tasks) {
    const parent = task.parentId ? allNodes.find(n => n.id === task.parentId) : null
    const isRealParent = parent && !isTemporalNode(parent) && !parent.deletedAt
    const key = isRealParent ? parent!.id : null

    if (!groups.has(key)) {
      groups.set(key, {
        parentId: key,
        parentText: isRealParent ? (parent!.text || 'Sin título') : '',
        parentIsSeguimiento: isRealParent ? !!parent!.isSeguimiento : false,
        tasks: [],
      })
    }
    groups.get(key)!.tasks.push(task)
  }

  // Sort: seguimiento groups first, then grouped by parent, then standalone last
  return Array.from(groups.values()).sort((a, b) => {
    if (a.parentIsSeguimiento && !b.parentIsSeguimiento) return -1
    if (!a.parentIsSeguimiento && b.parentIsSeguimiento) return 1
    if (a.parentId && !b.parentId) return -1
    if (!a.parentId && b.parentId) return 1
    return a.parentText.localeCompare(b.parentText)
  })
}

// ── TaskCheckbox ──────────────────────────────────────────────────────────────

interface TaskCheckboxProps {
  node: Node
}

function TaskCheckbox({ node, onMarkDone }: TaskCheckboxProps & { onMarkDone?: () => void }) {
  const isDone = node.status === 'done'
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(todayStart.getTime() + 86400000 - 1)
  const cls = checkboxClassForNode(node, todayStart, todayEnd)
  return (
    <button
      className={cls}
      onClick={e => {
        e.stopPropagation()
        if (isDone) {
          store.updateNode(node.id, { status: 'pending' })
        } else if (onMarkDone) {
          onMarkDone()
        } else {
          store.updateNode(node.id, { status: 'done' })
        }
      }}
      title={isDone ? 'Marcar como pendiente' : 'Marcar como hecho'}
    >
      {isDone && '✓'}
    </button>
  )
}

// ── TaskRow ───────────────────────────────────────────────────────────────────

interface TaskRowProps {
  node: Node
  checkColor: string
  indented?: boolean
}

function TaskRow({ node, checkColor, indented }: TaskRowProps) {
  const isDone = node.status === 'done'
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [leaving, setLeaving] = useState<null | 'pulse' | 'fade'>(null)
  const rowRef = useRef<HTMLDivElement>(null!)

  function markDone() {
    if (leaving) return
    setLeaving('pulse')
    setTimeout(() => setLeaving('fade'), 700)
    setTimeout(() => {
      store.updateNode(node.id, { status: 'done' })
    }, 1200)
  }

  // Si el nodo está marcando done localmente, render con checkbox verde y fade
  const showAsDone = isDone || leaving !== null
  const fadeClass = leaving === 'fade' ? 'cal-panel-task--leaving' : ''

  return (
    <>
      <div
        ref={rowRef}
        className={`cal-panel-task ${indented ? 'cal-panel-task--indented' : ''} ${showAsDone ? 'cal-panel-task--done' : ''} ${fadeClass}`}
        draggable={!leaving}
        onDragStart={e => {
          calDragNodeId = node.id
          e.dataTransfer.setData('cal-node-id', node.id)
          e.dataTransfer.effectAllowed = 'move'
        }}
        onDragEnd={() => { calDragNodeId = null }}
        onClick={() => { if (!leaving) setPopoverOpen(v => !v) }}
        title={node.text || 'Sin título'}
      >
        {leaving ? (
          <span className="diary-agenda-checkbox diary-agenda-checkbox--done cal-panel-check-pulse">✓</span>
        ) : (
          <TaskCheckbox node={node} onMarkDone={markDone} />
        )}
        <span className="cal-panel-task-text">{node.text || 'Sin título'}</span>
        {node.due && (
          <span className="cal-panel-task-date">
            {new Date(node.due).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>
      {popoverOpen && (
        <TaskPropsPopover
          node={node}
          onClose={() => setPopoverOpen(false)}
          anchorRef={rowRef}
          allowRename
          allowDelete
        />
      )}
    </>
  )
}

// ── GroupedSection ────────────────────────────────────────────────────────────

interface GroupedSectionProps {
  groups: TaskGroup[]
  checkColor: string
}

function GroupedSection({ groups, checkColor }: GroupedSectionProps) {
  return (
    <>
      {groups.map((group, gi) => (
        <div key={group.parentId ?? `standalone-${gi}`} className="cal-panel-group">
          {group.parentId && (
            <div
              className={`cal-panel-group-header ${group.parentIsSeguimiento ? 'cal-panel-group-header--seguimiento' : ''}`}
              title={group.parentText}
            >
              <span className="cal-panel-group-title">{group.parentText}</span>
              <span className="cal-panel-count">{group.tasks.length}</span>
            </div>
          )}
          {group.tasks.map(n => (
            <TaskRow key={n.id} node={n} checkColor={checkColor} indented={!!group.parentId} />
          ))}
        </div>
      ))}
    </>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

// ── Resource row ─────────────────────────────────────────────────────────────

function ResourceRow({ node }: { node: Node }) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [leaving, setLeaving] = useState<null | 'pulse' | 'fade'>(null)
  const rowRef = useRef<HTMLDivElement>(null!)
  function markDone() {
    if (leaving) return
    setLeaving('pulse')
    setTimeout(() => setLeaving('fade'), 700)
    setTimeout(() => { store.updateNode(node.id, { status: 'done' }) }, 1200)
  }
  const fadeClass = leaving === 'fade' ? 'cal-panel-task--leaving' : ''
  return (
    <>
      <div
        ref={rowRef}
        className={`cal-panel-task cal-panel-resource ${leaving ? 'cal-panel-task--done' : ''} ${fadeClass}`}
        draggable={!leaving}
        onDragStart={e => {
          calDragNodeId = node.id
          e.dataTransfer.setData('cal-node-id', node.id)
          e.dataTransfer.effectAllowed = 'move'
        }}
        onDragEnd={() => { calDragNodeId = null }}
        onClick={() => { if (!leaving) setPopoverOpen(v => !v) }}
        title={node.text || 'Sin título'}
      >
        {leaving ? (
          <span className="diary-agenda-checkbox diary-agenda-checkbox--done cal-panel-check-pulse">✓</span>
        ) : (
          <TaskCheckbox node={node} onMarkDone={markDone} />
        )}
        <span className="cal-panel-task-text">{node.text || 'Sin título'}</span>
      </div>
      {popoverOpen && (
        <TaskPropsPopover
          node={node}
          onClose={() => setPopoverOpen(false)}
          anchorRef={rowRef}
          allowRename
          allowDelete
        />
      )}
    </>
  )
}

export default function CalendarSidePanel({ periodStart, periodEnd, view }: Props) {
  const s = useStore()
  const [isDragOver, setIsDragOver] = useState(false)

  const allNodes = s.allActive().filter(n => !n.deletedAt)
  // Programable: pending O seguimiento O recurso (cualquier cosa que se pueda planificar)
  const schedulable = allNodes.filter(n =>
    !n.isDiaryEntry &&
    (n.status === 'pending' || n.status === 'future' || n.isSeguimiento || isResourceNode(n))
  )

  const endBoundary = periodEnd || new Date(periodStart.getTime() + 86400000)

  // Overdue: pending con due ANTES del periodo visible
  const overdue = schedulable.filter(n =>
    n.status === 'pending' && n.due && new Date(n.due) < periodStart
  )

  // Sin fecha: pending/seguimiento sin due (NO recursos — esos van abajo)
  const unscheduled = schedulable.filter(n =>
    !n.due && !isResourceNode(n) && (n.status === 'pending' || n.isSeguimiento)
  )

  // Futuras: tareas con due DESPUÉS del periodo visible
  const future = schedulable.filter(n =>
    n.status === 'pending' && n.due && new Date(n.due) >= endBoundary
  )

  // Recursos pendientes SIN agendar (los agendados ya aparecen en el calendario)
  const resources = allNodes
    .filter(n => isResourceNode(n) && !n.deletedAt)
    .filter(n => !n.due)  // si tiene fecha, ya está en el calendario
    .filter(n => {
      const st = getResourceStatus(n)
      return st === 'pending'
    })

  const overdueGroups = buildGroups(overdue, allNodes)
  const unscheduledGroups = buildGroups(unscheduled, allNodes)
  const futureGroups = buildGroups(future, allNodes)

  const label = view === 'day' ? 'pendientes anteriores a hoy'
    : view === 'week' ? 'semana pasada y anteriores'
    : view === 'month' ? 'mes pasado y anteriores'
    : 'año pasado y anteriores'

  const futureLabel = view === 'day' ? 'tareas próximas'
    : view === 'week' ? 'siguientes semanas'
    : view === 'month' ? 'meses siguientes'
    : 'años siguientes'

  return (
    <div
      className={`cal-side-panel ${isDragOver ? 'cal-side-panel--drag-over' : ''}`}
      onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={e => {
        e.preventDefault()
        setIsDragOver(false)
        const nodeId = e.dataTransfer.getData('cal-node-id')
        if (nodeId) store.updateNode(nodeId, { due: null })
      }}
    >
      {isDragOver && (
        <div className="cal-panel-drop-hint">Suelta para desagendar</div>
      )}

      {/* Overdue */}
      {overdue.length > 0 && (
        <div className="cal-panel-section">
          <div className="cal-panel-label cal-panel-label--overdue">
            ⚠ Vencidas — {label}
            <span className="cal-panel-count">{overdue.length}</span>
          </div>
          <GroupedSection groups={overdueGroups} checkColor="#ef4444" />
        </div>
      )}

      {/* Sin fecha */}
      {unscheduled.length > 0 && (
        <div className="cal-panel-section">
          <div className="cal-panel-label">
            Sin fecha
            <span className="cal-panel-count">{unscheduled.length}</span>
          </div>
          <GroupedSection groups={unscheduledGroups} checkColor="#f59e0b" />
        </div>
      )}

      {/* Futuras */}
      {future.length > 0 && (
        <div className="cal-panel-section">
          <div className="cal-panel-label">
            Futuras — {futureLabel}
            <span className="cal-panel-count">{future.length}</span>
          </div>
          <GroupedSection groups={futureGroups} checkColor="#8b5cf6" />
        </div>
      )}

      {/* Recursos */}
      {resources.length > 0 && (
        <div className="cal-panel-section">
          <div className="cal-panel-label">
            Recursos
            <span className="cal-panel-count">{resources.length}</span>
          </div>
          {resources.map(n => <ResourceRow key={n.id} node={n} />)}
        </div>
      )}

      {overdue.length === 0 && unscheduled.length === 0 && future.length === 0 && resources.length === 0 && (
        <div className="cal-panel-empty">
          <span style={{ fontSize: 20, opacity: 0.3 }}>✓</span>
          <span>Todo agendado</span>
        </div>
      )}
    </div>
  )
}
