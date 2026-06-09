/**
 * importMarkdown — importa archivos Markdown/texto (Obsidian, Notion, genéricos)
 * al árbol de Fromly, preservando la jerarquía de carpetas y el contenido.
 *
 * Cada archivo .md/.txt se convierte en una NOTA (su nombre = título), bajo un
 * contenedor "📥 Importado AAAA-MM-DD". Si los archivos vienen de una carpeta
 * (input webkitdirectory), las subcarpetas se reproducen como nodos contenedores.
 * El contenido se parsea: encabezados (#) → secciones anidadas; viñetas (-,*,1.)
 * → nodos hijos con su indentación; párrafos → nodos.
 */
import { store } from '../store/nodeStore'

export interface ImportFile {
  /** Ruta relativa (con carpetas) si viene de una carpeta; si no, solo el nombre. */
  path: string
  content: string
}

interface Line { depth: number; text: string; isHeading: boolean }

/** Parsea el contenido markdown de un archivo en una lista plana de líneas con
 *  profundidad relativa, lista para construir el árbol. */
function parseLines(md: string): Line[] {
  const out: Line[] = []
  const raw = md.replace(/\r\n/g, '\n').split('\n')
  let inCode = false
  for (const lineRaw of raw) {
    const line = lineRaw
    if (line.trim().startsWith('```')) { inCode = !inCode; out.push({ depth: 0, text: line.trim(), isHeading: false }); continue }
    if (inCode) { out.push({ depth: 0, text: line, isHeading: false }); continue }
    const trimmed = line.trim()
    if (!trimmed) continue
    // Encabezado markdown
    const h = trimmed.match(/^(#{1,6})\s+(.*)$/)
    if (h) { out.push({ depth: h[1].length - 1, text: h[2].trim(), isHeading: true }); continue }
    // Viñeta / tarea / numerada — depth por indentación (2 espacios = 1 nivel)
    const indent = line.match(/^(\s*)/)?.[1].replace(/\t/g, '  ').length ?? 0
    const bullet = trimmed.match(/^([-*+]|\d+\.)\s+(.*)$/)
    const checkbox = trimmed.match(/^[-*+]\s+\[( |x|X)\]\s+(.*)$/)
    if (checkbox) {
      out.push({ depth: 10 + Math.floor(indent / 2), text: (checkbox[1].toLowerCase() === 'x' ? '✓ ' : '') + checkbox[2].trim(), isHeading: false })
      continue
    }
    if (bullet) { out.push({ depth: 10 + Math.floor(indent / 2), text: bullet[2].trim(), isHeading: false }); continue }
    // Párrafo normal
    out.push({ depth: 100, text: trimmed, isHeading: false })
  }
  return out
}

/** Crea bajo `parentId` los nodos del contenido markdown. */
function buildContent(parentId: string, lines: Line[]): void {
  // Pila de [profundidadVisual, nodeId]. Encabezados anidan por nivel (#),
  // viñetas por indentación; los párrafos cuelgan del último encabezado.
  const stack: Array<{ key: number; id: string }> = [{ key: -1, id: parentId }]
  let order = 1000
  for (const ln of lines) {
    // key normalizada: encabezados 0..5, viñetas 10+, párrafos van bajo el último contenedor
    const key = ln.isHeading ? ln.depth : ln.depth >= 100 ? 999 : ln.depth
    // Buscar el padre: el nodo en la pila con key < key
    while (stack.length > 1 && stack[stack.length - 1].key >= key) stack.pop()
    const parent = stack[stack.length - 1].id
    const node = store.createNode({ text: ln.text, parentId: parent, siblingOrder: order })
    order += 1000
    // Encabezados y viñetas pueden tener hijos; los párrafos no anidan
    if (key !== 999) stack.push({ key, id: node.id })
  }
}

/** Importa los archivos. Devuelve cuántas notas se crearon. */
export async function importMarkdownFiles(files: ImportFile[]): Promise<{ notes: number; container: string | null }> {
  const valid = files.filter(f => /\.(md|markdown|txt)$/i.test(f.path) && f.content.trim())
  if (valid.length === 0) return { notes: 0, container: null }

  const date = new Date()
  const label = `📥 Importado ${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const rootSibs = store.children(null).filter(n => !n.deletedAt)
  const maxOrder = rootSibs.length > 0 ? Math.max(...rootSibs.map(c => c.siblingOrder)) : 0
  const container = store.createNode({ text: label, parentId: null, siblingOrder: maxOrder + 1000 })

  // Cache de carpetas creadas: ruta → nodeId
  const folderCache = new Map<string, string>()
  function ensureFolder(parts: string[]): string {
    if (parts.length === 0) return container.id
    const keyPath = parts.join('/')
    const cached = folderCache.get(keyPath)
    if (cached) return cached
    const parentId = ensureFolder(parts.slice(0, -1))
    const name = parts[parts.length - 1]
    const node = store.createNode({ text: `📁 ${name}`, parentId })
    folderCache.set(keyPath, node.id)
    return node.id
  }

  let notes = 0
  for (const f of valid) {
    const segments = f.path.split('/').filter(Boolean)
    const fileName = segments.pop() || 'Nota'
    const folderId = ensureFolder(segments.filter(s => !/\.(md|markdown|txt)$/i.test(s)))
    const lines = parseLines(f.content)
    // Título = primer H1 si existe; si no, el nombre del archivo sin extensión
    const firstH1 = lines.find(l => l.isHeading && l.depth === 0)
    const title = firstH1 ? firstH1.text : fileName.replace(/\.(md|markdown|txt)$/i, '')
    const body = firstH1 ? lines.filter(l => l !== firstH1) : lines
    const note = store.createNode({ text: title, parentId: folderId })
    buildContent(note.id, body)
    notes++
  }
  return { notes, container: container.id }
}
