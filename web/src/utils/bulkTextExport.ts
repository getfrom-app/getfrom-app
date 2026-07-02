// Exportar TODOS los textos/notas de la cuenta a un único Markdown legible, EXCLUYENDO
// tareas y contextos (esos se quedan tal cual — Alberto pidió no tocarlos nunca). Pensado
// para revisión manual: cada nota/documento sale como su propia sección con la ruta
// (breadcrumb) de dónde cuelga, para poder decidir en qué contexto volver a meterla.
import { store } from '../store/nodeStore'
import type { Node } from '../types'
import { isMarkedContext } from './cajones'
import { isDocNode, firstLineTitle } from './docNode'
import { nodeAsMarkdown } from './nodeExport'

function breadcrumb(node: Node): string {
  const parts: string[] = []
  let cur: Node | null = node
  let guard = 0
  while (cur && cur.parentId && guard++ < 40) {
    const parent = store.getNode(cur.parentId)
    if (!parent) break
    if (parent.text) parts.unshift(parent.text)
    cur = parent
  }
  return parts.join(' › ')
}

function shallowOutline(node: Node): string {
  return store.children(node.id).filter(c => !c.deletedAt).map(c => {
    const prefix = c.status === 'done' ? '- [x] ' : c.status === 'pending' ? '- [ ] ' : '- '
    return prefix + (c.text || '')
  }).join('\n')
}

/** Recorre TODO el árbol y devuelve un único Markdown con cada nota/documento como sección.
 *  Excluye: tareas, eventos, recursos, contextos marcados, y todo lo que cuelgue de Papelera. */
export function buildFullTextExport(): { markdown: string; count: number } {
  const sections: string[] = []
  let count = 0
  const seen = new Set<string>()

  function isTrashed(node: Node): boolean {
    let cur: Node | null = node
    let guard = 0
    while (cur && guard++ < 40) {
      if ((cur.text || '').trim() === '🗑 Papelera') return true
      cur = cur.parentId ? (store.getNode(cur.parentId) ?? null) : null
    }
    return false
  }

  function walk(parentId: string | null) {
    for (const n of store.children(parentId)) {
      if (n.deletedAt) continue
      if (isTrashed(n)) continue
      if (!seen.has(n.id)) {
        seen.add(n.id)
        if (isDocNode(n)) {
          const title = n.text || firstLineTitle(n.body) || '(sin título)'
          const path = breadcrumb(n)
          const md = nodeAsMarkdown(n).trim()
          if (md) {
            sections.push(`## ${title}\n${path ? `*${path}*\n` : ''}\n${md}\n`)
            count++
          }
        } else if (store.isNote(n) && !isMarkedContext(n)) {
          const path = breadcrumb(n)
          const outline = shallowOutline(n)
          if (outline.trim()) {
            sections.push(`## ${n.text || '(sin título)'}\n${path ? `*${path}*\n` : ''}\n${outline}\n`)
            count++
          }
        }
      }
      walk(n.id)
    }
  }
  walk(null)

  const header = `# Exportación de textos — Fromly\n\nGenerado ${new Date().toISOString().slice(0, 10)} · ${count} notas/documentos · excluye tareas y contextos.\n\n---\n`
  return { markdown: header + sections.join('\n---\n\n'), count }
}

export function downloadFullTextExport() {
  const { markdown, count } = buildFullTextExport()
  const blob = new Blob([markdown], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `fromly-textos-${new Date().toISOString().slice(0, 10)}.md`
  a.click()
  URL.revokeObjectURL(url)
  return count
}
