import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'
import Outliner from '../outliner/Outliner'

type DiaryPanelTab = 'pending' | 'timeline' | 'agenda'

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
  const [hovered, setHovered] = useState(false)
  return (
    <div
      className={`diary-task-chip${indented ? ' indented' : ''}`}
      onClick={() => navigate(`/node/${task.id}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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
      {hovered && task.status !== 'done' && (
        <div className="task-chip-quick-dates" onClick={e => e.stopPropagation()}>
          <button
            className="quick-date-btn"
            title="Hoy"
            onClick={e => {
              e.stopPropagation()
              store.updateNode(task.id, { due: new Date(new Date().setHours(23, 59, 0, 0)).toISOString() })
            }}
          >⏰</button>
          <button
            className="quick-date-btn"
            title="Mañana"
            onClick={e => {
              e.stopPropagation()
              const t = new Date()
              t.setDate(t.getDate() + 1)
              t.setHours(9, 0, 0, 0)
              store.updateNode(task.id, { due: t.toISOString() })
            }}
          >☀️</button>
          <button
            className="quick-date-btn"
            title="Próxima semana"
            onClick={e => {
              e.stopPropagation()
              const t = new Date()
              const day = t.getDay()
              const daysUntilMonday = day === 0 ? 1 : 8 - day
              t.setDate(t.getDate() + daysUntilMonday)
              t.setHours(9, 0, 0, 0)
              store.updateNode(task.id, { due: t.toISOString() })
            }}
          >📅</button>
          <button
            className="quick-date-btn"
            title="Sin fecha"
            onClick={e => {
              e.stopPropagation()
              store.updateNode(task.id, { due: null })
            }}
          >✕</button>
        </div>
      )}
    </div>
  )
}

function calculateStreak(s: ReturnType<typeof useStore>): number {
  const diaries = s.allActive()
    .filter(n => n.isDiaryEntry && !n.deletedAt && n.diaryDate)
    .sort((a, b) => (b.diaryDate ?? '').localeCompare(a.diaryDate ?? ''))

  if (diaries.length === 0) return 0
  let streak = 1
  let lastDate = new Date(diaries[0].diaryDate!)

  for (let i = 1; i < diaries.length; i++) {
    const d = new Date(diaries[i].diaryDate!)
    const diff = Math.round((lastDate.getTime() - d.getTime()) / 86400000)
    if (diff === 1) { streak++; lastDate = d }
    else break
  }
  return streak
}

export default function DiaryView() {
  const s = useStore()
  const navigate = useNavigate()
  const [dateOffset, setDateOffset] = useState(0)
  const [panelTab, setPanelTab] = useState<DiaryPanelTab>('pending')

  const streak = calculateStreak(s)

  const targetDate = new Date()
  targetDate.setDate(targetDate.getDate() + dateOffset)

  const diary = dateOffset === 0 ? s.todayDiary() : getDiaryForDate(targetDate)

  const isLoadingDiary = s.isSyncing && !diary

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

  // Nodos raíz con tareas pendientes (proyectos activos)
  const activeProjects = s.allActive()
    .filter(n => n.parentId === null && !n.isDiaryEntry && !n.deletedAt && n.status === null)
    .filter(rootNode => {
      const children = store.children(rootNode.id)
      return children.some(c => c.status === 'pending' && !c.deletedAt)
    })
    .slice(0, 5)

  // ── Panel stats ────────────────────────────────────────────────────────
  const todayStartStr = todayStart.toDateString()
  const doneToday = s.allActive().filter(n => {
    if (n.status !== 'done' || n.deletedAt) return false
    if (!n.updatedAt) return false
    return new Date(n.updatedAt).toDateString() === todayStartStr
  })

  function renderPending() {
    const hasBucles = bucles.length > 0
    const hasAnything = hasBucles || overdue.length > 0 || todayTasks.length > 0 || noDateTasks.length > 0

    const statsHeader = (
      <div className="diary-panel-stats">
        <div className="diary-panel-stat">
          <span className="diary-panel-stat-num" style={{ color: 'var(--accent)' }}>{todayTasks.length}</span>
          <span className="diary-panel-stat-label">hoy</span>
        </div>
        <div className="diary-panel-stat">
          <span className="diary-panel-stat-num" style={{ color: '#22c55e' }}>{doneToday.length}</span>
          <span className="diary-panel-stat-label">hechas</span>
        </div>
        <div className="diary-panel-stat">
          <span className="diary-panel-stat-num" style={{ color: '#ef4444' }}>{overdue.length}</span>
          <span className="diary-panel-stat-label">vencidas</span>
        </div>
      </div>
    )

    if (!hasAnything) {
      return (
        <div className="diary-panel-content">
          {statsHeader}
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px 8px' }}>
            Nada pendiente hoy
          </div>
          {activeProjects.length > 0 && (
            <div className="diary-pending-section">
              <div className="diary-pending-label" style={{ color: 'var(--text-secondary)' }}>Proyectos activos</div>
              {activeProjects.map(proj => {
                const pendingCount = store.children(proj.id).filter(c => c.status === 'pending' && !c.deletedAt).length
                return (
                  <div
                    key={proj.id}
                    className="diary-task-chip"
                    onClick={() => navigate(`/node/${proj.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="diary-task-text">{proj.text || 'Sin título'}</span>
                    <span className="diary-task-due" style={{ marginLeft: 'auto' }}>({pendingCount})</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )
    }

    return (
      <div className="diary-panel-content">
        {statsHeader}

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

        {/* Proyectos activos */}
        {activeProjects.length > 0 && (
          <div className="diary-pending-section">
            <div className="diary-pending-label" style={{ color: 'var(--text-secondary)' }}>Proyectos activos</div>
            {activeProjects.map(proj => {
              const pendingCount = store.children(proj.id).filter(c => c.status === 'pending' && !c.deletedAt).length
              return (
                <div
                  key={proj.id}
                  className="diary-task-chip"
                  onClick={() => navigate(`/node/${proj.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <span className="diary-task-text">{proj.text || 'Sin título'}</span>
                  <span className="diary-task-due" style={{ marginLeft: 'auto' }}>({pendingCount})</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── Events for timeline ────────────────────────────────────────────────
  const allEvents = s.allActive().filter(n => n.isEvent && n.due && !n.deletedAt)
  const eventsByHour: Record<number, Node[]> = {}
  for (const h of hours) {
    eventsByHour[h] = []
  }
  allEvents.forEach(n => {
    if (!n.due) return
    const d = new Date(n.due)
    if (d >= todayStart && d <= todayEnd) {
      const h = d.getHours()
      if (h >= 8 && h <= 22) {
        eventsByHour[h] = eventsByHour[h] || []
        eventsByHour[h].push(n)
      }
    }
  })

  function handleTimelineHourClick(h: number) {
    const date = new Date(targetDate)
    date.setHours(h, 0, 0, 0)
    const newNode = store.createNode({
      text: '',
      parentId: null,
      siblingOrder: Date.now(),
      isTask: true,
    })
    store.updateNode(newNode.id, {
      isEvent: true,
      status: 'pending',
      due: date.toISOString(),
    })
    navigate(`/node/${newNode.id}`)
  }

  function renderTimeline() {
    return (
      <div className="diary-panel-content timeline-panel">
        {hours.map(h => {
          const isCurrentHour = dateOffset === 0 && h === currentHour
          const tasks = tasksByHour[h] || []
          const events = eventsByHour[h] || []
          const allItems = [...events, ...tasks]

          // Show now-line just before current hour row
          const showNowLine = dateOffset === 0 && h === currentHour

          return (
            <div key={h}>
              {showNowLine && (
                <div
                  className="timeline-now-line"
                  title={`Ahora: ${String(currentHour).padStart(2, '0')}:${String(currentMinutes).padStart(2, '0')}`}
                >
                  <span className="timeline-now-dot" />
                  <span className="timeline-now-rule" />
                </div>
              )}
              <div className="timeline-row">
                <span className="timeline-hour-label">{String(h).padStart(2, '0')}:00</span>
                <div
                  className="timeline-hour-clickable"
                  onClick={() => handleTimelineHourClick(h)}
                  title={`Crear evento a las ${String(h).padStart(2, '0')}:00`}
                >
                  {allItems.map(t => (
                    <span
                      key={t.id}
                      className={t.isEvent ? 'timeline-event-chip' : 'timeline-task-chip'}
                      onClick={e => { e.stopPropagation(); navigate(`/node/${t.id}`) }}
                      title={t.text || 'Sin título'}
                    >
                      {t.isEvent ? '📅 ' : ''}{t.text || 'Sin título'}
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

  const EXCLUDED_TYPES = ['bucle', 'agente', 'prompt', 'evento', 'tarea']
  const dayTags = [...new Set(
    diaryChildren.flatMap(n => n.types || [])
      .filter(t => !EXCLUDED_TYPES.includes(t))
  )]


  function renderAgenda() {
    // Próximos 7 días con sus tareas
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() + i)
      d.setHours(0, 0, 0, 0)
      return d
    })
    return (
      <div className="diary-panel-content">
        {days.map(day => {
          const dayEnd = new Date(day.getTime() + 86400000)
          const dayTasks = s.allActive().filter(n => {
            if (!n.due || n.deletedAt) return false
            const d = new Date(n.due)
            return d >= day && d < dayEnd
          })
          const isToday = day.toDateString() === new Date().toDateString()
          if (dayTasks.length === 0 && !isToday) return null
          return (
            <div key={day.toISOString()} className="agenda-day">
              <div className={`agenda-day-label${isToday ? ' today' : ''}`}>
                {isToday ? 'Hoy' : day.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
              </div>
              {dayTasks.length === 0 && <div className="agenda-empty">Sin tareas</div>}
              {dayTasks.map(t => (
                <div key={t.id} className="diary-task-chip" onClick={() => navigate(`/node/${t.id}`)}>
                  <input type="checkbox" className="diary-task-check"
                    checked={t.status === 'done'}
                    onChange={e => { e.stopPropagation(); store.updateNode(t.id, { status: t.status === 'done' ? 'pending' : 'done' }) }}
                    onClick={e => e.stopPropagation()}
                  />
                  <span className={`diary-task-text${t.status === 'done' ? ' done' : ''}`}>{t.text || 'Sin título'}</span>
                  {t.due && <span className="diary-task-due">{new Date(t.due).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    )
  }

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

              {/* Tag counter */}
              {diary && dayTags.length > 0 && (
                <div className="diary-day-tags">
                  {dayTags.map(t => (
                    <span key={t} className="diary-day-tag" style={{ color: store.tagColor(t) }}>#{t}</span>
                  ))}
                </div>
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
            {isLoadingDiary ? (
              <div className="diary-skeleton" style={{ padding: '16px 0' }}>
                <style>{`
                  .skeleton-line { height: 14px; background: var(--bg-tertiary); border-radius: 4px; margin: 8px 0; animation: skeletonPulse 1.5s ease-in-out infinite; }
                  @keyframes skeletonPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
                `}</style>
                <div className="skeleton-line" style={{ width: '72%' }} />
                <div className="skeleton-line" style={{ width: '55%' }} />
                <div className="skeleton-line" style={{ width: '85%' }} />
              </div>
            ) : diary ? (
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
            <button
              className={`diary-panel-tab${panelTab === 'agenda' ? ' active' : ''}`}
              onClick={() => setPanelTab('agenda')}
            >
              Agenda
            </button>
          </div>
          {panelTab === 'pending' ? renderPending() : panelTab === 'timeline' ? renderTimeline() : renderAgenda()}
        </div>
      </div>
    </div>
  )
}
