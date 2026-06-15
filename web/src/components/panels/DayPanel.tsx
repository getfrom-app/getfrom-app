// DayPanel — pestaña del panel derecho «Día» (modo pizarra). Muestra la columna
// unificada del día (eventos → atrasadas → hoy → bucles → nodos) vía DayColumn.
// En pizarra el outliner inline del centro está desmontado, así que esta es la
// ÚNICA instancia del outliner del día (sin duplicar).

import { store, useStore } from '../../store/nodeStore'
import DayColumn from './DayColumn'

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
      {/* La columna derecha persiste en pizarra Y en lista: eventos + atrasadas/hoy/
          bucles + capturas. Los NODOS del día NO van aquí (includeNodes=false):
          viven en el lienzo (pizarra) o inline en el centro (lista). */}
      <DayColumn node={node} includeNodes={false} />
    </div>
  )
}
