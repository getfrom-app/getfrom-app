/**
 * UnclassifiedList — Lista de nodos sin contexto asignado.
 *
 * Wrapper sobre FilteredList con la lógica de filtrado de nodos sin contexto.
 * El comportamiento de raíces flotantes con breadcrumb lo provee FilteredList.
 */
import { useMemo } from 'react'
import { useStore } from '../../store/nodeStore'
import { useTranslation } from 'react-i18next'
import FilteredList from './FilteredList'
import { getUnclassifiedIds } from '../../utils/unclassified'

interface Props {
  onNavigate?: (nodeId: string) => void
}

export default function UnclassifiedList({ onNavigate: _onNavigate }: Props) {
  const s = useStore()
  const { t } = useTranslation()

  // Fuente única de verdad: solo Agenda, excluye system roots y nodos ya clasificados.
  const unclassifiedIds = useMemo(() => getUnclassifiedIds(), [s.nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <FilteredList
      matchIds={unclassifiedIds}
      label={t('autoCtx.unclassifiedFilter')}
      emptyText={t('autoCtx.unclassifiedEmpty', 'Todos los nodos tienen contexto asignado')}
      enableAutoClassify={true}
    />
  )
}
