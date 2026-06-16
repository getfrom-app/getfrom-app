// TextToolbar — barra de formato ÚNICA del elemento-texto. Es la MISMA en el
// lienzo (cuando editas un texto) y en la vista independiente del documento, para
// que el elemento se vea y se maneje exactamente igual en ambos sitios.
//
// Opera sobre el contentEditable enfocado vía document.execCommand: los botones
// usan onMouseDown+preventDefault para no robar el foco al editable.

import { useEffect, useState } from 'react'

const COLORS = ['#222222', '#e03131', '#1971c2', '#2f9e44', '#f08c00', '#9c36b5']

const exec = (cmd: string, val?: string) => { try { document.execCommand(cmd, false, val) } catch { /* noop */ } }
const blockIs = (tag: string) => {
  try { return (document.queryCommandValue('formatBlock') || '').toLowerCase() === tag } catch { return false }
}
const stateOf = (cmd: string) => { try { return document.queryCommandState(cmd) } catch { return false } }

export default function TextToolbar() {
  // Re-render al cambiar la selección → estados activos (B/I/H1…) correctos.
  const [, tick] = useState(0)
  useEffect(() => {
    const h = () => tick(t => t + 1)
    document.addEventListener('selectionchange', h)
    return () => document.removeEventListener('selectionchange', h)
  }, [])

  const Btn = ({ on, cmd, val, children, title }: { on?: boolean; cmd: string; val?: string; children: React.ReactNode; title: string }) => (
    <button title={title} onMouseDown={e => { e.preventDefault(); exec(cmd, val) }}
      style={{ minWidth: 30, height: 30, border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14,
        background: on ? 'var(--accent,#6c5ce7)' : 'transparent', color: on ? '#fff' : 'var(--text,#333)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'background .12s' }}>{children}</button>
  )
  const Sep = () => <div style={{ width: 1, height: 20, background: 'var(--border,#e2e2e2)', margin: '0 4px', flexShrink: 0 }} />

  return (
    <div className="text-toolbar" onMouseDown={e => e.preventDefault()} style={{
      display: 'flex', alignItems: 'center', gap: 2, padding: '6px 8px',
      background: 'var(--bg-elevated,#fff)', border: '1px solid var(--border,#e2e2e2)',
      borderRadius: 14, boxShadow: '0 10px 32px rgba(0,0,0,0.16)',
    }}>
      <Btn title="Título 1" on={blockIs('h1')} cmd="formatBlock" val="H1">H1</Btn>
      <Btn title="Título 2" on={blockIs('h2')} cmd="formatBlock" val="H2">H2</Btn>
      <Btn title="Título 3" on={blockIs('h3')} cmd="formatBlock" val="H3">H3</Btn>
      <Btn title="Texto normal" on={blockIs('p') || blockIs('div')} cmd="formatBlock" val="P">¶</Btn>
      <Sep />
      <Btn title="Negrita" on={stateOf('bold')} cmd="bold"><b>B</b></Btn>
      <Btn title="Cursiva" on={stateOf('italic')} cmd="italic"><i>I</i></Btn>
      <Btn title="Subrayado" on={stateOf('underline')} cmd="underline"><u>U</u></Btn>
      <Btn title="Tachado" on={stateOf('strikeThrough')} cmd="strikeThrough"><s>S</s></Btn>
      <Sep />
      <Btn title="Lista" on={stateOf('insertUnorderedList')} cmd="insertUnorderedList">•</Btn>
      <Btn title="Lista numerada" on={stateOf('insertOrderedList')} cmd="insertOrderedList">1.</Btn>
      <Btn title="Cita" on={blockIs('blockquote')} cmd="formatBlock" val="BLOCKQUOTE">❝</Btn>
      <button title="Enlace" onMouseDown={e => { e.preventDefault(); const u = window.prompt('URL del enlace:'); if (u) exec('createLink', u) }}
        style={{ minWidth: 30, height: 30, border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, background: 'transparent', color: 'var(--text,#333)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>🔗</button>
      <Sep />
      {COLORS.map(c => (
        <button key={c} title="Color" onMouseDown={e => { e.preventDefault(); exec('foreColor', c) }}
          style={{ width: 17, height: 17, borderRadius: '50%', background: c, border: '1px solid rgba(0,0,0,0.12)', cursor: 'pointer', margin: '0 1px', flexShrink: 0 }} />
      ))}
      <Sep />
      <Btn title="Deshacer" cmd="undo">↶</Btn>
      <Btn title="Rehacer" cmd="redo">↷</Btn>
    </div>
  )
}
