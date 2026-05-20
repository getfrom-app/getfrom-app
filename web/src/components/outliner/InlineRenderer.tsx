import React from 'react'

// ── Tag color system (matches From Mac) ──────────────────────────────────────
const TAG_COLORS = ['blue', 'green', 'orange', 'purple', 'pink', 'red', 'yellow', 'teal']

function getTagColor(tag: string): string {
  let hash = 0
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash)
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length]
}

// Render text with colored hashtags
function renderWithTags(text: string, key: number): React.ReactNode {
  const parts = text.split(/(#[\wÀ-ɏ]+)/g)
  if (parts.length === 1) return text
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('#') && part.length > 1) {
          const tagName = part.slice(1)
          const color = getTagColor(tagName)
          return (
            <span key={`tag-${key}-${i}`} className={`tag-inline tag-inline--${color}`}>
              {part}
            </span>
          )
        }
        return part
      })}
    </>
  )
}

// Parses inline markdown and returns JSX
export function renderInline(text: string): React.ReactNode {
  // Tokenize: bold, italic, code, strikethrough, link
  const tokens: React.ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    // Link: [text](url)
    const linkMatch = remaining.match(/^(.*?)\[([^\]]+)\]\(([^)]+)\)/)
    // Bold: **text**
    const boldMatch = remaining.match(/^(.*?)\*\*(.+?)\*\*/)
    // Italic: *text* (not **)
    const italicMatch = remaining.match(/^(.*?)(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/)
    // Code: `text`
    const codeMatch = remaining.match(/^(.*?)`(.+?)`/)
    // Strikethrough: ~~text~~
    const strikeMatch = remaining.match(/^(.*?)~~(.+?)~~/)

    // Find which match comes first
    const candidates: Array<{ index: number; type: string; match: RegExpMatchArray }> = []
    if (linkMatch) candidates.push({ index: linkMatch[1].length, type: 'link', match: linkMatch })
    if (boldMatch) candidates.push({ index: boldMatch[1].length, type: 'bold', match: boldMatch })
    if (italicMatch) candidates.push({ index: italicMatch[1].length, type: 'italic', match: italicMatch })
    if (codeMatch) candidates.push({ index: codeMatch[1].length, type: 'code', match: codeMatch })
    if (strikeMatch) candidates.push({ index: strikeMatch[1].length, type: 'strike', match: strikeMatch })

    if (candidates.length === 0) {
      tokens.push(renderWithTags(remaining, key++))
      break
    }

    // Pick earliest
    candidates.sort((a, b) => a.index - b.index)
    const best = candidates[0]
    const before = best.match[1]

    if (before) {
      tokens.push(renderWithTags(before, key++))
    }

    if (best.type === 'bold') {
      tokens.push(<strong key={key++}>{renderInline(best.match[2])}</strong>)
      remaining = remaining.slice(before.length + best.match[2].length + 4) // **x**
    } else if (best.type === 'italic') {
      tokens.push(<em key={key++}>{renderInline(best.match[2])}</em>)
      remaining = remaining.slice(before.length + best.match[2].length + 2) // *x*
    } else if (best.type === 'code') {
      tokens.push(
        <code key={key++} className="inline-code">
          {best.match[2]}
        </code>
      )
      remaining = remaining.slice(before.length + best.match[2].length + 2) // `x`
    } else if (best.type === 'strike') {
      tokens.push(<s key={key++}>{renderInline(best.match[2])}</s>)
      remaining = remaining.slice(before.length + best.match[2].length + 4) // ~~x~~
    } else if (best.type === 'link') {
      tokens.push(
        <a key={key++} href={best.match[3]} target="_blank" rel="noopener noreferrer">
          {best.match[2]}
        </a>
      )
      remaining = remaining.slice(before.length + best.match[2].length + best.match[3].length + 4) // [t](u)
    }
  }

  return <>{tokens}</>
}

interface Props {
  text: string
  className?: string
}

// Detect block type from text prefix
export type BlockType = 'h1' | 'h2' | 'h3' | 'divider' | 'quote' | 'text'

export function detectBlockType(text: string): BlockType {
  if (text === '---') return 'divider'
  if (text.startsWith('### ')) return 'h3'
  if (text.startsWith('## ')) return 'h2'
  if (text.startsWith('# ')) return 'h1'
  if (text.startsWith('> ')) return 'quote'
  return 'text'
}

export function getBlockContent(text: string, type: BlockType): string {
  if (type === 'h1') return text.slice(2)
  if (type === 'h2') return text.slice(3)
  if (type === 'h3') return text.slice(4)
  if (type === 'quote') return text.slice(2)
  return text
}

export default function InlineRenderer({ text, className }: Props) {
  const type = detectBlockType(text)
  const content = getBlockContent(text, type)

  if (type === 'divider') {
    return <hr className="block-divider" />
  }

  if (type === 'h1') {
    return <span className={`block-h1 ${className || ''}`}>{renderInline(content)}</span>
  }
  if (type === 'h2') {
    return <span className={`block-h2 ${className || ''}`}>{renderInline(content)}</span>
  }
  if (type === 'h3') {
    return <span className={`block-h3 ${className || ''}`}>{renderInline(content)}</span>
  }
  if (type === 'quote') {
    return <span className={`block-quote ${className || ''}`}>{renderInline(content)}</span>
  }

  return <span className={className}>{renderInline(text)}</span>
}

// ── HTML string renderer (para useEffect en contentEditable) ─────────────────
// Convierte texto con markdown inline a HTML string sin React nodes
// Evita poner React children dentro de contentEditable (bug removeChild)
export function renderInlineToHtml(text: string, highlight?: string): string {
  if (!text) return ''
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  // Detectar tipo de bloque
  const type = detectBlockType(text)
  let content = text
  let wrapClass = ''

  if (type === 'divider') return '<hr class="block-divider" />'
  if (type === 'h1') { content = text.replace(/^#\s*/, ''); wrapClass = 'block-h1' }
  else if (type === 'h2') { content = text.replace(/^##\s*/, ''); wrapClass = 'block-h2' }
  else if (type === 'h3') { content = text.replace(/^###\s*/, ''); wrapClass = 'block-h3' }
  else if (type === 'quote') { content = text.replace(/^>\s*/, ''); wrapClass = 'block-quote' }

  // Procesar inline markdown
  let html = esc(content)
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    // hashtags con color
    .replace(/#([\wÀ-ɏ]+)/g, (match, tag) => {
      const color = TAG_COLORS[Math.abs(tag.split('').reduce((h: number, c: string) => c.charCodeAt(0) + ((h << 5) - h), 0)) % TAG_COLORS.length]
      return `<span class="tag-inline tag-inline--${color}">${match}</span>`
    })

  // Aplicar highlight de búsqueda si existe
  if (highlight && highlight.trim()) {
    const escapedHighlight = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`(${escapedHighlight})`, 'gi')
    html = html.replace(re, '<mark class="search-highlight">$1</mark>')
  }

  return wrapClass ? `<span class="${wrapClass}">${html}</span>` : html
}
