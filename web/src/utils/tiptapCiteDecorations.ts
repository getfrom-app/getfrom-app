// Indicador visual de párrafos citados — implementado como DECORACIÓN nativa de
// ProseMirror, no como manipulación directa del DOM. Un `classList.add()`/`style`
// puesto a mano sobre un nodo gestionado por ProseMirror se pierde en cuanto la
// vista redibuja ese nodo (p.ej. `editor.commands.setContent()` disparado por un
// resync externo — polling remoto cada 15s o pull de operaciones en vivo,
// nodeStore.ts) porque PM no sabe nada de esa clase y la descarta al reconciliar.
// Las decoraciones, en cambio, se recalculan como parte del propio ciclo de vida
// del estado (`apply()` corre en CADA transacción, incluida la de setContent) así
// que sobreviven a esos redibujados sin intervención externa.
// Alberto, 22 jul: confirmado en vivo que la manipulación directa de DOM se borraba
// ~1s después de aplicarse sin que nada la disparara de nuevo — este es el fix real.
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'

export const citeDecoKey = new PluginKey('citeDeco')

export type CiteMap = Map<string, string>

interface CiteState {
  decos: DecorationSet
  map: CiteMap
  flashPid: string | null
}

function buildDecos(doc: PMNode, map: CiteMap, flashPid: string | null): DecorationSet {
  const decos: Decoration[] = []
  doc.descendants((n, pos) => {
    const pid = n.attrs?.pid as string | undefined
    if (!pid) return
    const color = map.get(pid)
    if (color) decos.push(Decoration.node(pos, pos + n.nodeSize, { class: 'doc-para--cited', style: `--cite-color:${color}` }))
    if (pid === flashPid) decos.push(Decoration.node(pos, pos + n.nodeSize, { class: 'doc-para--flash' }))
  })
  return DecorationSet.create(doc, decos)
}

export const CiteDecorations = Extension.create({
  name: 'citeDecorations',
  addProseMirrorPlugins() {
    return [
      new Plugin<CiteState>({
        key: citeDecoKey,
        state: {
          init: (_, state) => ({ decos: buildDecos(state.doc, new Map(), null), map: new Map(), flashPid: null }),
          apply(tr, old, _oldState, newState) {
            const meta = tr.getMeta(citeDecoKey) as { map?: CiteMap; flashPid?: string | null } | undefined
            if (!meta && !tr.docChanged) return old
            const map = meta?.map ?? old.map
            const flashPid = meta && 'flashPid' in meta ? (meta.flashPid ?? null) : old.flashPid
            return { decos: buildDecos(newState.doc, map, flashPid), map, flashPid }
          },
        },
        props: {
          decorations(state) {
            return citeDecoKey.getState(state)?.decos
          },
        },
      }),
    ]
  },
})
