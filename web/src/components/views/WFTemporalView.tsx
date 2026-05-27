/**
 * WFTemporalView — Pills de mes/día estilo Workflowy
 *
 * REGLA FUNDAMENTAL: toda creación y navegación pasa por agendaHelper,
 * que garantiza la jerarquía correcta: 📅 Agenda → Año → Mes → Día.
 * El nodo `node` se usa SOLO para leer qué hijos ya existen (UI),
 * NUNCA como padre para crear nuevos nodos.
 */
import { useNavigate } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'
import {
  getOrCreateAgendaRoot,
  getOrCreateYearNode,
  getOrCreateMonthNode,
  getOrCreateDayNode,
  ensureDayPath,
} from '../../utils/agendaHelper'

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

    // Qué meses ya existen como hijos de ESTE nodo (solo para la UI)
    const existingMonths = new Set(
      store.children(node.id)
        .filter(c => !c.deletedAt)
        .map(c => c.text?.toLowerCase())
    )

    function handleMonthClick(monthIdx: number) {
      // Siempre crear/encontrar bajo Agenda → Año correcto
      const agenda = getOrCreateAgendaRoot()
      const yearN  = getOrCreateYearNode(year, agenda.id)
      const monthN = getOrCreateMonthNode(monthIdx, yearN.id)
      navigate(`/node/${monthN.id}`)
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

    // Año: obtener del padre directo (debe ser un nodo año)
    const parent = node.parentId ? s.getNode(node.parentId) : null
    const year   = parent?.text && /^\d{4}$/.test(parent.text)
      ? parseInt(parent.text)
      : new Date().getFullYear()

    if (monthIdx === -1) return null

    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate()
    const today       = new Date()

    // Días que ya existen como hijos de ESTE nodo (solo para la UI)
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
      // SIEMPRE crear/encontrar bajo Agenda → Año → Mes → Día (jerarquía correcta)
      const dayNode = ensureDayPath(dayDate)
      navigate(`/node/${dayNode.id}`)
    }

    function goToAdjacentMonth(targetMonthIdx: number) {
      // Siempre navegar dentro de Agenda → Año
      const agenda = getOrCreateAgendaRoot()
      const yearN  = getOrCreateYearNode(year, agenda.id)
      const monthN = getOrCreateMonthNode(targetMonthIdx, yearN.id)
      navigate(`/node/${monthN.id}`)
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
            <button className="wf-temporal-nav-btn" onClick={() => goToAdjacentMonth(monthIdx - 1)}>
              ‹ {MONTHS_SHORT[monthIdx - 1]}
            </button>
          )}
          {monthIdx < 11 && (
            <button className="wf-temporal-nav-btn" onClick={() => goToAdjacentMonth(monthIdx + 1)}>
              {MONTHS_SHORT[monthIdx + 1]} ›
            </button>
          )}
        </div>
      </div>
    )
  }

  return null
}
