// DayColumn — columna unificada de una nota diaria, de arriba a abajo:
//   1. Eventos de Google Calendar del día (sueltos, alineados a la izquierda)
//   2. Atrasadas · 3. Para hoy · 4. Bucles abiertos  (cockpit «bare», sin caja)
//   5. Nodos del día (outliner editable; excluye los eventos del bloque 1)
//
// Se reutiliza en el panel derecho «Día» (modo pizarra) y inline en el centro
// (modo lista), para que el orden y el aspecto sean idénticos en ambos modos.

import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'
import Outliner from '../outliner/Outliner'
import DailyCockpit from '../views/DailyCockpit'
import { renderInline } from '../outliner/InlineRenderer'
import { pushEventTitleChanges, getGcalEventId, getGcalColor } from '../../utils/gcalNodesSync'

type OutlinerExtraProps = Omit<React.ComponentProps<typeof Outliner>, 'parentId' | 'excludeIds'>

export default function DayColumn({ node, outlinerProps }: { node: Node; outlinerProps?: OutlinerExtraProps }) {
  useStore()
  const navigate = useNavigate()

  // Eventos GCal del día (hijos con _gcalEventId), ordenados por hora de inicio.
  const eventNodes = store.children(node.id)
    .filter(c => getGcalEventId(c))
    .sort((a, b) => (a.due || '').localeCompare(b.due || ''))
  const eventIds = new Set(eventNodes.map(c => c.id))
  const isToday = store.todayDiary()?.id === node.id

  // Empujar a Google los títulos de eventos editados (debounce; anti-bucle dentro).
  const evSig = eventNodes.map(c => `${c.id}:${c.text}`).join('|')
  const titleTimer = useRef<number | null>(null)
  useEffect(() => {
    if (titleTimer.current) clearTimeout(titleTimer.current)
    titleTimer.current = window.setTimeout(() => { pushEventTitleChanges(node) }, 1400)
    return () => { if (titleTimer.current) clearTimeout(titleTimer.current) }
  }, [evSig, node.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* 1. Eventos de Google Calendar del día */}
      {eventNodes.length > 0 && (
        <div className="dc-group">
          <div className="dc-group-label dc-group-label--event">Eventos de hoy</div>
          {eventNodes.map(ev => {
            const color = getGcalColor(ev)
            return (
              <div
                key={ev.id}
                className="dc-row dc-row--event"
                data-node-id={ev.id}
                onClick={() => navigate(`/node/${ev.id}`)}
              >
                <span className="dc-event-dot" style={color ? { background: color } : undefined} />
                <span className="dc-text">{ev.text ? renderInline(ev.text) : 'Evento'}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* 2-4. Atrasadas · Para hoy · Bucles abiertos (sueltos, sin caja) */}
      {isToday && <DailyCockpit bare disablePlanner />}

      {/* 5. Nodos del día (sin los eventos, que ya van arriba) */}
      <Outliner parentId={node.id} excludeIds={eventIds} {...outlinerProps} />
    </>
  )
}
