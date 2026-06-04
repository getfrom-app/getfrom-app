/**
 * UnclassifiedList — Lista de nodos sin contexto asignado en estilo "raíces flotantes".
 *
 * Cada nodo resultado se muestra con:
 *   1. Un breadcrumb de texto (gris, pequeño) mostrando el path hasta el nodo en el árbol real.
 *   2. El OutlinerNode del nodo resultado como raíz flotante — el usuario puede expandir/colapsar
 *      sus hijos normalmente.
 *
 * Los ANCESTROS son texto plano (breadcrumb) → 0 coste de renderizado de OutlinerNode.
 * Solo el nodo resultado y sus HIJOS son OutlinerNode normales → coste habitual.
 *
 * Esto evita el freeze que ocurría al montar miles de OutlinerNode al expandir
 * los ancestros de 160 nodos distribuidos por todo el árbol.
 *
 * Incluye paginación con "Cargar más" (40 items por página).
 */
import { useState, useMemo, useCallback } from 'react'
import { useStore, store } from '../../store/nodeStore'
import AutoContextBadge from '../outliner/AutoContextBadge'
import { scheduleClassify, type ClassifyResult } from '../../api/autoClassify'
import { TAGS_ROOT_NAME } from '../../utils/tagsHelper'
import { useTranslation } from 'react-i18next'
import type { Node as FromNode } from '../../types'
import OutlinerNode from '../outliner/OutlinerNode'
import { useGlobalSelection, toggleNodeSelection, clearGlobalSelection, getGlobalSelectedIds, openSelectionMenu } from '../outliner/Outliner'

/** Tags de sistema — no cuentan como contexto de usuario */
const BUILTIN_TAGS = new Set(['tarea','evento','agente','prompt','proyecto','busqueda','panel','archivo','enlace','chat','favorito','seguimiento','quick','magic','rec','bucle','nota'])

const PAGE_SIZE = 40
/** Máximo de niveles de ancestro a mostrar en el breadcrumb */
const MAX_BREADCRUMB_DEPTH = 4

interface Props {
  onNavigate?: (nodeId: string) => void
}

/**
 * getBreadcrumb — recorre los ancestros de un nodo hacia arriba y devuelve
 * un array de strings con los textos. Máximo MAX_BREADCRUMB_DEPTH niveles.
 * Si hay más niveles, el primero del array es "…".
 */
function getBreadcrumb(nodeId: string): string[] {
  const parts: string[] = []
  let cur = store.getNode(nodeId)
  // Subir por los ancestros (sin incluir el nodo mismo)
  cur = cur?.parentId ? store.getNode(cur.parentId) : undefined
  while (cur && parts.length < MAX_BREADCRUMB_DEPTH) {
    const text = (cur.text || '').trim()
    if (text) parts.unshift(text)
    cur = cur.parentId ? store.getNode(cur.parentId) : undefined
  }
  // Si hay más ancestros sin mostrar, indicar truncado al inicio
  if (cur?.parentId) {
    parts.unshift('…')
  }
  return parts
}

/**
 * FilterResultItem — Muestra un nodo resultado de filtro como raíz flotante.
 * El breadcrumb es texto plano (sin OutlinerNode). El nodo resultado sí es OutlinerNode.
 */
function FilterResultItem({
  node,
  selectedId,
  onSelect,
  onSelectNext,
}: {
  node: FromNode
  selectedId: string | null
  onSelect: (id: string) => void
  onSelectNext: (id: string, dir: 'up' | 'down') => void
}) {
  const selectedIds = useGlobalSelection()
  const breadcrumb = useMemo(() => getBreadcrumb(node.id), [node.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ marginBottom: 4 }}>
      {/* Breadcrumb — texto plano, sin OutlinerNode → 0 coste de renderizado de árbol */}
      {breadcrumb.length > 0 && (
        <div
          style={{
            padding: '2px 16px 0',
            fontSize: 11,
            color: 'var(--text-tertiary)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            lineHeight: 1.4,
            userSelect: 'none',
          }}
        >
          {breadcrumb.map((segment, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {i > 0 && (
                <span style={{ opacity: 0.5, fontSize: 10 }}>›</span>
              )}
              <span
                style={{
                  maxWidth: 160,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={segment}
              >
                {segment}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Nodo resultado como OutlinerNode raíz flotante — con sus hijos expandibles */}
      <div style={{ paddingLeft: 4 }}>
        <OutlinerNode
          node={node}
          depth={0}
          isSelected={selectedId === node.id}
          selectedId={selectedId}
          isMultiSelected={selectedIds.has(node.id)}
          onSelect={onSelect}
          onSelectNext={onSelectNext}
          onShiftSelect={(id) => {
            toggleNodeSelection(id, store)
          }}
        />
      </div>
    </div>
  )
}

export default function UnclassifiedList({ onNavigate: _onNavigate }: Props) {
  const s = useStore()
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Calcular todos los nodos sin clasificar — SIN ancestorIds, sin Outliner padre
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

  // Navegación con flechas entre nodos resultado
  const handleSelectNext = useCallback((id: string, dir: 'up' | 'down') => {
    const idx = visible.findIndex(n => n.id === id)
    if (dir === 'up' && idx > 0) setSelectedId(visible[idx - 1].id)
    if (dir === 'down' && idx < visible.length - 1) setSelectedId(visible[idx + 1].id)
  }, [visible])

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

      {/* Lista de nodos como raíces flotantes con breadcrumb */}
      {visible.map(node => (
        <FilterResultItem
          key={node.id}
          node={node}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onSelectNext={handleSelectNext}
        />
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
