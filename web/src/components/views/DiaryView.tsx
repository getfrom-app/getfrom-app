import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'
import Outliner from '../outliner/Outliner'

type DiaryPanelTab = 'pending' | 'timeline'

function getDiaryForDate(date: Date): Node | null {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const end = new Date(start.getTime() + 86400000)
  for (const node of store.nodes.values()) {
    if (!node.isDiaryEntry || node.deletedAt) continue
    if (!node.diaryDate) continue
    const d = new Date(node.diaryDate)
    if (d >= start && d < end) return node
  }
  return null
}

function isBucle(n: Node): boolean {
  return (n.types?.includes('bucle') ?? false) && n.status !== 'done' && !n.deletedAt
}

function hasLoopAncestor(nodeId: string): boolean {
  let current = store.getNode(nodeId)
  while (current?.parentId) {
    const parent = store.getNode(current.parentId)
    if (!parent) break
    if (parent.types?.includes('bucle')) return true
    current = parent
  }
  return false
}

function formatDue(due: string): string {
  const d = new Date(due)
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  if (d >= todayStart && d <= todayEnd) {
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

function TaskChip({ task, indented, toggleTask }: { task: Node; indented?: boolean; toggleTask: (id: string, status: string | null) => void }) {
  const navigate = useNavigate()
  return (
    <div
      className={`diary-task-chip${indented ? ' indented' : ''}`}
      onClick={() => navigate(`/node/${task.id}`)}
    >
      <input
        type="checkbox"
        className="diary-task-check"
        checked={task.status === 'done'}
        onChange={e => {
          e.stopPropagation()
          toggleTask(task.id, task.status)
        }}
        onClick={e => e.stopPropagation()}
      />
      <span className={`diary-task-text${task.status === 'done' ? ' done' : ''}`}>
        {task.text || 'Sin título'}
      </span>
      {task.due && <span className="diary-task-due">{formatDue(task.due)}</span>}
    </div>
  )
}

export default function DiaryView() {
  const s = useStore()
  const navigate = useNavigate()
  const [dateOffset, setDateOffset] = useState(0)
  const [panelTab, setPanelTab] = useState<DiaryPanelTab>('pending')

  const targetDate = new Date()
  targetDate.setDate(targetDate.getDate() + dateOffset)

  const diary = dateOffset === 0 ? s.todayDiary() : getDiaryForDate(targetDate)

  if (s.isSyncing && !diary) {
    return <div className="view-loading">Cargando...</div>
  }

  const date = targetDate
  const dayName = date.toLocaleDateString('es-ES', { weekday: 'long' })
  const dateStr = date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

  function formatOffsetLabel(): string {
    if (dateOffset === 0) return 'Hoy'
    if (dateOffset === -1) return 'Ayer'
    if (dateOffset === 1) return 'Mañana'
    return dateStr
  }

  // ── Time boundaries ────────────────────────────────────────────────────
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

  function toggleTask(id: string, currentStatus: string | null) {
    const newStatus = currentStatus === 'done' ? 'pending' : 'done'
    store.updateNode(id, { status: newStatus })
  }

  // ── Pending tasks logic ────────────────────────────────────────────────

  // All active bucles
  const bucles = dateOffset === 0
    ? s.allActive().filter(n => isBucle(n))
    : []

  // For each bucle, get its pending children
  function getBucleChildren(bucleId: string): Node[] {
    return store.children(bucleId).filter(
      n => n.status !== null && n.status !== 'done' && !n.deletedAt
    )
  }

  const allPending = s.allActive().filter(
    n => n.status === 'pending' && !n.deletedAt
  )

  const overdue = allPending.filter(n => {
    if (!n.due) return false
    if (hasLoopAncestor(n.id)) return false
    return new Date(n.due) < todayStart
  })

  const todayTasks = allPending.filter(n => {
    if (!n.due) return false
    if (hasLoopAncestor(n.id)) return false
    const d = new Date(n.due)
    return d >= todayStart && d <= todayEnd
  })

  const noDateTasks = allPending.filter(n => {
    if (n.due) return false
    if (isBucle(n)) return false
    if (hasLoopAncestor(n.id)) return false
    return true
  }).slice(0, 10)

  // ── Add bullet to today's diary ────────────────────────────────────────
  function handleAddBullet() {
    const todayDiary = s.todayDiary()
    if (!todayDiary) return
    const children = store.children(todayDiary.id)
    const maxOrder = children.reduce((max, n) => Math.max(max, n.siblingOrder), 0)
    store.createNode({
      text: '',
      parentId: todayDiary.id,
      siblingOrder: maxOrder + 1000,
    })
  }

  // ── Timeline logic ─────────────────────────────────────────────────────
  const hours = Array.from({ length: 15 }, (_, i) => i + 8)
  const currentHour = now.getHours()
  const currentMinutes = now.getMinutes()

  const allDayTasks = s.allActive().filter(n => n.status !== null && !n.deletedAt && n.due)

  const tasksByHour: Record<number, Node[]> = {}
  for (const h of hours) {
    tasksByHour[h] = []
  }
  allDayTasks.forEach(n => {
    if (!n.due) return
    const d = new Date(n.due)
    if (d >= todayStart && d <= todayEnd) {
      const h = d.getHours()
      if (h >= 8 && h <= 22) {
        tasksByHour[h] = tasksByHour[h] || []
        tasksByHour[h].push(n)
      }
    }
  })

  // ── Render panels ──────────────────────────────────────────────────────

  function renderPending() {
    const hasBucles = bucles.length > 0
    const hasAnything = hasBucles || overdue.length > 0 || todayTasks.length > 0 || noDateTasks.length > 0

    if (!hasAnything) {
      return (
        <div className="diary-panel-content">
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px 8px' }}>
            Nada pendiente hoy
          </div>
        </div>
      )
    }

    return (
      <div className="diary-panel-content">

        {/* Bucles abiertos — solo hoy */}
        {hasBucles && (
          <div className="diary-pending-section">
            <div className="diary-pending-label" style={{ color: 'var(--accent)' }}>Bucles abiertos</div>
            {bucles.map(bucle => {
              const children = getBucleChildren(bucle.id)
              return (
                <div key={bucle.id} className="diary-bucle-section">
                  <div
                    className="diary-bucle-header"
                    onClick={() => navigate(`/node/${bucle.id}`)}
                  >
                    <span className="diary-bucle-icon">↺</span>
                    <span className="diary-bucle-text">{bucle.text || 'Sin título'}</span>
                  </div>
                  {children.length > 0 && (
                    <div className="diary-bucle-children">
                      {children.map(child => (
                        <TaskChip
                          key={child.id}
                          task={child}
                          indented
                          toggleTask={toggleTask}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Vencidas */}
        {overdue.length > 0 && (
          <div className="diary-pending-section">
            <div className="diary-pending-label" style={{ color: '#ef4444' }}>Vencidas</div>
            {overdue.map(t => (
              <TaskChip key={t.id} task={t} toggleTask={toggleTask} />
            ))}
          </div>
        )}

        {/* Para hoy */}
        {todayTasks.length > 0 && (
          <div className="diary-pending-section">
            <div className="diary-pending-label">Para hoy</div>
            {todayTasks.map(t => (
              <TaskChip key={t.id} task={t} toggleTask={toggleTask} />
            ))}
          </div>
        )}

        {/* Sin fecha */}
        {noDateTasks.length > 0 && (
          <div className="diary-pending-section">
            <div className="diary-pending-label">Sin fecha</div>
            {noDateTasks.map(t => (
              <TaskChip key={t.id} task={t} toggleTask={toggleTask} />
            ))}
          </div>
        )}
      </div>
    )
  }

  function renderTimeline() {
    return (
      <div className="diary-panel-content">
        {hours.map(h => {
          const isCurrentHour = h === currentHour
          const tasks = tasksByHour[h] || []
          return (
            <div key={h}>
              {isCurrentHour && (
                <div
                  className="timeline-now-line"
                  title={`${currentHour}:${String(currentMinutes).padStart(2, '0')}`}
                />
              )}
              <div className="timeline-row">
                <span className="timeline-hour-label">{String(h).padStart(2, '0')}:00</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, flex: 1 }}>
                  {tasks.map(t => (
                    <span
                      key={t.id}
                      className="timeline-task-chip"
                      onClick={() => navigate(`/node/${t.id}`)}
                      title={t.text || 'Sin título'}
                    >
                      {t.text || 'Sin título'}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ── Diary bullet stats ────────────────────────────────────────────────
  const diaryChildren = diary ? store.children(diary.id) : []
  const bulletCount = diaryChildren.length
  const taskChildren = diaryChildren.filter(n => n.status !== null && !n.deletedAt)
  const doneChildren = taskChildren.filter(n => n.status === 'done')

  return (
    <div className="view diary-view">
      <div className="diary-layout">
        {/* Left: outliner */}
        <div className="diary-main">
          <div className="view-header">
            <div className="diary-date">
              {/* Day name — large emphasis when today */}
              <span className={`diary-day${dateOffset === 0 ? ' diary-day--today' : ''}`}>
                {dayName.charAt(0).toUpperCase() + dayName.slice(1)}
              </span>
              <span className="diary-full-date">{dateStr}</span>

              {/* Bullet stats */}
              {diary && bulletCount > 0 && (
                <span className="diary-bullet-stats">
                  {bulletCount} {bulletCount === 1 ? 'bullet' : 'bullets'}
                  {taskChildren.length > 0 && (
                    <> · {taskChildren.length} {taskChildren.length === 1 ? 'tarea' : 'tareas'} · {doneChildren.length} completadas</>
                  )}
                </span>
              )}

              <div className="diary-nav">
                <button
                  className="diary-nav-btn"
                  onClick={() => setDateOffset(d => d - 1)}
                  title="Día anterior"
                >
                  ← Ayer
                </button>
                {dateOffset < 0 && (
                  <button
                    className="diary-nav-btn diary-nav-btn--today"
                    onClick={() => setDateOffset(0)}
                    title="Volver a hoy"
                  >
                    Hoy
                  </button>
                )}
                <button
                  className="diary-nav-btn"
                  onClick={() => setDateOffset(d => d + 1)}
                  disabled={dateOffset >= 0}
                  title="Día siguiente"
                  style={{ opacity: dateOffset >= 0 ? 0.3 : 1 }}
                >
                  Mañana →
                </button>
                {dateOffset === 0 && (
                  <button
                    className="diary-add-bullet"
                    onClick={handleAddBullet}
                    title="Añadir bullet"
                  >
                    +
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="view-body">
            {diary ? (
              <Outliner
                parentId={diary.id}
                autoFocusEmpty
                placeholder="Escribe lo que está en tu mente..."
                className="diary-outliner"
              />
            ) : (
              <div className="view-empty-state" style={{ padding: '32px 0' }}>
                <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>
                  No hay entrada de diario para este día
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: panel */}
        <div className="diary-right-panel">
          <div className="diary-panel-tabs">
            <button
              className={`diary-panel-tab${panelTab === 'pending' ? ' active' : ''}`}
              onClick={() => setPanelTab('pending')}
            >
              Pendiente
            </button>
            <button
              className={`diary-panel-tab${panelTab === 'timeline' ? ' active' : ''}`}
              onClick={() => setPanelTab('timeline')}
            >
              Timeline
            </button>
          </div>
          {panelTab === 'pending' ? renderPending() : renderTimeline()}
        </div>
      </div>
    </div>
  )
}
