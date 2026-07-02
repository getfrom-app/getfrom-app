// Copiar/Exportar un nodo (documento o nota con hijos) a Markdown/HTML/PDF.
// Extraído de NodeContextMenu.tsx para reutilizar desde el panel de documento del
// lienzo (Heptabase-style) sin duplicar la lógica de construcción de HTML/Markdown.
import { store } from '../store/nodeStore'
import type { Node } from '../types'
import { isDocNode } from './docNode'
import { htmlToMarkdown, docStandaloneHtml } from './htmlMarkdown'

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function buildMd(parentId: string, depth: number): string {
  return store.children(parentId).filter(n => !n.deletedAt).map(n => {
    const prefix = n.status === 'done' ? '- [x] ' : n.status === 'pending' ? '- [ ] ' : '- '
    return '  '.repeat(depth) + prefix + n.text + '\n' + buildMd(n.id, depth + 1)
  }).join('')
}

function buildHtml(parentId: string): string {
  const kids = store.children(parentId).filter(n => !n.deletedAt)
  if (!kids.length) return ''
  return '<ul>' + kids.map(n => `<li>${escapeHtml(n.text || '')}${buildHtml(n.id)}</li>`).join('') + '</ul>'
}

// Documento: el contenido es HTML en el body (no hijos). Markdown = conversión.
export function nodeAsMarkdown(node: Node): string {
  if (isDocNode(node)) return htmlToMarkdown(node.body || '')
  return `# ${node.text || 'Nota'}\n\n${node.body ? node.body + '\n\n' : ''}${buildMd(node.id, 0)}`.trim()
}

export function nodeAsRichHtml(node: Node): string {
  return isDocNode(node)
    ? (node.body || '')
    : `<h1>${escapeHtml(node.text || '')}</h1>${node.body ? `<p>${escapeHtml(node.body)}</p>` : ''}${buildHtml(node.id)}`
}

// Documento HTML autónomo (para exportar HTML y para el PDF limpio).
export function nodeAsStandaloneHtml(node: Node): string {
  if (isDocNode(node)) return docStandaloneHtml(node.text || 'Documento', node.body || '')
  const safeTitle = escapeHtml(node.text || 'Nota')
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${safeTitle}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:16px;line-height:1.6;color:#1a1a1a;max-width:720px;margin:40px auto;padding:0 24px;}
  h1{font-size:1.9rem;margin:0 0 1rem;color:#111;}
  ul{padding-left:1.3em;} li{margin:.25em 0;}
  p{margin:.7em 0;} footer{margin-top:48px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:.8rem;color:#aaa;}
</style></head>
<body><h1>${safeTitle}</h1>${node.body ? `<p>${escapeHtml(node.body)}</p>` : ''}${buildHtml(node.id)}
<footer>Generado con Fromly</footer></body></html>`
}

function downloadBlob(content: string, mime: string, filename: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function safeFilename(node: Node, ext: string): string {
  return (node.text || 'nota').slice(0, 40).replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s-]/g, '').trim() + '.' + ext
}

export function exportNodeMarkdown(node: Node) {
  downloadBlob(nodeAsMarkdown(node), 'text/markdown', safeFilename(node, 'md'))
}

export function exportNodeHtml(node: Node) {
  downloadBlob(nodeAsStandaloneHtml(node), 'text/html', safeFilename(node, 'html'))
}

export function exportNodePdf(node: Node) {
  // PDF limpio: ventana nueva con SOLO la nota → imprimir (sin el chrome de la app).
  const w = window.open('', '_blank')
  if (!w) { window.print(); return }
  w.document.write(nodeAsStandaloneHtml(node))
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 300)
}

export function copyNodeAsMarkdown(node: Node): Promise<void> {
  return navigator.clipboard.writeText(nodeAsMarkdown(node))
}

export function copyNodeAsRich(node: Node): Promise<void> {
  const html = nodeAsRichHtml(node)
  try {
    return navigator.clipboard.write([new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([nodeAsMarkdown(node)], { type: 'text/plain' }),
    })]).catch(() => navigator.clipboard.writeText(nodeAsMarkdown(node)))
  } catch {
    return navigator.clipboard.writeText(nodeAsMarkdown(node))
  }
}
