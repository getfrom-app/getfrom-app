// ─────────────────────────────────────────────────────────────────────────────
// FASE 2 de la virtualización del outliner.
//
// Renderiza el árbol como una LISTA PLANA virtualizada: aplana con
// flattenVisibleTree y monta solo las filas dentro del viewport (+overscan) con
// @tanstack/react-virtual. Cada fila es un <OutlinerNode flat> — su `depth` da la
// indentación; NO recurre a sus hijos (los monta esta lista).
//
// Detrás del flag `from_virtualized_outliner` (ver isVirtualizedOutliner). El
// render recursivo clásico sigue intacto como fallback cuando el flag está OFF.
//
// El scroll NO es de la ventana: el outliner vive dentro de un contenedor con
// overflow (p.ej. <main class="main-content">). Detectamos ese ancestro
// scrolleable dinámicamente para que el reciclaje funcione en home, NodeView y
// paneles. Altura dinámica vía measureElement (los bullets varían de alto).
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useRef, useState, useLayoutEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import OutlinerNode from './OutlinerNode'
import { flattenVisibleTree } from './flattenTree'
import type { NodeStore } from '../../store/nodeStore'

export function isVirtualizedOutliner(): boolean {
  try { return localStorage.getItem('from_virtualized_outliner') === '1' } catch { return false }
}

/** Sube el DOM desde `start` buscando el primer ancestro con scroll vertical. */
function findScrollParent(start: HTMLElement | null): HTMLElement | null {
  let el = start?.parentElement ?? null
  while (el && el !== document.body) {
    const oy = getComputedStyle(el).overflowY
    if (oy === 'auto' || oy === 'scroll') return el
    el = el.parentElement
  }
  return (document.scrollingElement as HTMLElement) ?? null
}

interface Props {
  parentId: string | null
  store: NodeStore
  selectedId: string | null
  setSelectedId: (id: string) => void
  handleSelectNext: (id: string, dir: 'up' | 'down') => void
  handleShiftSelect?: (id: string) => void
  selectedIds: Set<string>
  effectiveFilter?: string
  excludeDiaryEntries?: boolean
}

export function VirtualOutlinerList({
  parentId, store, selectedId, setSelectedId, handleSelectNext, handleShiftSelect,
  selectedIds, effectiveFilter, excludeDiaryEntries,
}: Props) {
  // Recompute solo cuando cambia el árbol (nodesVersion) o el ámbito.
  const rows = useMemo(
    () => flattenVisibleTree(store, parentId, { excludeDiaryEntries }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parentId, excludeDiaryEntries, store.nodesVersion],
  )

  const listRef = useRef<HTMLDivElement>(null)
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null)

  // Detectar el contenedor scrolleable real tras montar.
  useLayoutEffect(() => {
    setScrollEl(findScrollParent(listRef.current))
  }, [])

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollEl,
    estimateSize: () => 32,
    overscan: 12,
    getItemKey: (index) => rows[index]?.node.id ?? index,
  })

  const items = virtualizer.getVirtualItems()

  return (
    <div ref={listRef} style={{ position: 'relative', height: virtualizer.getTotalSize(), width: '100%' }}>
      {items.map((vi) => {
        const row = rows[vi.index]
        if (!row) return null
        return (
          <div
            key={vi.key}
            data-index={vi.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${vi.start}px)`,
            }}
          >
            <OutlinerNode
              node={row.node}
              depth={row.depth}
              flat
              isSelected={selectedId === row.node.id}
              selectedId={selectedId}
              isMultiSelected={selectedIds.has(row.node.id)}
              onSelect={setSelectedId}
              onSelectNext={handleSelectNext}
              onShiftSelect={handleShiftSelect}
              filterText={effectiveFilter}
            />
          </div>
        )
      })}
    </div>
  )
}
