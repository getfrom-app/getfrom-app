// DocEditor — DOCUMENTO de verdad (TipTap). Un nodo `_doc='1'` guarda su contenido
// en `body` (HTML). Editor rico: encabezados, listas, citas, código, enlaces,
// colores e IMÁGENES embebidas (subidas a R2). El título es la 1ª línea (se refleja
// en node.text). En el lienzo, el MISMO body se muestra como vista ligera; abrir el
// elemento (su dot) trae aquí el editor completo.

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Image from '@tiptap/extension-image'
import { store, useStore } from '../../store/nodeStore'
import { firstLineTitle } from '../../utils/docNode'
import { uploadFile } from '../../api/client'

const COLORS = ['#222222', '#e03131', '#1971c2', '#2f9e44', '#f08c00', '#9c36b5']

export default function DocEditor({ node, compact }: { node: { id: string; body?: string | null; text?: string }; compact?: boolean }) {
  useStore()
  const navigate = useNavigate()
  const saveTimer = useRef<number | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const editorRef = useRef<ReturnType<typeof useEditor>>(null)
  const [, force] = useState(0)

  // Sube una imagen a R2 y la inserta en el cursor.
  const insertImage = async (file: File) => {
    const ed = editorRef.current
    if (!ed || !file.type.startsWith('image/')) return
    try { const { publicUrl } = await uploadFile(file); ed.chain().focus().setImage({ src: publicUrl }).run() }
    catch { /* silencioso */ }
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextStyle,
      Color,
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener nofollow' } }),
      Placeholder.configure({ placeholder: 'Escribe tu documento…' }),
      Image.configure({ inline: false, allowBase64: false }),
    ],
    content: node.body || '',
    autofocus: compact ? 'end' : false,
    onUpdate: ({ editor }) => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      const html = editor.getHTML()
      saveTimer.current = window.setTimeout(() => store.updateNode(node.id, { body: html, text: firstLineTitle(html) }), 500)
    },
    onSelectionUpdate: () => force(x => x + 1),
    onTransaction: () => force(x => x + 1),
    editorProps: {
      // Pegar / soltar imágenes → subir a R2 e insertar.
      handlePaste: (_v, e) => {
        const items = Array.from(e.clipboardData?.items || [])
        const img = items.find(i => i.type.startsWith('image/'))
        if (img) { const f = img.getAsFile(); if (f) { insertImage(f); return true } }
        return false
      },
      handleDrop: (_v, e) => {
        const dt = (e as DragEvent).dataTransfer
        const f = Array.from(dt?.files || []).find(x => x.type.startsWith('image/'))
        if (f) { insertImage(f); return true }
        return false
      },
    },
  }, [node.id])
  editorRef.current = editor

  // Sanear título al abrir + clic en enlaces internos/externos.
  useEffect(() => {
    if (!editor) return
    const t = firstLineTitle(editor.getHTML())
    if (t && t !== node.text) store.updateNode(node.id, { text: t })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, node.id])
  useEffect(() => () => { if (saveTimer.current) { clearTimeout(saveTimer.current); if (editor) store.updateNode(node.id, { body: editor.getHTML(), text: firstLineTitle(editor.getHTML()) }) } }, [editor, node.id])

  if (!editor) return null

  const onContentClick = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a') as HTMLAnchorElement | null
    if (!a) return
    const href = a.getAttribute('href') || ''
    if (href.startsWith('/node/') || href.startsWith('/app/node/')) { e.preventDefault(); navigate(href.replace('/app', '')) }
    else if (/^https?:\/\//i.test(href)) { e.preventDefault(); window.open(href, '_blank', 'noopener') }
  }
  const setLink = () => {
    const prev = editor.getAttributes('link').href || ''
    const url = window.prompt('URL del enlace:', prev)
    if (url === null) return
    if (url === '') editor.chain().focus().unsetLink().run()
    else editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  const Btn = ({ on, act, children, title }: { on?: boolean; act: () => void; children: React.ReactNode; title: string }) => (
    <button title={title} onMouseDown={e => { e.preventDefault(); act() }}
      style={{ minWidth: 30, height: 30, border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14,
        background: on ? 'var(--accent,#6c5ce7)' : 'transparent', color: on ? '#fff' : 'var(--text,#333)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'background .12s' }}>{children}</button>
  )
  const Sep = () => <div style={{ width: 1, height: 20, background: 'var(--border,#e2e2e2)', margin: '0 4px', flexShrink: 0 }} />

  return (
    <div className="doc-editor" style={compact ? { padding: '2px 2px 6px', position: 'relative' } : { maxWidth: 760, margin: '0 auto', padding: '4px 4px 120px' }}>
      {/* Barra de formato ENCIMA del texto (en compact = flotante sobre el elemento). */}
      <div className="doc-toolbar" style={compact
        ? { position: 'absolute', left: 0, top: -46, zIndex: 1500, display: 'flex' }
        : { position: 'sticky', top: 6, zIndex: 1500, display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 1, padding: '6px 8px', flexWrap: 'wrap',
          background: 'var(--bg-elevated,#fff)', border: '1px solid var(--border,#e2e2e2)', borderRadius: 14, boxShadow: '0 6px 22px rgba(0,0,0,0.12)' }}>
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
          <Btn title="Enlace" on={editor.isActive('link')} act={setLink}>🔗</Btn>
          <Btn title="Imagen" act={() => fileRef.current?.click()}>🖼</Btn>
          <Sep />
          {COLORS.map(c => (
            <button key={c} title="Color" onMouseDown={e => { e.preventDefault(); editor.chain().focus().setColor(c).run() }}
              style={{ width: 17, height: 17, borderRadius: '50%', background: c, border: '1px solid rgba(0,0,0,0.12)', cursor: 'pointer', margin: '0 1px', flexShrink: 0 }} />
          ))}
          <Sep />
          <Btn title="Deshacer" act={() => editor.chain().focus().undo().run()}>↶</Btn>
          <Btn title="Rehacer" act={() => editor.chain().focus().redo().run()}>↷</Btn>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) insertImage(f); e.target.value = '' }} />

      <div onClick={onContentClick}>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
