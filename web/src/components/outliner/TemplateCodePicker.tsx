// MARK: - TemplateCodePicker
//
// Picker de códigos {{variable}} — aparece al escribir {{ en el editor.
// Misma arquitectura que SlashMenu: portal + teclado + click fuera cierra.

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { TEMPLATE_CODES } from '../../utils/templateCodes'

interface Props {
  anchorEl: HTMLElement | null
  query: string         // texto escrito tras {{
  onSelect: (code: string) => void
  onClose: () => void
}

export default function TemplateCodePicker({ anchorEl, query, onSelect, onClose }: Props) {
  const { t } = useTranslation()
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [activeIdx, setActiveIdx] = useState(0)

  const filtered = TEMPLATE_CODES.filter(c =>
    !query ||
    c.code.includes(query.toLowerCase()) ||
    c.label.toLowerCase().includes(query.toLowerCase())
  )

  useEffect(() => { setActiveIdx(0) }, [query])

  // Posición bajo el elemento ancla (igual que SlashMenu)
  useEffect(() => {
    if (!anchorEl) return
    const rect = anchorEl.getBoundingClientRect()
    const menuH = 300
    const spaceBelow = window.innerHeight - rect.bottom - 8
    const top = spaceBelow > menuH ? rect.bottom + 4 : rect.top - menuH - 4
    setPos({ top, left: Math.min(rect.left, window.innerWidth - 290) })
  }, [anchorEl])

  // Teclado: flechas + Enter + Escape
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
        if (filtered[activeIdx]) onSelect(filtered[activeIdx].code)
      } else if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey, true)
    return () => window.removeEventListener('keydown', handleKey, true)
  }, [activeIdx, filtered, onSelect, onClose])

  // Click fuera cierra
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  if (filtered.length === 0) return null

  return createPortal(
    <div
      ref={menuRef}
      className="slash-menu"
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 1001, minWidth: 280 }}
    >
      <div className="slash-menu-group" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ opacity: 0.6, fontFamily: 'monospace' }}>{'{ }'}</span>
        {t('templates.sectionTitle')}
      </div>
      {filtered.map((c, idx) => (
        <button
          key={c.code}
          className={`slash-menu-item ${idx === activeIdx ? 'active' : ''}`}
          onMouseEnter={() => setActiveIdx(idx)}
          onMouseDown={e => {
            e.preventDefault()
            onSelect(c.code)
          }}
        >
          <span
            className="slash-menu-icon"
            style={{ fontFamily: 'monospace', fontSize: 10, opacity: 0.7, letterSpacing: -1 }}
          >
            {'{{}}'}
          </span>
          <div className="slash-menu-text">
            <span className="slash-menu-label" style={{ fontFamily: 'monospace' }}>
              {`{{${c.code}}}`}
            </span>
            <span className="slash-menu-desc">
              {c.label}
              <span style={{ opacity: 0.55, marginLeft: 4 }}>→ {c.example()}</span>
            </span>
          </div>
        </button>
      ))}
    </div>,
    document.body
  )
}
