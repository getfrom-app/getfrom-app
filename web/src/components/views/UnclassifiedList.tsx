/**
 * UnclassifiedList — Lista plana de nodos sin contexto asignado.
 *
 * Completamente independiente del Outliner y de OutlinerNode.
 * No calcula ancestorIds, no expande árboles. Solo itera los nodos directamente.
 * Esto evita el freeze que ocurría cuando el Outliner montaba miles de componentes
 * al intentar expandir los ancestros de 160 nodos distribuidos por todo el árbol.
 *
 * Incluye paginación con "Cargar más" para evitar renders pesados.
 */
import { useState, useMemo, useCallback } from 'react'
import { useStore, store } from '../../store/nodeStore'
import AutoContextBadge from '../outliner/AutoContextBadge'
import { scheduleClassify, type ClassifyResult } from '../../api/autoClassify'
import { TAGS_ROOT_NAME } from '../../utils/tagsHelper'
import { useTranslation } from 'react-i18next'
import type { Node as FromNode } from '../../types'

/** Tags de sistema — no cuentan como contexto de usuario */
const BUILTIN_TAGS = new Set(['tarea','evento','agente','prompt','proyecto','busqueda','panel','archivo','enlace','chat','favorito','seguimiento','quick','magic','rec','bucle','nota'])

const PAGE_SIZE = 40

interface Props {
  onNavigate?: (nodeId: string) => void
}

/** Una fila de la lista plana */
function UnclassifiedRow({ node, onNavigate }: { node: FromNode; onNavigate?: (id: string) => void }) {
  const [autoCtxResult, setAutoCtxResult] = useState<ClassifyResult | null>(null)
  const [ctxAssigned, setCtxAssigned] = useState(false)
  const s = useStore()

  // Lanzar clasificación automática al montar la fila
  // Solo si el nodo todavía está sin contexto
  useMemo(() => {
    const tagsRoot = store.children(null).find(n => !n.deletedAt && n.text === TAGS_ROOT_NAME)
    const contextNodes = tagsRoot ? store.children(tagsRoot.id).filter(n => !n.deletedAt) : []
    if (contextNodes.length === 0) return

    scheduleClassify(
      node.id,
      node.text || '',
      contextNodes.map(n => ({ id: n.id, name: n.text || '' })),
      (_nodeId, result) => {
        if (result.contextId) setAutoCtxResult(result)
      }
    )
  }, [node.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Tipo de nodo para mostrar badge secundario
  const nodeTypes = node.types || []
  const isTask = node.status !== null
  const isLoop = nodeTypes.includes('bucle')
  const hasChildren = s.children(node.id).some(c => !c.deletedAt)

  const typeLabel = isTask ? '✓' : isLoop ? '↺' : hasChildren ? '▸' : '·'
  const typeColor = isTask ? 'var(--accent)' : isLoop ? '#f59e0b' : 'var(--text-tertiary)'

  if (ctxAssigned) return null // Ocultar fila tras asignar contexto

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 16px',
        borderRadius: 6,
        cursor: 'pointer',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      onClick={() => onNavigate?.(node.id)}
    >
      {/* Tipo badge */}
      <span style={{ fontSize: 12, color: typeColor, flexShrink: 0, width: 14, textAlign: 'center' }}>
        {typeLabel}
      </span>

      {/* Texto del nodo */}
      <span
        style={{
          flex: 1,
          fontSize: 13,
          color: 'var(--text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={node.text || ''}
      >
        {node.text || <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Sin título</span>}
      </span>

      {/* Badge de auto-contexto si hay sugerencia */}
      {autoCtxResult && !ctxAssigned && (
        <div onClick={e => e.stopPropagation()}>
          <AutoContextBadge
            node={node}
            result={autoCtxResult}
            onContextAssigned={() => setCtxAssigned(true)}
          />
        </div>
      )}
    </div>
  )
}

export default function UnclassifiedList({ onNavigate }: Props) {
  const s = useStore()
  const { t } = useTranslation()
  const [page, setPage] = useState(1)

  // Calcular todos los nodos sin clasificar — SIN ancestorIds, sin Outliner
  const allUnclassified = useMemo(() => {
    const result: FromNode[] = []
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
      result.push(n)
    })
    return result
  }, [s.nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  const total = allUnclassified.length
  const visible = allUnclassified.slice(0, page * PAGE_SIZE)
  const hasMore = total > visible.length

  const loadMore = useCallback(() => setPage(p => p + 1), [])

  if (total === 0) {
    return (
      <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
        {t('autoCtx.unclassifiedEmpty', 'Todos los nodos tienen contexto asignado')}
      </div>
    )
  }

  return (
    <div style={{ padding: '8px 0' }}>
      {/* Cabecera con contador */}
      <div style={{ padding: '4px 16px 8px', fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: 'var(--accent)', opacity: 0.7 }}>✦</span>
        <span>{t('autoCtx.unclassifiedFilter')} · {total}</span>
      </div>

      {/* Lista plana — sin OutlinerNode, sin ancestorIds */}
      {visible.map(node => (
        <UnclassifiedRow key={node.id} node={node} onNavigate={onNavigate} />
      ))}

      {/* Botón cargar más */}
      {hasMore && (
        <div style={{ textAlign: 'center', padding: '12px 0 8px' }}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginRight: 8 }}>
            {t('autoCtx.showingOf', 'Mostrando {{shown}} de {{total}}', { shown: visible.length, total })}
          </span>
          <button
            onClick={loadMore}
            style={{
              background: 'var(--bg-hover)',
              border: '1px solid var(--border)',
              borderRadius: 5,
              fontSize: 12,
              padding: '4px 12px',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
            }}
          >
            {t('common.loadMore', 'Cargar más')}
          </button>
        </div>
      )}
    </div>
  )
}
