// Tab «Agenda» de Fromly 2.0 — vista ANUAL (12 meses, como en v1) y, al pulsar un
// día, la nota de ese día con sus eventos, tareas y espacio para escribir (DayColumn
// real de v1). Más simple que el planner de v1 pero suficiente para tomar notas o
// ponerse avisos cualquier día.
import { useEffect, useState } from 'react'
import { store, useStore } from '../../store/nodeStore'
import { ensureDayPath } from '../../utils/agendaHelper'
import YearCalendarPanel from '../../components/panels/YearCalendarPanel'
import DayColumn from '../../components/panels/DayColumn'

export default function V2AgendaView() {
  useStore()
  const [dayId, setDayId] = useState<string | null>(null)

  // La rejilla anual emite `from:set-day` al pulsar un día → aseguramos/creamos su
  // nota (Agenda→Año→Mes→Día) y la mostramos.
  useEffect(() => {
    const onSetDay = (e: Event) => {
      const iso = (e as CustomEvent).detail?.date
      if (!iso) return
      try { setDayId(ensureDayPath(new Date(iso)).id) } catch { /* noop */ }
    }
    window.addEventListener('from:set-day', onSetDay as EventListener)
    return () => window.removeEventListener('from:set-day', onSetDay as EventListener)
  }, [])

  const dayNode = dayId ? store.getNode(dayId) : null

  if (dayNode) {
    return (
      <div>
        <button className="v2-agenda-back" onClick={() => setDayId(null)}>‹ Volver al año</button>
        <div className="v2-panel-title">{dayNode.text || 'Día'}</div>
        {/* Eventos + tareas del día + espacio de notas (outliner editable). */}
        <DayColumn node={dayNode} includeNodes />
      </div>
    )
  }

  return (
    <div>
      <div className="v2-panel-title">Agenda</div>
      <YearCalendarPanel activeDate={null} />
    </div>
  )
}
