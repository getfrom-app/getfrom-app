// Panel derecho «Día por metadato» — mini-calendario mensual + todo el contenido
// del día seleccionado (due ∪ createdAt). Navega por metadato, no por jerarquía:
// clic en cualquier día → su contenido, esté donde esté en el lienzo.
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useStore } from '../../store/nodeStore'
import { firstLineTitle } from '../../utils/docNode'
import { firstContextOf, contextColor } from '../../utils/cajones'
import { nodesForDay, daysWithContent, sameDay } from '../../utils/aggregationHelper'

const WD = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function monthLabel(d: Date, lang: string): string {
  return d.toLocaleDateString(lang?.startsWith('en') ? 'en-US' : lang || 'es-ES', { month: 'long', year: 'numeric' })
}

export default function DayAggregationPanel() {
  const s = useStore()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  void s.nodesVersion

  const today = useMemo(() => new Date(), [])
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selected, setSelected] = useState<Date>(() => today)

  const withContent = useMemo(
    () => daysWithContent(month.getFullYear(), month.getMonth()),
    [month, s.nodesVersion],
  )
  const items = useMemo(() => nodesForDay(selected), [selected, s.nodesVersion])

  // rejilla del mes (lunes primero)
  const cells = useMemo(() => {
    const y = month.getFullYear(), m = month.getMonth()
    const first = new Date(y, m, 1)
    const startWd = (first.getDay() + 6) % 7 // lunes=0
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    const out: (number | null)[] = []
    for (let i = 0; i < startWd; i++) out.push(null)
    for (let d = 1; d <= daysInMonth; d++) out.push(d)
    while (out.length % 7 !== 0) out.push(null)
    return out
  }, [month])

  const go = (delta: number) => setMonth(m => new Date(m.getFullYear(), m.getMonth() + delta, 1))
  const isSelected = (d: number) => selected && sameDay(selected, new Date(month.getFullYear(), month.getMonth(), d))
  const isToday = (d: number) => sameDay(today, new Date(month.getFullYear(), month.getMonth(), d))

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '10px 12px 88px' }}>
      {/* Mini-calendario */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <button onClick={() => go(-1)} style={navBtn} aria-label={t('common.back', 'Atrás')}>‹</button>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
          {monthLabel(month, i18n.language)}
        </span>
        <button onClick={() => go(1)} style={navBtn} aria-label={t('common.forward', 'Adelante')}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {WD.map((w, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-tertiary)', padding: '2px 0' }}>{w}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((d, i) => d === null ? <div key={i} /> : (
          <button
            key={i}
            onClick={() => setSelected(new Date(month.getFullYear(), month.getMonth(), d))}
            style={{
              position: 'relative', aspectRatio: '1', border: 'none', borderRadius: 8, cursor: 'pointer',
              fontSize: 12, fontWeight: isToday(d) ? 600 : 400,
              background: isSelected(d) ? 'var(--accent)' : 'transparent',
              color: isSelected(d) ? '#fff' : isToday(d) ? 'var(--accent)' : 'var(--text-secondary)',
            }}
          >
            {d}
            {withContent.has(d) && !isSelected(d) && (
              <span style={{ position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)' }} />
            )}
          </button>
        ))}
      </div>

      {/* Encabezado del día */}
      <div style={{ margin: '14px 2px 8px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--text-tertiary)' }}>
        {sameDay(selected, today)
          ? t('dayAgg.today', 'Hoy')
          : selected.toLocaleDateString(i18n.language?.startsWith('en') ? 'en-US' : i18n.language || 'es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
        {' · '}{items.length}
      </div>

      {/* Contenido del día */}
      {items.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: '6px 2px' }}>
          {t('dayAgg.empty', 'Nada este día')}
        </div>
      ) : items.map(n => {
        const ctx = firstContextOf(n)
        return (
          <div
            key={n.id}
            onClick={() => navigate(`/node/${n.id}`)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 6px', borderRadius: 8, cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: n.status != null ? 'var(--accent)' : 'var(--text-tertiary)' }} />
            <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {firstLineTitle(n.text) || t('common.noTitle', 'Sin título')}
            </span>
            {ctx && (
              <span style={{ fontSize: 11, color: contextColor(ctx.id), whiteSpace: 'nowrap' }}>
                {firstLineTitle(ctx.text)}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

const navBtn: React.CSSProperties = {
  width: 26, height: 26, borderRadius: 6, border: 'none', background: 'transparent',
  color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 16,
}
