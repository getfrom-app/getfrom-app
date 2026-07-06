// DayTimeline — tira horizontal de días arriba de la columna diaria + calendario desplegable.
// Scroll horizontal a días anteriores/posteriores; clic en un día → va a ese día (from:set-day,
// mismo zoom fijo). El botón de calendario DESPLIEGA HACIA ABAJO un mes completo (con navegación
// de mes/año) inline — no un popover flotante que se cortaba. Al pulsar un día navega y se colapsa.
// Es «un lienzo con días»: se navega por la tira/mes, no por una página mensual desconectada.
import { useMemo, useRef, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '../../store/nodeStore'
import { daysWithContent, sameDay } from '../../utils/aggregationHelper'

const RANGE = 21 // días a cada lado (tira scrollable)
const WD = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export default function DayTimeline({ date }: { date: Date }) {
  const { t, i18n } = useTranslation()
  const s = useStore(); void s.nodesVersion // reactivo para los puntos de días con contenido
  const lang = i18n.language || undefined
  const scroller = useRef<HTMLDivElement>(null)
  const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
  const today = useMemo(() => new Date(), [])

  const [calOpen, setCalOpen] = useState(false)
  const [calMonth, setCalMonth] = useState(() => new Date(date.getFullYear(), date.getMonth(), 1))

  // Tira de días (±RANGE alrededor del día actual).
  const days = useMemo(() => {
    const out: Date[] = []
    for (let i = -RANGE; i <= RANGE; i++) out.push(new Date(date.getFullYear(), date.getMonth(), date.getDate() + i))
    return out
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  // Centrar el día actual en la tira al montar / cambiar de día.
  useEffect(() => {
    const sc = scroller.current
    const el = sc?.querySelector('[data-current="1"]') as HTMLElement | null
    if (sc && el) sc.scrollLeft = el.offsetLeft - sc.clientWidth / 2 + el.clientWidth / 2
  }, [key])

  const go = (d: Date) => window.dispatchEvent(new CustomEvent('from:set-day', { detail: { date: d.toISOString() } }))

  // Calendario desplegable: al abrir, arranca en el mes del día actual.
  const toggleCal = () => {
    if (!calOpen) setCalMonth(new Date(date.getFullYear(), date.getMonth(), 1))
    setCalOpen(o => !o)
  }
  const stepMonth = (n: number) => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + n, 1))
  const stepYear = (n: number) => setCalMonth(m => new Date(m.getFullYear() + n, m.getMonth(), 1))
  const pickDay = (d: number) => { go(new Date(calMonth.getFullYear(), calMonth.getMonth(), d)); setCalOpen(false) }

  const cells = useMemo(() => {
    const y = calMonth.getFullYear(), m = calMonth.getMonth()
    const start = (new Date(y, m, 1).getDay() + 6) % 7 // lunes = 0
    const dim = new Date(y, m + 1, 0).getDate()
    const out: (number | null)[] = []
    for (let i = 0; i < start; i++) out.push(null)
    for (let d = 1; d <= dim; d++) out.push(d)
    while (out.length % 7 !== 0) out.push(null)
    return out
  }, [calMonth])
  const withContent = useMemo(
    () => calOpen ? daysWithContent(calMonth.getFullYear(), calMonth.getMonth()) : new Set<number>(),
    [calOpen, calMonth, s.nodesVersion], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const monthLabel = calMonth.toLocaleDateString(lang, { month: 'long', year: 'numeric' })

  return (
    <div className="day-timeline-wrap">
      <div className="day-timeline">
        <button className={`day-timeline-calbtn${calOpen ? ' active' : ''}`} onClick={toggleCal} title={t('dayNav.calendar', 'Calendario')} aria-label={t('dayNav.calendar', 'Calendario')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
        </button>
        <div ref={scroller} className="day-timeline-strip">
          {days.map(d => {
            const cur = sameDay(d, date)
            const tod = sameDay(d, today)
            const wd = d.toLocaleDateString(lang, { weekday: 'short' }).replace('.', '')
            const label = d.toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' })
            return (
              <button
                key={d.getTime()}
                data-current={cur ? '1' : undefined}
                onClick={() => go(d)}
                title={label}
                className={`day-timeline-chip${cur ? ' day-timeline-chip--current' : ''}${tod && !cur ? ' day-timeline-chip--today' : ''}`}
              >
                <span className="day-timeline-wd">{wd}</span>
                <span className="day-timeline-num">{d.getDate()}</span>
              </button>
            )
          })}
        </div>
      </div>

      {calOpen && (
        <div className="day-timeline-cal">
          <div className="dtc-head">
            <button onClick={() => stepYear(-1)} title={t('dayNav.prevYear', 'Año anterior')} aria-label={t('dayNav.prevYear', 'Año anterior')}>«</button>
            <button onClick={() => stepMonth(-1)} title={t('dayNav.prevMonth', 'Mes anterior')} aria-label={t('dayNav.prevMonth', 'Mes anterior')}>‹</button>
            <span className="dtc-title">{monthLabel}</span>
            <button onClick={() => stepMonth(1)} title={t('dayNav.nextMonth', 'Mes siguiente')} aria-label={t('dayNav.nextMonth', 'Mes siguiente')}>›</button>
            <button onClick={() => stepYear(1)} title={t('dayNav.nextYear', 'Año siguiente')} aria-label={t('dayNav.nextYear', 'Año siguiente')}>»</button>
          </div>
          <div className="dtc-grid">
            {WD.map((w, i) => <div key={`h${i}`} className="dtc-wd">{w}</div>)}
            {cells.map((d, i) => d === null ? <div key={i} /> : (() => {
              const dd = new Date(calMonth.getFullYear(), calMonth.getMonth(), d)
              const cur = sameDay(dd, date), tod = sameDay(dd, today)
              return (
                <button key={i} onClick={() => pickDay(d)} className={`dtc-day${cur ? ' dtc-day--current' : ''}${tod && !cur ? ' dtc-day--today' : ''}`}>
                  {d}
                  {withContent.has(d) && !cur && <span className="dtc-dot" />}
                </button>
              )
            })())}
          </div>
        </div>
      )}
    </div>
  )
}
