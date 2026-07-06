// DayTimeline — tira horizontal de días arriba de la columna diaria. Scroll horizontal
// a días anteriores/posteriores; clic en un día → va a ese día (from:set-day, mismo zoom
// fijo). El icono de calendario (MiniCalendar) abre el popover para saltar a cualquier fecha.
// Es «un lienzo con días»: navegas por la tira, no por una página mensual desconectada.
import { useMemo, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import MiniCalendar from './MiniCalendar'

const RANGE = 21 // días a cada lado (tira scrollable)

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export default function DayTimeline({ date }: { date: Date }) {
  const { i18n } = useTranslation()
  const lang = i18n.language || undefined
  const scroller = useRef<HTMLDivElement>(null)
  const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
  const today = useMemo(() => new Date(), [])

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

  return (
    <div className="day-timeline">
      <MiniCalendar activeDate={date} />
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
  )
}
