import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'
import { TaskPropsPopover } from './DiaryRightPanel'
import PendingTaskRow from '../shared/PendingTaskRow'

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
        tasks: [],
      })
    }
    groups.get(key)!.tasks.push(task)
  }

  // Sort: grouped by parent first, standalone last
  return Array.from(groups.values()).sort((a, b) => {
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

// TaskRow: ahora delega en <PendingTaskRow> compartido. Wrapper local
// mantiene el modal y la variante visual según fecha vs ahora.
function TaskRow({ node, indented, onOpenProps }: { node: Node; checkColor?: string; indented?: boolean; onOpenProps: (n: Node) => void }) {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(todayStart.getTime() + 86400000 - 1)
  const variant: 'today' | 'overdue' | 'done' | 'future' | 'event' = (() => {
    if (node.status === 'done') return 'done'
    if (node.isEvent) return 'event'
    if (node.status === 'future') return 'future'
    if (node.due) {
      const d = new Date(node.due)
      if (d < todayStart) return 'overdue'
      if (d <= todayEnd)  return 'today'
      return 'future'
    }
    return 'today'
  })()
  return (
    <PendingTaskRow
      task={node}
      variant={variant}
      indented={indented}
      onClick={() => onOpenProps(node)}
      onOpenProps={() => onOpenProps(node)}
    />
  )
}

// ── GroupedSection ────────────────────────────────────────────────────────────

interface GroupedSectionProps {
  groups: TaskGroup[]
  checkColor?: string
  onOpenProps: (n: Node) => void
}

function GroupedSection({ groups, onOpenProps }: GroupedSectionProps) {
  return (
    <>
      {groups.map((group, gi) => (
        <div key={group.parentId ?? `standalone-${gi}`} className="cal-panel-group">
          {group.parentId && (
            <div
              className="cal-panel-group-header"
              title={group.parentText}
            >
              <span className="cal-panel-group-title">{group.parentText}</span>
              <span className="cal-panel-count">{group.tasks.length}</span>
            </div>
          )}
          {group.tasks.map(n => (
            <TaskRow key={n.id} node={n} indented={!!group.parentId} onOpenProps={onOpenProps} />
          ))}
        </div>
      ))}
    </>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

// ── Resource row ─────────────────────────────────────────────────────────────

function ResourceRow({ node }: { node: Node }) {
  const { t } = useTranslation()
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
        title={node.text || t('common.noTitle')}
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

// Helper: ancestro live container (mismo concepto que en DiaryRightPanel)
function hasLiveContainerAncestor(nodeId: string): boolean {
  let cur = store.getNode(nodeId)
  while (cur?.parentId) {
    const parent = store.getNode(cur.parentId)
    if (!parent) break
    if (store.isLiveContainer(parent)) return true
    cur = parent
  }
  return false
}

export default function CalendarSidePanel({ periodStart, periodEnd, view }: Props) {
  const s = useStore()
  const { t } = useTranslation()
  const [isDragOver, setIsDragOver] = useState(false)
  const [modalNode, setModalNode] = useState<Node | null>(null)

  const allNodes = s.allActive().filter(n => !n.deletedAt)
  const endBoundary = periodEnd || new Date(periodStart.getTime() + 86400000)

  // ── Containers vivos con ≥1 tarea pendiente SIN AGENDAR ────────────────
  // Solo el ancestro más alto (no anidamos).
  const containers = s.liveContainers({ requireUnscheduled: true })
    .filter(n => !hasLiveContainerAncestor(n.id))

  // Tareas pendientes sin agendar de un container (excluyendo descendientes
  // de otro container vivo intermedio, para no duplicar).
  function getContainerUnscheduled(containerId: string): Node[] {
    return s.containerPendingTasks(containerId, { requireUnscheduled: true })
      .sort((a, b) => a.siblingOrder - b.siblingOrder)
  }

  // Tareas SUELTAS (no descendientes de un container vivo) por categoría
  const looseSchedulable = allNodes.filter(n =>
    !n.isDiaryEntry &&
    (n.status === 'pending' || n.status === 'future') &&
    !hasLiveContainerAncestor(n.id)
  )

  // Acotamos overdue y future a una ventana razonable según vista (evita
  // mostrar "vencidas hace 5 años" o "futuras dentro de 2 años").
  const lookbackDays = view === 'day' ? 14 : view === 'week' ? 60 : view === 'month' ? 365 : 999999
  const lookaheadDays = view === 'day' ? 7 : view === 'week' ? 30 : view === 'month' ? 90 : 999999
  const minVisible = new Date(periodStart.getTime() - lookbackDays * 86400000)
  const maxVisible = new Date(endBoundary.getTime() + lookaheadDays * 86400000)
  const overdue = looseSchedulable.filter(n => {
    if (n.status !== 'pending' || !n.due) return false
    const d = new Date(n.due)
    return d < periodStart && d >= minVisible
  })
  const unscheduled = looseSchedulable.filter(n =>
    !n.due && n.status === 'pending'
  )
  const future = looseSchedulable.filter(n => {
    if (n.status !== 'pending' || !n.due) return false
    const d = new Date(n.due)
    return d >= endBoundary && d <= maxVisible
  })

  // Recursos sin agendar
  const resources = allNodes
    .filter(n => isResourceNode(n) && !n.deletedAt && !n.due && !hasLiveContainerAncestor(n.id))
    .filter(n => getResourceStatus(n) === 'pending')

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

  const navigate = (id: string) => { window.location.href = `/app/node/${id}` }

  const hasAnything = containers.length > 0 || overdue.length > 0 || unscheduled.length > 0 || future.length > 0 || resources.length > 0

  return (
    <div
      className={`cal-side-panel diary-panel-content ${isDragOver ? 'cal-side-panel--drag-over' : ''}`}
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
        <div className="cal-panel-drop-hint">{t('panel.dropToUnschedule')}</div>
      )}

      {/* Containers vivos — mismo estilo que el panel del diario */}
      {containers.map(node => {
        const childTasks = getContainerUnscheduled(node.id)
        if (childTasks.length === 0) return null
        return (
          <div key={node.id}>
            <div
              className="diary-agenda-seguimiento"
              style={{ userSelect: 'none', cursor: 'pointer' }}
              onClick={() => navigate(node.id)}
              title={node.text || 'Sin título'}
            >
              <span className="diary-agenda-container-icon">📁</span>
              <span className="diary-agenda-text">{node.text || t('common.noTitle')}</span>
              <span className="diary-agenda-container-count">{childTasks.length}</span>
            </div>
            {childTasks.map(task => (
              <TaskRow key={task.id} node={task} indented onOpenProps={setModalNode} />
            ))}
          </div>
        )
      })}

      {/* Vencidas — tareas sueltas */}
      {overdue.length > 0 && (
        <div className="cal-panel-section">
          <div className="cal-panel-label cal-panel-label--overdue">
            ⚠ Vencidas — {label}
            <span className="cal-panel-count">{overdue.length}</span>
          </div>
          <GroupedSection groups={overdueGroups} onOpenProps={setModalNode} />
        </div>
      )}

      {/* Sin fecha — tareas sueltas */}
      {unscheduled.length > 0 && (
        <div className="cal-panel-section">
          <div className="cal-panel-label">
            {t('panel.noDate')}
            <span className="cal-panel-count">{unscheduled.length}</span>
          </div>
          <GroupedSection groups={unscheduledGroups} onOpenProps={setModalNode} />
        </div>
      )}

      {/* Futuras — tareas sueltas */}
      {future.length > 0 && (
        <div className="cal-panel-section">
          <div className="cal-panel-label">
            Futuras — {futureLabel}
            <span className="cal-panel-count">{future.length}</span>
          </div>
          <GroupedSection groups={futureGroups} onOpenProps={setModalNode} />
        </div>
      )}

      {/* Recursos */}
      {resources.length > 0 && (
        <div className="cal-panel-section">
          <div className="cal-panel-label">
            {t('panel.resources')}
            <span className="cal-panel-count">{resources.length}</span>
          </div>
          {resources.map(n => <ResourceRow key={n.id} node={n} />)}
        </div>
      )}

      {!hasAnything && (
        <div className="cal-panel-empty">
          <span style={{ fontSize: 20, opacity: 0.3 }}>✓</span>
          <span>{t('panel.upcoming')}</span>
        </div>
      )}

      {modalNode && (
        <TaskPropsPopover
          node={modalNode}
          onClose={() => setModalNode(null)}
          allowRename
          allowDelete
          onDeleted={() => setModalNode(null)}
        />
      )}
    </div>
  )
}
