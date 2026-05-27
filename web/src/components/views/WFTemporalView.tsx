/**
 * WFTemporalView — Renderizado especial para nodos temporales en WF mode
 * Año → pills de meses
 * Mes → strip horizontal de días
 */
import { useNavigate } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const DAYS_SHORT = ['Do','Lu','Ma','Mi','Ju','Vi','Sá']

interface Props {
  node: Node
  temporalType: 'year' | 'month' | 'diary'
}

export default function WFTemporalView({ node, temporalType }: Props) {
  const navigate = useNavigate()
  const s = useStore()

  // Find or create Calendar root node
  function getOrCreateCalendarRoot(): Node {
    const roots = store.children(null)
    const existing = roots.find(n => !n.deletedAt && (n.text?.toLowerCase() === 'calendario' || n.text?.toLowerCase() === 'calendar'))
    if (existing) return existing
    return store.createNode({ text: 'Calendario', parentId: null })
  }

  // Navigate to year node (find or create)
  async function goToYear(year: number) {
    const calNode = getOrCreateCalendarRoot()
    const yearText = String(year)
    const existing = store.children(calNode.id).find(c => !c.deletedAt && c.text === yearText)
    if (existing) { navigate(`/node/${existing.id}`); return }
    const y = store.createNode({ text: yearText, parentId: calNode.id })
    navigate(`/node/${y.id}`)
  }

  // Navigate to month (find or create under year)
  async function goToMonth(year: number, monthIdx: number) {
    const calNode = getOrCreateCalendarRoot()
    const yearText = String(year)
    let yearNode = store.children(calNode.id).find(c => !c.deletedAt && c.text === yearText)
    if (!yearNode) {
      yearNode = store.createNode({ text: yearText, parentId: calNode.id })
    }
    const monthText = MONTHS_ES[monthIdx]
    const existing = store.children(yearNode.id).find(c => !c.deletedAt && c.text?.toLowerCase() === monthText.toLowerCase())
    if (existing) { navigate(`/node/${existing.id}`); return }
    const m = store.createNode({ text: monthText, parentId: yearNode.id })
    navigate(`/node/${m.id}`)
  }

  // Navigate to day (find or create under month)
  async function goToDay(year: number, monthIdx: number, day: number) {
    const calNode = getOrCreateCalendarRoot()
    const yearText = String(year)
    let yearNode = store.children(calNode.id).find(c => !c.deletedAt && c.text === yearText)
    if (!yearNode) {
      yearNode = store.createNode({ text: yearText, parentId: calNode.id })
    }
    const monthText = MONTHS_ES[monthIdx]
    let monthNode = store.children(yearNode.id).find(c => !c.deletedAt && c.text?.toLowerCase() === monthText.toLowerCase())
    if (!monthNode) {
      monthNode = store.createNode({ text: monthText, parentId: yearNode.id })
    }

    // Find existing diary entry for this day
    const existing = store.children(monthNode.id).find(c => {
      if (c.deletedAt) return false
      if (c.diaryDate) {
        const d = new Date(c.diaryDate)
        return d.getFullYear() === year && d.getMonth() === monthIdx && d.getDate() === day
      }
      return false
    })
    if (existing) { navigate(`/node/${existing.id}`); return }

    // Create day node
    const dayDate = new Date(year, monthIdx, day, 0, 0, 0, 0)
    const dayText = dayDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
      .replace(/^\w/, c => c.toUpperCase())
    const d = store.createNode({
      text: dayText,
      parentId: monthNode.id,
      isDiaryEntry: true,
      diaryDate: dayDate.toISOString()
    })
    navigate(`/node/${d.id}`)
  }

  if (temporalType === 'year') {
    const year = parseInt(node.text || String(new Date().getFullYear()))
    const existingMonths = new Set(
      store.children(node.id).filter(c => !c.deletedAt).map(c => c.text?.toLowerCase())
    )
    return (
      <div className="wf-temporal-year">
        <div className="wf-temporal-months-grid">
          {MONTHS_ES.map((month, i) => (
            <button
              key={month}
              className={`wf-temporal-month-pill ${existingMonths.has(month.toLowerCase()) ? 'exists' : ''}`}
              onClick={() => goToMonth(year, i)}
            >
              {MONTHS_SHORT[i]}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (temporalType === 'month') {
    const monthText = node.text || ''
    const monthIdx = MONTHS_ES.findIndex(m => m.toLowerCase() === monthText.toLowerCase())
    const parent = node.parentId ? s.getNode(node.parentId) : null
    const year = parent?.text && /^\d{4}$/.test(parent.text) ? parseInt(parent.text) : new Date().getFullYear()
    if (monthIdx === -1) return null

    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate()
    const today = new Date()
    const existingDays = new Set<number>()
    store.children(node.id).filter(c => !c.deletedAt && c.diaryDate).forEach(c => {
      const d = new Date(c.diaryDate!)
      if (d.getMonth() === monthIdx && d.getFullYear() === year) existingDays.add(d.getDate())
    })

    return (
      <div className="wf-temporal-month">
        <div className="wf-temporal-days-strip">
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
            const d = new Date(year, monthIdx, day)
            const isToday = today.getFullYear() === year && today.getMonth() === monthIdx && today.getDate() === day
            const exists = existingDays.has(day)
            return (
              <button
                key={day}
                className={`wf-temporal-day-pill ${isToday ? 'today' : ''} ${exists ? 'exists' : ''}`}
                onClick={() => goToDay(year, monthIdx, day)}
              >
                <span className="wf-temporal-day-weekday">{DAYS_SHORT[d.getDay()]}</span>
                <span className="wf-temporal-day-num">{day}</span>
              </button>
            )
          })}
        </div>
        <div className="wf-temporal-month-nav">
          {monthIdx > 0 && (
            <button className="wf-temporal-nav-btn" onClick={() => goToMonth(year, monthIdx - 1)}>
              ‹ {MONTHS_SHORT[monthIdx - 1]}
            </button>
          )}
          {monthIdx < 11 && (
            <button className="wf-temporal-nav-btn" onClick={() => goToMonth(year, monthIdx + 1)}>
              {MONTHS_SHORT[monthIdx + 1]} ›
            </button>
          )}
        </div>
      </div>
    )
  }

  return null
}
