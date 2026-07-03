// MagicTaskGhost — la magia «verbo → tarea» del outliner, portada al editor TipTap de los
// textos del lienzo (tarjeta y panel derecho). Mientras escribes en un párrafo suelto:
//   · si empieza por un VERBO DE ACCIÓN («llamar…», «comprar…») → ghost «☐ tarea · ↵»
//   · si además/solo lleva una FECHA natural al final («… mañana», «… el viernes a las 6»)
//     → ghost con la fecha detectada.
// Enter o Tab ACEPTA: convierte la línea actual en casilla-tarea (y, si hay fecha, la quita
// del título y se la pasa como `due`). Enter además continúa en una casilla nueva debajo.
// Es una decoración de ProseMirror (no un overlay): vive dentro del sistema de coordenadas
// del editor, así que se mueve/escala CON la tarjeta en el lienzo transformado.
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { EditorState } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { buildTaskVerbRegex } from '../../store/predictionStore'
import { extractDateFromEnd } from '../../utils/naturalDate'
import type { DateExtraction } from '../../utils/naturalDate'

export interface MagicPrediction {
  isTask: boolean
  date: DateExtraction | null
  /** rango inline del párrafo actual (para reemplazar el texto al aceptar) */
  from: number
  to: number
  /** posición del final del contenido del párrafo (dónde pintar el ghost) */
  end: number
}

const magicKey = new PluginKey('magicTaskGhost')

// Detecta la predicción para el párrafo donde está el cursor. Devuelve null salvo que:
// selección colapsada, párrafo suelto (no dentro de tarea/lista/heading), cursor al final,
// ≥6 chars, y empiece por verbo o tenga fecha al final.
function computePrediction(state: EditorState): MagicPrediction | null {
  const { selection } = state
  if (!selection.empty) return null
  const $from = selection.$from
  const parent = $from.parent
  if (parent.type.name !== 'paragraph') return null
  // el contenedor del párrafo no debe ser una casilla-tarea ni un ítem de lista
  const grand = $from.depth >= 1 ? $from.node($from.depth - 1) : null
  if (grand && (grand.type.name === 'taskItem' || grand.type.name === 'listItem')) return null
  // cursor al FINAL del contenido del párrafo (no interrumpir en medio)
  if ($from.parentOffset !== parent.content.size) return null
  const text = parent.textContent.trim()
  if (text.length < 6) return null
  const normed = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const isTask = buildTaskVerbRegex().test(normed)
  let date: DateExtraction | null = null
  try { const dt = extractDateFromEnd(text); if (dt?.parsed?.date) date = dt } catch { /* sin fecha */ }
  if (!isTask && !date) return null
  const from = $from.start($from.depth)
  const to = $from.end($from.depth)
  return { isTask, date, from, to, end: to }
}

function ghostLabel(pred: MagicPrediction, taskWord: string): string {
  const dateLabel = pred.date?.parsed?.label
    ? pred.date.parsed.label + (pred.date.timeStr ? ` · ${pred.date.timeStr}` : '')
    : null
  if (pred.date && dateLabel) return `☐ ${dateLabel}`
  return `☐ ${taskWord}`
}

function buildDeco(state: EditorState, taskWord: string): DecorationSet {
  const pred = computePrediction(state)
  if (!pred) return DecorationSet.empty
  const widget = Decoration.widget(pred.end, () => {
    const span = document.createElement('span')
    span.className = 'from-ghost from-ghost--task'
    span.setAttribute('contenteditable', 'false')
    const label = document.createElement('span')
    label.className = 'from-ghost-text'
    label.textContent = ghostLabel(pred, taskWord)
    const sep = document.createElement('span')
    sep.className = 'from-ghost-sep'; sep.textContent = '·'
    const key = document.createElement('span')
    key.className = 'from-ghost-key'; key.textContent = '↵'
    span.append(label, sep, key)
    return span
  }, { side: 1, ignoreSelection: true, key: 'magic-ghost' })
  return DecorationSet.create(state.doc, [widget])
}

export interface MagicTaskGhostOptions {
  /** Palabra localizada para «tarea» (i18n). */
  taskWord: string
  /** Callback tras aceptar: crea/actualiza el nodo-tarea y aplica la fecha (`due`). */
  onAccept: (pred: MagicPrediction) => void
}

export const MagicTaskGhost = Extension.create<MagicTaskGhostOptions>({
  name: 'magicTaskGhost',

  // Prioridad alta → su plugin se registra ANTES que el keymap base de StarterKit, así su
  // `handleKeyDown` intercepta Enter/Tab antes de que el `splitBlock` por defecto los consuma.
  priority: 1000,

  addOptions() {
    return { taskWord: 'tarea', onAccept: () => {} }
  },

  addProseMirrorPlugins() {
    const editor = this.editor
    const options = this.options
    return [
      new Plugin({
        key: magicKey,
        props: {
          decorations(state) {
            return buildDeco(state, options.taskWord)
          },
          handleKeyDown(view: EditorView, event: KeyboardEvent) {
            const pred = computePrediction(view.state)
            if (!pred) return false
            const isEnter = event.key === 'Enter' && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey
            const isTab = event.key === 'Tab' && !event.shiftKey
            if (!isEnter && !isTab) return false
            event.preventDefault()
            // 1) Si hay fecha, quitarla del título → la casilla queda limpia.
            if (pred.date) {
              editor.chain().command(({ tr, dispatch }) => {
                if (dispatch) tr.insertText(pred.date!.cleanText, pred.from, pred.to)
                return true
              }).run()
            }
            // 2) Convertir la línea actual en casilla-tarea.
            editor.chain().toggleTaskList().run()
            // 3) Con Enter, continuar en una casilla nueva debajo (con Tab nos quedamos).
            if (isEnter) editor.chain().splitListItem('taskItem').run()
            // 4) Crear/enlazar el nodo-tarea real y aplicar la fecha.
            options.onAccept(pred)
            return true
          },
        },
      }),
    ]
  },
})

export default MagicTaskGhost
