// DocEditor — documento de TEXTO RICO (no nodos). Un nodo-documento (extraData
// _doc='1') guarda el contenido en su `body` (HTML de TipTap). Se edita como un
// documento completo: título + párrafos, barra flotante, y enlaces internos
// (a cualquier nodo de Fromly) y externos.

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
import type { Node } from '../../types'

const COLORS = ['#222222', '#e03131', '#1971c2', '#2f9e44', '#f08c00', '#9c36b5']

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
      saveTimer.current = window.setTimeout(() => store.updateNode(node.id, { body: editor.getHTML() }), 600)
    },
  }, [node.id])

  // Guardar al desmontar (sin perder el último cambio del debounce).
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    if (editor) store.updateNode(node.id, { body: editor.getHTML() })
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

  const Btn = ({ on, act, children, title }: { on?: boolean; act: () => void; children: React.ReactNode; title: string }) => (
    <button title={title} onMouseDown={e => { e.preventDefault(); act() }}
      style={{ minWidth: 28, height: 28, border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14,
        background: on ? 'var(--accent-soft,rgba(108,92,231,0.16))' : 'transparent', color: on ? 'var(--accent,#6c5ce7)' : 'var(--text,#333)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{children}</button>
  )

  return (
    <div className="doc-editor" style={{ maxWidth: 760, margin: '0 auto', padding: '8px 4px 80px' }}>
      {/* Título del documento = node.text */}
      <input
        className="doc-title"
        defaultValue={node.text}
        placeholder="Título del documento"
        onChange={e => store.updateNode(node.id, { text: e.target.value })}
        style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 30, fontWeight: 700, color: 'var(--text,#111)', marginBottom: 8 }}
      />

      {/* Barra flotante de formato (sobre la selección) */}
      <BubbleMenu editor={editor} tippyOptions={{ duration: 120 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 1, padding: 4, background: 'var(--bg-elevated,#fff)', border: '1px solid var(--border,#e2e2e2)', borderRadius: 10, boxShadow: '0 8px 28px rgba(0,0,0,0.18)' }}>
          <Btn title="Negrita" on={editor.isActive('bold')} act={() => editor.chain().focus().toggleBold().run()}><b>B</b></Btn>
          <Btn title="Cursiva" on={editor.isActive('italic')} act={() => editor.chain().focus().toggleItalic().run()}><i>I</i></Btn>
          <Btn title="Subrayado" on={editor.isActive('underline')} act={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></Btn>
          <div style={{ width: 1, height: 18, background: 'var(--border,#e2e2e2)', margin: '0 2px' }} />
          <Btn title="Título 1" on={editor.isActive('heading', { level: 1 })} act={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</Btn>
          <Btn title="Título 2" on={editor.isActive('heading', { level: 2 })} act={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</Btn>
          <Btn title="Lista" on={editor.isActive('bulletList')} act={() => editor.chain().focus().toggleBulletList().run()}>•</Btn>
          <Btn title="Enlace" on={editor.isActive('link')} act={() => setLinkOpen(o => !o)}>🔗</Btn>
          <div style={{ width: 1, height: 18, background: 'var(--border,#e2e2e2)', margin: '0 2px' }} />
          {COLORS.map(c => (
            <button key={c} title="Color" onMouseDown={e => { e.preventDefault(); editor.chain().focus().setColor(c).run() }}
              style={{ width: 16, height: 16, borderRadius: '50%', background: c, border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer', margin: '0 1px' }} />
          ))}
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
