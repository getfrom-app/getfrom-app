import React from 'react'
import { store } from '../../store/nodeStore'

/** Normaliza para búsqueda: sin tildes, sin mayúsculas */
function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * Highlight accent+case-insensitive en HTML ya generado.
 * Trabaja en los fragmentos de texto entre tags HTML para no corromper atributos.
 * Usa posiciones normalizadas → original (funcionan 1:1 para texto latino NFC→NFD).
 */
function highlightNormalized(html: string, search: string): string {
  const normalSearch = norm(search.trim()).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (!normalSearch) return html
  const re = new RegExp(normalSearch, 'g')

  // Dividir por tags HTML para no tocar atributos
  return html.split(/(<[^>]+>)/g).map(part => {
    if (part.startsWith('<')) return part   // tag HTML — intacto
    const normalPart = norm(part)
    let out = ''
    let lastIdx = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(normalPart)) !== null) {
      out += part.slice(lastIdx, m.index)
      out += `<mark class="search-highlight">${part.slice(m.index, m.index + m[0].length)}</mark>`
      lastIdx = m.index + m[0].length
    }
    out += part.slice(lastIdx)
    return out
  }).join('')
}

// Color de tag: usa el del store (custom o hash determinista)
function getTagColor(tag: string): string {
  return store.tagColor(tag)
}

// Genera inline style para un tag dado su color hex
function tagStyle(hex: string): string {
  return `background:${hex}20;color:${hex};border:1px solid ${hex}40;border-radius:4px;padding:0 5px;font-size:0.85em;font-weight:500`
}

// Color para chips de contexto @mention
const CONTEXT_COLOR = '#7c3aed'

// Convierte slug de contexto a nombre legible: "la-isla" → "La Isla", "media-sector/radio" → "Radio"
function slugToDisplayName(slug: string): string {
  // Tomar solo la última parte del path jerárquico
  const part = slug.split('/').pop() || slug
  return part
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

// Render text with colored hashtags and @context chips
function renderWithTags(text: string, key: number): React.ReactNode {
  const parts = text.split(/(#[\wÀ-ɏ/\-]+|(?<!\w)@[\wÀ-ɏ][\w\sÀ-ɏ\-]*)/g)
  if (parts.length === 1) return text
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('#') && part.length > 1) {
          const tagName = part.slice(1)
          const hex = getTagColor(tagName)
          return (
            <span
              key={`tag-${key}-${i}`}
              className="tag-inline"
              style={{ background: hex + '20', color: hex, border: `1px solid ${hex}40`, borderRadius: 4, padding: '0 5px', fontSize: '0.85em', fontWeight: 500 }}
            >
              {part}
            </span>
          )
        }
        if (part.startsWith('@') && part.length > 1) {
          const slug = part.slice(1).trim()
          const displayName = slugToDisplayName(slug)
          return (
            <span
              key={`ctx-${key}-${i}`}
              className="context-inline"
              data-slug={slug}
              style={{
                color: CONTEXT_COLOR,
                fontSize: '0.8em',
                fontWeight: 500,
                borderBottom: `1px dashed ${CONTEXT_COLOR}80`,
                padding: '0 2px',
                cursor: 'pointer',
              }}
            >
              {displayName}
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
  // Tokenize: bold, italic, code, strikethrough, link, checkbox, highlight, wiki-link, auto-url
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
    // Highlight: ==text==
    const highlightMatch = remaining.match(/^(.*?)==(.+?)==/)
    // Wiki-link: [[note name]]
    const wikiMatch = remaining.match(/^(.*?)\[\[([^\]]+)\]\]/)
    // Checkbox: [x] or [ ]
    const checkboxMatch = remaining.match(/^(.*?)(\[[ xX]\])/)
    // Auto-link URL (not already inside [text](url))
    const autoUrlMatch = remaining.match(/^(.*?)(https?:\/\/[^\s]+)/)

    // Find which match comes first
    const candidates: Array<{ index: number; type: string; match: RegExpMatchArray }> = []
    if (linkMatch) candidates.push({ index: linkMatch[1].length, type: 'link', match: linkMatch })
    if (boldMatch) candidates.push({ index: boldMatch[1].length, type: 'bold', match: boldMatch })
    if (italicMatch) candidates.push({ index: italicMatch[1].length, type: 'italic', match: italicMatch })
    if (codeMatch) candidates.push({ index: codeMatch[1].length, type: 'code', match: codeMatch })
    if (strikeMatch) candidates.push({ index: strikeMatch[1].length, type: 'strike', match: strikeMatch })
    if (highlightMatch) candidates.push({ index: highlightMatch[1].length, type: 'highlight', match: highlightMatch })
    if (wikiMatch) candidates.push({ index: wikiMatch[1].length, type: 'wiki', match: wikiMatch })
    if (checkboxMatch) candidates.push({ index: checkboxMatch[1].length, type: 'checkbox', match: checkboxMatch })
    if (autoUrlMatch) candidates.push({ index: autoUrlMatch[1].length, type: 'autourl', match: autoUrlMatch })

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
    } else if (best.type === 'highlight') {
      tokens.push(<mark key={key++} className="inline-highlight">{best.match[2]}</mark>)
      remaining = remaining.slice(before.length + best.match[2].length + 4) // ==x==
    } else if (best.type === 'link') {
      tokens.push(
        <a key={key++} href={best.match[3]} target="_blank" rel="noopener noreferrer">
          {best.match[2]}
        </a>
      )
      remaining = remaining.slice(before.length + best.match[2].length + best.match[3].length + 4) // [t](u)
    } else if (best.type === 'wiki') {
      const refText = best.match[2]
      tokens.push(
        <span key={key++} className="mention-inline" data-ref-text={refText}>
          [[{refText}]]
        </span>
      )
      remaining = remaining.slice(before.length + refText.length + 4) // [[x]]
    } else if (best.type === 'checkbox') {
      const raw = best.match[2] // [x] or [ ]
      const checked = raw[1] === 'x' || raw[1] === 'X'
      tokens.push(
        <span key={key++} className={`inline-checkbox ${checked ? 'inline-checkbox--done' : 'inline-checkbox--empty'}`}>
          {checked ? '✓' : '○'}
        </span>
      )
      remaining = remaining.slice(before.length + 3) // [x] or [ ]
    } else if (best.type === 'autourl') {
      const url = best.match[2]
      tokens.push(
        <a key={key++} href={url} target="_blank" rel="noopener noreferrer">
          {url}
        </a>
      )
      remaining = remaining.slice(before.length + url.length)
    }
  }

  return <>{tokens}</>
}

interface Props {
  text: string
  className?: string
}

// Detect block type from text prefix
export type BlockType = 'h1' | 'h2' | 'h3' | 'divider' | 'quote' | 'numbered' | 'code' | 'bullet' | 'text'

export function detectBlockType(text: string): BlockType {
  // Headings markdown: detectados para nodos creados externamente (Claude MCP, paste, etc.)
  // El OutlinerNode auto-normaliza el nodo en background (strip prefix + set _block).
  if (text.startsWith('### ')) return 'h3'
  if (text.startsWith('## ')) return 'h2'
  if (text.startsWith('# ')) return 'h1'
  if (text === '---') return 'divider'
  if (text.startsWith('> ')) return 'quote'
  if (/^\d+\.\s/.test(text)) return 'numbered'
  if (text.startsWith('` ')) return 'code'
  return 'text'
}

export function getBlockContent(text: string, type: BlockType): string {
  if (type === 'h1') return text.slice(2)
  if (type === 'h2') return text.slice(3)
  if (type === 'h3') return text.slice(4)
  if (type === 'quote') return text.slice(2)
  if (type === 'numbered') return text.replace(/^\d+\.\s/, '')
  if (type === 'code') return text.slice(2)
  if (type === 'bullet') return text.slice(2)
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

  if (type === 'bullet') {
    return <span className={className}>{renderInline(content)}</span>
  }

  return <span className={className}>{renderInline(text)}</span>
}

// ── HTML string renderer (para useEffect en contentEditable) ─────────────────
// Convierte texto con markdown inline a HTML string sin React nodes
// Evita poner React children dentro de contentEditable (bug removeChild)
export function renderInlineToHtml(text: string, highlight?: string, forcedBlock?: 'bullet' | 'h1' | 'h2' | 'h3'): string {
  if (!text && !forcedBlock) return ''
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  // Detectar tipo de bloque (con override por forcedBlock vía extraData)
  const type = forcedBlock ?? detectBlockType(text)
  let content = text
  let wrapClass = ''

  if (type === 'divider') return '<hr class="block-divider" />'
  // v8.25: headings y bullet vienen siempre por forcedBlock (extraData._block).
  // El text NO lleva prefijo "# "/"- ". Sin stripping necesario.
  if (type === 'h1') { wrapClass = 'block-h1' }
  else if (type === 'h2') { wrapClass = 'block-h2' }
  else if (type === 'h3') { wrapClass = 'block-h3' }
  else if (type === 'quote') { content = text.replace(/^>\s*/, ''); wrapClass = 'block-quote' }
  else if (type === 'numbered') { content = text.replace(/^\d+\.\s/, ''); wrapClass = 'block-numbered' }
  else if (type === 'code') { content = text.slice(2); wrapClass = 'block-code' }
  else if (type === 'bullet') { wrapClass = '' }

  // Procesar inline markdown
  let html = esc(content)
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/==(.+?)==/g, '<mark class="inline-highlight">$1</mark>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    // checkboxes inline: [x] y [ ]
    .replace(/\[([xX ])\]/g, (_, c) => {
      const checked = c === 'x' || c === 'X'
      return `<span class="inline-checkbox ${checked ? 'inline-checkbox--done' : 'inline-checkbox--empty'}">${checked ? '\u2713' : '\u25cb'}</span>`
    })
    // wiki-links [[nombre de nota]]
    .replace(/\[\[([^\]]+)\]\]/g, (_, refText) => {
      return `<span class="mention-inline" data-ref-text="${refText}">[[${refText}]]</span>`
    })
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    // auto-link URLs no ya dentro de [text](url)
    .replace(/(https?:\/\/[^\s<"]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
    // hashtags con color del store
    .replace(/#([\wÀ-ɏ/\-]+)/g, (match, tag) => {
      const hex = store.tagColor(tag)
      return `<span class="tag-inline" style="${tagStyle(hex)}">${match}</span>`
    })
    // @contextos \u2014 nombre limpio, sin @, sin guiones, sin fondo, underline punteado
    .replace(/(?<!\w)@([\w\u00C0-\u024F][\w\u00C0-\u024F\s\-]*)/g, (_match, slug) => {
      const hex = '#7c3aed'
      // De-slug: tomar \u00FAltima parte del path y capitalizar
      const part = (slug.trim().split('/').pop() || slug.trim())
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c: string) => c.toUpperCase())
      return `<span class="context-inline" data-slug="${esc(slug.trim())}" style="color:${hex};font-size:0.8em;font-weight:500;border-bottom:1px dashed ${hex}80;padding:0 2px;cursor:pointer">${esc(part)}</span>`
    })

  // Aplicar highlight de búsqueda insensible a tildes y mayúsculas
  if (highlight && highlight.trim()) {
    html = highlightNormalized(html, highlight)
  }

  return wrapClass ? `<span class="${wrapClass}">${html}</span>` : html
}
