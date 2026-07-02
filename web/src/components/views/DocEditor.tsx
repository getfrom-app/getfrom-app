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
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { store, useStore } from '../../store/nodeStore'
import { assignContext } from '../../utils/cajones'
import { firstLineTitle } from '../../utils/docNode'
import { extractDateFromEnd } from '../../utils/naturalDate'
import { uploadFile } from '../../api/client'
import { setDocEditor, notifyDocEditor } from '../../utils/docEditorStore'

// Paleta de la barra flotante (misma que FormatToolbar del outliner).
const DOC_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#a16207', '#6b7280']

// TaskItem con un id ESTABLE (`data-node-id`) que enlaza cada casilla del texto con su
// nodo-tarea de From real. Es la clave anti-duplicación: el sync reconcilia por este id
// (actualiza si existe, crea solo si falta y le escribe el id de vuelta). Se persiste en
// el HTML del body, así sobrevive a recargas.
const TaskItemLinked = TaskItem.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      dataNodeId: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-node-id'),
        renderHTML: (attrs: { dataNodeId?: string | null }) => (attrs.dataNodeId ? { 'data-node-id': attrs.dataNodeId } : {}),
      },
    }
  },
})

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

  // ── Paso 2: sincroniza las CASILLAS del texto con tareas-From REALES ──────────
  // Cada `taskItem` ↔ un nodo-tarea hijo del `_doc` (con `_taskEmbed='1'`), status según
  // la casilla. Idempotente y anti-duplicación: reconcilia por `dataNodeId` (actualiza si
  // existe; crea SOLO si falta y le escribe el id de vuelta en el mismo tick; borra los
  // huérfanos). Hereda el contexto (`_ctxRefs`) del `_doc` si lo tiene → la tarea aparece
  // en la columna del contexto/día. Solo corre para el editor en edición (el activo).
  const syncingRef = useRef(false)
  const lastDetailRef = useRef<string | null>(null)
  const syncTasksToNodes = () => {
    const ed = editorRef.current
    if (!ed || syncingRef.current) return
    syncingRef.current = true
    try {
      const seen = new Set<string>()
      const assign: { pos: number; id: string }[] = []
      let parentRefs: string[] = []
      try { const r = JSON.parse(store.getNode(node.id)?.extraData || '{}')._ctxRefs; if (Array.isArray(r)) parentRefs = r } catch { /* ignore */ }
      ed.state.doc.descendants((item, pos) => {
        if (item.type.name !== 'taskItem') return true
        const text = item.textContent.trim()
        if (!text) return true // casilla vacía: aún no es tarea (evita nodos «Sin título»)
        const status = item.attrs.checked ? 'done' : 'pending'
        const id = item.attrs.dataNodeId as string | null
        const existing = id ? store.getNode(id) : null
        if (existing && !existing.deletedAt) {
          if (existing.text !== text || existing.status !== status) store.updateNode(id!, { text, status })
          seen.add(id!)
        } else {
          const created = store.createNode({ text, parentId: node.id, extraData: { _taskEmbed: '1' } })
          const updates: Record<string, unknown> = { status }
          // Magic de FECHA: si el texto lleva una fecha natural («… mañana», «… el viernes»),
          // la tarea coge ese `due` y entra en la agenda del día correcto. Solo al CREAR (no
          // se re-machaca luego: si el usuario ajusta la fecha en la columna, se respeta).
          try {
            const dt = extractDateFromEnd(text)
            if (dt?.parsed?.date) {
              const d = new Date(dt.parsed.date); d.setHours(0, 0, 0, 0)
              if (dt.timeStr) { const [h, m] = dt.timeStr.split(':').map(Number); updates.due = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).toISOString() }
              else updates.due = d.toISOString()
            }
          } catch { /* sin fecha */ }
          store.updateNode(created.id, updates)
          // Hereda el contexto del `_doc` (si lo tiene) → la tarea aparece en su columna.
          for (const ref of parentRefs) assignContext(created.id, ref)
          assign.push({ pos, id: created.id })
          seen.add(created.id)
        }
        return true
      })
      if (assign.length) {
        const tr = ed.state.tr
        for (const a of assign) tr.setNodeAttribute(a.pos, 'dataNodeId', a.id)
        tr.setMeta('addToHistory', false)
        ed.view.dispatch(tr)
      }
      // Borrar las tareas-embed cuyas casillas ya no existen en el texto. (Solo afecta a
      // nodos hijos con `_taskEmbed='1'` de ESTE _doc → jamás toca contenido normal.)
      for (const c of store.children(node.id)) {
        if (c.deletedAt) continue
        let emb = false
        try { emb = JSON.parse(c.extraData || '{}')._taskEmbed === '1' } catch { /* ignore */ }
        if (emb && !seen.has(c.id)) store.deleteNode(c.id)
      }
    } finally {
      syncingRef.current = false
    }
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextStyle,
      Color,
      // Casillas de tarea DENTRO del texto: «[] » al inicio de línea las crea (input rule
      // nativo de TaskList). Paso 1 = casilla WYSIWYG marcable. Paso 2 (pendiente) = cada
      // casilla se enlazará a una tarea-From real (agenda) por su nodo hijo.
      TaskList,
      TaskItemLinked.configure({ nested: true }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener nofollow' } }),
      Placeholder.configure({ placeholder: 'Escribe tu documento…' }),
      Image.configure({ inline: false, allowBase64: false }),
    ],
    content: node.body || '',
    autofocus: compact ? 'end' : false,
    onUpdate: ({ editor }) => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      const html = editor.getHTML()
      saveTimer.current = window.setTimeout(() => {
        store.updateNode(node.id, { body: html, text: firstLineTitle(html) })
        syncTasksToNodes()
      }, 500)
    },
    onSelectionUpdate: ({ editor }) => {
      notifyDocEditor()
      // En el LIENZO: si el cursor está DENTRO de una casilla enlazada, la columna derecha
      // muestra las propiedades de ESA tarea (fecha/repetición/prioridad). Fuera de una
      // casilla → vuelve a la columna del propio texto (contexto/día). Solo al cambiar el
      // objetivo (no en cada tecla) para no spamear.
      if (!compact) return
      const { $from } = editor.state.selection
      let taskId: string | null = null
      for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type.name === 'taskItem') { taskId = ($from.node(d).attrs.dataNodeId as string | null) ?? null; break }
      }
      const linked = taskId && store.getNode(taskId) && !store.getNode(taskId)!.deletedAt ? taskId : node.id
      if (linked !== lastDetailRef.current) {
        lastDetailRef.current = linked
        window.dispatchEvent(new CustomEvent('from:open-detail', { detail: { nodeId: linked } }))
      }
    },
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
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    if (editor) {
      syncTasksToNodes() // reconcilia y asigna ids al doc ANTES de guardar el HTML final
      store.updateNode(node.id, { body: editor.getHTML(), text: firstLineTitle(editor.getHTML()) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, node.id])

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
                <button className="ft-btn" title="Tarea (casilla)" onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleTaskList().run() }}><span style={{ fontSize: 12 }}>☑</span></button>
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
