// DocInspector — panel de formato a la DERECHA, estilo Pages (Apple). Opera sobre
// el editor TipTap ACTIVO (docEditorStore): el documento en solitario (NodeView) o
// el elemento de texto que se edita en el lienzo (PizarraView). Solo hay un editor
// activo a la vez; si no hay ninguno, no pinta nada.

import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useActiveDocEditor, getDocImageInsert } from '../../utils/docEditorStore'

const COLORS = ['#222222', '#e03131', '#1971c2', '#2f9e44', '#f08c00', '#9c36b5', '#868e96']

export default function DocInspector() {
  const { t } = useTranslation()
  const editor = useActiveDocEditor()
  const fileRef = useRef<HTMLInputElement | null>(null)
  if (!editor) return null

  const setLink = () => {
    const prev = editor.getAttributes('link').href || ''
    const url = window.prompt(t('tip.linkUrl'), prev)
    if (url === null) return
    if (url === '') editor.chain().focus().unsetLink().run()
    else editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  // Botón cuadrado de la rejilla.
  const Cell = ({ on, act, children, title, wide }: { on?: boolean; act: () => void; children: React.ReactNode; title: string; wide?: boolean }) => (
    <button title={title} onMouseDown={e => { e.preventDefault(); act() }}
      style={{
        height: 34, gridColumn: wide ? 'span 2' : undefined, border: '1px solid var(--border,#e2e2e2)',
        borderRadius: 9, cursor: 'pointer', fontSize: 14, lineHeight: 1,
        background: on ? 'var(--accent,#6c5ce7)' : 'var(--bg-elevated,#fff)', color: on ? '#fff' : 'var(--text,#333)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'background .12s, color .12s',
      }}>{children}</button>
  )
  const grid = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 } as const
  const Label = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-tertiary,#9a9a9a)', margin: '16px 2px 8px' }}>{children}</div>
  )

  return (
    <div className="doc-inspector" style={{
      width: '100%', height: '100%', minHeight: 0,
      background: 'var(--bg-elevated,#fafafa)', padding: '14px 16px 40px', overflowY: 'auto',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text,#333)', marginBottom: 2 }}>{t('tip.format')}</div>

      <Label>{t('tip.paragraphStyle')}</Label>
      <div style={grid}>
        <Cell title={t('tip.normalText')} on={editor.isActive('paragraph')} act={() => editor.chain().focus().setParagraph().run()} wide>{t('tip.body')}</Cell>
        <Cell title={t('format.heading1')} on={editor.isActive('heading', { level: 1 })} act={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</Cell>
        <Cell title={t('format.heading2')} on={editor.isActive('heading', { level: 2 })} act={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</Cell>
        <Cell title={t('format.heading3')} on={editor.isActive('heading', { level: 3 })} act={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</Cell>
      </div>

      <Label>{t('tip.font')}</Label>
      <div style={grid}>
        <Cell title={t('tip.bold')} on={editor.isActive('bold')} act={() => editor.chain().focus().toggleBold().run()}><b>B</b></Cell>
        <Cell title={t('tip.italic')} on={editor.isActive('italic')} act={() => editor.chain().focus().toggleItalic().run()}><i>I</i></Cell>
        <Cell title={t('tip.underline')} on={editor.isActive('underline')} act={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></Cell>
        <Cell title={t('format.strikethrough')} on={editor.isActive('strike')} act={() => editor.chain().focus().toggleStrike().run()}><s>S</s></Cell>
      </div>

      <Label>{t('tip.textColor')}</Label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '2px' }}>
        {COLORS.map(c => (
          <button key={c} title={t('tip.color')} onMouseDown={e => { e.preventDefault(); editor.chain().focus().setColor(c).run() }}
            style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: '2px solid var(--bg-elevated,#fff)', boxShadow: '0 0 0 1px var(--border,#d8d8d8)', cursor: 'pointer' }} />
        ))}
        <button title={t('tip.noColor')} onMouseDown={e => { e.preventDefault(); editor.chain().focus().unsetColor().run() }}
          style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--bg,#fff)', border: '1px dashed var(--text-tertiary,#bbb)', cursor: 'pointer', fontSize: 11, color: 'var(--text-tertiary,#999)' }}>✕</button>
      </div>

      <Label>{t('tip.listsAndBlocks')}</Label>
      <div style={grid}>
        <Cell title={t('tip.bulletList')} on={editor.isActive('bulletList')} act={() => editor.chain().focus().toggleBulletList().run()}>•</Cell>
        <Cell title={t('tip.orderedList')} on={editor.isActive('orderedList')} act={() => editor.chain().focus().toggleOrderedList().run()}>1.</Cell>
        <Cell title={t('format.quote')} on={editor.isActive('blockquote')} act={() => editor.chain().focus().toggleBlockquote().run()}>❝</Cell>
        <Cell title={t('tip.codeBlock')} on={editor.isActive('codeBlock')} act={() => editor.chain().focus().toggleCodeBlock().run()}>{'</>'}</Cell>
      </div>

      <Label>{t('tip.insert')}</Label>
      <div style={grid}>
        <Cell title={t('format.link')} on={editor.isActive('link')} act={setLink} wide>🔗 {t('format.link')}</Cell>
        <Cell title={t('tip.image')} act={() => fileRef.current?.click()} wide>🖼 {t('tip.image')}</Cell>
      </div>

      <Label>{t('tip.editing')}</Label>
      <div style={grid}>
        <Cell title={t('tip.undo')} act={() => editor.chain().focus().undo().run()} wide>↶ {t('tip.undo')}</Cell>
        <Cell title={t('tip.redo')} act={() => editor.chain().focus().redo().run()} wide>↷ {t('tip.redo')}</Cell>
      </div>

      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; const ins = getDocImageInsert(); if (f && ins) ins(f); e.target.value = '' }} />
    </div>
  )
}
