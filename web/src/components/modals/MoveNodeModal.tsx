import { createPortal } from 'react-dom'
import { useState, useRef, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import { markMovedIntoNote } from '../../utils/dayColumn'
import type { Node } from '../../types'

interface Props {
  node: Node
  nodeIds?: string[]   // cuando se mueven varios nodos a la vez
  onClose: () => void
}

function getAncestorPath(nodeId: string): string {
  const parts: string[] = []
  let cur = store.getNode(nodeId)
  while (cur?.parentId) {
    const parent = store.getNode(cur.parentId)
    if (!parent) break
    parts.unshift(parent.text || 'Sin título')
    cur = parent
  }
  return parts.slice(-2).join(' / ')
}

function getNodeIcon(n: Node): string {
  if (n.isDiaryEntry) return '📓'
  if (n.isEvent) return '📅'
  if (n.status === 'pending') return '○'
  if (n.status === 'done') return '✓'
  if ((n.types || []).includes('bucle')) return '↺'
  if (n.isFavorite) return '★'
  return '📄'
}

export default function MoveNodeModal({ node, nodeIds, onClose }: Props) {
  const { t } = useTranslation()
  const s = useStore()
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Collect all descendants of the node (cannot move into self or descendants)
  const descendants = useMemo(() => {
    const set = new Set<string>()
    const queue = [node.id]
    while (queue.length) {
      const id = queue.shift()!
      set.add(id)
      store.children(id).forEach(c => queue.push(c.id))
    }
    return set
  }, [node.id])

  const todayDiary = store.todayDiary()

  const candidates = useMemo(() => {
    const allNodes = s.allActive().filter(n => {
      if (descendants.has(n.id)) return false
      if (n.deletedAt) return false
      return true
    })

    if (query.trim()) {
      const q = query.toLowerCase()
      const noTitle = t('common.noTitle')
      const label = (n: Node) => n.isDiaryEntry && n.diaryDate
        ? new Date(n.diaryDate).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
        : (n.text || noTitle)
      return allNodes
        .filter(n => label(n).toLowerCase().includes(q))
        .sort((a, b) => {
          const al = label(a).toLowerCase(), bl = label(b).toLowerCase()
          return (al.startsWith(q) ? 0 : 1) - (bl.startsWith(q) ? 0 : 1) || b.updatedAt.localeCompare(a.updatedAt)
        })
        .slice(0, 15)
    }

    // Sin query: Hoy primero, luego diarios recientes, luego notas recientes (sin raíz)
    const results: Node[] = []
    if (todayDiary && !descendants.has(todayDiary.id)) results.push(todayDiary)

    // Otros diarios recientes (últimos 3 días)
    const recentDiaries = allNodes
      .filter(n => n.isDiaryEntry && n.id !== todayDiary?.id && n.diaryDate)
      .sort((a, b) => (b.diaryDate ?? '').localeCompare(a.diaryDate ?? ''))
      .slice(0, 3)
    results.push(...recentDiaries)

    // Notas no-raíz, no-diario, recientes
    const recent = allNodes
      .filter(n => !n.isDiaryEntry && n.parentId) // tienen padre → no están en raíz
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 10)
    const seen = new Set(results.map(n => n.id))
    for (const r of recent) {
      if (!seen.has(r.id)) { results.push(r); seen.add(r.id) }
    }
    return results.slice(0, 12)
  }, [query, s, descendants, todayDiary])

  // Sin opción "Raíz" — las notas siempre van bajo un día o bajo otra nota
  const allItems = candidates.map(n => {
    const isToday = n.id === todayDiary?.id
    const text = n.isDiaryEntry && n.diaryDate
      ? (isToday ? t('common.today') : new Date(n.diaryDate).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }))
      : (n.text || t('common.noTitle'))
    return {
      id: n.id,
      text,
      icon: isToday ? '📅' : getNodeIcon(n),
      path: n.isDiaryEntry ? '' : getAncestorPath(n.id),
      isToday,
    }
  })

  useEffect(() => { setActiveIdx(0) }, [query])

  function moveTo(targetId: string) {
    const siblings = store.children(targetId)
    const maxOrder = siblings.reduce((max, n) => Math.max(max, n.siblingOrder), 0)
    const idsToMove = nodeIds && nodeIds.length > 1 ? nodeIds : [node.id]
    idsToMove.forEach((id, i) => {
      if (id !== targetId) {
        store.updateNode(id, { parentId: targetId, siblingOrder: maxOrder + (i + 1) * 1000 })
        markMovedIntoNote(id, targetId) // → bloque «Movidos» de la nota destino
      }
    })
    onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, allItems.length - 1))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const item = allItems[activeIdx]
      if (item) moveTo(item.id)
    }
  }

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const active = list.querySelector('.move-node-item--active') as HTMLElement | null
    active?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card move-node-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-icon">⇢</span>
          <h2>{t('modal.moveNote')}</h2>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>
        <div className="move-node-info">
          {nodeIds && nodeIds.length > 1
            ? <>{t('modal.moving')} <strong>{nodeIds.length} nodos</strong></>
            : <>{t('modal.moving')} <strong>{node.text || t('common.noTitle')}</strong></>
          }
        </div>
        <div className="move-node-search">
          <input
            ref={inputRef}
            type="text"
            className="modal-input"
            placeholder={t('modal.searchDestination')}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div ref={listRef} className="move-node-results">
          {allItems.map((item, idx) => (
            <div
              key={item.id}
              className={`move-node-item ${idx === activeIdx ? 'move-node-item--active' : ''} ${item.isToday ? 'move-node-item--today' : ''}`}
              onClick={() => moveTo(item.id)}
              onMouseEnter={() => setActiveIdx(idx)}
            >
              <span className="move-node-icon">{item.icon}</span>
              <div className="move-node-info-row">
                <span className="move-node-text">{item.text}</span>
                {item.path && <span className="move-node-path">{item.path}</span>}
              </div>
              {item.isToday && <span className="move-node-badge">hoy</span>}
            </div>
          ))}
          {allItems.length === 0 && query && (
            <div className="move-node-empty">Sin resultados para "{query}"</div>
          )}
        </div>
        <div className="move-node-hint">↑↓ navegar · Enter mover · Esc cancelar</div>
      </div>
    </div>,
    document.body
  )
}
