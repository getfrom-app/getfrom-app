// DayPanel — pestaña del panel derecho «Día» (como iPad). Muestra el panel
// completo de la nota diaria abierta, de arriba a abajo:
//   1. Eventos de Google Calendar del día (sueltos, alineados a la izquierda)
//   2. Atrasadas · 3. Para hoy · 4. Bucles abiertos  (cockpit «bare», sin caja)
//   5. Nodos del día (outliner editable; excluye los eventos del bloque 1)
//
// Se usa en modo pizarra: NodeView dispara `from:open-day-panel` al abrir la
// diaria como pizarra → MainLayout activa este panel. Como en pizarra el
// outliner inline del día está desmontado, esta es la ÚNICA instancia del
// outliner del día (sin duplicar).

import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import Outliner from '../outliner/Outliner'
import DailyCockpit from '../views/DailyCockpit'
import { renderInline } from '../outliner/InlineRenderer'
import { pushEventTitleChanges, getGcalEventId, getGcalColor } from '../../utils/gcalNodesSync'

export default function DayPanel({ nodeId }: { nodeId?: string }) {
  useStore()
  const navigate = useNavigate()
  const node = nodeId ? store.getNode(nodeId) : undefined

  // Eventos GCal del día (hijos con _gcalEventId), ordenados por hora de inicio.
  const eventNodes = node?.isDiaryEntry
    ? store.children(node.id)
        .filter(c => getGcalEventId(c))
        .sort((a, b) => (a.due || '').localeCompare(b.due || ''))
    : []
  const eventIds = new Set(eventNodes.map(c => c.id))

  // Empujar a Google los títulos de eventos editados (debounce; anti-bucle dentro).
  const evSig = eventNodes.map(c => `${c.id}:${c.text}`).join('|')
  const titleTimer = useRef<number | null>(null)
  useEffect(() => {
    if (!node?.isDiaryEntry) return
    if (titleTimer.current) clearTimeout(titleTimer.current)
    titleTimer.current = window.setTimeout(() => { pushEventTitleChanges(node) }, 1400)
    return () => { if (titleTimer.current) clearTimeout(titleTimer.current) }
  }, [evSig, node?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!node?.isDiaryEntry) {
    return (
      <div style={{ padding: 16, color: 'var(--text-secondary, #999)', fontSize: 14 }}>
        Abre una nota diaria para ver su panel.
      </div>
    )
  }

  const isToday = store.todayDiary()?.id === node.id
  // El outliner del día solo se monta en el panel cuando el día está en PIZARRA
  // (en modo lista el outliner ya está inline en el área central → evitar duplicar).
  let isPizarra = false
  try { isPizarra = JSON.parse(node.extraData || '{}').viewBlock === 'pizarra' } catch { /* ignore */ }

  // Clic en un nodo del panel → si está colocado en el lienzo, la pizarra vuela a
  // él (estilo iPad). No bloquea la edición; PizarraView filtra a hijos-del-día.
  const onPanelClick = (e: React.MouseEvent) => {
    if (!isPizarra) return
    const row = (e.target as HTMLElement).closest('[data-node-id]') as HTMLElement | null
    const id = row?.getAttribute('data-node-id')
    if (id) window.dispatchEvent(new CustomEvent('from:pizarra-flyto', { detail: { nodeId: id } }))
  }

  return (
    <div className="day-panel" style={{ height: '100%', overflowY: 'auto', padding: '6px 8px' }} onClick={onPanelClick}>
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
      {isPizarra && <Outliner parentId={node.id} autoFocusEmpty disableLocalFilter excludeIds={eventIds} />}
    </div>
  )
}
