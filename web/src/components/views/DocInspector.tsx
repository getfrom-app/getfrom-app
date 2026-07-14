// DocInspector — panel de formato a la DERECHA, estilo Pages (Apple). Opera sobre
// el editor TipTap ACTIVO (docEditorStore): el documento en solitario (NodeView) o
// el elemento de texto que se edita en el lienzo (PizarraView). Solo hay un editor
// activo a la vez; si no hay ninguno, no pinta nada.
//
// `compact`: barra ÚNICA de una fila (mismo estilo que la barra flotante `BubbleMenu`
// del lienzo — clases `wf-format-toolbar`/`ft-btn`), para no ocupar media columna
// derecha. La usa `LienzoDocPanel`. Sin `compact`: la rejilla completa de siempre,
// para la página en solitario de un documento.

import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useActiveDocEditor, getDocImageInsert } from '../../utils/docEditorStore'

const COLORS = ['#222222', '#e03131', '#1971c2', '#2f9e44', '#f08c00', '#9c36b5', '#868e96']

export default function DocInspector({ compact, bar }: { compact?: boolean; bar?: boolean } = {}) {
  const { t } = useTranslation()
  const editor = useActiveDocEditor()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [barMode, setBarMode] = useState<'main' | 'colors' | 'headings'>('main')
  if (!editor) return null

  const setLink = () => {
    const prev = editor.getAttributes('link').href || ''
    const url = window.prompt(t('tip.linkUrl'), prev)
    if (url === null) return
    if (url === '') editor.chain().focus().unsetLink().run()
    else editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  // Crear tarea en el punto del cursor — si está al PRINCIPIO de línea, esa línea se
  // convierte en la casilla (nace ahí mismo); si no, se abre una línea VACÍA nueva
  // debajo (al FINAL de la actual, no partiéndola por el cursor) y ES ESA la que se
  // convierte, sin tocar ni una letra de lo que ya había escrito.
  const insertTask = () => {
    const { $from } = editor.state.selection
    if ($from.parentOffset === 0) {
      editor.chain().focus().toggleTaskList().run()
      return
    }
    const endOfLine = $from.end($from.depth)
    editor.chain().focus().setTextSelection(endOfLine).splitBlock().toggleTaskList().run()
  }

  if (compact || bar) {
    // `bar`: barra PLANA de una fila (iconos normales, sin píldora flotante) para el
    // panel de nota de v2. `compact`: la píldora estilo BubbleMenu del lienzo.
    // H1/H2/H3 van en UN desplegable (antes 3 botones sueltos) para que la barra quepa
    // en una sola línea sin saltar (Alberto: se partía en dos filas en la columna
    // derecha, más estrecha que la página de nota en solitario).
    const headingLevel = editor.isActive('heading', { level: 1 }) ? 1 : editor.isActive('heading', { level: 2 }) ? 2 : editor.isActive('heading', { level: 3 }) ? 3 : 0
    const headingLabel = headingLevel ? `H${headingLevel}` : '¶'
    const setHeading = (level: 1 | 2 | 3) => { editor.chain().focus().toggleHeading({ level }).run(); setBarMode('main') }
    return (
      <div className={bar ? 'v2-doc-toolbar' : 'wf-format-toolbar'} style={bar ? undefined : { position: 'static', width: 'auto' }} onMouseDown={e => e.preventDefault()}>
        {barMode === 'main' && (
          <>
            <button className="ft-btn" title={t('tip.paragraphStyle')} onMouseDown={e => { e.preventDefault(); setBarMode('headings') }}><span style={{ fontWeight: 800, fontSize: 10 }}>{headingLabel}</span></button>
            <div className="ft-sep" />
            <button className="ft-btn" title={t('tip.bold')} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBold().run() }}><strong style={{ fontSize: 13 }}>B</strong></button>
            <button className="ft-btn" title={t('tip.italic')} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleItalic().run() }}><em style={{ fontSize: 13 }}>I</em></button>
            <button className="ft-btn" title={t('tip.underline')} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleUnderline().run() }}><u style={{ fontSize: 13 }}>U</u></button>
            <button className="ft-btn" title={t('format.strikethrough')} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleStrike().run() }}><s style={{ fontSize: 13 }}>S</s></button>
            <div className="ft-sep" />
            <button className="ft-btn" title={t('tip.bulletList')} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBulletList().run() }}><span style={{ fontSize: 13 }}>•</span></button>
            <button className="ft-btn" title={t('tip.orderedList')} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run() }}><span style={{ fontSize: 11 }}>1.</span></button>
            <button className="ft-btn" title={t('format.quote')} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBlockquote().run() }}><span style={{ fontSize: 13 }}>❝</span></button>
            <button className="ft-btn" title={t('tip.codeBlock')} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleCodeBlock().run() }}><span style={{ fontFamily: 'monospace', fontSize: 10 }}>{'<>'}</span></button>
            <button className="ft-btn" title={t('tip.newTask')} onMouseDown={e => { e.preventDefault(); insertTask() }}><span style={{ fontSize: 13 }}>☑</span></button>
            <div className="ft-sep" />
            <button className="ft-btn" title={t('format.link')} onMouseDown={e => { e.preventDefault(); setLink() }}><span style={{ fontSize: 12 }}>🔗</span></button>
            <button className="ft-btn" title={t('tip.image')} onMouseDown={e => { e.preventDefault(); fileRef.current?.click() }}><span style={{ fontSize: 12 }}>🖼</span></button>
            <button className="ft-btn" title={t('tip.color')} onMouseDown={e => { e.preventDefault(); setBarMode('colors') }}><span style={{ fontWeight: 700, fontSize: 13, borderBottom: '2.5px solid #ef4444', lineHeight: 1 }}>A</span></button>
            <div className="ft-sep" />
            <button className="ft-btn" title={t('tip.undo')} onMouseDown={e => { e.preventDefault(); editor.chain().focus().undo().run() }}><span style={{ fontSize: 13 }}>↶</span></button>
            <button className="ft-btn" title={t('tip.redo')} onMouseDown={e => { e.preventDefault(); editor.chain().focus().redo().run() }}><span style={{ fontSize: 13 }}>↷</span></button>
          </>
        )}
        {barMode === 'headings' && (
          <div className="ft-color-panel">
            <div className="ft-color-row">
              <span className="ft-color-label">{t('tip.paragraphStyle')}</span>
              <button className="ft-btn" title={t('tip.normalText')} onMouseDown={e => { e.preventDefault(); editor.chain().focus().setParagraph().run(); setBarMode('main') }}><span style={{ fontSize: 12 }}>¶</span></button>
              <button className="ft-btn" title="H1" onMouseDown={e => { e.preventDefault(); setHeading(1) }}><span style={{ fontWeight: 800, fontSize: 10 }}>H1</span></button>
              <button className="ft-btn" title="H2" onMouseDown={e => { e.preventDefault(); setHeading(2) }}><span style={{ fontWeight: 800, fontSize: 10 }}>H2</span></button>
              <button className="ft-btn" title="H3" onMouseDown={e => { e.preventDefault(); setHeading(3) }}><span style={{ fontWeight: 800, fontSize: 10 }}>H3</span></button>
            </div>
            <div className="ft-color-footer">
              <button className="ft-back-btn" onMouseDown={e => { e.preventDefault(); setBarMode('main') }}>‹ {t('common.back', 'Volver')}</button>
            </div>
          </div>
        )}
        {barMode === 'colors' && (
          <div className="ft-color-panel">
            <div className="ft-color-row">
              <span className="ft-color-label">{t('tip.color')}</span>
              <button className="ft-btn ft-erase-btn" title={t('tip.noColor')} onMouseDown={e => { e.preventDefault(); editor.chain().focus().unsetColor().run(); setBarMode('main') }}>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><line x1="2" y1="10" x2="10" y2="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </button>
              {COLORS.map(c => (
                <button key={c} className="ft-color-swatch" title={c} onMouseDown={e => { e.preventDefault(); editor.chain().focus().setColor(c).run(); setBarMode('main') }}>
                  <span style={{ color: c, fontWeight: 700, fontSize: 13 }}>A</span>
                </button>
              ))}
            </div>
            <div className="ft-color-footer">
              <button className="ft-back-btn" onMouseDown={e => { e.preventDefault(); setBarMode('main') }}>‹ {t('common.back', 'Volver')}</button>
            </div>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; const ins = getDocImageInsert(); if (f && ins) ins(f); e.target.value = '' }} />
      </div>
    )
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
        <Cell title={t('tip.newTask')} act={insertTask} wide>☑ {t('tip.newTask')}</Cell>
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
