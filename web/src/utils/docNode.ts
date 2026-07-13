// Nodo-documento y elemento-texto del lienzo.
//
// Un DOCUMENTO es un nodo hoja con `extraData._doc='1'`: su contenido vive en el
// `body` (HTML de TipTap), NO troceado en nodos hijos. Se edita con DocEditor.
//
// Un ELEMENTO-TEXTO DEL LIENZO es además `_ctext='1'` y está anclado (`_pinX/_pinY`):
// se dibuja en el lienzo como texto suelto y se abre en solitario como el MISMO
// nodo (sin copia ni sincronización). El lienzo y el documento comparten `body`.

import type { Node } from '../types'

export const DOC = '_doc'
export const CTEXT = '_ctext'

export function isDocNode(node: Node | null | undefined): boolean {
  if (!node) return false
  try { return JSON.parse(node.extraData || '{}')[DOC] === '1' } catch { return false }
}

export function isCanvasText(node: Node | null | undefined): boolean {
  if (!node) return false
  try { return JSON.parse(node.extraData || '{}')[CTEXT] === '1' } catch { return false }
}

// Elementos de VISTA del lienzo (tabla/kanban/calendario). Igual que el texto: un
// nodo hijo con `extraData.viewBlock`, embebido en el lienzo y abrible en solitario
// (NodeView ya renderiza su vista al navegar). Devuelve el tipo o null.
export type CanvasViewKind = 'tabla' | 'kanban' | 'calendario'
export function canvasViewKind(node: Node | null | undefined): CanvasViewKind | null {
  if (!node) return null
  try {
    const vb = JSON.parse(node.extraData || '{}').viewBlock
    return vb === 'tabla' || vb === 'kanban' || vb === 'calendario' ? vb : null
  } catch { return null }
}

// Título del documento = primer bloque/línea del HTML del body. Se refleja en
// `node.text` para que el árbol, breadcrumb y listados muestren algo legible.
export function firstLineTitle(html: string | null | undefined): string {
  const d = document.createElement('div')
  d.innerHTML = html || ''
  const txt = (d.textContent || '').replace(/ /g, ' ').trim()
  // Primer NODO hijo con texto, RECORRIENDO también los nodos de texto sueltos:
  // en un contentEditable la 1ª línea suele ir SIN envolver en <div>/<p>, así que
  // mirar solo `children` (elementos) se la saltaría y cogería el 2º bloque.
  for (const child of Array.from(d.childNodes)) {
    if (child.nodeType === 3 || child.nodeType === 1) {
      const bt = (child.textContent || '').trim()
      if (bt) return bt.slice(0, 120)
    }
  }
  const first = (d.textContent || '').trim()
  return first.slice(0, 120)
}
