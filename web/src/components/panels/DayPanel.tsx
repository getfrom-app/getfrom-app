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

  return (
    <div className="day-panel" style={{ height: '100%', overflowY: 'auto', padding: '6px 8px' }}>
      {isToday && <DailyCockpit disablePlanner />}
      {isPizarra && <Outliner parentId={node.id} autoFocusEmpty disableLocalFilter />}
    </div>
  )
}
