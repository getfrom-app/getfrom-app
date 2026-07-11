// Tab «Agenda» de Fromly 2.0 — vista ANUAL (12 meses, como en v1) y, al pulsar un
// día, EXACTAMENTE la misma columna que la tab «Hoy» (DayColumn real de v1: eventos,
// para hacer, seguimiento, por planificar) + espacio de escritura libre al final.
// Sin «Volver al año» (un 2º clic en la tab Agenda ya vuelve al año); sin quick-add
// aparte (los bloques de DayColumn tienen su propio «+» en la cabecera).
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import { ensureDayPath } from '../../utils/agendaHelper'
import YearCalendarPanel from '../../components/panels/YearCalendarPanel'
import DayColumn from '../../components/panels/DayColumn'
import DocEditor from '../../components/views/DocEditor'
import DocEditorBoundary from '../../components/DocEditorBoundary'

export default function V2AgendaView() {
  const { t } = useTranslation()
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
        <div className="v2-panel-title">{dayNode.text || t('v2.agenda.day', 'Día')}</div>
        {/* Eventos + tareas del día — MISMO componente que la tab «Hoy», sin bullets. */}
        <DayColumn node={dayNode} includeNodes={false} />
        {/* Espacio para escribir lo que sea, al final de todo. */}
        <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <DocEditorBoundary compact>
            <DocEditor node={dayNode} compact registerActive autofocus={false} />
          </DocEditorBoundary>
        </div>
      </div>
    )
  }

  return (
    <div>
      <YearCalendarPanel activeDate={null} />
    </div>
  )
}
