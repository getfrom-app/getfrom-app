// YearCalendarPanel — calendario ANUAL en la columna derecha: 12 mini-meses (3×4),
// días en pequeño, aprovechando el ancho de la columna. Clic en un día → viaja a ese día
// (from:set-day) → vuelve la columna del día + el lienzo del día. Sustituye a la antigua
// «página mensual» y al mini-calendario desplegable. Navegación de año (‹ ›).
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '../../store/nodeStore'
import { daysWithContent, sameDay } from '../../utils/aggregationHelper'

const WD = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function MiniMonth({ year, month, today, activeDate, lang, onPick }: {
  year: number; month: number; today: Date; activeDate: Date | null; lang: string | undefined
  onPick: (d: Date) => void
}) {
  const s = useStore(); void s.nodesVersion
  const withContent = useMemo(() => daysWithContent(year, month), [year, month, s.nodesVersion])
  const cells = useMemo(() => {
    const start = (new Date(year, month, 1).getDay() + 6) % 7 // lunes = 0
    const dim = new Date(year, month + 1, 0).getDate()
    const out: (number | null)[] = []
    for (let i = 0; i < start; i++) out.push(null)
    for (let d = 1; d <= dim; d++) out.push(d)
    return out
  }, [year, month])
  const monthName = new Date(year, month, 1).toLocaleDateString(lang, { month: 'long' })
  return (
    <div className="yc-month">
      <div className="yc-month-name">{monthName}</div>
      <div className="yc-grid">
        {WD.map((w, i) => <div key={`h${i}`} className="yc-wd">{w}</div>)}
        {cells.map((d, i) => {
          if (d === null) return <div key={i} className="yc-empty" />
          const dd = new Date(year, month, d)
          const cur = activeDate ? sameDay(dd, activeDate) : false
          const tod = sameDay(dd, today)
          return (
            <button
              key={i}
              className={`yc-day${cur ? ' yc-day--current' : ''}${tod && !cur ? ' yc-day--today' : ''}`}
              onClick={() => onPick(dd)}
              title={dd.toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            >
              {d}
              {withContent.has(d) && !cur && <span className="yc-dot" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function YearCalendarPanel({ activeDate }: { activeDate?: Date | null }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language || undefined
  const today = useMemo(() => new Date(), [])
  const [year, setYear] = useState(() => (activeDate ?? new Date()).getFullYear())

  const pick = (d: Date) => window.dispatchEvent(new CustomEvent('from:set-day', { detail: { date: d.toISOString() } }))

  return (
    <div className="yearcal-panel">
      <div className="yc-head">
        <button className="yc-navbtn" onClick={() => setYear(y => y - 1)} title={t('dayNav.prevYear', 'Año anterior')} aria-label={t('dayNav.prevYear', 'Año anterior')}>‹</button>
        <span className="yc-year">{year}</span>
        <button className="yc-navbtn" onClick={() => setYear(y => y + 1)} title={t('dayNav.nextYear', 'Año siguiente')} aria-label={t('dayNav.nextYear', 'Año siguiente')}>›</button>
        <button className="yc-today" onClick={() => setYear(today.getFullYear())} title={t('dayNav.today', 'Hoy')}>{t('dayNav.today', 'Hoy')}</button>
      </div>
      <div className="yc-months">
        {Array.from({ length: 12 }, (_, m) => (
          <MiniMonth key={m} year={year} month={m} today={today} activeDate={activeDate ?? null} lang={lang} onPick={pick} />
        ))}
      </div>
    </div>
  )
}
