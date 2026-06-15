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

  const isCapture = (n: Node) => {
    try { return JSON.parse(n.extraData || '{}')._capture === '1' } catch { return false }
  }
  const hasPin = (n: Node) => {
    try { const e = JSON.parse(n.extraData || '{}'); return e._pinX != null || e._pinY != null } catch { return false }
  }

  const dayChildren = store.children(node.id)
  // Eventos GCal del día (hijos con _gcalEventId), ordenados por hora de inicio.
  const eventNodes = dayChildren
    .filter(c => getGcalEventId(c))
    .sort((a, b) => (a.due || '').localeCompare(b.due || ''))
  // Bandeja de capturas: marcadas `_capture` y aún SIN colocar en el lienzo.
  const captureNodes = dayChildren.filter(c => isCapture(c) && !hasPin(c) && !getGcalEventId(c))
  // El bloque «Nodos» (y el lienzo) no muestra eventos ni capturas-en-bandeja.
  const eventIds = new Set([...eventNodes, ...captureNodes].map(c => c.id))

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

      {/* 6. Capturas — bandeja de entrada (fondo). Arrástralas al lienzo para colocarlas. */}
      {captureNodes.length > 0 && (
        <div className="dc-group">
          {header('capturas', 'Capturas')}
          {!collapsed.has('capturas') && captureNodes.map(c => (
            <div
              key={c.id}
              className="dc-row dc-row--capture"
              data-node-id={c.id}
              draggable
              onDragStart={e => { e.dataTransfer.setData('text/plain', c.id); e.dataTransfer.effectAllowed = 'copy' }}
              onClick={() => navigate(`/node/${c.id}`)}
              title="Arrastra al lienzo para colocarla"
            >
              <span className="dc-capture-grip">⠿</span>
              <span className="dc-text">{c.text ? renderInline(c.text) : 'Captura'}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
