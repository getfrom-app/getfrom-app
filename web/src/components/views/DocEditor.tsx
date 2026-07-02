// DocEditor — DOCUMENTO de verdad (TipTap). Un nodo `_doc='1'` guarda su contenido
// en `body` (HTML). Editor rico: encabezados, listas, citas, código, enlaces,
// colores e IMÁGENES embebidas (subidas a R2). El título es la 1ª línea (se refleja
// en node.text). En el lienzo, el MISMO body se muestra como vista ligera; abrir el
// elemento (su dot) trae aquí el editor completo.

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react'
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
import { setDocEditor, notifyDocEditor } from '../../utils/docEditorStore'

// Paleta de la barra flotante (misma que FormatToolbar del outliner).
const DOC_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#a16207', '#6b7280']

export default function DocEditor({ node, compact }: { node: { id: string; body?: string | null; text?: string }; compact?: boolean }) {
  useStore()
  const navigate = useNavigate()
  const saveTimer = useRef<number | null>(null)
  const editorRef = useRef<ReturnType<typeof useEditor>>(null)
  const [showColors, setShowColors] = useState(false)

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
    onSelectionUpdate: () => notifyDocEditor(),
    onTransaction: () => notifyDocEditor(),
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

  // Registrar el editor activo para la barra de formato de PÁGINA (DocInspector, columna
  // derecha). En el LIENZO (compact) NO se registra: el formato va en la barra flotante y
  // la columna derecha debe seguir siendo la del contexto/tarea, no el inspector de doc.
  useEffect(() => {
    if (!editor || compact) return
    setDocEditor(editor, insertImage)
    return () => setDocEditor(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, compact])

  if (!editor) return null

  const onContentClick = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a') as HTMLAnchorElement | null
    if (!a) return
    const href = a.getAttribute('href') || ''
    if (href.startsWith('/node/') || href.startsWith('/app/node/')) { e.preventDefault(); navigate(href.replace('/app', '')) }
    else if (/^https?:\/\//i.test(href)) { e.preventDefault(); window.open(href, '_blank', 'noopener') }
  }

  return (
    <div className={`doc-editor${compact ? ' doc-editor--compact' : ''}`} style={compact ? { padding: 0, position: 'relative' } : { maxWidth: 760, margin: '0 auto', padding: '4px 4px 120px' }}>
      {/* Barra FLOTANTE de formato (solo en el lienzo). Aparece al seleccionar texto,
          ENCIMA de la selección — la columna derecha sigue siendo la del contexto/tarea.
          Mismo diseño que la FormatToolbar del outliner (clases wf-format-toolbar/ft-*).
          Al ser TipTap, el formato es WYSIWYG: negrita se ve negrita, el color se aplica. */}
      {compact && (
        <BubbleMenu editor={editor} tippyOptions={{ duration: 100, maxWidth: 'none' }}>
          <div className="wf-format-toolbar" style={{ position: 'static', width: 'auto' }} onMouseDown={e => e.preventDefault()}>
            {!showColors ? (
              <>
                <button className="ft-btn" title="H1" onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 1 }).run() }}><span style={{ fontWeight: 800, fontSize: 10 }}>H1</span></button>
                <button className="ft-btn" title="H2" onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 2 }).run() }}><span style={{ fontWeight: 800, fontSize: 10 }}>H2</span></button>
                <button className="ft-btn" title="H3" onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 3 }).run() }}><span style={{ fontWeight: 800, fontSize: 10 }}>H3</span></button>
                <div className="ft-sep" />
                <button className="ft-btn" title="Negrita" onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBold().run() }}><strong style={{ fontSize: 13 }}>B</strong></button>
                <button className="ft-btn" title="Cursiva" onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleItalic().run() }}><em style={{ fontSize: 13 }}>I</em></button>
                <button className="ft-btn" title="Tachado" onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleStrike().run() }}><s style={{ fontSize: 13 }}>S</s></button>
                <div className="ft-sep" />
                <button className="ft-btn" title="Código" onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleCode().run() }}><span style={{ fontFamily: 'monospace', fontSize: 10 }}>{'<>'}</span></button>
                <button className="ft-btn" title="Enlace" onMouseDown={e => { e.preventDefault(); const prev = editor.getAttributes('link').href; const url = window.prompt('URL', prev || 'https://'); if (url === null) return; if (url === '') editor.chain().focus().unsetLink().run(); else editor.chain().focus().setLink({ href: url }).run() }}><span style={{ fontSize: 12 }}>🔗</span></button>
                <div className="ft-sep" />
                <button className="ft-btn" title="Color" onMouseDown={e => { e.preventDefault(); setShowColors(true) }}><span style={{ fontWeight: 700, fontSize: 13, borderBottom: '2.5px solid #ef4444', lineHeight: 1 }}>A</span></button>
              </>
            ) : (
              <div className="ft-color-panel">
                <div className="ft-color-row">
                  <span className="ft-color-label">Color</span>
                  <button className="ft-btn ft-erase-btn" title="Quitar color" onMouseDown={e => { e.preventDefault(); editor.chain().focus().unsetColor().run(); setShowColors(false) }}>
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><line x1="2" y1="10" x2="10" y2="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                  </button>
                  {DOC_COLORS.map(c => (
                    <button key={c} className="ft-color-swatch" title={c} onMouseDown={e => { e.preventDefault(); editor.chain().focus().setColor(c).run(); setShowColors(false) }}>
                      <span style={{ color: c, fontWeight: 700, fontSize: 13 }}>A</span>
                    </button>
                  ))}
                </div>
                <div className="ft-color-footer">
                  <button className="ft-back-btn" onMouseDown={e => { e.preventDefault(); setShowColors(false) }}>‹ Volver</button>
                </div>
              </div>
            )}
          </div>
        </BubbleMenu>
      )}
      <div onClick={onContentClick}>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
