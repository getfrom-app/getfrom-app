// DocEditor — DOCUMENTO de verdad (TipTap). Un nodo `_doc='1'` guarda su contenido
// en `body` (HTML). Editor rico: encabezados, listas, citas, código, enlaces,
// colores e IMÁGENES embebidas (subidas a R2). El título es la 1ª línea (se refleja
// en node.text). En el lienzo, el MISMO body se muestra como vista ligera; abrir el
// elemento (su dot) trae aquí el editor completo.

import { useEffect, useRef } from 'react'
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
import { setDocEditor, notifyDocEditor } from '../../utils/docEditorStore'

export default function DocEditor({ node, compact }: { node: { id: string; body?: string | null; text?: string }; compact?: boolean }) {
  useStore()
  const navigate = useNavigate()
  const saveTimer = useRef<number | null>(null)
  const editorRef = useRef<ReturnType<typeof useEditor>>(null)

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

  // Registrar el editor activo para la barra de formato (DocInspector, columna derecha).
  useEffect(() => {
    if (!editor) return
    setDocEditor(editor, insertImage)
    return () => setDocEditor(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

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
      <div onClick={onContentClick}>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
