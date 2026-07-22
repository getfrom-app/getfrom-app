// TabIndent — Tab/Shift-Tab indentan/desindentan la línea actual, en CUALQUIER
// párrafo (no solo dentro de una lista de viñetas ya formada). StarterKit no
// trae ningún atajo para Tab: sin interceptarlo, el navegador simplemente
// sacaba el foco del editor y saltaba a la columna derecha (Alberto, 22 jul,
// dos veces: "en documentos no funciona el tabulador" y luego "sigue sin
// funcionar... salta a la columna derecha" — el primer intento solo cubría
// listas reales vía sinkListItem/liftListItem; si el cursor no estaba en una
// lista, esos comandos fallaban en silencio y el Tab se escapaba).
//
// Diseño: un nivel de indentación NUMÉRICO por párrafo (`data-indent`, como
// Notion/Tana), no una reestructuración del árbol de listas — mucho más
// simple y sin el riesgo de mover/fusionar nodos con matemática de
// posiciones de ProseMirror a mano. Dentro de una lista (viñetas/numerada/
// tarea) SÍ se usa el sink/lift nativo, que es el comportamiento correcto
// ahí. Fuera de listas, Tab/Shift-Tab cambian `indent` y SIEMPRE capturan la
// tecla — nunca debe llegar a escaparse del editor.
import { Extension } from '@tiptap/core'

const INDENT_TYPES = ['paragraph', 'heading', 'blockquote']
const MAX_INDENT = 8

export const TabIndent = Extension.create({
  name: 'tabIndent',
  addGlobalAttributes() {
    return [
      {
        types: INDENT_TYPES,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (el: HTMLElement) => {
              const n = parseInt(el.getAttribute('data-indent') || '0', 10)
              return Number.isFinite(n) ? n : 0
            },
            renderHTML: (attrs: { indent?: number }) =>
              attrs.indent ? { 'data-indent': String(attrs.indent), style: `margin-left: ${attrs.indent * 24}px` } : {},
          },
        },
      },
    ]
  },
  addKeyboardShortcuts() {
    const changeIndent = (delta: number) => () => {
      if (delta > 0 && (this.editor.commands.sinkListItem('listItem') || this.editor.commands.sinkListItem('taskItem'))) return true
      if (delta < 0 && (this.editor.commands.liftListItem('listItem') || this.editor.commands.liftListItem('taskItem'))) return true
      const { $from } = this.editor.state.selection
      const node = $from.parent
      if (!INDENT_TYPES.includes(node.type.name)) return true // captura igual — nunca se escapa
      const pos = $from.before($from.depth)
      const cur = (node.attrs.indent as number) || 0
      const next = Math.max(0, Math.min(MAX_INDENT, cur + delta))
      if (next !== cur) {
        this.editor.commands.command(({ tr }) => {
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next })
          return true
        })
      }
      return true
    }
    return {
      Tab: changeIndent(1),
      'Shift-Tab': changeIndent(-1),
    }
  },
})
