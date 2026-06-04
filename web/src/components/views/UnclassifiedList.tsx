/**
 * UnclassifiedList — Lista de nodos sin contexto asignado.
 *
 * Wrapper sobre FilteredList con la lógica de filtrado de nodos sin contexto.
 * El comportamiento de raíces flotantes con breadcrumb lo provee FilteredList.
 */
import { useMemo } from 'react'
import { useStore, store } from '../../store/nodeStore'
import { useTranslation } from 'react-i18next'
import FilteredList from './FilteredList'

/** Tags de sistema — no cuentan como contexto de usuario */
const BUILTIN_TAGS = new Set(['tarea','evento','agente','prompt','proyecto','busqueda','panel','archivo','enlace','chat','favorito','seguimiento','quick','magic','rec','bucle','nota'])

interface Props {
  onNavigate?: (nodeId: string) => void
}

export default function UnclassifiedList({ onNavigate: _onNavigate }: Props) {
  const s = useStore()
  const { t } = useTranslation()

  // Calcular todos los nodos sin clasificar — SIN ancestorIds, sin Outliner padre
  const unclassifiedIds = useMemo(() => {
    const ids = new Set<string>()
    s.allActive().forEach(n => {
      if (n.deletedAt || n.isDiaryEntry) return
      const text = (n.text || '').trim()
      if (text.length < 4) return
      // Solo nodos contenedor (con hijos), tareas o bucles
      const hasChildren = store.children(n.id).some(c => !c.deletedAt)
      const isTask = n.status !== null
      const isLoop = (n.types || []).includes('bucle')
      if (!hasChildren && !isTask && !isLoop) return
      // ¿tiene contextos del usuario en types[]?
      const userTypes = (n.types || []).filter(t => !BUILTIN_TAGS.has(t))
      if (userTypes.length > 0) return
      // ¿tiene @mention?
      if (/@\w/.test(n.text || '')) return
      // ¿fue asignado manualmente via badge?
      try {
        const ed = JSON.parse(n.extraData || '{}')
        if (ed._contextManuallySet === '1') return
      } catch { /* ignore */ }
      ids.add(n.id)
    })
    return ids
  }, [s.nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <FilteredList
      matchIds={unclassifiedIds}
      label={t('autoCtx.unclassifiedFilter')}
      emptyText={t('autoCtx.unclassifiedEmpty', 'Todos los nodos tienen contexto asignado')}
      enableAutoClassify={true}
    />
  )
}
