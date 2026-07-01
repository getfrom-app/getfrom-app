// Mini-calendario mensual para la columna derecha del día. Pinchar un día abre
// su nota diaria (créala si hace falta) → la columna del día se pinta con la
// info de siempre (eventos, para hacer, seguimiento…). NO cambia esa columna;
// solo permite saltar a otro día/mes/año. Por defecto resalta el día abierto.
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useStore } from '../../store/nodeStore'
import { daysWithContent, sameDay } from '../../utils/aggregationHelper'
import { ensureDiaryForDate } from '../../utils/diaryNav'

const WD = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export default function MiniCalendar({ activeDate }: { activeDate?: Date | null }) {
  const s = useStore()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  void s.nodesVersion

  const today = useMemo(() => new Date(), [])
  const [month, setMonth] = useState(() => {
    const base = activeDate || today
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })

  const withContent = useMemo(
    () => daysWithContent(month.getFullYear(), month.getMonth()),
    [month, s.nodesVersion],
  )

  const cells = useMemo(() => {
    const y = month.getFullYear(), m = month.getMonth()
    const startWd = (new Date(y, m, 1).getDay() + 6) % 7 // lunes = 0
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    const out: (number | null)[] = []
    for (let i = 0; i < startWd; i++) out.push(null)
    for (let d = 1; d <= daysInMonth; d++) out.push(d)
    while (out.length % 7 !== 0) out.push(null)
    return out
  }, [month])

  const go = (delta: number) => setMonth(m => new Date(m.getFullYear(), m.getMonth() + delta, 1))
  const dateOf = (d: number) => new Date(month.getFullYear(), month.getMonth(), d)
  const isActive = (d: number) => !!activeDate && sameDay(activeDate, dateOf(d))
  const isToday = (d: number) => sameDay(today, dateOf(d))

  const openDay = (d: number) => {
    const diary = ensureDiaryForDate(dateOf(d))
    navigate(`/node/${diary.id}`)
  }

  const monthLabel = month.toLocaleDateString(
    i18n.language?.startsWith('en') ? 'en-US' : i18n.language || 'es-ES',
    { month: 'long', year: 'numeric' },
  )

  return (
    <div style={{ padding: '4px 6px 10px', borderBottom: '1px solid var(--border-color)', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <button onClick={() => go(-1)} style={navBtn} aria-label={t('common.back', 'Atrás')}>‹</button>
        <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{monthLabel}</span>
        <button onClick={() => go(1)} style={navBtn} aria-label={t('common.forward', 'Adelante')}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {WD.map((w, i) => (
          <div key={`h${i}`} style={{ textAlign: 'center', fontSize: 9.5, color: 'var(--text-tertiary)', paddingBottom: 2 }}>{w}</div>
        ))}
        {cells.map((d, i) => d === null ? <div key={i} /> : (
          <button
            key={i}
            onClick={() => openDay(d)}
            style={{
              position: 'relative', aspectRatio: '1', border: 'none', borderRadius: 6, cursor: 'pointer',
              fontSize: 11.5, fontWeight: isToday(d) ? 600 : 400,
              background: isActive(d) ? 'var(--accent)' : 'transparent',
              color: isActive(d) ? '#fff' : isToday(d) ? 'var(--accent)' : 'var(--text-secondary)',
            }}
          >
            {d}
            {withContent.has(d) && !isActive(d) && (
              <span style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', width: 3, height: 3, borderRadius: '50%', background: 'var(--accent)' }} />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

const navBtn: React.CSSProperties = {
  width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent',
  color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 15,
}
