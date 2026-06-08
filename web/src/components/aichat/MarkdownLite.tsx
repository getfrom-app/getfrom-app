// MarkdownLite — renderiza markdown legible en los mensajes de Magic (web).
// Cubre lo que devuelve el modelo de chat: encabezados, viñetas, listas
// numeradas, negrita, cursiva, código inline, enlaces y párrafos.
// Ligero y seguro (no usa dangerouslySetInnerHTML con HTML del modelo).

import React from 'react'

/** Convierte el inline markdown (**negrita**, *cursiva*, `code`, [txt](url)) a nodos React. */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  // Tokenizador simple por prioridad: código → enlace → negrita → cursiva.
  const regex = /(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(__[^_]+__)|(_[^_]+_)/g
  let lastIndex = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIndex) nodes.push(text.slice(lastIndex, m.index))
    const tok = m[0]
    const k = `${keyPrefix}-${i++}`
    if (tok.startsWith('`')) {
      nodes.push(<code key={k} className="md-code">{tok.slice(1, -1)}</code>)
    } else if (tok.startsWith('[')) {
      const mm = /\[([^\]]+)\]\(([^)]+)\)/.exec(tok)
      if (mm) nodes.push(<a key={k} href={mm[2]} target="_blank" rel="noopener noreferrer">{mm[1]}</a>)
      else nodes.push(tok)
    } else if (tok.startsWith('**') || tok.startsWith('__')) {
      nodes.push(<strong key={k}>{tok.slice(2, -2)}</strong>)
    } else {
      nodes.push(<em key={k}>{tok.slice(1, -1)}</em>)
    }
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

export default function MarkdownLite({ content }: { content: string }) {
  const lines = content.split('\n')
  const blocks: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const raw = lines[i]
    const line = raw.trim()

    if (line === '') { i++; continue }

    // Encabezados
    const h = /^(#{1,3})\s+(.*)$/.exec(line)
    if (h) {
      const level = h[1].length
      const Tag = (level === 1 ? 'h3' : level === 2 ? 'h4' : 'h5') as keyof JSX.IntrinsicElements
      blocks.push(<Tag key={i} className="md-h">{renderInline(h[2], `h${i}`)}</Tag>)
      i++
      continue
    }

    // Lista de viñetas (agrupar líneas consecutivas)
    if (/^[-*•]\s+/.test(line)) {
      const items: React.ReactNode[] = []
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        const txt = lines[i].trim().replace(/^[-*•]\s+/, '')
        items.push(<li key={i}>{renderInline(txt, `li${i}`)}</li>)
        i++
      }
      blocks.push(<ul key={`ul${i}`} className="md-ul">{items}</ul>)
      continue
    }

    // Lista numerada
    if (/^\d+\.\s+/.test(line)) {
      const items: React.ReactNode[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        const txt = lines[i].trim().replace(/^\d+\.\s+/, '')
        items.push(<li key={i}>{renderInline(txt, `ol${i}`)}</li>)
        i++
      }
      blocks.push(<ol key={`ol${i}`} className="md-ol">{items}</ol>)
      continue
    }

    // Párrafo
    blocks.push(<p key={i} className="md-p">{renderInline(line, `p${i}`)}</p>)
    i++
  }

  return <div className="md-lite">{blocks}</div>
}
