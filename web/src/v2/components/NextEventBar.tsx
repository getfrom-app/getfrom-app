// Barra de estado inferior — franja fija de borde a borde (27 ago 2026,
// Alberto: "añadiendo un pequeño indicador de agentes activos, último backup
// efectuado, etc... y el siguiente evento alineado en la parte derecha").
// Mismo criterio que cualquier barra de estado real (VS Code, Slack):
// IZQUIERDA = salud del sistema, en segundo plano, solo icono/color — nunca
// exige lectura activa; DERECHA = lo accionable, con texto, porque es lo
// único que sí pide leerse. El centro se deja vacío a propósito, no es un
// tercer bloque de info.
//
// "Lo próximo" (26 ago 2026, Alberto: "un pequeño apartado de 'Lo próximo'
// con el siguiente evento a la hora que sea"). Colapsada: solo el texto del
// más próximo. Un botón la expande, mostrando varios separados por "·". Se
// pone en rojo bajo 1h, parpadea bajo 15min (un clic detiene el parpadeo), y
// se mantiene resaltada mientras el elemento está en curso. Activable/
// desactivable en Ajustes → Apariencia — SOLO afecta a este bloque de la
// derecha, no a los indicadores de la izquierda (son utilidad de sistema, no
// una función opcional).
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '../../store/nodeStore'
import { listUpcomingTimed, isNextEventBarEnabled, NEXT_EVENT_BAR_CHANGED, type UpcomingItem } from '../../utils/nextEvent'
import { apiRequest } from '../../api/client'
import { listBackups, formatBackupAge, type BackupSnapshot } from '../../api/backups'
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

/** Agentes con una ejecución en curso AHORA MISMO (status "running" en sus
 *  últimas ejecuciones) — no "programados", solo los que de verdad están
 *  trabajando en este instante. Poll ligero: no hay push para esto todavía. */
function useActiveAgentCount(): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    let alive = true
    const check = () => {
      apiRequest<{ runs: Array<{ status: string }> }>('/agents/runs?limit=10')
        .then(res => { if (alive) setCount(res.runs.filter(r => r.status === 'running').length) })
        .catch(() => { /* silencioso — indicador de bajo compromiso, no bloquea nada */ })
    }
    check()
    const id = setInterval(check, 30_000)
    return () => { alive = false; clearInterval(id) }
  }, [])
  return count
}

/** Último snapshot de backup del usuario — poll cada 2 min, suficiente para
 *  algo que cambia como mucho una vez por hora (cron) o al guardar a mano. */
function useLastBackup(): BackupSnapshot | null {
  const [last, setLast] = useState<BackupSnapshot | null>(null)
  useEffect(() => {
    let alive = true
    const check = () => {
      listBackups().then(rows => { if (alive) setLast(rows[0] ?? null) }).catch(() => {})
    }
    check()
    const id = setInterval(check, 120_000)
    return () => { alive = false; clearInterval(id) }
  }, [])
  return last
}

/** Conexión real a internet — el punto de la izquierda se leía como "algo va
 *  mal" en ámbar aunque solo indicara la antigüedad del backup (27 ago 2026,
 *  Alberto: "veo un punto amarillo, debería ser verde porque estoy conectado
 *  a internet. el amarillo da la impresión de error"). Ahora el punto es
 *  SOLO conectividad (verde=online, como cualquier app), y el backup se lee
 *  aparte, en texto. */
function useOnline(): boolean {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return online
}

interface Props {
  /** Abre Ajustes → Backups (V2App.setSettingsTab('backups')). */
  onOpenBackups?: () => void
  /** Abre Elementos filtrado a agentes (V2App.onOpenElementsFiltered('agent')). */
  onOpenAgents?: () => void
}

export default function NextEventBar({ onOpenBackups, onOpenAgents }: Props) {
  const { t } = useTranslation()
  const s = useStore()
  const [enabled, setEnabled] = useState(isNextEventBarEnabled())
  const [now, setNow] = useState(() => new Date())
  const [expanded, setExpanded] = useState(false)
  const [blinkStopped, setBlinkStopped] = useState<Set<string>>(new Set())
  const activeAgents = useActiveAgentCount()
  const lastBackup = useLastBackup()
  const online = useOnline()

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
  const hasEvent = enabled && items.length > 0

  const first = items[0]
  const state = first ? urgency(first, now) : 'normal'
  const blinking = hasEvent && state === 'blink' && !blinkStopped.has(first!.id)
  const urgent = hasEvent && (state === 'soon' || state === 'blink' || state === 'ongoing')

  const label = hasEvent
    ? (expanded
        ? items.map(it => `${it.text || t('common.noTitle', 'Sin título')} — ${fmtWhen(it.due, now, t)}`).join('  ·  ')
        : `${first!.text || t('common.noTitle', 'Sin título')} — ${fmtWhen(first!.due, now, t)}`)
    : ''
  const prefix = t('nextEvent.next', 'Siguiente:')

  const backupText = lastBackup
    ? `${t('statusbar.backup', 'Backup')} ${formatBackupAge(lastBackup.createdAt)}`
    : t('statusbar.noBackup', 'Sin backups todavía')

  return (
    <div className={`v2-statusbar${urgent ? ' v2-statusbar--urgent' : ''}${blinking ? ' v2-statusbar--blink' : ''}`}>
      <div className="v2-statusbar-left">
        {activeAgents > 0 && (
          <button className="v2-statusbar-pill" onClick={onOpenAgents}
            title={activeAgents === 1 ? t('statusbar.oneAgentRunning', '1 agente trabajando ahora') : t('statusbar.nAgentsRunning', '{{count}} agentes trabajando ahora', { count: activeAgents })}>
            <Icon name="agent" size={11} />
            <span>{activeAgents}</span>
          </button>
        )}
        <span className={`v2-statusbar-dot v2-statusbar-dot--${online ? 'ok' : 'old'}`}
          title={online ? t('statusbar.online', 'Conectado') : t('statusbar.offline', 'Sin conexión')} />
        <button className="v2-statusbar-pill" onClick={onOpenBackups} title={backupText}>
          <span>{backupText}</span>
        </button>
      </div>
      <div className="v2-statusbar-spacer" />
      {hasEvent && (
        <div className="v2-statusbar-right">
          <button
            className="v2-nextevent-text"
            onClick={() => {
              if (blinking) { setBlinkStopped(s => new Set(s).add(first!.id)); return }
              window.dispatchEvent(new CustomEvent('from:open-detail', { detail: { nodeId: first!.id } }))
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
      )}
    </div>
  )
}
