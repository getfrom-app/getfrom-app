// ParagraphId — extensión TipTap que da a cada párrafo/encabezado/cita un id
// ESTABLE (`data-pid`), persistido en el HTML del body. Es el ancla que permite
// asignar un párrafo concreto de una nota a un contexto (icono «?» al pasar el
// ratón, ver DocEditor.tsx) y volver a él con precisión desde la cita (scroll +
// resalte), no solo abrir el documento entero (Alberto, 22 jul: "hazlo con
// ancla, hazlo completo").
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

const PID_TYPES = ['paragraph', 'heading', 'blockquote']

export function genPid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
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
        // Asigna un pid a cualquier nodo de los tipos vigilados que aún no lo
        // tenga — al escribir, al pulsar Enter (nuevo párrafo), y una vez al
        // cargar un documento antiguo sin anclas. `setNodeMarkup` no cambia el
        // tamaño de ningún nodo, así que las posiciones siguen siendo válidas
        // aunque se llame varias veces dentro de la misma transacción.
        appendTransaction(transactions, oldState, newState) {
          if (!transactions.some(tr => tr.docChanged) && oldState.doc.eq(newState.doc)) return null
          let tr = newState.tr
          let changed = false
          newState.doc.descendants((node, pos) => {
            if (PID_TYPES.includes(node.type.name) && !node.attrs.pid) {
              tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, pid: genPid() })
              changed = true
            }
          })
          if (!changed) return null
          tr.setMeta('addToHistory', false)
          return tr
        },
      }),
    ]
  },
})
