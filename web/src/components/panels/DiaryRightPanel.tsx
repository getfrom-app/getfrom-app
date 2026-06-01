/**
 * DiaryRightPanel — Panel derecho del diario de hoy.
 *
 * Muestra un filtro vivo: tareas pendientes de hoy + vencidas.
 * Usa el sistema de filtros de From (applyWFFilter) y el Outliner nativo
 * para renderizar los resultados con formato y contexto completo.
 */
import { useMemo } from 'react'
import { useStore } from '../../store/nodeStore'
import { applyWFFilter } from '../../utils/wfFilter'
import { normalizeSynonyms } from '../../utils/filterInterpreter'
import { isInPapelera } from '../../utils/papeleraHelper'
import Outliner from '../outliner/Outliner'

export interface DiaryRightPanelProps {
  diaryDate: Date
  rangeType?: 'day' | 'week' | 'month'
  timelineMode?: boolean
}

// Query fija: tareas pendientes de hoy O vencidas
const DIARY_PANEL_QUERY = 'pendiente y hoy o vencido'

export default function DiaryRightPanel({ diaryDate: _diaryDate, rangeType: _rangeType, timelineMode: _timelineMode }: DiaryRightPanelProps) {
  const s = useStore()

  // Aplicar filtro vivo — se recalcula con cada cambio del store
  // Excluir nodos de la Papelera (están "activos" pero son basura)
  const filterResult = useMemo(() => {
    const effective = normalizeSynonyms(DIARY_PANEL_QUERY) ?? DIARY_PANEL_QUERY
    const raw = applyWFFilter(s.nodes, effective)
    if (!raw) return null
    // Filtrar matchIds que estén en la Papelera
    const cleanMatchIds = new Set<string>()
    for (const id of raw.matchIds) {
      if (!isInPapelera(id)) cleanMatchIds.add(id)
    }
    return { matchIds: cleanMatchIds, ancestorIds: raw.ancestorIds }
  }, [s.nodes.size]) // eslint-disable-line react-hooks/exhaustive-deps

  const count = filterResult?.matchIds.size ?? 0

  return (
    <div className="diary-right-panel" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Cabecera */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px 8px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
          Hoy + Vencidas
        </span>
        {count > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 600,
            background: 'var(--accent-soft)', color: 'var(--accent)',
            borderRadius: 10, padding: '1px 7px',
          }}>
            {count}
          </span>
        )}
      </div>

      {/* Resultados del filtro — Outliner nativo con contexto completo */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {count === 0 ? (
          <div style={{
            padding: '24px 12px', textAlign: 'center',
            fontSize: 12, color: 'var(--text-tertiary)',
          }}>
            ✓ Nada pendiente para hoy
          </div>
        ) : (
          <Outliner
            parentId={null}
            filterMatchIds={filterResult?.matchIds}
            filterAncestorIds={filterResult?.ancestorIds}
            filterText={DIARY_PANEL_QUERY}
            disableLocalFilter
            compact
          />
        )}
      </div>
    </div>
  )
}

// Re-export para compatibilidad con imports existentes
export { DiaryRightPanel }
export { GCalEventEditor, TaskPropsPopover } from './DiaryPanelComponents'
