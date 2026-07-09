// Menciones @ para el editor de documento (TipTap). Al escribir «@» seguido de texto,
// muestra un popup con elementos de Fromly que coinciden; al elegir uno, inserta un
// ENLACE INTERNO (/node/<id>) con su título → enlace bidireccional (los retroenlaces
// se calculan escaneando los enlaces internos del vault). Implementación propia y
// ligera (sin @tiptap/extension-mention).
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Editor } from '@tiptap/react'
import { store, useStore } from '../../store/nodeStore'
import { parseExtraData } from '../../utils/papeleraHelper'
import type { Node } from '../../types'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function iconFor(n: Node): string {
  const e = parseExtraData(n.extraData)
  const rt = (e._resourceType as string) || (n.resourceType || '')
  if (rt === 'image' || e._imageUrl) return '🖼'
  if (rt === 'pdf') return '📄'
  if (n.isResource || e._resourceUrl != null || rt) return '🔗'
  if (n.status != null || (n.types || []).includes('tarea')) return '☑️'
  if (n.isEvent || (n.types || []).includes('evento')) return '📅'
  if (e._ctx === '1') return '📁'
  return '📝'
}

// Elementos mencionables: notas, documentos, tareas, eventos, recursos, contextos.
// Excluye transcripciones de chat y líneas absorbidas/memoria interna.
function mentionable(n: Node): boolean {
  if (n.deletedAt || !(n.text || '').trim()) return false
  const e = parseExtraData(n.extraData)
  if (e._aiTranscript === '1' || e._aiMsgRole || e._absorbedBy != null || e._tagDefinition != null) return false
  return true
}
const cleanTitle = (t: string) => (t || '').replace(/^[✦💬🧠]\s*/u, '').trim()

export default function DocMention({ editor, selfId }: { editor: Editor; selfId: string }) {
  useStore()
  const [m, setM] = useState<{ query: string; start: number; from: number; top: number; left: number } | null>(null)
  const [sel, setSel] = useState(0)

  // Detectar «@query» justo antes del cursor.
  useEffect(() => {
    const detect = () => {
      const { state } = editor
      const { from, empty } = state.selection
      if (!empty) { setM(null); return }
      const before = state.doc.textBetween(Math.max(0, from - 40), from, '\n', '￼')
      const match = /(^|\s)@([^\s@]{0,40})$/.exec(before)
      if (!match) { setM(null); return }
      const query = match[2]
      const start = from - query.length - 1
      let coords
      try { coords = editor.view.coordsAtPos(from) } catch { return }
      setM({ query, start, from, top: coords.bottom + 4, left: coords.left })
      setSel(0)
    }
    editor.on('update', detect)
    editor.on('selectionUpdate', detect)
    return () => { editor.off('update', detect); editor.off('selectionUpdate', detect) }
  }, [editor])

  const matches = useMemo(() => {
    if (!m) return []
    const q = norm(m.query.trim())
    const all = store.allActive().filter(n => n.id !== selfId && mentionable(n))
    const pool = q
      ? all.filter(n => norm(n.text).includes(q))
      : [...all].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    return pool.slice(0, 8)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m, selfId, store.nodesVersion])

  const pick = (n: Node) => {
    const title = cleanTitle(n.text).slice(0, 80) || 'Elemento'
    editor.chain().focus()
      .deleteRange({ from: m!.start, to: m!.from })
      .insertContent([
        { type: 'text', marks: [{ type: 'link', attrs: { href: `/node/${n.id}` } }], text: `@${title}` },
        { type: 'text', text: ' ' },
      ])
      .run()
    setM(null)
  }

  // Teclado (captura para adelantarse a TipTap): flechas, Enter, Esc.
  useEffect(() => {
    if (!m || matches.length === 0) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); setSel(s => Math.min(s + 1, matches.length - 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); setSel(s => Math.max(s - 1, 0)) }
      else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (matches[sel]) pick(matches[sel]) }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setM(null) }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m, matches, sel])

  if (!m || matches.length === 0) return null

  return createPortal((
    <div className="doc-mention-pop" style={{ position: 'fixed', top: Math.min(m.top, window.innerHeight - 300), left: Math.min(m.left, window.innerWidth - 280) }}
      onMouseDown={e => e.preventDefault()}>
      {matches.map((n, i) => (
        <button key={n.id} className={`doc-mention-item${i === sel ? ' active' : ''}`}
          onMouseEnter={() => setSel(i)} onMouseDown={e => { e.preventDefault(); pick(n) }}>
          <span className="doc-mention-icon">{iconFor(n)}</span>
          <span className="doc-mention-title">{cleanTitle(n.text)}</span>
        </button>
      ))}
    </div>
  ), document.body)
}
