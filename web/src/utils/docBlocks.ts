// docBlocks — la regla de JERARQUÍA de un documento (qué "cuelga" de un párrafo o
// de un encabezado), en un solo sitio y sobre un modelo neutro de bloques.
//
// Existía únicamente DENTRO de DocEditor.tsx, sobre el estado de ProseMirror
// (`getOrderedBlocks`/`collectDescendantText`): perfecto mientras la única
// operación fuese CITAR con el documento abierto. Convertir una cita en documento
// tiene que borrar ese mismo bloque del origen aunque el origen NO esté abierto en
// ningún editor — ahí solo hay el `body` (HTML) del nodo. Dos implementaciones de
// la misma regla se desincronizan a la primera, así que la regla vive aquí y cada
// lado solo aporta cómo LEE sus bloques: el editor desde el doc de ProseMirror, el
// otro camino desde el HTML (`data-pid`/`data-indent` se persisten, ver
// tiptapParagraphId.ts y tiptapTabIndent.ts).
export type DocBlock = { pid: string; type: string; level: number; indent: number; text: string }

const HEADING_TAGS: Record<string, number> = { H1: 1, H2: 2, H3: 3, H4: 4, H5: 5, H6: 6 }

/** Bloques con `pid` de un body HTML, en orden de documento. */
export function blocksFromHtml(html: string): DocBlock[] {
  if (!html) return []
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const out: DocBlock[] = []
  for (const el of Array.from(doc.body.querySelectorAll<HTMLElement>('[data-pid]'))) {
    const pid = el.getAttribute('data-pid')
    if (!pid) continue
    const tag = el.tagName
    const level = HEADING_TAGS[tag] || 0
    out.push({
      pid,
      type: level ? 'heading' : tag === 'BLOCKQUOTE' ? 'blockquote' : 'paragraph',
      level,
      indent: parseInt(el.getAttribute('data-indent') || '0', 10) || 0,
      text: el.textContent || '',
    })
  }
  return out
}

/** El bloque ancla MÁS todo lo que cuelga de él: si es encabezado, hasta el
 *  siguiente del mismo nivel o superior; si no, mientras la indentación sea mayor
 *  (y sin cruzar nunca un encabezado). Devuelve los pids en orden, ancla incluida.
 *  Vacío si el ancla no está en la lista. */
export function descendantPids(blocks: DocBlock[], anchorPid: string): string[] {
  const idx = blocks.findIndex(b => b.pid === anchorPid)
  if (idx === -1) return []
  const anchor = blocks[idx]
  const pids = [anchor.pid]
  for (let i = idx + 1; i < blocks.length; i++) {
    const b = blocks[i]
    if (anchor.type === 'heading') {
      if (b.type === 'heading' && b.level <= anchor.level) break
    } else {
      if (b.type === 'heading') break
      if (b.indent <= anchor.indent) break
    }
    pids.push(b.pid)
  }
  return pids
}

/** Texto de esos bloques tal y como lo guarda una cita (un párrafo por bloque,
 *  separados por línea en blanco; los vacíos no cuentan). */
export function blockTexts(blocks: DocBlock[], pids: string[]): string {
  const set = new Set(pids)
  return blocks.filter(b => set.has(b.pid)).map(b => b.text).filter(s => s.trim()).join('\n\n')
}

/** Localiza el ancla por `pid` y, si ese pid ya no existe (un `setContent` externo
 *  regenera los pid — ver applyCiteIndicators en DocEditor.tsx), por el TEXTO del
 *  párrafo citado. Sin este segundo camino la cita se queda huérfana para siempre. */
export function findAnchorPid(blocks: DocBlock[], pid?: string | null, citedText?: string | null): string | null {
  if (pid && blocks.some(b => b.pid === pid)) return pid
  const anchorText = (citedText || '').split('\n\n')[0].trim()
  if (!anchorText) return null
  return blocks.find(b => b.text.trim() === anchorText)?.pid ?? null
}

/** Devuelve el HTML sin esos bloques. Limpia además el `<li>` y la lista que
 *  queden vacíos al llevarse el párrafo que contenían — si no, el documento
 *  hereda viñetas huérfanas. */
export function removeBlocksFromHtml(html: string, pids: string[]): string {
  if (!html || pids.length === 0) return html
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const wanted = new Set(pids)
  // Barrido por atributo (no un selector con el pid interpolado): un pid es dato del
  // documento, y meterlo dentro de un selector obliga a escaparlo bien para siempre.
  for (const el of Array.from(doc.body.querySelectorAll<HTMLElement>('[data-pid]'))) {
    if (!wanted.has(el.getAttribute('data-pid') || '')) continue
    const li = el.closest('li')
    el.remove()
    if (li && !li.textContent?.trim()) {
      const list = li.parentElement
      li.remove()
      if (list && !list.textContent?.trim() && (list.tagName === 'UL' || list.tagName === 'OL')) list.remove()
    }
  }
  return doc.body.innerHTML
}
