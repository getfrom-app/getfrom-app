// DocSlashMenu — menú "/" para el editor NUEVO (DocEditor, TipTap). Equivalente
// reducido del SlashMenu.tsx del editor clásico (outliner): mismo modelo de datos
// (extraData.viewBlock + _inline), pero solo los 3 bloques más importantes que hoy
// faltan en v2: Tabla / Kanban / Calendario. Reutiliza las clases CSS `.slash-menu*`
// ya existentes (styles/index.css) — mismo look que el outliner clásico.

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

export type DocSlashAction = 'view-table' | 'view-kanban' | 'view-calendar'

export interface DocSlashOption {
  action: DocSlashAction
  label: string
  icon: string
  description: string
}

interface Props {
  anchorEl: HTMLElement | null
  query: string
  onSelect: (action: DocSlashAction, label: string) => void
  onClose: () => void
}

export default function DocSlashMenu({ anchorEl, query, onSelect, onClose }: Props) {
  const { t } = useTranslation()
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [activeIdx, setActiveIdx] = useState(0)

  const OPTIONS: DocSlashOption[] = [
    { action: 'view-table', label: t('docSlash.table', 'Tabla'), icon: '⊞', description: t('docSlash.tableDesc', 'Vista tabla inline con hijos') },
    { action: 'view-kanban', label: t('docSlash.kanban', 'Kanban'), icon: '⫴', description: t('docSlash.kanbanDesc', 'Tablero kanban inline') },
    { action: 'view-calendar', label: t('docSlash.calendar', 'Calendario'), icon: '📅', description: t('docSlash.calendarDesc', 'Calendario inline') },
  ]

  const filtered = OPTIONS.filter(opt =>
    !query ||
    opt.label.toLowerCase().includes(query.toLowerCase()) ||
    opt.description.toLowerCase().includes(query.toLowerCase())
  )

  useEffect(() => { setActiveIdx(0) }, [query])

  useEffect(() => {
    if (!anchorEl) return
    const rect = anchorEl.getBoundingClientRect()
    const menuW = 260
    const menuH = 200
    const margin = 8
    const spaceBelow = window.innerHeight - rect.bottom - margin
    const top = spaceBelow >= Math.min(menuH, 160)
      ? rect.bottom + 4
      : Math.max(margin, rect.top - menuH - 4)
    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - menuW - margin))
    setPos({ top, left })
  }, [anchorEl])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault(); e.stopPropagation()
        setActiveIdx(i => Math.min(i + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault(); e.stopPropagation()
        setActiveIdx(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault(); e.stopPropagation()
        if (filtered[activeIdx]) onSelect(filtered[activeIdx].action, filtered[activeIdx].label)
      } else if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey, true)
    return () => window.removeEventListener('keydown', handleKey, true)
  }, [activeIdx, filtered, onSelect, onClose])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  if (!anchorEl) return null

  if (filtered.length === 0) {
    return createPortal(
      <div ref={menuRef} className="slash-menu" style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 1000 }}>
        <div className="slash-menu-empty">{t('docSlash.noResults', 'Sin resultados para')} &quot;{query}&quot;</div>
      </div>,
      document.body
    )
  }

  return createPortal(
    <div ref={menuRef} className="slash-menu" style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 1000 }}>
      <div className="slash-menu-group">{t('docSlash.groupBlocks', 'Bloques')}</div>
      {filtered.map((opt, idx) => (
        <button
          key={opt.action}
          className={`slash-menu-item ${idx === activeIdx ? 'active' : ''}`}
          onMouseEnter={() => setActiveIdx(idx)}
          onMouseDown={e => { e.preventDefault(); onSelect(opt.action, opt.label) }}
        >
          <span className="slash-menu-icon">{opt.icon}</span>
          <div className="slash-menu-text">
            <span className="slash-menu-label">{opt.label}</span>
            <span className="slash-menu-desc">{opt.description}</span>
          </div>
        </button>
      ))}
    </div>,
    document.body
  )
}
