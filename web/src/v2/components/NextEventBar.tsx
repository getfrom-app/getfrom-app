// "Lo próximo" — franja fija con el siguiente elemento con hora, siempre
// visible (26 ago 2026, Alberto: "un pequeño apartado de 'Lo próximo' con el
// siguiente evento a la hora que sea... siempre mostrará el siguiente evento
// sea cuando sea para que el usuario lo tenga presente"). Colapsada: solo el
// texto del más próximo, a la derecha. Un botón la expande, deslizando el
// texto hacia la izquierda para enseñar varios separados por "·". Se pone en
// rojo bajo 1h, parpadea bajo 15min (un clic detiene el parpadeo — "para que
// no sea incómodo"), y se mantiene resaltada mientras el elemento está en
// curso. Al terminar, el siguiente ocupa su sitio solo (recalculado cada
// tick). Activable/desactivable en Ajustes → Apariencia.
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '../../store/nodeStore'
import { listUpcomingTimed, isNextEventBarEnabled, NEXT_EVENT_BAR_CHANGED, type UpcomingItem } from '../../utils/nextEvent'
import Icon from './Icon'

const HOUR_MS = 3600_000
const QUARTER_MS = 900_000

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fmtWhen(d: Date, now: Date, t: any): string {
  const dayMs = 86400_000
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diffDays = Math.round((startOfDay(d) - startOfDay(now)) / dayMs)
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  const dayLabel =
    diffDays === 0 ? t('nextEvent.today', 'Hoy')
    : diffDays === 1 ? t('nextEvent.tomorrow', 'Mañana')
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  return `${dayLabel} ${t('nextEvent.at', 'a las')} ${time}`
}

function urgency(item: UpcomingItem, now: Date): 'normal' | 'soon' | 'blink' | 'ongoing' {
  const toStart = item.due.getTime() - now.getTime()
  const ongoing = now >= item.due && now < item.dueEnd
  if (ongoing) return 'ongoing'
  if (toStart > 0 && toStart <= QUARTER_MS) return 'blink'
  if (toStart > 0 && toStart <= HOUR_MS) return 'soon'
  return 'normal'
}

export default function NextEventBar() {
  const { t } = useTranslation()
  const s = useStore()
  const [enabled, setEnabled] = useState(isNextEventBarEnabled())
  const [now, setNow] = useState(() => new Date())
  const [expanded, setExpanded] = useState(false)
  const [blinkStopped, setBlinkStopped] = useState<Set<string>>(new Set())

  useEffect(() => {
    const onChange = () => setEnabled(isNextEventBarEnabled())
    window.addEventListener(NEXT_EVENT_BAR_CHANGED, onChange)
    return () => window.removeEventListener(NEXT_EVENT_BAR_CHANGED, onChange)
  }, [])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 20_000)
    return () => clearInterval(id)
  }, [])

  const items = useMemo(() => listUpcomingTimed(6, now), [now, s.nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!enabled || items.length === 0) return null

  const first = items[0]
  const state = urgency(first, now)
  const blinking = state === 'blink' && !blinkStopped.has(first.id)
  const urgent = state === 'soon' || state === 'blink' || state === 'ongoing'

  const label = expanded
    ? items.map(it => `${it.text || t('common.noTitle', 'Sin título')} — ${fmtWhen(it.due, now, t)}`).join('  ·  ')
    : `${first.text || t('common.noTitle', 'Sin título')} — ${fmtWhen(first.due, now, t)}`
  const prefix = t('nextEvent.next', 'Siguiente:')

  return (
    <div className={`v2-nextevent${urgent ? ' v2-nextevent--urgent' : ''}${blinking ? ' v2-nextevent--blink' : ''}`}>
      <button
        className="v2-nextevent-text"
        onClick={() => {
          if (blinking) { setBlinkStopped(s => new Set(s).add(first.id)); return }
          window.dispatchEvent(new CustomEvent('from:open-detail', { detail: { nodeId: first.id } }))
        }}
        title={blinking ? t('nextEvent.tapToStopBlink', 'Toca para dejar de parpadear') : label}
      >
        <span className="v2-nextevent-prefix">{prefix}</span> {label}
      </button>
      {items.length > 1 && (
        <button
          className="v2-nextevent-toggle"
          onClick={() => setExpanded(e => !e)}
          aria-label={expanded ? t('nextEvent.collapse', 'Mostrar menos') : t('nextEvent.expand', 'Ver más próximos')}
        >
          <Icon name={expanded ? 'chevron-right' : 'chevron-left'} size={12} />
        </button>
      )}
    </div>
  )
}
