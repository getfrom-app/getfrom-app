/**
 * WFTemporalView — Pills de mes/día estilo Workflowy
 * Año  → 12 pills de meses  (Jan…Dec)
 * Mes  → strip horizontal de días  (1…31)
 *
 * Al hacer click en una pill:
 *   - Si el nodo ya existe → navega a él
 *   - Si no existe         → lo crea como hijo del nodo actual y navega
 *
 * Los nodos hijo se ordenan en la vista via prop temporalSort del Outliner.
 */
import { useNavigate } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'

const MONTHS_ES    = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const DAYS_SHORT   = ['Do','Lu','Ma','Mi','Ju','Vi','Sá']

interface Props {
  node: Node
  temporalType: 'year' | 'month' | 'diary'
}

export default function WFTemporalView({ node, temporalType }: Props) {
  const navigate = useNavigate()
  const s = useStore()

  // ── Año → Pills de meses ──────────────────────────────────────────────────
  if (temporalType === 'year') {
    const year = parseInt(node.text || String(new Date().getFullYear()))

    // Qué meses ya existen como hijos del nodo año
    const existingMonths = new Set(
      store.children(node.id)
        .filter(c => !c.deletedAt)
        .map(c => c.text?.toLowerCase())
    )

    function handleMonthClick(monthIdx: number) {
      const monthText = MONTHS_ES[monthIdx]
      // Buscar hijo existente
      const existing = store.children(node.id).find(
        c => !c.deletedAt && c.text?.toLowerCase() === monthText.toLowerCase()
      )
      if (existing) { navigate(`/node/${existing.id}`); return }
      // Crear como hijo del nodo año actual
      const m = store.createNode({ text: monthText, parentId: node.id })
      navigate(`/node/${m.id}`)
    }

    return (
      <div className="wf-temporal-year">
        <div className="wf-temporal-months-grid">
          {MONTHS_ES.map((month, i) => (
            <button
              key={month}
              className={`wf-temporal-month-pill${existingMonths.has(month.toLowerCase()) ? ' exists' : ''}`}
              onClick={() => handleMonthClick(i)}
            >
              {MONTHS_SHORT[i]}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── Mes → Strip de días ───────────────────────────────────────────────────
  if (temporalType === 'month') {
    const monthText = node.text || ''
    const monthIdx  = MONTHS_ES.findIndex(m => m.toLowerCase() === monthText.toLowerCase())
    // Año: buscar en el nodo padre (debe ser el nodo año)
    const parent = node.parentId ? s.getNode(node.parentId) : null
    const year   = parent?.text && /^\d{4}$/.test(parent.text)
      ? parseInt(parent.text)
      : new Date().getFullYear()
    if (monthIdx === -1) return null

    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate()
    const today       = new Date()

    // Días que ya tienen nodo hijo
    const existingDays = new Set<number>()
    store.children(node.id)
      .filter(c => !c.deletedAt && c.diaryDate)
      .forEach(c => {
        const d = new Date(c.diaryDate!)
        if (d.getFullYear() === year && d.getMonth() === monthIdx) {
          existingDays.add(d.getDate())
        }
      })

    function handleDayClick(day: number) {
      const dayDate = new Date(year, monthIdx, day, 0, 0, 0, 0)
      // Buscar nodo existente por diaryDate
      const existing = store.children(node.id).find(c => {
        if (c.deletedAt || !c.diaryDate) return false
        const d = new Date(c.diaryDate)
        return d.getFullYear() === year && d.getMonth() === monthIdx && d.getDate() === day
      })
      if (existing) { navigate(`/node/${existing.id}`); return }
      // Crear nodo día como hijo del nodo mes
      const dayText = dayDate.toLocaleDateString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long'
      }).replace(/^\w/, c => c.toUpperCase())
      const d = store.createNode({
        text: dayText,
        parentId: node.id,
        isDiaryEntry: true,
        diaryDate: dayDate.toISOString(),
      })
      navigate(`/node/${d.id}`)
    }

    // Navegar a mes anterior / siguiente (crea si no existe)
    function goToAdjacentMonth(targetMonthIdx: number) {
      const targetText = MONTHS_ES[targetMonthIdx]
      if (!parent) return
      const existing = store.children(parent.id).find(
        c => !c.deletedAt && c.text?.toLowerCase() === targetText.toLowerCase()
      )
      if (existing) { navigate(`/node/${existing.id}`); return }
      const m = store.createNode({ text: targetText, parentId: parent.id })
      navigate(`/node/${m.id}`)
    }

    return (
      <div className="wf-temporal-month">
        <div className="wf-temporal-days-strip">
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
            const d       = new Date(year, monthIdx, day)
            const isToday = today.getFullYear() === year &&
                            today.getMonth()    === monthIdx &&
                            today.getDate()     === day
            const exists  = existingDays.has(day)
            return (
              <button
                key={day}
                className={`wf-temporal-day-pill${isToday ? ' today' : ''}${exists ? ' exists' : ''}`}
                onClick={() => handleDayClick(day)}
              >
                <span className="wf-temporal-day-weekday">{DAYS_SHORT[d.getDay()]}</span>
                <span className="wf-temporal-day-num">{day}</span>
              </button>
            )
          })}
        </div>
        <div className="wf-temporal-month-nav">
          {monthIdx > 0 && (
            <button
              className="wf-temporal-nav-btn"
              onClick={() => goToAdjacentMonth(monthIdx - 1)}
            >
              ‹ {MONTHS_SHORT[monthIdx - 1]}
            </button>
          )}
          {monthIdx < 11 && (
            <button
              className="wf-temporal-nav-btn"
              onClick={() => goToAdjacentMonth(monthIdx + 1)}
            >
              {MONTHS_SHORT[monthIdx + 1]} ›
            </button>
          )}
        </div>
      </div>
    )
  }

  return null
}
