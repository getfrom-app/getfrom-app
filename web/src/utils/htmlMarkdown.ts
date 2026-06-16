// HTML (TipTap / contentEditable) → Markdown ligero. Cubre títulos, negrita/
// cursiva/tachado/código, enlaces, listas (orden/desorden), citas y párrafos.
// Usado por el DocEditor y por NodeContextMenu (copiar/exportar documentos).

export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html || '', 'text/html')
  const inline = (el: Element | HTMLElement): string => {
    let out = ''
    el.childNodes.forEach(c => { out += serialize(c) })
    return out
  }
  const serialize = (n: ChildNode): string => {
    if (n.nodeType === 3) return n.textContent || ''   // TEXT_NODE
    if (n.nodeType !== 1) return ''                     // no ELEMENT_NODE
    const el = n as Element
    const tag = el.tagName.toLowerCase()
    const inner = inline(el)
    switch (tag) {
      case 'strong': case 'b': return `**${inner}**`
      case 'em': case 'i': return `*${inner}*`
      case 's': case 'del': return `~~${inner}~~`
      case 'u': return inner
      case 'code': return `\`${inner}\``
      case 'a': return `[${inner}](${el.getAttribute('href') || ''})`
      case 'br': return '\n'
      case 'h1': return `# ${inner}\n\n`
      case 'h2': return `## ${inner}\n\n`
      case 'h3': return `### ${inner}\n\n`
      case 'p': return `${inner}\n\n`
      case 'blockquote': return inner.split('\n').filter(Boolean).map(l => `> ${l}`).join('\n') + '\n\n'
      case 'ul': return Array.from(el.children).map(li => `- ${inline(li).trim()}`).join('\n') + '\n\n'
      case 'ol': return Array.from(el.children).map((li, i) => `${i + 1}. ${inline(li).trim()}`).join('\n') + '\n\n'
      case 'pre': return '```\n' + (el.textContent || '') + '\n```\n\n'
      default: return inner
    }
  }
  return inline(doc.body).replace(/\n{3,}/g, '\n\n').trim()
}

// Documento HTML autónomo (con estilos) para exportar/imprimir el body de un doc.
export function docStandaloneHtml(title: string, bodyHtml: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${esc(title)}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:16px;line-height:1.65;color:#1a1a1a;max-width:720px;margin:40px auto;padding:0 24px;}
  h1{font-size:2rem;margin:0 0 1rem;color:#111;} h2{font-size:1.5rem;margin:1.4em 0 .5em;} h3{font-size:1.2rem;margin:1.2em 0 .4em;}
  ul,ol{padding-left:1.4em;} li{margin:.25em 0;} p{margin:.7em 0;} blockquote{border-left:3px solid #ddd;margin:.8em 0;padding:.2em 0 .2em 1em;color:#555;}
  a{color:#1971c2;} code{background:#f3f3f3;padding:.1em .35em;border-radius:4px;font-size:.9em;}
  footer{margin-top:48px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:.8rem;color:#aaa;}
</style></head>
<body>${bodyHtml}<footer>Generado con Fromly</footer></body></html>`
}
