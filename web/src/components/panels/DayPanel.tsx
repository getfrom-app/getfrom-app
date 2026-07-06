// DayPanel — pestaña del panel derecho «Día» (modo pizarra). Muestra la columna
// unificada del día (eventos → atrasadas → hoy → bucles → nodos) vía DayColumn.
// En pizarra el outliner inline del centro está desmontado, así que esta es la
// ÚNICA instancia del outliner del día (sin duplicar).
//
// La navegación entre superficies (Lienzo de contextos · Hoy · Calendario) vive en la
// BARRA SUPERIOR (WFTopBar), siempre visible y en el mismo sitio — no aquí (los botones
// que aparecían/desaparecían en esta columna confundían).

import { useLocation } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import DayColumn from './DayColumn'
import NoteColumn from './NoteColumn'
import DayTimeline from './DayTimeline'

export default function DayPanel({ nodeId }: { nodeId?: string }) {
  useStore()
  const location = useLocation()
  const node = nodeId ? store.getNode(nodeId) : undefined
  // El timeline de días aparece SOLO cuando estás dentro de un día (no en el lienzo de
  // contextos, donde la columna solo muestra «hoy» como referencia).
  const onContextsCanvas = location.pathname.replace(/^\/app\/?/, '').replace(/^\/+|\/+$/g, '') === ''

  if (!node) {
    return (
      <div style={{ padding: 16, color: 'var(--text-secondary, #999)', fontSize: 14 }}>
        Abre una nota para ver su panel.
      </div>
    )
  }

  // El día abre como LIENZO salvo que su viewBlock lo fije a lista explícitamente.
  let vb = ''
  try { vb = JSON.parse(node.extraData || '{}').viewBlock || '' } catch { /* ignore */ }
  const isPizarra = vb !== 'lista' && vb !== 'tabla' && vb !== 'kanban' && vb !== 'calendario'

  // Clic en un nodo del panel → si está colocado en el lienzo, la pizarra vuela a
  // él (estilo iPad). No bloquea la edición; PizarraView filtra a hijos-del-día.
  const onPanelClick = (e: React.MouseEvent) => {
    if (!isPizarra) return
    const row = (e.target as HTMLElement).closest('[data-node-id]') as HTMLElement | null
    const id = row?.getAttribute('data-node-id')
    if (id) window.dispatchEvent(new CustomEvent('from:pizarra-flyto', { detail: { nodeId: id } }))
  }

  return (
    <div className="day-panel" style={{ height: '100%', overflowY: 'auto', padding: '6px 8px 88px' }} onClick={onPanelClick}>
      {node.isDiaryEntry ? (
        <>
          {/* Timeline de días (scroll horizontal + mini-calendario) — solo dentro de un día. */}
          {!onContextsCanvas && <DayTimeline date={node.diaryDate ? new Date(node.diaryDate) : new Date()} />}
          {/* La columna del día persiste en pizarra Y en lista: eventos + atrasadas/hoy/bucles/
              capturas. Los NODOS del día NO van aquí (includeNodes=false): viven en el lienzo. */}
          <DayColumn node={node} includeNodes={false} />
        </>
      ) : (
        // Nota normal (no diaria) → columna «Movidos».
        <NoteColumn node={node} />
      )}
    </div>
  )
}
