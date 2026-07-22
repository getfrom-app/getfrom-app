// TabIndent — Tab/Shift-Tab indentan/desindentan el elemento de lista actual
// (bullet, numerada o casilla de tarea), como en Notion/Tana. StarterKit no lo
// trae por defecto: sin esta extensión, Tab simplemente sacaba el foco del
// editor sin hacer nada (Alberto, 22 jul: "en documentos no funciona el
// tabulador. debería funcionar").
import { Extension } from '@tiptap/core'

export const TabIndent = Extension.create({
  name: 'tabIndent',
  addKeyboardShortcuts() {
    return {
      Tab: () => this.editor.commands.sinkListItem('listItem') || this.editor.commands.sinkListItem('taskItem'),
      'Shift-Tab': () => this.editor.commands.liftListItem('listItem') || this.editor.commands.liftListItem('taskItem'),
    }
  },
})
