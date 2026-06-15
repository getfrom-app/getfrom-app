// DayPanel — pestaña del panel derecho «Día» (como iPad). Muestra el panel
// completo de la nota diaria abierta: «Tu día» (tareas atrasadas/hoy + bucles,
// solo en la diaria de HOY) + TODOS los nodos del día (outliner editable).
//
// Se usa en modo pizarra: NodeView dispara `from:open-day-panel` al abrir la
// diaria como pizarra → MainLayout activa este panel. Como en pizarra el
// outliner inline del día está desmontado, esta es la ÚNICA instancia del
// outliner del día (sin duplicar).

import { store, useStore } from '../../store/nodeStore'
import Outliner from '../outliner/Outliner'
import DailyCockpit from '../views/DailyCockpit'

export default function DayPanel({ nodeId }: { nodeId?: string }) {
  useStore()
  const node = nodeId ? store.getNode(nodeId) : undefined

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
      {isToday && <DailyCockpit disablePlanner />}
      {isPizarra && <Outliner parentId={node.id} autoFocusEmpty disableLocalFilter />}
    </div>
  )
}
