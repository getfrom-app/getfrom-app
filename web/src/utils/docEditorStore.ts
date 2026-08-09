// docEditorStore — comparte el editor TipTap ACTIVO (el documento que se está
// editando) entre DocEditor y la barra de herramientas (DocToolbar), que puede
// pintarse en la columna derecha (estilo Pages) o flotando sobre el elemento del
// lienzo. Solo hay un editor activo a la vez.

import { useSyncExternalStore } from 'react'
import type { Editor } from '@tiptap/react'

let activeEditor: Editor | null = null
let activeNodeId: string | null = null
let imageInsert: ((file: File) => void) | null = null
// version: cambia en CADA transacción (para estados activos de la barra).
// presence: cambia SOLO al aparecer/desaparecer el editor (para suscriptores que
// solo necesitan saber si hay edición en curso, sin re-render por tecleo).
let version = 0
let presence = 0
const subs = new Set<() => void>()
const presenceSubs = new Set<() => void>()
const emit = () => { version++; subs.forEach(s => s()) }

/** DocEditor registra (o limpia) su editor + el insertador de imágenes al montar/enfocar.
 *  `nodeId` identifica de QUÉ nodo es este editor — la tarjeta del lienzo lo usa
 *  (`useActiveDocNodeId`) para saber si el panel YA está editando este mismo nodo y, si es
 *  así, ceder y mostrarse en modo lectura: nunca dos editores TipTap vivos a la vez sobre
 *  el mismo nodo (causaba un bucle de renders al seleccionar — v9.6.680). */
export function setDocEditor(editor: Editor | null, img?: ((file: File) => void) | null, nodeId?: string | null): void {
  const had = activeEditor != null
  activeEditor = editor
  activeNodeId = editor ? (nodeId ?? null) : null
  imageInsert = img ?? null
  if (had !== (editor != null)) { presence++; presenceSubs.forEach(s => s()) }
  emit()
}
/** Llamar en cada transacción/selección del editor → refresca estados activos de la barra. */
export function notifyDocEditor(): void { emit() }
export function getDocImageInsert(): ((file: File) => void) | null { return imageInsert }

/** Editor VIVO de un nodo concreto, o null si ese documento no está abierto. No es un
 *  hook: lo usan operaciones sueltas (convertir una cita en documento) que tienen que
 *  editar el documento origen POR EL EDITOR si está abierto — escribirle el `body` por
 *  detrás mientras hay un editor vivo encima lo pisaría en el siguiente guardado. */
export function getDocEditorFor(nodeId: string): Editor | null {
  return activeEditor && activeNodeId === nodeId ? activeEditor : null
}

/** Hook ligero: id del nodo cuyo editor está registrado como «activo» (el del panel), o
 *  null si no hay ninguno. Re-renderiza solo al aparecer/desaparecer (como presence). */
export function useActiveDocNodeId(): string | null {
  useSyncExternalStore(
    cb => { presenceSubs.add(cb); return () => { presenceSubs.delete(cb) } },
    () => presence,
  )
  return activeNodeId
}

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
