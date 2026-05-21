import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'

type DiaryPanelTab = 'agenda' | 'timeline'

function hasSeguimientoAncestor(nodeId: string): string | null {
  let current = store.getNode(nodeId)
  while (current?.parentId) {
    const parent = store.getNode(current.parentId)
    if (!parent) break
    if (parent.isSeguimiento || (parent.types || []).includes('bucle')) return parent.id
    current = parent
  }
  return null
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

export interface DiaryRightPanelProps {
  diaryDate: Date
}

export default function DiaryRightPanel({ diaryDate }: DiaryRightPanelProps) {
  const s = useStore()
  const navigate = useNavigate()
  const [panelTab, setPanelTab] = useState<DiaryPanelTab>('agenda')

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

  // Determine if diaryDate is today
  const isToday = diaryDate.toDateString() === now.toDateString()

  // Boundaries for the diary date
  const dateStart = new Date(diaryDate.getFullYear(), diaryDate.getMonth(), diaryDate.getDate())
  const dateEnd = new Date(dateStart.getTime() + 86400000)

  function toggleTask(id: string, currentStatus: string | null) {
    const newStatus = currentStatus === 'done' ? 'pending' : 'done'
    store.updateNode(id, { status: newStatus })
  }

  // ── Agenda logic ───────────────────────────────────────────────────────

  // Nodos de seguimiento
  const seguimientoNodes = s.allActive().filter(n =>
    !n.deletedAt &&
    (n.isSeguimiento || (n.types || []).includes('bucle'))
  )

  const allPending = s.allActive().filter(
    n => n.status === 'pending' && !n.deletedAt && n.due
  )

  // Set de IDs de nodos que SON seguimiento (para excluirlos de overdue/today)
  const seguimientoIds = new Set(seguimientoNodes.map(n => n.id))

  const overdue = allPending.filter(n => {
    if (!n.due) return false
    if (seguimientoIds.has(n.id)) return false        // el nodo MISMO es seguimiento
    if (hasSeguimientoAncestor(n.id)) return false    // es hijo de seguimiento
    return new Date(n.due) < todayStart
  })

  const todayTasks = allPending.filter(n => {
    if (!n.due) return false
    if (seguimientoIds.has(n.id)) return false        // el nodo MISMO es seguimiento
    if (hasSeguimientoAncestor(n.id)) return false    // es hijo de seguimiento
    const d = new Date(n.due)
    return d >= todayStart && d <= todayEnd
  })

  function getChildTasks(nodeId: string): Node[] {
    return store.children(nodeId).filter(n => n.status === 'pending' && !n.deletedAt)
  }


  function renderAgenda() {
    const hasAnything = seguimientoNodes.length > 0 || overdue.length > 0 || todayTasks.length > 0

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
        {/* Nodos en seguimiento + sus tareas hijo */}
        {seguimientoNodes.map(node => {
          const childTasks = getChildTasks(node.id)
          return (
            <div key={node.id}>
              <div className="diary-agenda-seguimiento" onClick={() => navigate(`/node/${node.id}`)}>
                <span className="diary-agenda-checkbox diary-agenda-checkbox--seguimiento"></span>
                <span className="diary-agenda-text">{node.text || 'Sin título'}</span>
                {node.due && <span className="diary-agenda-due">{formatDue(node.due)}</span>}
              </div>
              {childTasks.map(task => (
                <div
                  key={task.id}
                  className="diary-agenda-task diary-agenda-task--indented"
                  onClick={() => navigate(`/node/${task.id}`)}
                >
                  <button
                    className="diary-agenda-checkbox diary-agenda-checkbox--seguimiento"
                    onClick={e => { e.stopPropagation(); toggleTask(task.id, task.status) }}
                  >
                    {task.status === 'done' ? '✓' : ''}
                  </button>
                  <span className={`diary-agenda-text${task.status === 'done' ? ' done' : ''}`}>
                    {task.text || 'Sin título'}
                  </span>
                  {task.due && <span className="diary-agenda-due">{formatDue(task.due)}</span>}
                </div>
              ))}
            </div>
          )
        })}

        {/* Tareas vencidas */}
        {overdue.map(task => (
          <div
            key={task.id}
            className="diary-agenda-task"
            onClick={() => navigate(`/node/${task.id}`)}
          >
            <button
              className={`diary-agenda-checkbox diary-agenda-checkbox--${task.status === 'done' ? 'done' : 'overdue'}`}
              onClick={e => { e.stopPropagation(); toggleTask(task.id, task.status) }}
            >
              {task.status === 'done' ? '✓' : ''}
            </button>
            <span className={`diary-agenda-text${task.status === 'done' ? ' done' : ''}`}>
              {task.text || 'Sin título'}
            </span>
            {task.due && <span className="diary-agenda-due">{formatDue(task.due)}</span>}
          </div>
        ))}

        {/* Tareas de hoy */}
        {todayTasks.map(task => (
          <div
            key={task.id}
            className="diary-agenda-task"
            onClick={() => navigate(`/node/${task.id}`)}
          >
            <button
              className={`diary-agenda-checkbox diary-agenda-checkbox--${task.status === 'done' ? 'done' : 'today'}`}
              onClick={e => { e.stopPropagation(); toggleTask(task.id, task.status) }}
            >
              {task.status === 'done' ? '✓' : ''}
            </button>
            <span className={`diary-agenda-text${task.status === 'done' ? ' done' : ''}`}>
              {task.text || 'Sin título'}
            </span>
            {task.due && <span className="diary-agenda-due">{formatDue(task.due)}</span>}
          </div>
        ))}
      </div>
    )
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
    if (d >= dateStart && d < dateEnd) {
      const h = d.getHours()
      if (h >= 8 && h <= 22) {
        tasksByHour[h] = tasksByHour[h] || []
        tasksByHour[h].push(n)
      }
    }
  })

  // ── Events for timeline ────────────────────────────────────────────────
  const allEvents = s.allActive().filter(n => n.isEvent && n.due && !n.deletedAt)
  const eventsByHour: Record<number, Node[]> = {}
  for (const h of hours) {
    eventsByHour[h] = []
  }
  allEvents.forEach(n => {
    if (!n.due) return
    const d = new Date(n.due)
    if (d >= dateStart && d < dateEnd) {
      const h = d.getHours()
      if (h >= 8 && h <= 22) {
        eventsByHour[h] = eventsByHour[h] || []
        eventsByHour[h].push(n)
      }
    }
  })

  function handleTimelineHourClick(h: number) {
    const clickDate = new Date(diaryDate)
    clickDate.setHours(h, 0, 0, 0)
    const newNode = store.createNode({
      text: '',
      parentId: null,
      siblingOrder: Date.now(),
      isTask: true,
    })
    store.updateNode(newNode.id, {
      isEvent: true,
      status: 'pending',
      due: clickDate.toISOString(),
    })
    navigate(`/node/${newNode.id}`)
  }

  function renderTimeline() {
    return (
      <div className="diary-panel-content timeline-panel">
        {hours.map(h => {
          const tasks = tasksByHour[h] || []
          const events = eventsByHour[h] || []
          const allItems = [...events, ...tasks]

          const showNowLine = isToday && h === currentHour

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

  // renderStats() movida a Ajustes (pendiente)
  function _renderStats_REMOVED() {
    const allNodes = s.allActive()

    // Weekly bar chart
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - 6 + i)
      d.setHours(0, 0, 0, 0)
      return d
    })
    const weekCounts = weekDays.map(day => {
      const end = new Date(day.getTime() + 86400000)
      return allNodes.filter(n => {
        if (n.isDiaryEntry || n.deletedAt) return false
        const updated = new Date(n.updatedAt)
        return updated >= day && updated < end
      }).length
    })
    const maxCount = Math.max(...weekCounts, 1)
    const barHeight = 40
    const barWidth = 24
    const gap = 4

    // Global counters
    const totalNotes = allNodes.filter(n => !n.isDiaryEntry && n.status === null).length
    const totalTasks = allNodes.filter(n => n.status !== null).length
    const doneTasks = allNodes.filter(n => n.status === 'done').length
    const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

    // Top 5 tags
    const topTags = s.allUsedTags()
      .map(t => ({ tag: t, count: s.tagNodeCount(t) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
    const maxTagCount = topTags.length > 0 ? topTags[0].count : 1

    // Streak
    const currentStreak = calculateStreak(s)

    // Diary for diaryDate (used for bullet count)
    const diaryNode = s.allActive().find(n => {
      if (!n.isDiaryEntry || n.deletedAt || !n.diaryDate) return false
      const d = new Date(n.diaryDate)
      return d >= dateStart && d < dateEnd
    }) ?? null

    return (
      <div className="diary-panel-content">
        {/* Weekly bar chart */}
        <div className="stats-section-label">Últimos 7 días</div>
        <div className="stats-week-chart">
          <svg width={(barWidth + gap) * 7 - gap} height={barHeight + 20}>
            {weekDays.map((day, i) => {
              const h = Math.max(2, (weekCounts[i] / maxCount) * barHeight)
              const isTodayBar = i === 6
              return (
                <g key={i}>
                  <rect
                    x={i * (barWidth + gap)}
                    y={barHeight - h}
                    width={barWidth}
                    height={h}
                    rx={3}
                    fill={isTodayBar ? 'var(--accent)' : weekCounts[i] > 0 ? 'var(--accent-soft, #c4b5fd)' : 'var(--bg-tertiary)'}
                  />
                  <text
                    x={i * (barWidth + gap) + barWidth / 2}
                    y={barHeight + 14}
                    textAnchor="middle"
                    fontSize={10}
                    fill={isTodayBar ? 'var(--text-accent, var(--accent))' : 'var(--text-tertiary)'}
                  >
                    {day.toLocaleDateString('es-ES', { weekday: 'narrow' })}
                  </text>
                </g>
              )
            })}
          </svg>
          <div className="stats-week-label">
            {weekCounts.reduce((a, b) => a + b, 0)} actividades esta semana
          </div>
        </div>

        {/* Global counters */}
        <div className="stats-section-label" style={{ marginTop: 12 }}>Global</div>
        <div className="stats-counters">
          <div className="stats-counter">
            <div className="stats-counter-value">{totalNotes}</div>
            <div className="stats-counter-label">Notas</div>
          </div>
          <div className="stats-counter">
            <div className="stats-counter-value">{totalTasks}</div>
            <div className="stats-counter-label">Tareas</div>
          </div>
          <div className="stats-counter">
            <div className="stats-counter-value">{doneTasks}</div>
            <div className="stats-counter-label">Completadas</div>
          </div>
          <div className="stats-counter">
            <div className="stats-counter-value">{completionRate}%</div>
            <div className="stats-counter-label">Tasa completado</div>
          </div>
        </div>

        {/* Streak */}
        {currentStreak >= 1 && (
          <>
            <div className="stats-section-label" style={{ marginTop: 12 }}>Racha</div>
            <div className="stats-counter" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <div className="stats-counter-value" style={{ fontSize: 28 }}>🔥</div>
              <div>
                <div className="stats-counter-value">{currentStreak} {currentStreak === 1 ? 'día' : 'días'}</div>
                <div className="stats-counter-label">Racha actual de diario</div>
              </div>
            </div>
          </>
        )}

        {/* Productividad del día — solo hoy */}
        {isToday && (
          <>
            <div className="stats-section-label" style={{ marginTop: 12 }}>Productividad del día</div>
            <div className="stats-counters">
              <div className="stats-counter">
                <div className="stats-counter-value">{diaryNode ? store.children(diaryNode.id).length : 0}</div>
                <div className="stats-counter-label">Bullets hoy</div>
              </div>
              <div className="stats-counter">
                <div className="stats-counter-value" style={{ color: '#22c55e' }}>
                  {allNodes.filter(n => {
                    if (n.status !== 'done') return false
                    const d = new Date(n.updatedAt)
                    return d >= todayStart && d <= todayEnd
                  }).length}
                </div>
                <div className="stats-counter-label">Tareas completadas hoy</div>
              </div>
            </div>
          </>
        )}

        {/* Hábitos — grid últimas 4 semanas */}
        <>
          <div className="stats-section-label" style={{ marginTop: 12 }}>Hábitos — últimas 4 semanas</div>
          {(() => {
            const lastMonth = Array.from({ length: 28 }, (_, i) => {
              const d = new Date()
              d.setDate(d.getDate() - 27 + i)
              d.setHours(0, 0, 0, 0)
              return d
            })
            const diaryDays = new Set(
              s.allActive()
                .filter(n => n.isDiaryEntry && n.diaryDate)
                .map(n => new Date(n.diaryDate!).toDateString())
            )
            return (
              <div className="stats-habit-grid">
                {lastMonth.map((day, i) => (
                  <div
                    key={i}
                    className={`habit-dot${diaryDays.has(day.toDateString()) ? ' habit-dot--active' : ''}${day.toDateString() === new Date().toDateString() ? ' habit-dot--today' : ''}`}
                    title={day.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                  />
                ))}
              </div>
            )
          })()}
        </>

        {/* Top tags */}
        {topTags.length > 0 && (
          <>
            <div className="stats-section-label" style={{ marginTop: 12 }}>Tags más usados</div>
            <div className="stats-tags-list">
              {topTags.map(({ tag, count }) => (
                <div key={tag} className="stats-tag-row">
                  <span className="stats-tag-name" style={{ color: store.tagColor(tag) }}>#{tag}</span>
                  <div
                    className="stats-tag-bar"
                    style={{
                      flex: 1,
                      background: 'var(--bg-tertiary)',
                      marginLeft: 6,
                      marginRight: 6,
                    }}
                  >
                    <div
                      className="stats-tag-bar"
                      style={{
                        width: `${(count / maxTagCount) * 100}%`,
                        background: store.tagColor(tag) || 'var(--accent)',
                      }}
                    />
                  </div>
                  <span className="stats-tag-count">{count}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="diary-right-panel">
      <div className="diary-panel-tabs">
        <button
          className={`diary-panel-tab${panelTab === 'agenda' ? ' active' : ''}`}
          onClick={() => setPanelTab('agenda')}
        >
          Agenda
        </button>
        <button
          className={`diary-panel-tab${panelTab === 'timeline' ? ' active' : ''}`}
          onClick={() => setPanelTab('timeline')}
        >
          Timeline
        </button>
      </div>
      {panelTab === 'agenda' ? renderAgenda() : renderTimeline()}
    </div>
  )
}
