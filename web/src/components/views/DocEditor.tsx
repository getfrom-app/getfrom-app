// DocEditor — DOCUMENTO de verdad (TipTap). Un nodo `_doc='1'` guarda su contenido
// en `body` (HTML). Editor rico: encabezados, listas, citas, código, enlaces,
// colores e IMÁGENES embebidas (subidas a R2). El título es la 1ª línea (se refleja
// en node.text). En el lienzo, el MISMO body se muestra como vista ligera; abrir el
// elemento (su dot) trae aquí el editor completo.

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEditor, EditorContent, BubbleMenu, ReactNodeViewRenderer } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Image from '@tiptap/extension-image'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { createPortal } from 'react-dom'
import { store, useStore } from '../../store/nodeStore'
import { assignContext, firstContextOf, contextColor } from '../../utils/cajones'
import { isContextKnowledge, isProfileKnowledge } from '../../utils/knowledgeNodes'
import { parseExtraData } from '../../utils/papeleraHelper'
import { firstLineTitle, DOC } from '../../utils/docNode'
import { markdownToHtml } from '../../utils/importMarkdown'
import DocMention from './DocMention'
import { extractDateFromEnd } from '../../utils/naturalDate'
import { buildTaskVerbRegex } from '../../store/predictionStore'
import { uploadFile } from '../../api/client'
import { setDocEditor, notifyDocEditor } from '../../utils/docEditorStore'
import TaskItemChip from './TaskItemChip'
import { MagicTaskGhost } from './MagicTaskGhost'
import type { MagicPrediction } from './MagicTaskGhost'
import { useTranslation } from 'react-i18next'
import DocSlashMenu from './DocSlashMenu'
import type { DocSlashAction } from './DocSlashMenu'
import NodeTableView from './NodeTableView'
import NodeKanbanView from './NodeKanbanView'
import NodeCalendarView from './NodeCalendarView'
import ContextPicker from '../panels/ContextPicker'
import { ParagraphId, genPid } from '../../utils/tiptapParagraphId'
import { CiteDecorations, citeDecoKey } from '../../utils/tiptapCiteDecorations'

// ¿El texto pegado parece MARKDOWN? (encabezados, listas, code fence, cita, enlaces,
// negritas). Basta un marcador claro para tratarlo como markdown y renderizarlo.
function looksLikeMarkdown(s: string): boolean {
  return /(^|\n)#{1,6}\s+\S/.test(s)          // # Encabezado
    || /(^|\n)\s*[-*+]\s+\S/.test(s)          // - lista
    || /(^|\n)\s*\d+\.\s+\S/.test(s)          // 1. lista
    || /```/.test(s)                          // ``` bloque de código
    || /(^|\n)>\s+\S/.test(s)                 // > cita
    || /\[[^\]]+\]\([^)\s]+\)/.test(s)        // [texto](url)
    || /\*\*[^*\n]+\*\*/.test(s)              // **negrita**
}

// Paleta de la barra flotante (misma que FormatToolbar del outliner).
const DOC_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#a16207', '#6b7280']

// CONSTANTE de módulo (no objeto literal inline en el JSX): evita que `BubbleMenu` de TipTap
// reciba un `tippyOptions` distinto en cada render.
const BUBBLE_MENU_TIPPY_OPTIONS = { duration: 100, maxWidth: 'none' } as const
const BUBBLE_MENU_ENABLED = true

// TaskItem con un id ESTABLE (`data-node-id`) que enlaza cada casilla del texto con su
// nodo-tarea de From real. Es la clave anti-duplicación: el sync reconcilia por este id
// (actualiza si existe, crea solo si falta y le escribe el id de vuelta). Se persiste en
// el HTML del body, así sobrevive a recargas.
// NodeView de React (`TaskItemChip`) para poder añadir, junto al checkbox nativo, un
// chip clicable con la fecha/prioridad que abre el modal de propiedades — ver ese archivo.
const TaskItemLinked = TaskItem.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      dataNodeId: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-node-id'),
        renderHTML: (attrs: { dataNodeId?: string | null }) => (attrs.dataNodeId ? { 'data-node-id': attrs.dataNodeId } : {}),
      },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(TaskItemChip)
  },
})

export default function DocEditor({ node, compact, registerActive, autofocus }: { node: { id: string; body?: string | null; text?: string }; compact?: boolean; registerActive?: boolean; autofocus?: boolean | 'start' | 'end' }) {
  useStore()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const saveTimer = useRef<number | null>(null)
  const editorRef = useRef<ReturnType<typeof useEditor>>(null)
  const [showColors, setShowColors] = useState(false)
  // Fechas pendientes de aplicar a la próxima tarea creada por el magic (clave = texto limpio
  // en minúsculas). El ghost quita la fecha del título al aceptar; aquí la recuperamos cuando
  // `syncTasksToNodes` crea el nodo-tarea, para ponerle el `due` correcto.
  const pendingDueRef = useRef<Map<string, { due: string; isEvent: boolean }>>(new Map())

  // ── Slash menu ("/tabla", "/kanban", "/calendario") ───────────────────────
  // Equivalente reducido del SlashMenu.tsx del outliner clásico, solo para los 3
  // bloques que hoy faltan en el documento nuevo (TipTap). MISMO modelo de datos:
  // este nodo `_doc` se marca con extraData.viewBlock+_inline='1' y sus hijos reales
  // (creados con el outliner o el propio doc) se renderizan como tabla/kanban/
  // calendario en vez de HTML — ver bloque de render más abajo y OutlinerNode.tsx
  // (~línea 2984) para el mismo mecanismo en el editor clásico.
  const [slashAnchor, setSlashAnchor] = useState<HTMLElement | null>(null)
  const [slashQuery, setSlashQuery] = useState('')
  // Posición (en el doc de TipTap) donde empieza el '/': permite borrar "/query" al elegir.
  const slashFromRef = useRef<number | null>(null)

  const detectSlash = () => {
    const ed = editorRef.current
    if (!ed) { setSlashAnchor(null); return }
    // Ya es un bloque-vista inline: no hay texto que editar, no hace falta detectar.
    if (viewBlockKind) { setSlashAnchor(null); return }
    const { $from } = ed.state.selection
    if (!ed.state.selection.empty) { setSlashAnchor(null); return }
    const para = $from.parent
    if (!para.isTextblock) { setSlashAnchor(null); return }
    const textBefore = para.textBetween(0, $from.parentOffset, undefined, ' ')
    const m = /(?:^|\s)\/([a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]*)$/.exec(textBefore)
    if (!m) { setSlashAnchor(null); return }
    slashFromRef.current = $from.pos - m[1].length - 1 // posición del '/'
    setSlashQuery(m[1])
    // Ancla visual: coordenadas del cursor en pantalla (el menú se posiciona con getBoundingClientRect).
    const coords = ed.view.coordsAtPos($from.pos)
    let anchor = document.getElementById('doc-slash-anchor-ghost')
    if (!anchor) {
      anchor = document.createElement('div')
      anchor.id = 'doc-slash-anchor-ghost'
      anchor.style.position = 'fixed'
      anchor.style.width = '0'
      anchor.style.height = '0'
      anchor.style.pointerEvents = 'none'
      document.body.appendChild(anchor)
    }
    anchor.style.left = coords.left + 'px'
    anchor.style.top = coords.top + 'px'
    setSlashAnchor(anchor)
  }

  const closeSlashMenu = () => { setSlashAnchor(null); slashFromRef.current = null }

  const selectSlashOption = (action: DocSlashAction, label: string) => {
    const ed = editorRef.current
    const from = slashFromRef.current
    closeSlashMenu()
    if (!ed || from == null) return
    const to = ed.state.selection.from
    const kind = action === 'view-table' ? 'tabla' : action === 'view-kanban' ? 'kanban' : 'calendario'
    // Borra el "/query" escrito y marca ESTE nodo como bloque-vista inline — mismo
    // extraData que usa el outliner clásico (viewBlock+_inline), para que
    // NodeTableView/NodeKanbanView/NodeCalendarView (parentId=node.id) lo interpreten.
    ed.chain().focus().deleteRange({ from, to }).run()
    let ed2: Record<string, unknown> = {}
    try { ed2 = JSON.parse(store.getNode(node.id)?.extraData || '{}') } catch { /* ignore */ }
    ed2.viewBlock = kind
    ed2._inline = '1'
    store.updateNode(node.id, { extraData: JSON.stringify(ed2), text: node.text?.trim() || label })
  }

  // Kind del bloque-vista inline actual (si lo hay) — leído en vivo desde la store para
  // reflejar el cambio nada más aplicarlo (sin esperar al próximo render por props).
  const viewBlockKind = (() => {
    const n = store.getNode(node.id)
    try {
      const parsed = JSON.parse(n?.extraData || '{}')
      if (parsed._inline === '1' && parsed.viewBlock) return parsed.viewBlock as string
    } catch { /* ignore */ }
    return null
  })()

  // Los nodos con título CANÓNICO (nota diaria = la fecha; TAREA/EVENTO = su texto)
  // NO deben perderlo cuando su body empieza vacío: `firstLineTitle('')` devuelve
  // «Documento» y pisaría el título real. Red de seguridad: si por un fallo de
  // enrutado (V2DetailView, etc.) una TAREA/EVENTO acaba abriéndose en este editor
  // como si fuera un documento en blanco, NUNCA debe perder su nombre — el bug
  // original era justo este: tareas abiertas por error quedaban tituladas «Documento».
  // «🧠 Lo que Fromly sabe» (por contexto o de perfil) es OTRO título canónico: un
  // sentinel de texto fijo, no algo que el usuario escriba — pero su body puede
  // quedarse vacío legítimamente (memoria aún sin contenido). Sin esta protección,
  // el guardado al DESMONTAR (más abajo) recalculaba `text` desde un body vacío y
  // lo dejaba en blanco, con lo que dejaba de reconocerse como el nodo de
  // conocimiento y aparecía como un documento huérfano «Sin título» en Elementos
  // (Alberto, 15 jul: "Lo que Fromly sabe" de Casa Alicante vacío + nota "Sin
  // título" — mismo nodo, mismo bug).
  const keepsOwnTitle = () => {
    const n = store.getNode(node.id)
    if (!n) return false
    if (n.isDiaryEntry || n.diaryDate || n.status != null || n.isEvent) return true
    if (isContextKnowledge(n.text) || isProfileKnowledge(n.text)) return true
    try { return JSON.parse(n.extraData || '{}')._containerNotes === '1' } catch { return false }
  }
  // Título vs. primer encabezado del body: son cosas DISTINTAS. El título solo se
  // deriva del primer renglón mientras el documento sigue SIN TÍTULO (nace en
  // blanco con «+Nota» y el usuario empieza a escribir — esa es la única situación
  // en la que "lo que escribes arriba se convierte en el título" tiene sentido).
  // En cuanto el documento YA tiene un título propio (puesto por el usuario, por la
  // IA al crearlo, o ya derivado antes), nunca más se vuelve a pisar por editar o
  // simplemente ABRIR el body — antes se recalculaba en cada guardado y CADA
  // APERTURA («Sanear título al abrir», más abajo), así que un documento titulado
  // "15 jul 26 — Santander: inscripción registral..." cuyo primer encabezado del
  // body fuera "Resumen" (patrón habitual en los resúmenes que genera la IA) se
  // renombraba a «Resumen» solo con abrirlo (Alberto, 15 jul).
  const hasOwnTitle = () => !!(store.getNode(node.id)?.text || '').trim()
  // Construye el update de guardado: incluye `text` solo en nodos SIN título propio.
  const bodySave = (html: string) => (keepsOwnTitle() || hasOwnTitle()) ? { body: html } : { body: html, text: firstLineTitle(html) }

  // Sube una imagen a R2 y la inserta en el cursor.
  const insertImage = async (file: File) => {
    const ed = editorRef.current
    if (!ed || !file.type.startsWith('image/')) return
    try { const { publicUrl } = await uploadFile(file); ed.chain().focus().setImage({ src: publicUrl }).run() }
    catch { /* silencioso */ }
  }

  // ── Citas de párrafo: «?» al pasar el ratón → asignar ESE párrafo a un
  // contexto. Crea un nodo-cita ligero (mismo patrón que un subrayado de PDF:
  // `_doc:'1'` + blockquote con el texto, hijo de ESTE documento) anclado por
  // `_docParagraphId` al párrafo de origen (id estable de ParagraphId, ver
  // tiptapParagraphId.ts) — así aparece en el contexto elegido (Alberto, 22
  // jul: "para que cuando trabajo en casa Alicante aparezca también ese
  // párrafo") y desde la cita se vuelve exactamente a ese párrafo, con ancla,
  // no solo se abre el documento entero ("hazlo con ancla, hazlo completo").
  const contentWrapRef = useRef<HTMLDivElement>(null)
  const [citeHover, setCiteHover] = useState<{ pid: string; top: number } | null>(null)
  const [citePicker, setCitePicker] = useState<{ pid: string; x: number; y: number; up: boolean } | null>(null)
  const citePickerRef = useRef<HTMLDivElement>(null)

  const onContentMouseMove = (e: React.MouseEvent) => {
    if (citePicker) return
    const wrap = contentWrapRef.current
    const target = (e.target as HTMLElement).closest('[data-pid]') as HTMLElement | null
    if (!target || !wrap) { setCiteHover(null); return }
    const pid = target.getAttribute('data-pid')
    if (!pid) { setCiteHover(null); return }
    setCiteHover({ pid, top: target.getBoundingClientRect().top - wrap.getBoundingClientRect().top })
  }

  const openCitePicker = (e: React.MouseEvent, pid: string) => {
    e.stopPropagation()
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const up = window.innerHeight - r.bottom < 320
    const x = Math.max(8, Math.min(r.left, window.innerWidth - 250))
    setCitePicker(up ? { pid, x, y: window.innerHeight - r.top + 4, up: true } : { pid, x, y: r.bottom + 4, up: false })
  }

  // Indicador persistente de párrafos citados — implementado como DECORACIÓN de
  // ProseMirror (ver utils/tiptapCiteDecorations.ts), NO como manipulación directa
  // del DOM: un `classList.add()` a mano se pierde en cuanto la vista redibuja ese
  // nodo (p.ej. `setContent()` disparado por el polling remoto cada 15s,
  // nodeStore.ts) porque PM no sabe nada de esa clase y la descarta. Las
  // decoraciones se recalculan dentro del propio `apply()` del plugin en CADA
  // transacción, así que sobreviven a esos redibujados solas. `lastSigRef` evita
  // dispatch redundantes (no hay cambios reales) en cada render.
  const lastCiteSigRef = useRef<string | null>(null)
  // pid en resalte breve («Ir a la nota») — NO un parámetro de applyCiteIndicators:
  // esta función se llama constantemente sin argumento (cada render, cada
  // transacción) y si el flash se pasara solo por parámetro, esas llamadas
  // rutinarias lo resetearían a null casi al instante, borrándolo antes de que
  // se llegara a ver. Vive en una ref para que sobreviva a esas llamadas.
  const flashPidRef = useRef<string | null>(null)
  const applyCiteIndicators = () => {
    const ed = editorRef.current
    if (!ed) return
    // Escaneo directo por `_docSourceId` (no `store.children`): las citas son
    // hijas de este documento, pero el filtro por extraData es más robusto
    // frente a cualquier desfase de la caché de hijos entre instancias/pestañas.
    // Doble índice — por `pid` (preciso) y por TEXTO citado (fallback): un
    // resync/setContent externo puede regenerar el `pid` de un párrafo ya
    // citado (el plugin de ParagraphId solo rellena huecos, pero un reemplazo
    // completo del doc borra el atributo y le asigna uno nuevo). Sin el
    // fallback por texto, la cita queda huérfana para siempre en ese caso.
    const byStoredPid = new Map<string, string>()
    const byText = new Map<string, string>()
    for (const c of store.allActive()) {
      const e = parseExtraData(c.extraData)
      if (e._docSelection !== '1' || e._docSourceId !== node.id) continue
      const pid = e._docParagraphId as string | undefined
      const text = (e._docText as string | undefined)?.trim()
      const ctx = firstContextOf(c)
      if (!ctx) continue
      const color = contextColor(ctx.id)
      if (pid) byStoredPid.set(pid, color)
      if (text) byText.set(text, color)
    }
    // Mapa final CLAVE = pid VIGENTE del párrafo (no el guardado en la cita).
    const map = new Map<string, string>()
    ed.state.doc.descendants(n => {
      const pid = n.attrs?.pid as string | undefined
      if (!pid) return
      const color = byStoredPid.get(pid) ?? byText.get(n.textContent.trim())
      if (color) map.set(pid, color)
    })
    const fPid = flashPidRef.current
    const sig = JSON.stringify(Array.from(map.entries())) + '|' + fPid
    if (sig === lastCiteSigRef.current) return
    lastCiteSigRef.current = sig
    const tr = ed.state.tr.setMeta(citeDecoKey, { map, flashPid: fPid })
    tr.setMeta('addToHistory', false)
    ed.view.dispatch(tr)
  }

  const createCitation = (pid: string, contextId: string) => {
    const ed = editorRef.current
    if (!ed) return
    let text = ''
    ed.state.doc.descendants(n => { if (n.attrs?.pid === pid) text = n.textContent })
    const trimmed = text.trim()
    if (!trimmed) return
    const extra: Record<string, string> = { [DOC]: '1', _docSelection: '1', _docSourceId: node.id, _docParagraphId: pid, _docText: trimmed }
    const quote = store.createNode({ text: '', parentId: node.id, extraData: extra })
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    store.updateNode(quote.id, { body: `<blockquote><p>${esc(trimmed)}</p></blockquote>` })
    assignContext(quote.id, contextId)
    applyCiteIndicators()
    window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: t('v2.citationSaved', 'Párrafo asignado al contexto'), type: 'success' } }))
  }

  useEffect(() => {
    if (!citePicker) return
    const h = (e: PointerEvent) => {
      const t = e.target as globalThis.Node
      if (citePickerRef.current?.contains(t)) return
      setCitePicker(null)
    }
    window.addEventListener('pointerdown', h, true)
    return () => window.removeEventListener('pointerdown', h, true)
  }, [citePicker])

  // Recalcula el mapa de citas en cada render (p.ej. cuando `useStore()` refleja
  // una cita creada desde OTRA pestaña/instancia) — `lastCiteSigRef` evita
  // transacciones redundantes cuando no hay cambios reales.
  useEffect(() => { applyCiteIndicators() })

  // Volver al párrafo exacto de una cita: scroll + resalte breve (disparado
  // desde V2DetailView.tsx, botón «Ir a la nota» de una cita). El resalte va
  // por decoración (applyCiteIndicators con flashPid), no por classList directo,
  // por la misma razón que el indicador persistente.
  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent<{ nodeId?: string; pid?: string; text?: string }>).detail
      if (!d?.nodeId || d.nodeId !== node.id) return
      const ed = editorRef.current
      const wrap = contentWrapRef.current
      if (!ed || !wrap) return
      // El `pid` puede haberse regenerado (ver applyCiteIndicators) — si no hay
      // coincidencia exacta, cae al párrafo cuyo texto coincide con el citado.
      let targetPid: string | null = d.pid && wrap.querySelector(`[data-pid="${d.pid}"]`) ? d.pid : null
      let el = targetPid ? wrap.querySelector<HTMLElement>(`[data-pid="${targetPid}"]`) : null
      if (!el && d.text) {
        const target = d.text.trim()
        ed.state.doc.descendants(n => {
          if (el) return
          const pid = n.attrs?.pid as string | undefined
          if (pid && n.textContent.trim() === target) { targetPid = pid; el = wrap.querySelector<HTMLElement>(`[data-pid="${pid}"]`) }
        })
      }
      if (!el || !targetPid) return
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      flashPidRef.current = targetPid
      lastCiteSigRef.current = null // fuerza el dispatch aunque el mapa de citas no cambie
      applyCiteIndicators()
      setTimeout(() => {
        flashPidRef.current = null
        lastCiteSigRef.current = null
        applyCiteIndicators()
      }, 1600)
    }
    window.addEventListener('from:scroll-to-paragraph', h as EventListener)
    return () => window.removeEventListener('from:scroll-to-paragraph', h as EventListener)
  }, [node.id])

  // ── Paso 2: sincroniza las CASILLAS del texto con tareas-From REALES ──────────
  // Cada `taskItem` ↔ un nodo-tarea hijo del `_doc` (con `_taskEmbed='1'`), status según
  // la casilla. Idempotente y anti-duplicación: reconcilia por `dataNodeId` (actualiza si
  // existe; crea SOLO si falta y le escribe el id de vuelta en el mismo tick; borra los
  // huérfanos). Hereda el contexto (`_ctxRefs`) del `_doc` si lo tiene → la tarea aparece
  // en la columna del contexto/día. Solo corre para el editor en edición (el activo).
  const syncingRef = useRef(false)
  const lastDetailRef = useRef<string | null>(null)
  const syncTasksToNodes = () => {
    const ed = editorRef.current
    if (!ed || syncingRef.current) return
    syncingRef.current = true
    try {
      const seen = new Set<string>()
      const assign: { pos: number; id: string }[] = []
      let parentRefs: string[] = []
      try { const r = JSON.parse(store.getNode(node.id)?.extraData || '{}')._ctxRefs; if (Array.isArray(r)) parentRefs = r } catch { /* ignore */ }
      ed.state.doc.descendants((item, pos) => {
        if (item.type.name !== 'taskItem') return true
        const text = item.textContent.trim()
        if (!text) return true // casilla vacía: aún no es tarea (evita nodos «Sin título»)
        const status = item.attrs.checked ? 'done' : 'pending'
        const id = item.attrs.dataNodeId as string | null
        const existing = id ? store.getNode(id) : null
        if (existing && !existing.deletedAt) {
          if (existing.text !== text || existing.status !== status) store.updateNode(id!, { text, status })
          seen.add(id!)
        } else {
          const created = store.createNode({ text, parentId: node.id, extraData: { _taskEmbed: '1' } })
          const updates: Record<string, unknown> = { status }
          // Fecha del magic (ghost): el título ya viene limpio, la fecha se guardó aparte.
          const pend = pendingDueRef.current.get(text.toLowerCase())
          if (pend) {
            updates.due = pend.due
            if (pend.isEvent) { updates.isEvent = true; updates.status = null }
            pendingDueRef.current.delete(text.toLowerCase())
          } else {
            // Magic de FECHA en línea: si el texto lleva una fecha natural («… mañana», «… el
            // viernes»), la tarea coge ese `due` y entra en la agenda del día correcto. Solo al
            // CREAR (no se re-machaca luego: si ajustas la fecha en la columna, se respeta).
            try {
              const dt = extractDateFromEnd(text)
              if (dt?.parsed?.date) {
                const d = new Date(dt.parsed.date); d.setHours(0, 0, 0, 0)
                if (dt.timeStr) { const [h, m] = dt.timeStr.split(':').map(Number); updates.due = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).toISOString() }
                else updates.due = d.toISOString()
              }
            } catch { /* sin fecha */ }
          }
          store.updateNode(created.id, updates)
          // Hereda el contexto del `_doc` (si lo tiene) → la tarea aparece en su columna.
          for (const ref of parentRefs) assignContext(created.id, ref)
          assign.push({ pos, id: created.id })
          seen.add(created.id)
        }
        return true
      })
      if (assign.length) {
        const tr = ed.state.tr
        for (const a of assign) tr.setNodeAttribute(a.pos, 'dataNodeId', a.id)
        tr.setMeta('addToHistory', false)
        ed.view.dispatch(tr)
      }
      // Borrar las tareas-embed cuyas casillas ya no existen en el texto. (Solo afecta a
      // nodos hijos con `_taskEmbed='1'` de ESTE _doc → jamás toca contenido normal.)
      for (const c of store.children(node.id)) {
        if (c.deletedAt) continue
        let emb = false
        try { emb = JSON.parse(c.extraData || '{}')._taskEmbed === '1' } catch { /* ignore */ }
        if (emb && !seen.has(c.id)) store.deleteNode(c.id)
      }
    } finally {
      syncingRef.current = false
    }
  }

  // MAGIC automático: convierte en casilla los PÁRRAFOS que parecen tarea (verbo de acción),
  // pero SOLO los que ya no tienes editando (el cursor está en otra línea) → nunca interrumpe
  // mientras escribes. Conservador: mínimo 6 chars y solo párrafos sueltos (no dentro de lista).
  const magicRef = useRef(false)
  const autoMagicTasks = () => {
    const ed = editorRef.current
    if (!ed || magicRef.current) return
    const $from = ed.state.selection.$from
    // Solo actúa si acabas de pulsar Enter: el cursor está en un párrafo VACÍO. Así NUNCA
    // reconvierte prosa de un documento largo — solo la línea que acabas de terminar.
    const cur = $from.parent
    if (cur.type.name !== 'paragraph' || cur.textContent.trim().length > 0) return
    const curStart = $from.before($from.depth)
    const prev = ed.state.doc.resolve(curStart).nodeBefore
    if (!prev || prev.type.name !== 'paragraph') return
    const text = prev.textContent.trim()
    if (text.length < 6) return
    const normed = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    if (!buildTaskVerbRegex().test(normed)) return
    const prevInner = curStart - prev.nodeSize + 1
    const cursorPos = ed.state.selection.from
    magicRef.current = true
    try {
      ed.chain().setTextSelection(prevInner).toggleTaskList().run()
      ed.commands.setTextSelection(Math.min(cursorPos, ed.state.doc.content.size))
    } finally {
      magicRef.current = false
    }
  }

  // Aceptar el ghost del magic: guarda la fecha detectada (para el nodo que creará el sync)
  // y crea la tarea YA. Ref estable → la extensión (creada una vez) nunca queda desfasada.
  const magicAcceptRef = useRef<(pred: MagicPrediction) => void>(() => {})
  magicAcceptRef.current = (pred: MagicPrediction) => {
    if (pred.date?.parsed?.date) {
      const d = new Date(pred.date.parsed.date); d.setHours(0, 0, 0, 0)
      let due: string
      if (pred.date.timeStr) { const [h, m] = pred.date.timeStr.split(':').map(Number); due = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).toISOString() }
      else due = d.toISOString()
      const isEvent = !!pred.date.isEvent || !!pred.date.timeStr
      pendingDueRef.current.set(pred.date.cleanText.trim().toLowerCase(), { due, isEvent })
    }
    // Crear el nodo-tarea inmediatamente (no esperar al debounce de 500 ms) → aparece ya en
    // su columna/agenda. El sync es idempotente, así que adelantar la llamada es seguro.
    syncTasksToNodes()
    const dl = pred.date?.parsed?.label
    const msg = dl ? `☐ ${t('outliner.taskLower', 'tarea')} · 📅 ${dl}${pred.date?.timeStr ? ` ${pred.date.timeStr}` : ''}` : `☐ ${t('outliner.taskLower', 'tarea')}`
    window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: msg, type: 'success' } }))
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextStyle,
      Color,
      // Magic «verbo → tarea» con ghost-text (misma que el outliner). Ver MagicTaskGhost.ts.
      MagicTaskGhost.configure({ taskWord: t('outliner.taskLower', 'tarea'), onAccept: (p) => magicAcceptRef.current(p) }),
      // Casillas de tarea DENTRO del texto: «[] » al inicio de línea las crea (input rule
      // nativo de TaskList). Paso 1 = casilla WYSIWYG marcable. Paso 2 (pendiente) = cada
      // casilla se enlazará a una tarea-From real (agenda) por su nodo hijo.
      TaskList,
      TaskItemLinked.configure({ nested: true }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener nofollow' } }),
      // Sin placeholder en el lienzo (compact): al crear un texto con doble clic, el
      // «Escribe tu documento…» centrado quedaba raro sobre una tarjeta recién nacida.
      // En la página en solitario de un documento sí ayuda, se mantiene.
      Placeholder.configure({ placeholder: compact ? '' : 'Escribe tu documento…' }),
      Image.configure({ inline: false, allowBase64: false }),
      ParagraphId,
      CiteDecorations,
    ],
    content: node.body || '',
    // Por defecto: compact (tarjeta del lienzo) autoenfoca al montar; NO-compact (página en
    // solitario) no. `autofocus={false}` explícito lo desactiva SIEMPRE — lo usa
    // `LienzoDocPanel` para no robarle el foco a la tarjeta si esta también está editando.
    // `autofocus="start"`/`"end"` explícitos pasan tal cual (p.ej. V2DetailView lo pide
    // en 'start' para una nota recién creada, así se puede escribir al vuelo).
    autofocus: autofocus === false ? false : (typeof autofocus === 'string' ? autofocus : (compact ? 'end' : false)),
    onUpdate: ({ editor }) => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      const html = editor.getHTML()
      saveTimer.current = window.setTimeout(() => {
        autoMagicTasks() // Magic: párrafos-tarea (fuera del cursor) → casilla
        store.updateNode(node.id, bodySave(editor.getHTML()))
        syncTasksToNodes()
      }, 500)
      detectSlash()
    },
    onSelectionUpdate: () => {
      notifyDocEditor()
      detectSlash()
      // NOTA: al poner el cursor dentro de una casilla-tarea NO cambiamos la columna derecha.
      // Antes disparábamos `from:open-detail` → la columna saltaba a las PROPIEDADES DE LA TAREA
      // y se salía del texto que estabas editando. Ahora la columna se queda en el TEXTO y las
      // propiedades de la tarea (fecha/recurrencia/prioridad) se abren en el MODAL global al
      // pulsar el chip de la casilla (`from:open-task-props` en TaskItemChip). Igual en tarjeta
      // del lienzo y en el panel derecho — consistencia total.
    },
    // `applyCiteIndicators` también aquí (no solo en el useEffect de render):
    // tras el backfill de `pid` (más abajo, `onCreate`) o cualquier transacción
    // que cambie pids, recalcula el mapa contra los pids VIGENTES sin esperar
    // al siguiente render de React. `lastCiteSigRef` evita dispatch redundantes.
    onTransaction: () => { notifyDocEditor(); applyCiteIndicators() },
    // Documentos ya existentes (creados antes de ParagraphId) no tienen `pid` en
    // ningún párrafo — el plugin de la extensión solo asigna ids en transacciones
    // que YA cambian el doc, así que un documento abierto sin tocar se quedaría
    // sin anclas para siempre. Backfill único al crear el editor.
    onCreate: ({ editor: ed }) => {
      const types = ['paragraph', 'heading', 'blockquote']
      let tr = ed.state.tr
      let changed = false
      ed.state.doc.descendants((n, pos) => {
        if (types.includes(n.type.name) && !n.attrs.pid) {
          tr = tr.setNodeMarkup(pos, undefined, { ...n.attrs, pid: genPid() })
          changed = true
        }
      })
      if (changed) { tr.setMeta('addToHistory', false); ed.view.dispatch(tr) }
    },
    editorProps: {
      // Pegar / soltar imágenes → subir a R2 e insertar.
      handlePaste: (_v, e) => {
        const items = Array.from(e.clipboardData?.items || [])
        const img = items.find(i => i.type.startsWith('image/'))
        if (img) { const f = img.getAsFile(); if (f) { insertImage(f); return true } }
        // Pegar TEXTO PLANO que parece MARKDOWN → renderizarlo (encabezados, listas,
        // negritas, código, enlaces, citas). Solo si NO viene HTML del portapapeles
        // (si copias de una web, ya trae HTML y lo maneja TipTap).
        const text = e.clipboardData?.getData('text/plain') || ''
        const html = e.clipboardData?.getData('text/html') || ''
        if (text && !html && looksLikeMarkdown(text)) {
          const rendered = markdownToHtml(text)
          if (rendered && rendered !== `<p>${text}</p>`) {
            editorRef.current?.chain().focus().insertContent(rendered).run()
            return true
          }
        }
        return false
      },
      handleDrop: (_v, e) => {
        const dt = (e as DragEvent).dataTransfer
        const f = Array.from(dt?.files || []).find(x => x.type.startsWith('image/'))
        if (f) { insertImage(f); return true }
        return false
      },
    },
  }, [node.id])
  editorRef.current = editor

  // Título del documento en blanco al abrirlo por primera vez: si NACE sin título
  // (p.ej. «+Nota»), toma el primer renglón del body como título inicial. Si YA
  // tiene título propio, no se toca — abrir el documento nunca debe retitularlo.
  useEffect(() => {
    if (!editor) return
    if (keepsOwnTitle() || hasOwnTitle()) return
    const t = firstLineTitle(editor.getHTML())
    if (t) store.updateNode(node.id, { text: t })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, node.id])

  // Sincronizar con cambios EXTERNOS: la tarjeta y el panel son dos editores TipTap
  // independientes sobre el MISMO nodo (decisión de Alberto: escribir en ambos sitios).
  // TipTap es «no controlado» — solo lee `content` al crearse, nunca vuelve a mirar el
  // prop — así que si escribes en uno, el otro se queda con el HTML viejo hasta que algo
  // fuerce un refresco. Aquí: si `node.body` cambia por FUERA de este editor (viene de la
  // store, no de `onUpdate`) y este editor NO tiene el foco ahora mismo, se resincroniza
  // su contenido. `emitUpdate:false` para no disparar `onUpdate`→otro `store.updateNode`
  // (evita el eco). Si SÍ tiene el foco, no se toca — nunca pisar lo que se está tecleando.
  useEffect(() => {
    if (!editor) return
    if (editor.isFocused) return
    if (editor.getHTML() === (node.body || '')) return
    editor.commands.setContent(node.body || '', false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, node.body])

  // Limpieza del ancla fantasma del menú "/" (creada en detectSlash) al desmontar.
  useEffect(() => () => {
    document.getElementById('doc-slash-anchor-ghost')?.remove()
  }, [])
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    if (editor) {
      syncTasksToNodes() // reconcilia y asigna ids al doc ANTES de guardar el HTML final
      store.updateNode(node.id, bodySave(editor.getHTML()))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, node.id])

  // Registrar el editor activo para la barra de formato de PÁGINA (DocInspector, columna
  // derecha). En el LIENZO (compact) normalmente NO se registra: el formato va en la barra
  // flotante y la columna derecha es la del contexto/tarea. EXCEPCIÓN: `registerActive` (lo usa
  // `LienzoDocPanel`, el panel de documento del lienzo) SÍ registra aunque sea compact — así
  // conserva el autofocus + la barra flotante al seleccionar, Y ADEMÁS obtiene la barra de
  // formato persistente de `DocInspector` arriba, reutilizada tal cual.
  useEffect(() => {
    if (!editor || (compact && !registerActive)) return
    setDocEditor(editor, insertImage, node.id)
    return () => setDocEditor(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, compact, registerActive, node.id])

  if (!editor) return null

  const onContentClick = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a') as HTMLAnchorElement | null
    if (!a) return
    const href = a.getAttribute('href') || ''
    if (href.startsWith('/node/') || href.startsWith('/app/node/') || href.startsWith('from://node/')) {
      e.preventDefault()
      const id = href.replace(/^\/app/, '').replace(/^\/node\//, '').replace(/^from:\/\/node\//, '')
      // En Fromly 2.0 los enlaces internos ABREN el elemento en el panel de detalle
      // (evento que V2App escucha); en v1 se navega igual que antes.
      if (window.location.pathname.startsWith('/app') && !window.location.pathname.startsWith('/app/v1')) {
        window.dispatchEvent(new CustomEvent('from:open-detail', { detail: { nodeId: id } }))
      } else {
        navigate('/node/' + id)
      }
    }
    else if (/^https?:\/\//i.test(href)) { e.preventDefault(); window.open(href, '_blank', 'noopener') }
  }

  return (
    <div className={`doc-editor${compact ? ' doc-editor--compact' : ''}`} style={compact ? { padding: 0, position: 'relative' } : { maxWidth: 760, margin: '0 auto', padding: '4px 4px 120px' }}>
      {/* Barra FLOTANTE de formato (solo en el lienzo). Aparece al seleccionar texto,
          ENCIMA de la selección — la columna derecha sigue siendo la del contexto/tarea.
          Mismo diseño que la FormatToolbar del outliner (clases wf-format-toolbar/ft-*).
          Al ser TipTap, el formato es WYSIWYG: negrita se ve negrita, el color se aplica. */}
      {BUBBLE_MENU_ENABLED && compact && (
        <BubbleMenu editor={editor} tippyOptions={BUBBLE_MENU_TIPPY_OPTIONS}>
          <div className="wf-format-toolbar" style={{ position: 'static', width: 'auto' }} onMouseDown={e => e.preventDefault()}>
            {!showColors ? (
              <>
                <button className="ft-btn" title="H1" onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 1 }).run() }}><span style={{ fontWeight: 800, fontSize: 10 }}>H1</span></button>
                <button className="ft-btn" title="H2" onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 2 }).run() }}><span style={{ fontWeight: 800, fontSize: 10 }}>H2</span></button>
                <button className="ft-btn" title="H3" onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 3 }).run() }}><span style={{ fontWeight: 800, fontSize: 10 }}>H3</span></button>
                <div className="ft-sep" />
                <button className="ft-btn" title="Negrita" onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBold().run() }}><strong style={{ fontSize: 13 }}>B</strong></button>
                <button className="ft-btn" title="Cursiva" onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleItalic().run() }}><em style={{ fontSize: 13 }}>I</em></button>
                <button className="ft-btn" title="Tachado" onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleStrike().run() }}><s style={{ fontSize: 13 }}>S</s></button>
                <div className="ft-sep" />
                <button className="ft-btn" title="Código" onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleCode().run() }}><span style={{ fontFamily: 'monospace', fontSize: 10 }}>{'<>'}</span></button>
                <button className="ft-btn" title="Enlace" onMouseDown={e => { e.preventDefault(); const prev = editor.getAttributes('link').href; const url = window.prompt('URL', prev || 'https://'); if (url === null) return; if (url === '') editor.chain().focus().unsetLink().run(); else editor.chain().focus().setLink({ href: url }).run() }}><span style={{ fontSize: 12 }}>🔗</span></button>
                <div className="ft-sep" />
                <button className="ft-btn" title="Tarea (casilla)" onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleTaskList().run() }}><span style={{ fontSize: 12 }}>☑</span></button>
                <button className="ft-btn" title="Color" onMouseDown={e => { e.preventDefault(); setShowColors(true) }}><span style={{ fontWeight: 700, fontSize: 13, borderBottom: '2.5px solid #ef4444', lineHeight: 1 }}>A</span></button>
              </>
            ) : (
              <div className="ft-color-panel">
                <div className="ft-color-row">
                  <span className="ft-color-label">Color</span>
                  <button className="ft-btn ft-erase-btn" title="Quitar color" onMouseDown={e => { e.preventDefault(); editor.chain().focus().unsetColor().run(); setShowColors(false) }}>
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><line x1="2" y1="10" x2="10" y2="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                  </button>
                  {DOC_COLORS.map(c => (
                    <button key={c} className="ft-color-swatch" title={c} onMouseDown={e => { e.preventDefault(); editor.chain().focus().setColor(c).run(); setShowColors(false) }}>
                      <span style={{ color: c, fontWeight: 700, fontSize: 13 }}>A</span>
                    </button>
                  ))}
                </div>
                <div className="ft-color-footer">
                  <button className="ft-back-btn" onMouseDown={e => { e.preventDefault(); setShowColors(false) }}>‹ Volver</button>
                </div>
              </div>
            )}
          </div>
        </BubbleMenu>
      )}
      <div ref={contentWrapRef} style={{ position: 'relative' }} onClick={onContentClick}
        onMouseMove={onContentMouseMove} onMouseLeave={() => setCiteHover(null)}>
        <EditorContent editor={editor} />
        {/* «?» flotante al pasar el ratón por un párrafo — asigna ESE párrafo a
            un contexto (mismo patrón que RowContextChip). */}
        {citeHover && !citePicker && (
          <button className="doc-cite-btn" style={{ top: citeHover.top }}
            onMouseDown={e => e.preventDefault()}
            onClick={e => openCitePicker(e, citeHover.pid)}
            title={t('v2.assignParagraphToContext', 'Asignar este párrafo a un contexto')}>?</button>
        )}
        {citePicker && createPortal((
          <div ref={citePickerRef} className="ctx-pick"
            style={{ position: 'fixed', ...(citePicker.up ? { bottom: citePicker.y } : { top: citePicker.y }), left: citePicker.x, zIndex: 3000 }}
            onClick={e => e.stopPropagation()}>
            <ContextPicker currentId={null} onPick={id => { if (id) createCitation(citePicker.pid, id); setCitePicker(null) }} />
          </div>
        ), document.body)}
      </div>
      {editor && <DocMention editor={editor} selfId={node.id} />}

      {/* Menú "/" — inserta Tabla/Kanban/Calendario, mismo modelo de datos que el
          outliner clásico (ver detectSlash/selectSlashOption arriba). */}
      {slashAnchor && (
        <DocSlashMenu
          anchorEl={slashAnchor}
          query={slashQuery}
          onSelect={selectSlashOption}
          onClose={closeSlashMenu}
        />
      )}

      {/* Bloque-vista inline: si este documento fue convertido en Tabla/Kanban/Calendario
          por el menú "/", renderiza esa vista (con sus hijos reales) DEBAJO del texto,
          en vez del HTML del body — igual que el outliner clásico (OutlinerNode.tsx ~4519). */}
      {viewBlockKind && (
        <div className="outliner-inline-view doc-editor-inline-view">
          {viewBlockKind === 'tabla' && <NodeTableView parentId={node.id} />}
          {viewBlockKind === 'kanban' && <NodeKanbanView parentId={node.id} />}
          {viewBlockKind === 'calendario' && <NodeCalendarView parentId={node.id} />}
        </div>
      )}
    </div>
  )
}
