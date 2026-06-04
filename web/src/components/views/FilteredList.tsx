/**
 * FilteredList — Lista genérica de resultados de filtro como raíces flotantes con breadcrumb.
 *
 * Se usa para TODOS los filtros activos en From:
 *   - Filtro por contexto (@La Isla, @Personal, etc.)
 *   - Filtro por tipo (tareas, notas, eventos, bucles)
 *   - Filtro "Sin clasificar"
 *   - Búsqueda de texto
 *   - Cualquier filtro futuro
 *
 * Comportamiento estilo Workflowy:
 *   Cada nodo resultado se muestra como raíz flotante independiente.
 *   Por encima aparece un breadcrumb de texto plano (sin OutlinerNode) indicando
 *   su posición real en el árbol. El nodo resultado y sus hijos son OutlinerNode
 *   normales y el usuario puede expandirlos/colapsarlos.
 *
 * Esto evita el freeze que ocurría al pasar ancestorIds al Outliner, lo que montaba
 * miles de OutlinerNode simultáneamente (cada uno con ~30 hooks).
 */
import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { store } from '../../store/nodeStore'
import { useTranslation } from 'react-i18next'
import type { Node as FromNode } from '../../types'
import OutlinerNode from '../outliner/OutlinerNode'
import { useGlobalSelection, toggleNodeSelection } from '../outliner/Outliner'
import AutoContextBadge from '../outliner/AutoContextBadge'
import { scheduleClassify, cancelClassify, getCachedClassify, type ClassifyResult } from '../../api/autoClassify'
import { TAGS_ROOT_NAME } from '../../utils/tagsHelper'

/** Máximo de niveles de ancestro a mostrar en el breadcrumb */
const MAX_BREADCRUMB_DEPTH = 4
const PAGE_SIZE = 40

/**
 * getBreadcrumb — recorre los ancestros de un nodo hacia arriba y devuelve
 * un array de strings con los textos. Máximo MAX_BREADCRUMB_DEPTH niveles.
 * Si hay más niveles, el primero del array es "…".
 */
export function getBreadcrumb(nodeId: string): string[] {
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

/** Constante para el data transfer del drag de nodo a contexto */
export const DRAG_NODE_ID_KEY = 'from/nodeId'

/**
 * FilterResultItem — Muestra un nodo resultado de filtro como raíz flotante.
 * El breadcrumb es texto plano (sin OutlinerNode). El nodo resultado sí es OutlinerNode.
 * Exportado para que UnclassifiedList pueda reutilizarlo.
 *
 * enableAutoClassify: si true, programa clasificación inmediata al montar y muestra
 *   AutoContextBadge junto al breadcrumb (vista "Sin clasificar").
 */
export function FilterResultItem({
  node,
  selectedId,
  onSelect,
  onSelectNext,
  enableAutoClassify = false,
}: {
  node: FromNode
  selectedId: string | null
  onSelect: (id: string) => void
  onSelectNext: (id: string, dir: 'up' | 'down') => void
  enableAutoClassify?: boolean
}) {
  const selectedIds = useGlobalSelection()
  const breadcrumb = useMemo(() => getBreadcrumb(node.id), [node.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-clasificación en "Sin clasificar": scheduleClassify al montar y mostrar badge
  const [autoCtxResult, setAutoCtxResult] = useState<ClassifyResult | null>(() => {
    if (!enableAutoClassify) return null
    // 1. Caché en memoria (más reciente)
    const cached = getCachedClassify(node.id)
    if (cached) return cached
    // 2. Fallback: extraData persistido
    try {
      const ed = JSON.parse(node.extraData || '{}')
      if (ed._autoContextId !== undefined) {
        return {
          contextId: ed._autoContextId || null,
          confidence: typeof ed._autoContextConfidence === 'number' ? ed._autoContextConfidence : 0,
        }
      }
    } catch { /* ignore */ }
    return null
  })
  const classifyScheduledRef = useRef(false)

  useEffect(() => {
    if (!enableAutoClassify) return
    if (classifyScheduledRef.current) return
    classifyScheduledRef.current = true

    // No clasificar si ya tiene contexto manual o @mention
    try {
      const ed = JSON.parse(node.extraData || '{}')
      if (ed._contextManuallySet === '1') return
    } catch { /* ignore */ }
    if (/@\w/.test(node.text || '')) return
    const builtinTags = new Set(['tarea','evento','agente','prompt','proyecto','busqueda','panel','archivo','enlace','chat','favorito','seguimiento','quick','magic','rec','bucle','nota'])
    const userTypes = (node.types || []).filter(t => !builtinTags.has(t))
    if (userTypes.length > 0) return

    const text = (node.text || '').trim()
    if (text.length < 4) return

    const tagsRoot = store.children(null).find(n => !n.deletedAt && n.text === TAGS_ROOT_NAME)
    if (!tagsRoot) return
    const contextNodes = store.children(tagsRoot.id).filter(n => !n.deletedAt)
    if (contextNodes.length === 0) return
    const contexts = contextNodes.map(n => ({ id: n.id, name: n.text || '' }))

    scheduleClassify(node.id, text, contexts, (id, result) => {
      if (id !== node.id) return
      setAutoCtxResult(result)
      // Persistir en extraData para que sobreviva desmonte/remonte y recargas
      try {
        const currentNode = store.getNode(node.id)
        const ed = JSON.parse(currentNode?.extraData || node.extraData || '{}')
        // No sobreescribir si ya se asignó manualmente entre medias
        if (ed._contextManuallySet !== '1') {
          ed._autoContextId = result.contextId ?? ''
          ed._autoContextConfidence = result.confidence
          store.updateNode(node.id, { extraData: JSON.stringify(ed) })
        }
      } catch { /* ignore */ }
    })

    return () => { cancelClassify(node.id) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData(DRAG_NODE_ID_KEY, node.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div
      style={{ marginBottom: 4 }}
      draggable={true}
      onDragStart={handleDragStart}
    >
      {/* Breadcrumb + badge de auto-clasificación en la misma fila */}
      {(breadcrumb.length > 0 || (enableAutoClassify && autoCtxResult && autoCtxResult.confidence > 0.3)) && (
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

          {/* Badge de auto-clasificación — visible inmediatamente en vista "Sin clasificar" */}
          {enableAutoClassify && autoCtxResult && autoCtxResult.confidence > 0.3 && (
            <AutoContextBadge
              node={node}
              result={autoCtxResult}
              onContextAssigned={(id) => {
                if (id === node.id) setAutoCtxResult(null)
              }}
            />
          )}
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

interface FilteredListProps {
  /** IDs de los nodos resultado (ya calculados por el filtro activo) */
  matchIds: Set<string>
  /** Etiqueta opcional para la cabecera (ej. "La Isla", "tareas", etc.) */
  label?: string
  /** Texto vacío cuando no hay resultados */
  emptyText?: string
  /** Mostrar paginación (por defecto true) */
  paginate?: boolean
  /** Si true, cada FilterResultItem programa clasificación al montar y muestra AutoContextBadge */
  enableAutoClassify?: boolean
}

/**
 * FilteredList — renderiza un Set<string> de matchIds como lista de raíces flotantes
 * con breadcrumb. Genérico para cualquier filtro activo de From.
 */
export default function FilteredList({
  matchIds,
  label,
  emptyText,
  paginate = true,
  enableAutoClassify = false,
}: FilteredListProps) {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Convertir matchIds a array de nodos, conservando orden del store (siblingOrder)
  const allNodes = useMemo(() => {
    const result: FromNode[] = []
    matchIds.forEach(id => {
      const n = store.getNode(id)
      if (n && !n.deletedAt) result.push(n)
    })
    // Orden: alfabético por texto como fallback estable
    result.sort((a, b) => (a.text || '').localeCompare(b.text || '', 'es'))
    return result
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchIds])

  const total = allNodes.length
  const visible = paginate ? allNodes.slice(0, page * PAGE_SIZE) : allNodes
  const hasMore = paginate && total > visible.length

  const loadMore = useCallback(() => setPage(p => p + 1), [])

  const handleSelectNext = useCallback((id: string, dir: 'up' | 'down') => {
    const idx = visible.findIndex(n => n.id === id)
    if (dir === 'up' && idx > 0) setSelectedId(visible[idx - 1].id)
    if (dir === 'down' && idx < visible.length - 1) setSelectedId(visible[idx + 1].id)
  }, [visible])

  if (total === 0) {
    return (
      <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
        {emptyText || t('filter.noResults', 'Sin resultados')}
      </div>
    )
  }

  return (
    <div style={{ padding: '8px 0' }}>
      {/* Cabecera con contador */}
      {label && (
        <div style={{ padding: '4px 16px 8px', fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'var(--accent)', opacity: 0.7 }}>✦</span>
          <span>{label} · {total}</span>
        </div>
      )}

      {/* Lista de nodos como raíces flotantes con breadcrumb */}
      {visible.map(node => (
        <FilterResultItem
          key={node.id}
          node={node}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onSelectNext={handleSelectNext}
          enableAutoClassify={enableAutoClassify}
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
