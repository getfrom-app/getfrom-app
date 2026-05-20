import React from 'react'

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
      tokens.push(remaining)
      break
    }

    // Pick earliest
    candidates.sort((a, b) => a.index - b.index)
    const best = candidates[0]
    const before = best.match[1]

    if (before) {
      tokens.push(before)
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
