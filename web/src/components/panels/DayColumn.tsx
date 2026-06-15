// DayColumn — columna unificada de una nota diaria, de arriba a abajo:
//   1. Eventos de Google Calendar del día (sueltos, alineados a la izquierda)
//   2. Atrasadas · 3. Para hoy · 4. Bucles abiertos  (cockpit «bare», sin caja)
//   5. Nodos del día (outliner editable; excluye los eventos del bloque 1)
//
// Se reutiliza en el panel derecho «Día» (modo pizarra, sin el bloque de nodos
// porque viven en el lienzo) e inline en el centro (modo lista, con todo).
// Cada cabecera de bloque colapsa su contenido (clic). Persistente.

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'
import Outliner from '../outliner/Outliner'
import DailyCockpit from '../views/DailyCockpit'
import { renderInline } from '../outliner/InlineRenderer'
import { pushEventTitleChanges, getGcalEventId, getGcalColor } from '../../utils/gcalNodesSync'

type OutlinerExtraProps = Omit<React.ComponentProps<typeof Outliner>, 'parentId' | 'excludeIds'>

export default function DayColumn({
  node,
  outlinerProps,
  includeNodes = true,
}: {
  node: Node
  outlinerProps?: OutlinerExtraProps
  includeNodes?: boolean
}) {
  useStore()
  const navigate = useNavigate()

  // Colapsado por bloque (cabecera clicable). Persistente.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('from_daycol_collapsed') || '[]')) } catch { return new Set() }
  })
  function toggle(k: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(k) ? next.delete(k) : next.add(k)
      localStorage.setItem('from_daycol_collapsed', JSON.stringify([...next]))
      return next
    })
  }
  const header = (k: string, label: string, cls = '') => (
    <button className={`dc-group-label dc-group-toggle ${cls}`} onClick={e => { e.stopPropagation(); toggle(k) }}>
      <span className="dc-group-chevron">{collapsed.has(k) ? '›' : '▾'}</span>{label}
    </button>
  )

  // Eventos GCal del día (hijos con _gcalEventId), ordenados por hora de inicio.
  const eventNodes = store.children(node.id)
    .filter(c => getGcalEventId(c))
    .sort((a, b) => (a.due || '').localeCompare(b.due || ''))
  const eventIds = new Set(eventNodes.map(c => c.id))

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
          {header('eventos', 'Eventos de hoy', 'dc-group-label--event')}
          {!collapsed.has('eventos') && eventNodes.map(ev => {
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
      {store.todayDiary()?.id === node.id && <DailyCockpit bare disablePlanner />}

      {/* 5. Nodos del día (sin los eventos, que ya van arriba). En pizarra NO se
             monta aquí: los nodos viven en el lienzo (includeNodes=false). */}
      {includeNodes && (
        <div className="dc-group">
          {header('nodos', 'Nodos')}
          {!collapsed.has('nodos') && (
            <Outliner parentId={node.id} excludeIds={eventIds} {...outlinerProps} />
          )}
        </div>
      )}
    </>
  )
}
