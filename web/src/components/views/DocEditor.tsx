// DocEditor — vista INDEPENDIENTE de un elemento-texto del lienzo. Es EXACTAMENTE
// el mismo elemento que en el lienzo (mismo contentEditable `.pizarra-text`, misma
// barra de formato `TextToolbar`), solo que centrado y enfocado: «abrir en
// solitario» = hacer foco en el texto. Fuente única = `node.body`.

import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import { firstLineTitle } from '../../utils/docNode'
import TextToolbar from './TextToolbar'
import type { Node } from '../../types'

export default function DocEditor({ node }: { node: Node }) {
  useStore()
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement | null>(null)
  const saveTimer = useRef<number | null>(null)

  // Cargar el body en el editable al abrir (no controlado → no se pierde el cursor).
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.innerHTML = node.body || '<h1></h1>'
    // Sanear el título del breadcrumb por si quedó concatenado.
    const t = firstLineTitle(el.innerHTML)
    if (t && t !== node.text) store.updateNode(node.id, { text: t })
    el.focus()
    const sel = window.getSelection(); const range = document.createRange()
    range.selectNodeContents(el); range.collapse(false); sel?.removeAllRanges(); sel?.addRange(range)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id])

  const save = (html: string) => store.updateNode(node.id, { body: html, text: firstLineTitle(html) })
  const scheduleSave = (html: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => save(html), 500)
  }
  useEffect(() => () => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); if (ref.current) save(ref.current.innerHTML) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id])

  // Clic en un enlace → interno (navega) o externo (nueva pestaña).
  const onClick = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a') as HTMLAnchorElement | null
    if (!a) return
    const href = a.getAttribute('href') || ''
    if (href.startsWith('/node/') || href.startsWith('/app/node/')) { e.preventDefault(); navigate(href.replace('/app', '')) }
    else if (/^https?:\/\//i.test(href)) { e.preventDefault(); window.open(href, '_blank', 'noopener') }
  }

  return (
    <div className="doc-editor" style={{ maxWidth: 760, margin: '0 auto', padding: '4px 4px 120px' }}>
      {/* Barra de formato — la MISMA que en el lienzo, ENCIMA del texto (pegada arriba). */}
      <div style={{ position: 'sticky', top: 6, zIndex: 1500, display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
        <TextToolbar />
      </div>

      <div
        ref={ref}
        className="pizarra-text"
        contentEditable
        suppressContentEditableWarning
        onInput={e => scheduleSave((e.target as HTMLElement).innerHTML)}
        onBlur={e => save((e.target as HTMLElement).innerHTML)}
        onClick={onClick}
        style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--text,#222)', outline: 'none', minHeight: 320, wordBreak: 'break-word' }}
      />
    </div>
  )
}
