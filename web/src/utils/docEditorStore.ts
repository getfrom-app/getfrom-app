// docEditorStore — comparte el editor TipTap ACTIVO (el documento que se está
// editando) entre DocEditor y la barra de herramientas (DocToolbar), que puede
// pintarse en la columna derecha (estilo Pages) o flotando sobre el elemento del
// lienzo. Solo hay un editor activo a la vez.

import { useSyncExternalStore } from 'react'
import type { Editor } from '@tiptap/react'

let activeEditor: Editor | null = null
let imageInsert: ((file: File) => void) | null = null
// version: cambia en CADA transacción (para estados activos de la barra).
// presence: cambia SOLO al aparecer/desaparecer el editor (para suscriptores que
// solo necesitan saber si hay edición en curso, sin re-render por tecleo).
let version = 0
let presence = 0
const subs = new Set<() => void>()
const presenceSubs = new Set<() => void>()
const emit = () => { version++; subs.forEach(s => s()) }

/** DocEditor registra (o limpia) su editor + el insertador de imágenes al montar/enfocar. */
export function setDocEditor(editor: Editor | null, img?: ((file: File) => void) | null): void {
  const had = activeEditor != null
  activeEditor = editor
  imageInsert = img ?? null
  if (had !== (editor != null)) { presence++; presenceSubs.forEach(s => s()) }
  emit()
}
/** Llamar en cada transacción/selección del editor → refresca estados activos de la barra. */
export function notifyDocEditor(): void { emit() }
export function getDocImageInsert(): ((file: File) => void) | null { return imageInsert }

/** Hook: editor activo (re-renderiza al cambiar de editor o de selección). */
export function useActiveDocEditor(): Editor | null {
  useSyncExternalStore(
    cb => { subs.add(cb); return () => { subs.delete(cb) } },
    () => version,
  )
  return activeEditor
}

/** Hook ligero: ¿hay un documento en edición? Solo re-renderiza al aparecer/desaparecer
 *  el editor (NO en cada tecleo). Para componentes grandes (MainLayout). */
export function useHasActiveDocEditor(): boolean {
  useSyncExternalStore(
    cb => { presenceSubs.add(cb); return () => { presenceSubs.delete(cb) } },
    () => presence,
  )
  return activeEditor != null
}
