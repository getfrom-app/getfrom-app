import { useMemo } from 'react'
import { store, useStore } from '../../store/nodeStore'
import { diaryId } from '../../utils/deterministicId'
import type { Node } from '../../types'

interface Props {
  node: Node
  type: 'year' | 'month' | 'week'
  onNavigate: (id: string) => void
}

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAYS_ES_SHORT = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

function weekNumberFromDate(d: Date): number {
  const date = new Date(d); date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7))
  const week1 = new Date(date.getFullYear(), 0, 4)
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
}

// Encuentra el año (top-level node) buscando hacia arriba en la jerarquía.
function findAncestorYear(node: Node): number | null {
  let cur: Node | undefined = node
  while (cur) {
    if (/^\d{4}$/.test(cur.text || '')) return parseInt(cur.text)
    if (!cur.parentId) break
    cur = store.getNode(cur.parentId)
  }
  return null
}

// Devuelve el lunes ISO de la semana N de un año dado
function mondayOfIsoWeek(year: number, week: number): Date {
  // ISO week 1 = la semana del primer jueves
  const jan4 = new Date(year, 0, 4)
  const jan4Dow = (jan4.getDay() + 6) % 7  // Mon=0
  const isoWeek1Mon = new Date(jan4)
  isoWeek1Mon.setDate(jan4.getDate() - jan4Dow)
  const target = new Date(isoWeek1Mon)
  target.setDate(isoWeek1Mon.getDate() + (week - 1) * 7)
  return target
}

export default function TemporalChildrenBlock({ node, type, onNavigate }: Props) {
  const s = useStore()
  s  // suscripción

  // Resolver año del contexto
  const inferredYear = useMemo(() => findAncestorYear(node) ?? new Date().getFullYear(), [node])

  if (type === 'year') {
    // 12 meses
    const yearNum = parseInt(node.text || '0')
    return (
      <div className="temporal-children">
        <div className="temporal-children-label">Meses de {yearNum}</div>
        <div className="temporal-children-grid temporal-children-grid--months">
          {MONTHS_ES.map(m => {
            const existing = store.children(node.id).find(c => c.text === m && !c.deletedAt)
            return (
              <button
                key={m}
                className={`temporal-children-item ${existing ? 'has-content' : ''}`}
                onClick={() => {
                  if (existing) onNavigate(existing.id)
                  else {
                    const created = store.createNode({ text: m, parentId: node.id })
                    onNavigate(created.id)
                  }
                }}
              >{m}</button>
            )
          })}
        </div>
      </div>
    )
  }

  if (type === 'month') {
    // 4-5 semanas del mes
    const monthIdx = MONTHS_ES.findIndex(m => m.toLowerCase() === (node.text || '').toLowerCase())
    if (monthIdx < 0) return null
    const firstDay = new Date(inferredYear, monthIdx, 1)
    const lastDay = new Date(inferredYear, monthIdx + 1, 0)
    const weeksInMonth = new Set<number>()
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const d = new Date(inferredYear, monthIdx, day)
      weeksInMonth.add(weekNumberFromDate(d))
    }
    void firstDay
    return (
      <div className="temporal-children">
        <div className="temporal-children-label">Semanas de {node.text}</div>
        <div className="temporal-children-grid temporal-children-grid--weeks">
          {[...weeksInMonth].sort((a, b) => a - b).map(w => {
            const label = `Semana ${w}`
            const existing = store.children(node.id).find(c => c.text === label && !c.deletedAt)
            return (
              <button
                key={w}
                className={`temporal-children-item ${existing ? 'has-content' : ''}`}
                onClick={() => {
                  if (existing) onNavigate(existing.id)
                  else {
                    const created = store.createNode({ text: label, parentId: node.id })
                    onNavigate(created.id)
                  }
                }}
              >{label}</button>
            )
          })}
        </div>
      </div>
    )
  }

  // type === 'week'
  const weekNum = parseInt((node.text || '').replace(/^Semana\s+/i, ''))
  if (isNaN(weekNum)) return null
  const monday = mondayOfIsoWeek(inferredYear, weekNum)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })

  function findOrCreateDiary(date: Date): Node {
    // Buscar diary entry cuya diaryDate caiga en ese día (cualquier zona horaria)
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const targetEnd = new Date(target.getTime() + 86400000)
    const existing = [...store.nodes.values()].find(n => {
      if (!n.isDiaryEntry || n.deletedAt || !n.diaryDate) return false
      const dd = new Date(n.diaryDate)
      return dd >= target && dd < targetEnd
    })
    if (existing) return existing
    // Crear nueva (igual que store.createTodayDiary pero para fecha arbitraria)
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    const dateStr = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const created = store.createNode({
      text: dateStr.charAt(0).toUpperCase() + dateStr.slice(1),
      parentId: null,
      isDiaryEntry: true,
      diaryDate: `${y}-${m}-${dd}T00:00:00.000Z`,
      predefinedId: diaryId(date) ?? undefined,  // canónico → nunca duplica
    })
    return created
  }

  return (
    <div className="temporal-children">
      <div className="temporal-children-label">Días de la semana</div>
      <div className="temporal-children-grid temporal-children-grid--days">
        {days.map((d, i) => {
          const dayOfWeek = DAYS_ES_SHORT[d.getDay()]
          const dayNum = d.getDate()
          const monthShort = d.toLocaleDateString('es-ES', { month: 'short' })
          const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
          const targetEnd = new Date(target.getTime() + 86400000)
          const existingDiary = [...store.nodes.values()].find(n => {
            if (!n.isDiaryEntry || n.deletedAt || !n.diaryDate) return false
            const ed = new Date(n.diaryDate)
            return ed >= target && ed < targetEnd
          })
          const childCount = existingDiary ? store.children(existingDiary.id).filter(n => !n.deletedAt).length : 0
          return (
            <button
              key={i}
              className={`temporal-children-day ${existingDiary ? 'has-content' : ''}`}
              onClick={() => {
                const diary = findOrCreateDiary(d)
                onNavigate(diary.id)
              }}
            >
              <span className="temporal-children-day-dow">{dayOfWeek}</span>
              <span className="temporal-children-day-num">{dayNum}</span>
              <span className="temporal-children-day-month">{monthShort}</span>
              {childCount > 0 && <span className="temporal-children-day-badge">{childCount}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
