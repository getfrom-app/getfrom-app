// Trigger «#» para el editor de documento (TipTap) — mismo mecanismo de
// contextos/tags anidados que ya usa el outliner (`OutlinerNode.tsx`, picker
// tipo '#'): al escribir `#nombre` aparece un popup con los contextos
// existentes que coinciden; al elegir uno (o pulsar Enter sin coincidencia)
// el PÁRRAFO donde se escribió queda REALMENTE citado a ese contexto, vía
// `onAssign` (= `setCitationContext` de DocEditor.tsx — la misma función que
// usa el botón hover «?»): crea/reasigna la cita de ese párrafo y deja el
// indicador visual PERSISTENTE en la línea (`applyCiteIndicators`), igual que
// el flujo «?». Antes esto llamaba a `assignContext(selfId, ctxId)`, que
// asignaba el contexto al NODO DEL DOCUMENTO ENTERO (no al párrafo) y no
// tocaba ningún indicador visual — de ahí que solo se viera el toast verde
// efímero y la línea nunca quedara citada (Alberto, 24 ago: "pone en verde
// #biblioteca... pero luego desaparece todo y la línea no se cita"). Si no
// hay coincidencia y el usuario confirma, se crea el contexto en la raíz
// (`ensureContextPath`, misma función que usa el outliner para
// `#la-isla/marketing/emails`).
//
// Hermano de DocMention.tsx (mismo patrón: popup flotante en portal,
// detección por regex antes del cursor, teclado ↑/↓/Enter/Esc). El `#nombre`
// SÍ queda visible en el texto (28 ago 2026: antes se borraba del todo tras
// Enter — "desaparece, se oculta" — aunque la cita del párrafo sí se creaba;
// ahora se inserta como enlace interno con clase `doc-ctx-mention`, estilo
// propio en styles/index.css) y, además, cita el párrafo entero.
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Editor } from '@tiptap/react'
import { useStore } from '../../store/nodeStore'
import {
  listContextTags,
  findContextByPath,
  ensureContextPath,
  assignContext,
  normalizeContextPath,
  contextPath,
  type ContextTag,
} from '../../utils/cajones'
import Icon from '../../v2/components/Icon'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

type Item = { id: string; label: string; contextLabel?: string; create?: string }

// pid del párrafo/heading/blockquote que contiene `pos` (ver ParagraphId en
// tiptapParagraphId.ts) — sube por los ancestros del doc hasta encontrar uno
// con el atributo, igual que hace `getOrderedBlocks`/`data-pid` para el hover.
function pidAtPos(editor: Editor, pos: number): string | null {
  try {
    const $pos = editor.state.doc.resolve(pos)
    for (let d = $pos.depth; d >= 0; d--) {
      const pid = $pos.node(d).attrs?.pid
      if (typeof pid === 'string' && pid) return pid
    }
  } catch { /* posición inválida */ }
  return null
}

export default function DocContextMention({ editor, selfId, onAssign }: { editor: Editor; selfId: string; onAssign: (pid: string, contextId: string) => void }) {
  useStore()
  const [m, setM] = useState<{ query: string; start: number; from: number; top: number; left: number; pid: string | null } | null>(null)
  const [sel, setSel] = useState(0)

  // Detectar «#query» justo antes del cursor. Mismo criterio que el picker
  // '#' del outliner: pegado a inicio de palabra (o inicio de párrafo), sin
  // espacios ni otro `#` dentro — pero sí permite `/` para rutas anidadas.
  useEffect(() => {
    const detect = () => {
      const { state } = editor
      const { from, empty } = state.selection
      if (!empty) { setM(null); return }
      const before = state.doc.textBetween(Math.max(0, from - 60), from, '\n', '￼')
      const match = /(^|\s)#([^\s#]{0,60})$/.exec(before)
      if (!match) { setM(null); return }
      const query = match[2]
      const start = from - query.length - 1
      let coords
      try { coords = editor.view.coordsAtPos(from) } catch { return }
      setM({ query, start, from, top: coords.bottom + 4, left: coords.left, pid: pidAtPos(editor, from) })
      setSel(0)
    }
    editor.on('update', detect)
    editor.on('selectionUpdate', detect)
    return () => { editor.off('update', detect); editor.off('selectionUpdate', detect) }
  }, [editor])

  const matches = useMemo((): Item[] => {
    if (!m) return []
    const q = norm(m.query.trim())
    const tags: ContextTag[] = listContextTags()
      .filter(tg => !q || norm(tg.path).includes(q) || norm(tg.label).includes(q))
      .slice(0, 8)
    const items: Item[] = tags.map(tg => ({
      id: tg.node.id,
      label: tg.path,
      contextLabel: tg.depth > 1 ? tg.label.split('/').slice(0, -1).join('/') : undefined,
    }))
    // Ofrecer «crear» solo si la ruta escrita no existe tal cual (igual que
    // buildCajonPickerItems en OutlinerNode.tsx).
    const typed = normalizeContextPath(m.query)
    if (typed && !findContextByPath(typed)) {
      items.push({ id: '__create__', label: typed, create: m.query.trim() })
    }
    return items
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m])

  const pick = (item: Item) => {
    if (!m) return
    let ctxId = item.id
    if (item.create) {
      const created = ensureContextPath(item.create)
      if (!created) { setM(null); return }
      ctxId = created.id
    }
    const pid = m.pid
    const label = item.create ? item.create : (item.label || '')
    // El texto de la mención se queda VISIBLE en el párrafo (antes se borraba
    // del todo — Alberto, 28 ago: "desaparece, se oculta"). Se inserta como
    // enlace interno al contexto con su propia clase (`doc-ctx-mention`),
    // estilada aparte del texto normal (ver styles/index.css), al estilo Tana.
    editor.chain().focus()
      .deleteRange({ from: m.start, to: m.from })
      .insertContent([
        { type: 'text', marks: [{ type: 'link', attrs: { href: `/node/${ctxId}`, class: 'doc-ctx-mention' } }], text: `#${label}` },
        { type: 'text', text: ' ' },
      ])
      .run()
    if (pid) {
      // Cita el PÁRRAFO (mismo mecanismo que el hover «?»): deja un indicador
      // visual persistente en la línea, no solo un toast efímero.
      onAssign(pid, ctxId)
    } else {
      // Sin párrafo detectable (caso raro, p.ej. doc vacío): fallback al
      // contexto del documento entero, con confirmación explícita.
      assignContext(selfId, ctxId)
      window.dispatchEvent(new CustomEvent('from:toast', {
        detail: { message: `#${contextPath(ctxId) || ''}`, type: 'success' },
      }))
    }
    setM(null)
  }

  // Teclado (captura para adelantarse a TipTap): flechas, Enter/Tab, Esc.
  useEffect(() => {
    if (!m || matches.length === 0) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); setSel(s => Math.min(s + 1, matches.length - 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); setSel(s => Math.max(s - 1, 0)) }
      else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); if (matches[sel]) pick(matches[sel]) }
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
      {matches.map((item, i) => (
        <button key={item.id} className={`doc-mention-item${i === sel ? ' active' : ''}`}
          onMouseEnter={() => setSel(i)} onMouseDown={e => { e.preventDefault(); pick(item) }}>
          <span className="doc-mention-icon"><Icon name={item.create ? 'plus' : 'folder'} size={13} /></span>
          <span className="doc-mention-title">{item.create ? `Crear "${item.label}"` : item.label}</span>
        </button>
      ))}
    </div>
  ), document.body)
}
