// DocEditor — documento de TEXTO RICO (no nodos). Un nodo-documento (extraData
// _doc='1') guarda el contenido en su `body` (HTML de TipTap). Se edita como un
// documento completo: título + párrafos, barra de formato fija, barra flotante,
// enlaces internos (a cualquier nodo de Fromly) y externos, y acciones de
// imprimir / copiar (markdown · texto rico) / exportar (markdown · PDF).

import { useEffect, useRef, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import { store, useStore } from '../../store/nodeStore'
import { updateLinkedCanvasText } from '../../utils/pizarraBody'
import type { Node } from '../../types'

const COLORS = ['#222222', '#e03131', '#1971c2', '#2f9e44', '#f08c00', '#9c36b5']

const toast = (message: string) => window.dispatchEvent(new CustomEvent('from:toast', { detail: { message, type: 'success' } }))
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const safeName = (s: string) => (s || 'documento').slice(0, 40).replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s-]/g, '').trim() || 'documento'

// HTML del texto del lienzo enlazado = título (1er bloque) + cuerpo del documento.
// htmlToBlocks (PizarraView) toma el 1er bloque como título al re-promover, así que
// el título va en un <div> propio delante del cuerpo.
const canvasMd = (title: string | undefined, bodyHtml: string) =>
  `<div>${escapeHtml(title || 'Documento')}</div>${bodyHtml || ''}`

// HTML (TipTap) → Markdown ligero. Cubre títulos, negrita/cursiva/tachado/código,
// enlaces, listas (orden/desorden), citas y párrafos.
function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const inline = (el: Element | HTMLElement): string => {
    let out = ''
    el.childNodes.forEach(c => { out += serialize(c) })
    return out
  }
  const serialize = (n: ChildNode): string => {
    if (n.nodeType === 3) return n.textContent || ''   // TEXT_NODE
    if (n.nodeType !== 1) return ''                     // no ELEMENT_NODE
    const el = n as Element
    const tag = el.tagName.toLowerCase()
    const inner = inline(el)
    switch (tag) {
      case 'strong': case 'b': return `**${inner}**`
      case 'em': case 'i': return `*${inner}*`
      case 's': case 'del': return `~~${inner}~~`
      case 'u': return inner
      case 'code': return `\`${inner}\``
      case 'a': return `[${inner}](${el.getAttribute('href') || ''})`
      case 'br': return '\n'
      case 'h1': return `# ${inner}\n\n`
      case 'h2': return `## ${inner}\n\n`
      case 'h3': return `### ${inner}\n\n`
      case 'p': return `${inner}\n\n`
      case 'blockquote': return inner.split('\n').filter(Boolean).map(l => `> ${l}`).join('\n') + '\n\n'
      case 'ul': return Array.from(el.children).map(li => `- ${inline(li).trim()}`).join('\n') + '\n\n'
      case 'ol': return Array.from(el.children).map((li, i) => `${i + 1}. ${inline(li).trim()}`).join('\n') + '\n\n'
      case 'pre': return '```\n' + (el.textContent || '') + '\n```\n\n'
      default: return inner
    }
  }
  return inline(doc.body).replace(/\n{3,}/g, '\n\n').trim()
}

export default function DocEditor({ node }: { node: Node }) {
  useStore()
  const navigate = useNavigate()
  const saveTimer = useRef<number | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkQuery, setLinkQuery] = useState('')

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextStyle,
      Color,
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener nofollow' } }),
      Placeholder.configure({ placeholder: 'Escribe tu documento…' }),
    ],
    content: node.body || '',
    onUpdate: ({ editor }) => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      const html = editor.getHTML()
      saveTimer.current = window.setTimeout(() => {
        store.updateNode(node.id, { body: html })
        // Reflejar el contenido en el texto del lienzo enlazado (si existe).
        updateLinkedCanvasText(node.parentId, node.id, canvasMd(node.text, html))
      }, 600)
    },
  }, [node.id])

  // Guardar al desmontar (sin perder el último cambio del debounce).
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    if (editor) {
      const html = editor.getHTML()
      store.updateNode(node.id, { body: html })
      updateLinkedCanvasText(node.parentId, node.id, canvasMd(node.text, html))
    }
  }, [editor, node.id])

  // Búsqueda de nodos para enlazar (internos).
  const results = useMemo(() => {
    const q = linkQuery.trim().toLowerCase()
    if (!q || /^https?:\/\//i.test(linkQuery)) return [] as Node[]
    return store.allActive()
      .filter(n => !n.isDiaryEntry && (n.text || '').toLowerCase().includes(q))
      .slice(0, 6)
  }, [linkQuery])

  if (!editor) return null

  const setLink = (href: string) => {
    if (!href) return
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
    setLinkOpen(false); setLinkQuery('')
  }

  // Clic en un enlace del documento → interno (navega) o externo (nueva pestaña).
  const onContentClick = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a') as HTMLAnchorElement | null
    if (!a) return
    const href = a.getAttribute('href') || ''
    if (href.startsWith('/node/') || href.startsWith('/app/node/')) {
      e.preventDefault()
      navigate(href.replace('/app', ''))
    } else if (/^https?:\/\//i.test(href)) {
      e.preventDefault(); window.open(href, '_blank', 'noopener')
    }
  }

  // ── Contenido del documento para copiar / exportar (título + cuerpo HTML) ──
  const title = node.text || 'Documento'
  const bodyHtml = () => editor.getHTML()
  const richHtml = () => `<h1>${escapeHtml(title)}</h1>\n${bodyHtml()}`
  const markdown = () => `# ${title}\n\n${htmlToMarkdown(bodyHtml())}`.trim()
  const standaloneHtml = () => `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(title)}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:16px;line-height:1.65;color:#1a1a1a;max-width:720px;margin:40px auto;padding:0 24px;}
  h1{font-size:2rem;margin:0 0 1rem;color:#111;} h2{font-size:1.5rem;margin:1.4em 0 .5em;} h3{font-size:1.2rem;margin:1.2em 0 .4em;}
  ul,ol{padding-left:1.4em;} li{margin:.25em 0;} p{margin:.7em 0;} blockquote{border-left:3px solid #ddd;margin:.8em 0;padding:.2em 0 .2em 1em;color:#555;}
  a{color:#1971c2;} code{background:#f3f3f3;padding:.1em .35em;border-radius:4px;font-size:.9em;}
  footer{margin-top:48px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:.8rem;color:#aaa;}
</style></head>
<body><h1>${escapeHtml(title)}</h1>${bodyHtml()}<footer>Generado con Fromly</footer></body></html>`

  const copyMarkdown = () => navigator.clipboard.writeText(markdown()).then(() => toast('Markdown copiado')).catch(() => {})
  const copyRich = () => {
    try {
      navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([richHtml()], { type: 'text/html' }),
        'text/plain': new Blob([markdown()], { type: 'text/plain' }),
      })]).then(() => toast('Copiado con formato')).catch(() => navigator.clipboard.writeText(markdown()))
    } catch { navigator.clipboard.writeText(markdown()) }
  }
  const download = (content: string, mime: string, ext: string) => {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${safeName(title)}.${ext}`; a.click()
    URL.revokeObjectURL(url)
  }
  const exportMarkdown = () => { download(markdown(), 'text/markdown', 'md'); toast('Exportado a Markdown') }
  const printDoc = () => {
    const w = window.open('', '_blank')
    if (!w) { window.print(); return }
    w.document.write(standaloneHtml()); w.document.close(); w.focus()
    setTimeout(() => w.print(), 300)
  }

  // Botón de formato (barra fija y flotante).
  const Btn = ({ on, act, children, title }: { on?: boolean; act: () => void; children: React.ReactNode; title: string }) => (
    <button title={title} onMouseDown={e => { e.preventDefault(); act() }}
      style={{ minWidth: 30, height: 30, border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14,
        background: on ? 'var(--accent-soft,rgba(108,92,231,0.16))' : 'transparent', color: on ? 'var(--accent,#6c5ce7)' : 'var(--text,#333)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{children}</button>
  )
  const Sep = () => <div style={{ width: 1, height: 20, background: 'var(--border,#e2e2e2)', margin: '0 3px', flexShrink: 0 }} />
  // Botón de acción (imprimir / copiar / exportar) — estilo icono de la app.
  const Act = ({ act, children, title }: { act: () => void; children: React.ReactNode; title: string }) => (
    <button className="node-action-icon-btn" title={title} onClick={act}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{children}</button>
  )

  return (
    <div className="doc-editor" style={{ maxWidth: 760, margin: '0 auto', padding: '0 4px 80px' }}>
      {/* ── Barra fija: formato (izquierda) + acciones (derecha) ── */}
      <div className="doc-toolbar" style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1,
        padding: '6px 4px', marginBottom: 10, background: 'var(--bg,#fff)', borderBottom: '1px solid var(--border,#ececec)' }}>
        <Btn title="Título 1" on={editor.isActive('heading', { level: 1 })} act={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</Btn>
        <Btn title="Título 2" on={editor.isActive('heading', { level: 2 })} act={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</Btn>
        <Btn title="Título 3" on={editor.isActive('heading', { level: 3 })} act={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</Btn>
        <Sep />
        <Btn title="Negrita" on={editor.isActive('bold')} act={() => editor.chain().focus().toggleBold().run()}><b>B</b></Btn>
        <Btn title="Cursiva" on={editor.isActive('italic')} act={() => editor.chain().focus().toggleItalic().run()}><i>I</i></Btn>
        <Btn title="Subrayado" on={editor.isActive('underline')} act={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></Btn>
        <Btn title="Tachado" on={editor.isActive('strike')} act={() => editor.chain().focus().toggleStrike().run()}><s>S</s></Btn>
        <Btn title="Código" on={editor.isActive('code')} act={() => editor.chain().focus().toggleCode().run()}>{'</>'}</Btn>
        <Sep />
        <Btn title="Lista" on={editor.isActive('bulletList')} act={() => editor.chain().focus().toggleBulletList().run()}>•</Btn>
        <Btn title="Lista numerada" on={editor.isActive('orderedList')} act={() => editor.chain().focus().toggleOrderedList().run()}>1.</Btn>
        <Btn title="Cita" on={editor.isActive('blockquote')} act={() => editor.chain().focus().toggleBlockquote().run()}>❝</Btn>
        <Btn title="Enlace" on={editor.isActive('link')} act={() => setLinkOpen(o => !o)}>🔗</Btn>
        <Sep />
        {COLORS.map(c => (
          <button key={c} title="Color" onMouseDown={e => { e.preventDefault(); editor.chain().focus().setColor(c).run() }}
            style={{ width: 16, height: 16, borderRadius: '50%', background: c, border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer', margin: '0 1px', flexShrink: 0 }} />
        ))}
        <Sep />
        <Btn title="Deshacer" act={() => editor.chain().focus().undo().run()}>↶</Btn>
        <Btn title="Rehacer" act={() => editor.chain().focus().redo().run()}>↷</Btn>

        {/* Acciones a la derecha (imprimir / copiar / exportar) */}
        <div style={{ flex: 1 }} />
        <Act title="Imprimir" act={printDoc}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        </Act>
        <Act title="Copiar como Markdown" act={copyMarkdown}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>MD</span>
        </Act>
        <Act title="Copiar texto rico" act={copyRich}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </Act>
        <Act title="Exportar a PDF" act={printDoc}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.3 }}>PDF</span>
        </Act>
        <Act title="Exportar a Markdown" act={exportMarkdown}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </Act>
      </div>

      {/* Título del documento = node.text */}
      <input
        className="doc-title"
        defaultValue={node.text}
        placeholder="Título del documento"
        onChange={e => {
          store.updateNode(node.id, { text: e.target.value })
          updateLinkedCanvasText(node.parentId, node.id, canvasMd(e.target.value, editor.getHTML()))
        }}
        style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 30, fontWeight: 700, color: 'var(--text,#111)', marginBottom: 8 }}
      />

      {/* Barra flotante de formato (sobre la selección) */}
      <BubbleMenu editor={editor} tippyOptions={{ duration: 120 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 1, padding: 4, background: 'var(--bg-elevated,#fff)', border: '1px solid var(--border,#e2e2e2)', borderRadius: 10, boxShadow: '0 8px 28px rgba(0,0,0,0.18)' }}>
          <Btn title="Negrita" on={editor.isActive('bold')} act={() => editor.chain().focus().toggleBold().run()}><b>B</b></Btn>
          <Btn title="Cursiva" on={editor.isActive('italic')} act={() => editor.chain().focus().toggleItalic().run()}><i>I</i></Btn>
          <Btn title="Subrayado" on={editor.isActive('underline')} act={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></Btn>
          <Sep />
          <Btn title="Título 1" on={editor.isActive('heading', { level: 1 })} act={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</Btn>
          <Btn title="Título 2" on={editor.isActive('heading', { level: 2 })} act={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</Btn>
          <Btn title="Lista" on={editor.isActive('bulletList')} act={() => editor.chain().focus().toggleBulletList().run()}>•</Btn>
          <Btn title="Enlace" on={editor.isActive('link')} act={() => setLinkOpen(o => !o)}>🔗</Btn>
        </div>
      </BubbleMenu>

      {/* Popover de enlace: pega una URL o busca un nodo de Fromly */}
      {linkOpen && (
        <div style={{ position: 'fixed', left: '50%', top: 120, transform: 'translateX(-50%)', zIndex: 1800, width: 320, padding: 8,
          background: 'var(--bg-elevated,#fff)', border: '1px solid var(--border,#e2e2e2)', borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.2)' }}>
          <input autoFocus value={linkQuery} onChange={e => setLinkQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && /^https?:\/\//i.test(linkQuery)) setLink(linkQuery); if (e.key === 'Escape') setLinkOpen(false) }}
            placeholder="Pega una URL o busca un nodo…"
            style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--border,#ddd)', borderRadius: 8, outline: 'none', fontSize: 14 }} />
          {editor.isActive('link') && (
            <button onMouseDown={e => { e.preventDefault(); editor.chain().focus().unsetLink().run(); setLinkOpen(false) }}
              style={{ marginTop: 6, width: '100%', padding: '6px', border: 'none', background: 'transparent', color: 'var(--danger,#e03131)', cursor: 'pointer', fontSize: 13, textAlign: 'left' }}>Quitar enlace</button>
          )}
          {results.map(n => (
            <button key={n.id} onMouseDown={e => { e.preventDefault(); setLink(`/node/${n.id}`) }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 9px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, color: 'var(--text,#333)', borderRadius: 8 }}>
              {n.text || 'Sin título'}
            </button>
          ))}
        </div>
      )}

      <div onClick={onContentClick}>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
