// Botón compacto que despliega un mini-calendario (popover) para saltar a otro
// día/mes/año. Al elegir un día abre su nota diaria (créala si hace falta) → la
// columna del día se pinta con la info de siempre. NO cambia esa columna ni la
// ocupa: es solo un botón que se despliega.
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '../../store/nodeStore'
import { daysWithContent, sameDay } from '../../utils/aggregationHelper'

const WD = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export default function MiniCalendar({ activeDate }: { activeDate?: Date | null }) {
  const s = useStore()
  const { t, i18n } = useTranslation()
  void s.nodesVersion

  const [open, setOpen] = useState(false)
  const today = useMemo(() => new Date(), [])
  const [month, setMonth] = useState(() => {
    const base = activeDate || today
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })

  const withContent = useMemo(
    () => open ? daysWithContent(month.getFullYear(), month.getMonth()) : new Set<number>(),
    [open, month, s.nodesVersion],
  )

  const cells = useMemo(() => {
    const y = month.getFullYear(), m = month.getMonth()
    const startWd = (new Date(y, m, 1).getDay() + 6) % 7
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
    setOpen(false)
    // No navega: cambia el DÍA de la columna derecha en el lienzo (lienzo único).
    window.dispatchEvent(new CustomEvent('from:set-day', { detail: { date: dateOf(d).toISOString() } }))
  }

  const monthLabel = month.toLocaleDateString(
    i18n.language?.startsWith('en') ? 'en-US' : i18n.language || 'es-ES',
    { month: 'long', year: 'numeric' },
  )

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(o => !o)}
        title={t('miniCal.goToDay', 'Ir a un día')}
        aria-label={t('miniCal.goToDay', 'Ir a un día')}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          height: 28, padding: '0 9px', borderRadius: 8, cursor: 'pointer',
          border: '1px solid var(--border-color)', background: open ? 'var(--bg-hover)' : 'var(--bg-secondary)',
          color: 'var(--text-secondary)', fontSize: 12.5,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1998 }} />
          <div style={{
            position: 'absolute', right: 0, top: 34, zIndex: 1999, width: 226,
            background: 'var(--bg-elevated, #fff)', border: '1px solid var(--border-color)', borderRadius: 12,
            boxShadow: '0 8px 28px rgba(0,0,0,0.16)', padding: 10,
          }}>
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
            <button
              onClick={() => { setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); openDay(today.getDate()) }}
              style={{ marginTop: 8, width: '100%', height: 28, borderRadius: 8, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12 }}
            >
              {t('miniCal.today', 'Hoy')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

const navBtn: React.CSSProperties = {
  width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent',
  color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 15,
}
