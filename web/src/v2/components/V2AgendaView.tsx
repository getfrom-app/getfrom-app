// Tab «Agenda» de Fromly 2.0 — antes eran DOS tabs separadas («Hoy» y «Agenda»);
// se fusionan en una sola (Alberto, 21 jul: "el tab de hoy debería ser Agenda y
// tener dentro del propio tab un botón para el calendario anual... con eso
// podríamos eliminar el tab de Agenda actual"). Por defecto muestra la columna
// del día de HOY (DayColumn real de v1: eventos, para hacer, seguimiento, por
// planificar); un botón abre el calendario ANUAL (12 meses) y, al pulsar un día,
// se muestra esa columna (mismo DayColumn); un botón «Hoy» vuelve directo.
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import { ensureDayPath } from '../../utils/agendaHelper'
import YearCalendarPanel from '../../components/panels/YearCalendarPanel'
import DayColumn from '../../components/panels/DayColumn'
import DocEditor from '../../components/views/DocEditor'
import DocEditorBoundary from '../../components/DocEditorBoundary'
import type { Node } from '../../types'

type SubView = 'day' | 'year'

interface Props {
  /** Nota diaria de HOY, ya resuelta por V2RightColumn (se garantiza al abrir la tab). */
  todayNode: Node | null
}

export default function V2AgendaView({ todayNode }: Props) {
  const { t } = useTranslation()
  useStore()
  const [subView, setSubView] = useState<SubView>('day')
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
      <div className="v2-agenda-toolbar" style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button
          className="v2-iconbtn"
          onClick={() => setSubView(v => v === 'year' ? 'day' : 'year')}
          title={subView === 'year' ? t('v2.rightColumn.back', 'Volver') : t('v2.agenda.openYear', 'Calendario anual')}
        >
          {subView === 'year' ? `‹ ${t('v2.rightColumn.back', 'Volver')}` : `📅 ${t('v2.agenda.year', 'Año')}`}
        </button>
        {!isToday && (
          <button
            className="v2-iconbtn"
            onClick={() => { setDayId(null); setSubView('day') }}
            title={t('v2.agenda.backToToday', 'Volver a hoy')}
          >
            {t('v2.agenda.today', 'Hoy')}
          </button>
        )}
      </div>

      {subView === 'year' ? (
        <YearCalendarPanel activeDate={null} />
      ) : shownDay ? (
        <div>
          {!isToday && <div className="v2-panel-title">{shownDay.text || t('v2.agenda.day', 'Día')}</div>}
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
