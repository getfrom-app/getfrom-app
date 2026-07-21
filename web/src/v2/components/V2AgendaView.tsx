// Tab «Agenda» de Fromly 2.0 — antes eran DOS tabs separadas («Hoy» y «Agenda»),
// luego se fusionaron en una (Alberto, 21 jul). Ahora también absorbe el tab
// «Día» (timeline horario embebido, Alberto 22 jul: "vamos a integrar este
// timeline del día dentro de la pestaña de agenda, y podemos eliminar así la
// pestaña de día"): tres botones, HOY / CAL / TIMELINE. Por defecto muestra la
// columna del día de HOY (DayColumn: eventos, para hacer, seguimiento, por
// planificar); CAL abre el calendario ANUAL (12 meses) y, al pulsar un día, se
// muestra esa columna (mismo DayColumn); TIMELINE abre el PlannerPanel en modo
// día (rejilla horaria, drag&drop); HOY vuelve directo al día de hoy.
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import { ensureDayPath } from '../../utils/agendaHelper'
import YearCalendarPanel from '../../components/panels/YearCalendarPanel'
import DayColumn from '../../components/panels/DayColumn'
import PlannerPanel from '../../components/panels/PlannerPanel'
import DocEditor from '../../components/views/DocEditor'
import DocEditorBoundary from '../../components/DocEditorBoundary'
import type { Node } from '../../types'

type SubView = 'day' | 'year' | 'timeline'

interface Props {
  /** Nota diaria de HOY, ya resuelta por V2RightColumn (se garantiza al abrir la tab). */
  todayNode: Node | null
}

export default function V2AgendaView({ todayNode }: Props) {
  const { t } = useTranslation()
  useStore()
  const [subView, setSubView] = useState<SubView>('day')
  // A qué subVista volver desde Año («‹ Volver») — recuerda si veníamos de Día o Timeline.
  const [beforeYear, setBeforeYear] = useState<'day' | 'timeline'>('day')
  // null = viendo HOY (todayNode); con valor = un día concreto elegido en el año.
  const [dayId, setDayId] = useState<string | null>(null)

  // La rejilla anual emite `from:set-day` al pulsar un día → aseguramos/creamos su
  // nota (Agenda→Año→Mes→Día) y la mostramos.
  useEffect(() => {
    const onSetDay = (e: Event) => {
      const iso = (e as CustomEvent).detail?.date
      if (!iso) return
      try { setDayId(ensureDayPath(new Date(iso)).id); setSubView('day') } catch { /* noop */ }
    }
    window.addEventListener('from:set-day', onSetDay as EventListener)
    return () => window.removeEventListener('from:set-day', onSetDay as EventListener)
  }, [])

  const isToday = !dayId
  const shownDay = dayId ? store.getNode(dayId) : todayNode

  return (
    <div>
      <div className="v2-agenda-toolbar">
        {subView === 'year' ? (
          <button className="v2-head-action" onClick={() => setSubView(beforeYear)} title={t('v2.rightColumn.back', 'Volver')}>
            ‹ {t('v2.rightColumn.back', 'Volver')}
          </button>
        ) : (
          <>
            {/* HOY: vuelve al día de hoy — visible si estamos viendo otro día O en
                timeline (desde ahí siempre tiene sentido volver a la lista de hoy). */}
            {(subView === 'timeline' || !isToday) && (
              <button
                className="v2-head-action"
                onClick={() => { setDayId(null); setSubView('day') }}
                title={t('v2.agenda.backToToday', 'Volver a hoy')}
              >
                {t('v2.agenda.today', 'HOY')}
              </button>
            )}
            <button
              className="v2-head-action"
              onClick={() => { setBeforeYear(subView === 'timeline' ? 'timeline' : 'day'); setSubView('year') }}
              title={t('v2.agenda.openYear', 'Calendario anual')}
            >
              {t('v2.agenda.year', 'CAL')}
            </button>
            {/* TIMELINE se oculta cuando ya está activo (mismo patrón que Año→Volver). */}
            {subView !== 'timeline' && (
              <button className="v2-head-action" onClick={() => setSubView('timeline')} title={t('v2.agenda.openTimeline', 'Vista de línea de tiempo')}>
                {t('v2.agenda.timeline', 'TIMELINE')}
              </button>
            )}
          </>
        )}
      </div>

      {subView === 'year' ? (
        <YearCalendarPanel activeDate={null} />
      ) : subView === 'timeline' ? (
        // Se «rompe» del padding/scroll de .v2-right-body (como .v2-right-fill en
        // las demás tabs) para que el PlannerPanel llene todo el alto disponible.
        <div className="v2-agenda-timeline">
          <PlannerPanel initialView="day" initialDays={1} viewTabs={['day']} onClose={() => {}} />
        </div>
      ) : shownDay ? (
        <div>
          <h2 className="v2-agenda-day-title">{shownDay.text || t('v2.agenda.day', 'Día')}</h2>
          {/* Eventos + tareas del día — MISMO componente para hoy y para un día elegido. */}
          <DayColumn node={shownDay} includeNodes={false} />
          {!isToday && (
            <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <DocEditorBoundary compact>
                <DocEditor node={shownDay} compact registerActive autofocus={false} />
              </DocEditorBoundary>
            </div>
          )}
        </div>
      ) : (
        <div className="v2-right-empty">{t('v2.rightColumn.preparingToday', 'Preparando la columna de hoy…')}</div>
      )}
    </div>
  )
}
