// Citas de párrafo — helpers compartidos por quien las CREA (DocEditor.tsx) y por
// quien las manipula desde fuera (menú contextual de cualquier fila, ficha de la
// cita). Ver el modelo en DocEditor.tsx: una cita es un nodo hijo del documento
// origen con `_doc:'1'` + `_docSelection:'1'` + `_docSourceId`/`_docParagraphId`/
// `_docText`, cuerpo `<blockquote>` y un contexto asignado.
import { store } from '../store/nodeStore'
import { parseExtraData } from './papeleraHelper'
import { nodeCtxRefs } from './cajones'
import { getDocEditorFor } from './docEditorStore'
import { blocksFromHtml, descendantPids, findAnchorPid, removeBlocksFromHtml, type DocBlock } from './docBlocks'
import type { Editor } from '@tiptap/react'
import type { Node } from '../types'

export function isCitationNode(n: Node | null | undefined): boolean {
  if (!n) return false
  return parseExtraData(n.extraData)._docSelection === '1'
}

/** Bloques del documento tal y como los ve su editor abierto (mismo modelo neutro
 *  que `blocksFromHtml`, para que la regla de jerarquía sea LA MISMA). */
function blocksFromEditor(ed: Editor): DocBlock[] {
  const blocks: DocBlock[] = []
  ed.state.doc.descendants(n => {
    const pid = n.attrs?.pid as string | undefined
    if (!pid) return
    blocks.push({ pid, type: n.type.name, level: (n.attrs?.level as number) || 0, indent: (n.attrs?.indent as number) || 0, text: n.textContent })
  })
  return blocks
}

/** Saca el `<blockquote>` que envuelve el cuerpo de una cita — un documento normal
 *  no nace citándose a sí mismo. Si el cuerpo no es exactamente ese envoltorio, se
 *  devuelve tal cual (no es asunto de esta función reescribir un cuerpo editado). */
function unwrapQuote(html: string): string {
  if (!html) return html
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const kids = Array.from(doc.body.children)
  if (kids.length !== 1 || kids[0].tagName !== 'BLOCKQUOTE') return html
  return kids[0].innerHTML
}

export type PromoteResult = { ok: false } | { ok: true; title: string; undo: () => void }

/** Convierte una cita en un DOCUMENTO independiente: rompe el vínculo con el origen
 *  y BORRA de él el bloque citado (ancla + lo que colgaba de ella). El documento pasa
 *  a colgar de su contexto — si siguiera siendo hijo del origen, borrar el origen algún
 *  día se llevaría por delante un documento que ya no tiene nada que ver con él.
 *
 *  Devuelve un `undo` que restaura las tres cosas (cuerpo del origen, marcas de la
 *  cita y su sitio en el árbol): se borra texto de OTRO documento, así que la acción
 *  tiene que ser reversible desde el toast. */
export function promoteCitationToDocument(nodeId: string): PromoteResult {
  const node = store.getNode(nodeId)
  if (!node || node.deletedAt || !isCitationNode(node)) return { ok: false }
  const e = parseExtraData(node.extraData)
  const sourceId = e._docSourceId as string | undefined
  const citedPid = e._docParagraphId as string | undefined
  const citedText = e._docText as string | undefined

  // ── 1. Quitar el bloque citado del documento origen.
  const source = sourceId ? store.getNode(sourceId) : null
  const prevSourceBody = source?.body ?? ''
  const editor = sourceId ? getDocEditorFor(sourceId) : null
  let restoreSource: (() => void) | null = null
  if (source && !source.deletedAt) {
    const blocks = editor ? blocksFromEditor(editor) : blocksFromHtml(prevSourceBody)
    const anchor = findAnchorPid(blocks, citedPid, citedText)
    const pids = anchor ? new Set(descendantPids(blocks, anchor)) : new Set<string>()
    if (pids.size > 0) {
      if (editor) {
        // Con el documento abierto hay que ir POR EL EDITOR: escribirle el `body` por
        // detrás lo pisaría el siguiente guardado del propio editor.
        let from = Infinity, to = -1
        editor.state.doc.descendants((n, pos) => {
          const pid = (n.attrs as Record<string, unknown> | undefined)?.pid as string | undefined
          if (!pid || !pids.has(pid)) return
          from = Math.min(from, pos); to = Math.max(to, pos + n.nodeSize)
        })
        if (to > 0) editor.chain().focus().deleteRange({ from, to }).run()
        restoreSource = () => {
          const live = getDocEditorFor(sourceId!)
          if (live) live.commands.setContent(prevSourceBody)
          store.updateNode(sourceId!, { body: prevSourceBody })
        }
      } else {
        store.updateNode(sourceId!, { body: removeBlocksFromHtml(prevSourceBody, Array.from(pids)) })
        restoreSource = () => store.updateNode(sourceId!, { body: prevSourceBody })
      }
    }
  }

  // ── 2. La cita deja de serlo: fuera las marcas de vínculo, fuera el <blockquote>.
  const { _docSelection, _docSourceId, _docParagraphId, _docText, ...rest } = e
  void _docSelection; void _docSourceId; void _docParagraphId; void _docText
  const prevExtra = node.extraData
  const prevBody = node.body ?? ''
  const prevParent = node.parentId ?? null
  const update: Parameters<typeof store.updateNode>[1] = {
    body: unwrapQuote(prevBody),
    extraData: JSON.stringify({ ...rest, _doc: '1' }),
  }

  // ── 3. Colgar del contexto propio (nunca de uno HEREDADO del origen: `firstContextOf`
  // sube por los ancestros, y ahí el ancestro es justo el documento del que se sale).
  const ownCtxId = nodeCtxRefs(node).find(id => { const c = store.getNode(id); return !!c && !c.deletedAt })
  if (ownCtxId && ownCtxId !== prevParent) {
    const sibs = store.children(ownCtxId).filter(n => !n.deletedAt)
    update.parentId = ownCtxId
    update.siblingOrder = (sibs.length ? Math.max(...sibs.map(s => s.siblingOrder)) : 0) + 1000
  }
  store.updateNode(nodeId, update)

  return {
    ok: true,
    title: node.text || '',
    undo: () => {
      store.updateNode(nodeId, { body: prevBody, extraData: prevExtra, parentId: prevParent, siblingOrder: node.siblingOrder })
      restoreSource?.()
    },
  }
}

type TFunc = (key: string, def: string, opts?: Record<string, unknown>) => string

/** `promoteCitationToDocument` + toast con «Deshacer». Lo comparten las dos entradas
 *  (menú contextual de la fila y ficha de la cita) para que digan y hagan lo mismo. */
export function promoteCitationWithFeedback(nodeId: string, t: TFunc): boolean {
  const res = promoteCitationToDocument(nodeId)
  if (!res.ok) return false
  window.dispatchEvent(new CustomEvent('from:toast', {
    detail: {
      message: t('citation.converted', 'Ahora es un documento independiente'),
      type: 'success',
      action: { label: t('tip.undo', 'Deshacer'), onClick: res.undo },
    },
  }))
  return true
}
