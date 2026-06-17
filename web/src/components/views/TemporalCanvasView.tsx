// TemporalCanvasView — la Agenda como CALENDARIO con LOD por NIVELES (estilo iPad).
// Niveles internos (NO navega entre nodos → se mantiene el "modo pizarra" y la
// toolbar es única): raíces → años → meses (3×4) → días.
//   · Zoom-in (rueda↑ / +) baja de nivel: raíces→años→meses→días→[entra al día].
//   · Zoom-out (rueda↓ / −) sube: días→meses→años→raíces.
//   · Clic en una celda baja de nivel (o entra al día / al nodo raíz).
// Transición CONTINUA (morph de 2 capas): la capa saliente se aleja/acerca y se
// desvanece mientras la entrante crece/encoge desde el lado correcto (bucear =
// crece desde pequeño; subir = encoge desde grande). Da sensación de un solo
// espacio infinito, no de pantallas separadas.

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import { ensureDayPath } from '../../utils/agendaHelper'
import { findRootByKey } from '../../utils/rootLookup'
import { takeTemporalFocus, type TemporalLevel } from '../../utils/pizarraNav'

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const MONTHS_LONG = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const WD = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

const ORDER: TemporalLevel[] = ['roots', 'years', 'months', 'days']
const MORPH_MS = 320

type Snapshot = { level: TemporalLevel; year: number; month: number }

// Foco inicial opcional: al abrir un nodo Año/Mes directamente, arrancamos el
// calendario en ese nivel/año/mes (en vez de la raíz Agenda en nivel 'months').
interface Props { focusLevel?: TemporalLevel; focusYear?: number; focusMonth?: number }

export default function TemporalCanvasView({ focusLevel, focusYear, focusMonth }: Props = {}) {
  useStore()
  const navigate = useNavigate()
  const now = new Date()

  const init = takeTemporalFocus()
  const initDate = init ? new Date(init.date) : now
  const [level, setLevel] = useState<TemporalLevel>(focusLevel ?? (init ? init.level : 'months'))
  const [year, setYear] = useState(focusYear ?? initDate.getFullYear())
  const [month, setMonth] = useState(focusMonth ?? initDate.getMonth()) // 0-11
  // Morph: capa SALIENTE (la que dejamos) + dirección. La entrante es el estado vivo.
  const [outgoing, setOutgoing] = useState<{ snap: Snapshot; dir: 'in' | 'out'; k: number } | null>(null)
  const [animK, setAnimK] = useState(0)
  const [animDir, setAnimDir] = useState<'in' | 'out'>('in')
  const outTimer = useRef<number | null>(null)
  const wheelAcc = useRef(0)
  const wheelCooldown = useRef(0)

  useEffect(() => () => { if (outTimer.current) clearTimeout(outTimer.current) }, [])

  // Días con contenido (1 pasada sobre el store). Clave "YYYY-M-D" y "YYYY-M".
  const content = useMemo(() => {
    const days = new Set<string>(); const months = new Set<string>()
    for (const n of store.nodes.values()) {
      if (!n.parentId || n.deletedAt) continue
      const p = store.getNode(n.parentId)
      if (!p || !p.isDiaryEntry || !p.diaryDate) continue
      const d = new Date(p.diaryDate)
      days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)
      months.add(`${d.getFullYear()}-${d.getMonth()}`)
    }
    return { days, months }
  }, [store.nodes.size]) // eslint-disable-line react-hooks/exhaustive-deps

  const goLevel = useCallback((next: TemporalLevel, dir: 'in' | 'out') => {
    // Snapshot de lo que dejamos → capa saliente que se anima fuera.
    setOutgoing({ snap: { level, year, month }, dir, k: animK })
    setAnimDir(dir); setAnimK(k => k + 1)
    setLevel(next)
    if (outTimer.current) clearTimeout(outTimer.current)
    outTimer.current = window.setTimeout(() => setOutgoing(null), MORPH_MS)
  }, [level, year, month, animK])

  const zoomIn = useCallback(() => {
    const i = ORDER.indexOf(level)
    if (i < ORDER.length - 1) goLevel(ORDER[i + 1], 'in')
  }, [level, goLevel])
  const zoomOut = useCallback(() => {
    const i = ORDER.indexOf(level)
    if (i > 0) goLevel(ORDER[i - 1], 'out')
  }, [level, goLevel])

  const goToday = useCallback(() => {
    setYear(now.getFullYear()); setMonth(now.getMonth())
    goLevel('days', 'in')
  }, [goLevel]) // eslint-disable-line react-hooks/exhaustive-deps

  // Rueda → cambia de nivel (acumulando para no saltar de golpe).
  const onWheel = useCallback((e: React.WheelEvent) => {
    const t = e.timeStamp
    if (t < wheelCooldown.current) return
    wheelAcc.current += e.deltaY
    if (Math.abs(wheelAcc.current) < 90) return
    const dir = wheelAcc.current < 0 ? 'in' : 'out'
    wheelAcc.current = 0
    wheelCooldown.current = t + 360
    if (dir === 'in') {
      if (level === 'days') {
        const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
        const cell = el?.closest('[data-day]') as HTMLElement | null
        const ds = cell?.getAttribute('data-day')
        if (ds) { const [y, m, d] = ds.split('-').map(Number); navigate(`/node/${ensureDayPath(new Date(y, m, d)).id}`) }
        return
      }
      zoomIn()
    } else zoomOut()
  }, [level, zoomIn, zoomOut, navigate]) // eslint-disable-line react-hooks/exhaustive-deps

  const roots = useMemo(() => {
    const home = findRootByKey('home')
    if (!home) return []
    return store.children(home.id).filter(n => !n.deletedAt)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const agendaId = useMemo(() => findRootByKey('agenda')?.id, [])

  // ── Render de UN nivel (header + rejilla). Parametrizado por nivel/año/mes para
  //    poder pintar la capa entrante (estado vivo) y la saliente (snapshot). ──
  const renderLevel = (lvl: TemporalLevel, yr: number, mo: number) => (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        {lvl !== 'roots' && <button onClick={zoomOut} title="Subir un nivel" style={hdrBtn}>‹</button>}
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text, #222)' }}>
          {lvl === 'roots' && 'From'}
          {lvl === 'years' && 'Años'}
          {lvl === 'months' && yr}
          {lvl === 'days' && `${MONTHS_LONG[mo]} ${yr}`}
        </div>
      </div>

      {lvl === 'roots' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignContent: 'flex-start' }}>
          {roots.map(r => (
            <button key={r.id} onClick={() => { if (r.id === agendaId) goLevel('years', 'in'); else navigate(`/node/${r.id}`) }}
              style={{ ...card, width: 240, height: 120 }}>
              <span style={{ fontSize: 19, fontWeight: 600 }}>{r.text || 'Sin título'}</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary,#999)' }}>{store.children(r.id).filter(c => !c.deletedAt).length} elementos</span>
            </button>
          ))}
        </div>
      )}

      {lvl === 'years' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, maxWidth: 760 }}>
          {Array.from({ length: 12 }, (_, i) => now.getFullYear() - 5 + i).map(y => (
            <button key={y} onClick={() => { setYear(y); goLevel('months', 'in') }}
              style={{ ...card, height: 84, fontSize: 22, fontWeight: y === now.getFullYear() ? 700 : 500, color: y === now.getFullYear() ? 'var(--accent,#6c5ce7)' : 'var(--text,#333)' }}>
              {y}
            </button>
          ))}
        </div>
      )}

      {lvl === 'months' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(4, 1fr)', gap: 16, flex: 1, maxWidth: 880 }}>
          {MONTHS.map((m, mi) => {
            const isThis = yr === now.getFullYear() && mi === now.getMonth()
            const has = content.months.has(`${yr}-${mi}`)
            return (
              <button key={mi} onClick={() => { setMonth(mi); goLevel('days', 'in') }}
                style={{ ...card, alignItems: 'flex-start', justifyContent: 'flex-start', padding: 16, position: 'relative',
                  border: isThis ? '2px solid var(--accent,#6c5ce7)' : card.border }}>
                <span style={{ fontSize: 18, fontWeight: 600, color: isThis ? 'var(--accent,#6c5ce7)' : 'var(--text,#333)' }}>{m.toUpperCase()}</span>
                {has && <span style={{ position: 'absolute', top: 16, right: 16, width: 7, height: 7, borderRadius: '50%', background: 'var(--accent,#6c5ce7)', opacity: 0.7 }} />}
              </button>
            )
          })}
        </div>
      )}

      {lvl === 'days' && (() => {
        const first = new Date(yr, mo, 1)
        const lead = (first.getDay() + 6) % 7
        const ndays = new Date(yr, mo + 1, 0).getDate()
        const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: ndays }, (_, i) => i + 1)]
        while (cells.length % 7 !== 0) cells.push(null)
        return (
          <div style={{ flex: 1 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0, marginBottom: 6 }}>
              {WD.map((w, i) => <div key={i} style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-secondary,#999)', padding: '4px 0' }}>{w}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: 'minmax(64px, 1fr)', gap: 6 }}>
              {cells.map((d, i) => {
                if (d == null) return <div key={i} />
                const isToday = yr === now.getFullYear() && mo === now.getMonth() && d === now.getDate()
                const has = content.days.has(`${yr}-${mo}-${d}`)
                return (
                  <button key={i} data-day={`${yr}-${mo}-${d}`} onClick={() => navigate(`/node/${ensureDayPath(new Date(yr, mo, d)).id}`)}
                    style={{ ...card, alignItems: 'flex-start', justifyContent: 'flex-start', padding: 8, position: 'relative',
                      background: isToday ? 'var(--accent-soft, rgba(108,92,231,0.10))' : card.background as string,
                      border: isToday ? '2px solid var(--accent,#6c5ce7)' : card.border }}>
                    <span style={{ fontSize: 15, fontWeight: isToday ? 700 : 500, color: isToday ? 'var(--accent,#6c5ce7)' : 'var(--text,#333)' }}>{d}</span>
                    {has && <span style={{ position: 'absolute', bottom: 8, left: 10, width: 6, height: 6, borderRadius: '50%', background: 'var(--accent,#6c5ce7)', opacity: 0.7 }} />}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })()}
    </div>
  )

  return (
    <div onWheel={onWheel} style={{
      position: 'relative', width: '100%', height: 'calc(100vh - 160px)', minHeight: 480,
      overflow: 'hidden', background: 'var(--bg, #fff)', borderRadius: 8, userSelect: 'none',
    }}>
      <style>{`
@keyframes tc-in-in{from{opacity:0;transform:scale(0.82)}to{opacity:1;transform:scale(1)}}
@keyframes tc-in-out{from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(1.35)}}
@keyframes tc-out-in{from{opacity:0;transform:scale(1.25)}to{opacity:1;transform:scale(1)}}
@keyframes tc-out-out{from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(0.78)}}`}</style>

      {/* Capa SALIENTE (snapshot del nivel que dejamos) — se anima fuera. */}
      {outgoing && (
        <div key={`out-${outgoing.k}`} style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', padding: '28px 32px 80px',
          pointerEvents: 'none', transformOrigin: 'center', animation: `tc-${outgoing.dir}-out ${MORPH_MS}ms ease-out forwards`,
        }}>
          {renderLevel(outgoing.snap.level, outgoing.snap.year, outgoing.snap.month)}
        </div>
      )}

      {/* Capa ENTRANTE (estado vivo). */}
      <div key={`in-${animK}`} style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', padding: '28px 32px 80px',
        transformOrigin: 'center', animation: `tc-${animDir}-in ${MORPH_MS}ms ease-out`,
      }}>
        {renderLevel(level, year, month)}
      </div>

      {/* Toolbar inferior ÚNICA (fija) */}
      <div style={{
        position: 'fixed', left: '50%', bottom: 22, transform: 'translateX(-50%)', zIndex: 60,
        display: 'flex', alignItems: 'center', gap: 2, padding: 5,
        background: 'var(--bg-elevated, #fff)', border: '1px solid var(--border, #e2e2e2)',
        borderRadius: 16, boxShadow: '0 6px 22px rgba(0,0,0,0.12)',
      }}>
        <button style={tbtn} title="Ir a hoy" onClick={goToday}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>
        </button>
        <div style={{ width: 1, height: 22, background: 'var(--border, #e2e2e2)', margin: '0 3px' }} />
        <button style={level === 'roots' ? tbtnOff : tbtn} disabled={level === 'roots'} title="Alejar (subir nivel)" onClick={zoomOut}>−</button>
        <span style={{ minWidth: 64, textAlign: 'center', fontSize: 12, color: 'var(--text-secondary, #888)' }}>
          {level === 'roots' ? 'From' : level === 'years' ? 'Años' : level === 'months' ? 'Meses' : 'Días'}
        </span>
        <button style={level === 'days' ? tbtnOff : tbtn} disabled={level === 'days'} title={level === 'days' ? 'Haz clic en un día para entrar' : 'Acercar (bajar nivel)'} onClick={zoomIn}>+</button>
      </div>
    </div>
  )
}

const card: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', justifyContent: 'center',
  background: 'var(--bg-elevated, #fff)', border: '1px solid var(--border, #e2e2e2)', borderRadius: 12,
  cursor: 'pointer', color: 'var(--text, #333)', textAlign: 'left', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
}
const hdrBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border,#e2e2e2)', background: 'var(--bg-elevated,#fff)',
  color: 'var(--text,#333)', cursor: 'pointer', fontSize: 18, lineHeight: 1,
}
const tbtn: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 9, border: 'none', background: 'transparent',
  color: 'var(--text, #333)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
}
const tbtnOff: React.CSSProperties = { ...tbtn, color: 'var(--text-secondary,#ccc)', cursor: 'not-allowed' }
