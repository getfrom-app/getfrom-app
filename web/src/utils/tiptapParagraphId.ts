// ParagraphId — extensión TipTap que da a cada párrafo/encabezado/cita un id
// ESTABLE (`data-pid`), persistido en el HTML del body. Es el ancla que permite
// asignar un párrafo concreto de una nota a un contexto (icono «?» al pasar el
// ratón, ver DocEditor.tsx) y volver a él con precisión desde la cita (scroll +
// resalte), no solo abrir el documento entero (Alberto, 22 jul: "hazlo con
// ancla, hazlo completo").
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { Transaction } from '@tiptap/pm/state'

const PID_TYPES = ['paragraph', 'heading', 'blockquote']

export function genPid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

// Recorre el doc y (a) rellena el `pid` que falte, (b) REGENERA cualquier `pid`
// DUPLICADO — clave: al pulsar Enter dentro/al final de un párrafo con `pid`,
// el comando estándar de ProseMirror para partir el bloque copia los attrs del
// nodo original al nuevo (incluido `pid`), así que sin este paso de
// deduplicación TODOS los párrafos escritos después de uno ya citado heredan
// su mismo `pid` — y por tanto su mismo indicador de cita (Alberto, 22 jul:
// "la barra esa oscura... ha aparecido con lo de las citas [en párrafos que
// no había citado]"). Se queda con el PRIMER nodo que lleva cada pid (el
// "dueño" original) y reasigna uno nuevo a cualquier repetición posterior.
export function dedupePids(doc: PMNode, tr: Transaction): { tr: Transaction; changed: boolean } {
  const seen = new Set<string>()
  let changed = false
  doc.descendants((node, pos) => {
    if (!PID_TYPES.includes(node.type.name)) return
    const pid = node.attrs.pid as string | null
    if (!pid || seen.has(pid)) {
      tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, pid: genPid() })
      changed = true
    } else {
      seen.add(pid)
    }
  })
  return { tr, changed }
}

export const ParagraphId = Extension.create({
  name: 'paragraphId',
  addGlobalAttributes() {
    return [
      {
        types: PID_TYPES,
        attributes: {
          pid: {
            default: null,
            parseHTML: (el: HTMLElement) => el.getAttribute('data-pid'),
            renderHTML: (attrs: { pid?: string | null }) => (attrs.pid ? { 'data-pid': attrs.pid } : {}),
          },
        },
      },
    ]
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('paragraphId'),
        // Corre en CADA transacción que cambia el doc — al escribir, al pulsar
        // Enter (nuevo párrafo), al pegar, etc. `setNodeMarkup` no cambia el
        // tamaño de ningún nodo, así que las posiciones siguen siendo válidas
        // aunque se llame varias veces dentro de la misma transacción.
        appendTransaction(transactions, oldState, newState) {
          if (!transactions.some(tr => tr.docChanged) && oldState.doc.eq(newState.doc)) return null
          const { tr, changed } = dedupePids(newState.doc, newState.tr)
          if (!changed) return null
          tr.setMeta('addToHistory', false)
          return tr
        },
      }),
    ]
  },
})
