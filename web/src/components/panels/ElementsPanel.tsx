/**
 * ElementsPanel — el BUSCADOR universal del lienzo (estilo Heptabase). Lista TODOS los
 * elementos del lienzo (globalmente): textos, tareas, eventos, enlaces, PDFs, imágenes y
 * contextos. Buscador de texto + filtro por TIPO; al filtrar por Tareas/Eventos aparece un
 * sub-filtro (hoy/abiertas/cerradas/futuras/sin fecha). Clic en una fila → vuela al elemento
 * en el lienzo y abre su panel. Lista VIRTUALIZADA → escala a miles de elementos (años de
 * trabajo) sin pegarse.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useVirtualizer } from '@tanstack/react-virtual'
import { store, useStore, nodeMeta } from '../../store/nodeStore'
import type { Node } from '../../types'
import { isDocNode, elementDisplayTitle } from '../../utils/docNode'
import { fmtDate, fmtDateFull } from '../../utils/formatDate'
import { isMarkedContext, listMarkedContexts, contextColor, assignContext } from '../../utils/cajones'
import { isContextMemoryNode } from '../../utils/knowledgeNodes'
import { openNodeDetail } from '../../utils/canvasNav'
import TaskRow from './TaskRow'
import { TaskPropsPopover } from './DiaryPanelComponents'
import { isInPapelera } from '../../utils/papeleraHelper'
import { isTaskNode, isTimeBlockNode } from '../../utils/taskNode'
import { createAgentUnder } from '../../utils/agentesHelper'
import { createPromptUnder } from '../../utils/promptsHelper'
import { useGroupSelection } from '../../hooks/useGroupSelection'
import NewNamedItemModal from '../modals/NewNamedItemModal'
import { TableView, KanbanView, CalendarView } from '../views/FilterResultsView'
import type { FilterView, TableSortBy } from '../views/FilterResultsView'
import PizarraThumbnail from '../views/PizarraThumbnail'
import Icon, { type IconName } from '../../v2/components/Icon'
import GroupAddButton from '../../v2/components/GroupAddButton'
import { displayTitle } from '../../utils/displayText'
import { elementsBrowserStore, useElementsBrowserStore } from '../../store/elementsBrowserStore'
import { elementTypeId, createElementOfType, getTypeDef } from '../../utils/typeDefsHelper'

// ⚠️ Ya NO existen los tipos 'event', 'context' ni 'memory' (Alberto, 5 ago 2026):
//   · evento    → es una TAREA con día y hora, no un tipo aparte ("los eventos son
//                 tareas que tienen día y hora... hay que unificarlo en todo Fromly").
//   · contexto  → es un LUGAR, no un elemento: se navega desde la sidebar, y la ficha
//                 del contexto ya lista lo suyo. Aquí era un segundo camino redundante.
//   · memoria   → memoria IA antigua, pieza interna de Fromly. Fuera de la vista.
export type ElemKind = 'text' | 'canvas' | 'task' | 'link' | 'pdf' | 'image' | 'highlight' | 'agent' | 'conversation' | 'prompt' | 'cita' | 'group'
export type TaskSub = 'all' | 'today' | 'open' | 'done' | 'future' | 'nodate'

export interface ElemRow { id: string; kind: ElemKind; title: string; snippet: string; updatedAt: string; createdAt: string; due?: string | null; status?: string | null; typeId?: string | null }
type SortBy = 'updated' | 'created' | 'title' | 'kind'

// Rendimiento (27 ago 2026 — Alberto: "en elementos va lenta porque hay
// demasiados elementos"): antes `classify()` hacía su propio JSON.parse(extraData)
// SIN caché en cada llamada — con miles de nodos, cada cambio de `nodesVersion`
// (que salta con CUALQUIER escritura en CUALQUIER parte de la app, no solo aquí)
// reparseaba el extraData de todo el árbol activo. `nodeMeta()` (nodeStore.ts) ya
// cachea ese parse en un WeakMap por objeto Node, invalidado solo cuando el nodo
// cambia de verdad (updateNode siempre crea un Node nuevo) — reusarlo aquí evita
// duplicar la caché y elimina el reparseo repetido sin tocar el resto de la lógica.

// Exportada: ElementsFilters.tsx (columna derecha) necesita los mismos
// recuentos por tipo que el centro, sin duplicar la regla de qué ES un
// elemento — 28 ago 2026.
export function classify(n: Node): ElemKind | null {
  if (n.deletedAt) return null
  const e = nodeMeta(n) as unknown as Record<string, unknown>
  if (e._absorbedBy != null) return null       // oculto dentro de un bloque → no es elemento suelto
  // Mensajes/transcripciones DENTRO de una conversación no son elementos sueltos (solo
  // la sesión en sí lo es, como tipo 'conversation' — ver más abajo).
  if (e._aiTranscript != null || e._aiMsgRole != null) return null
  // Nota diaria (📅 Agenda → Año → Mes → Día) — NUNCA es un elemento suelto (Alberto,
  // 4 ago 2026: "las notas diarias no deben aparecer en elementos, son notas que solo
  // se abren desde el calendario o desde la tab día"). Reemplaza la decisión anterior
  // (22 jul: se había convertido en su propio tipo buscable 'dia') — revertida porque
  // duplicaba el acceso ya cubierto por Calendario/tab Día y añadía ruido a la lista.
  if (n.isDiaryEntry) return null
  // La conversación (sesión ✦) SÍ es un elemento — Alberto: "la conversación en sí también
  // debería ser un elemento". Antes se ocultaban aquí las sesiones de comando rápido (1
  // turno, sin continuidad); ahora TODOS los chats se guardan y se listan (15 jul: "quiero
  // que se guarden todos los chats").
  if (e._aiSession === '1') return 'conversation'
  if (e._containerNotes === '1') return null   // espacio de notas libres (estructural, no un elemento)
  if (isContextMemoryNode(n)) return null      // Memoria del contexto — superficie interna, no un elemento suelto
  if (e._pdfSelection != null) return 'highlight'   // subrayado guardado de un PDF (cita)
  if (e._docSelection != null) return 'cita'        // párrafo de otra nota asignado a este contexto
  if (e._agentDef === '1') return 'agent'           // agente (v2: puede colgar de cualquier contexto)
  if (e._promptDef === '1') return 'prompt'         // prompt (v2: puede colgar de cualquier contexto)
  if (e._group === '1') return 'group'              // grupo de elementos (varios ids en _groupRefs)
  if (isMarkedContext(n)) return null   // contexto = lugar, no elemento (ver ElemKind)
  if (isTaskNode(n)) return 'task'      // evento = tarea con día y hora (utils/taskNode.ts)
  if (isTimeBlockNode(n)) return null   // TimeBlock: solo vive en el planificador, no en Elementos
  const rt = e._resourceType as string | undefined
  if (rt === 'image' || e._imageUrl) return 'image'
  if (rt === 'pdf') return 'pdf'
  if (n.isResource || e._resourceUrl || e._resource) return 'link'
  if (e._v2canvas === '1') return 'canvas'          // nodo-documento en modo Lienzo (pizarra)
  if (isDocNode(n) || store.isNote(n)) return 'text'
  // Memoria IA ANTIGUA (`_tagDefinition`): pieza interna de Fromly, nunca un elemento.
  return null
}

function stripHtml(html?: string | null): string {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Sub-filtro de tareas/eventos por su `due`/`status`. */
function matchesTaskSub(r: ElemRow, sub: TaskSub): boolean {
  if (sub === 'all') return true
  if (sub === 'open') return r.status === 'pending'
  if (sub === 'done') return r.status === 'done'
  if (sub === 'nodate') return !r.due
  if (!r.due) return false
  const d = new Date(r.due); const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dayMs = 24 * 3600 * 1000
  if (sub === 'today') return d >= start && d < new Date(start.getTime() + dayMs)
  if (sub === 'future') return d >= new Date(start.getTime() + dayMs)
  return true
}

// Icono por tipo — nombres del sistema propio (v2/components/Icon.tsx), nunca
// emojis (rediseño 5 ago 2026).
const KIND_ICON: Record<ElemKind, IconName> = {
  text: 'document', canvas: 'canvas', task: 'task', link: 'link',
  pdf: 'pdf', image: 'image',
  highlight: 'highlight', agent: 'agent', conversation: 'conversation',
  prompt: 'prompt', cita: 'quote', group: 'folder',
}
const ROW_H = 46
// Fila de TAREA (TaskRow) es más alta desde que pasó a dos líneas (Alberto, 4 ago
// 2026: "las tareas de la tab agenda se deben leer completas") — el resto de tipos
// (nota, PDF, enlace…) siguen en una línea a ROW_H. Lista virtualizada: hay que
// declarar la altura real por fila o las filas de tarea se solapan/recortan.
const TASK_ROW_H = 58

interface Props {
  /** Filtro inicial (p.ej. al llegar desde «← Agentes»/«← Prompts» en el detalle). */
  initialFilter?: ElemKind | 'all' | 'favorite'
}

export default function ElementsPanel({ initialFilter }: Props = {}) {
  const { t, i18n } = useTranslation()
  const s = useStore()
  // Buscador/filtro/orden viven en un store COMPARTIDO (28 ago 2026): la
  // columna derecha (ElementsFilters) los edita, el centro (aquí) solo los
  // lee y pinta los resultados — mismo mando a distancia.
  const browser = useElementsBrowserStore()
  const { filter, taskSub, sortBy, customTypeId } = browser
  const q = browser.q
  // Si llegamos aquí ya con el panel montado (p.ej. «← Agentes» tras «← Prompts»
  // sin pasar por otro modo), re-aplica el filtro pedido en vez de ignorarlo.
  useEffect(() => {
    // Guard: sin esto, si `initialFilter` llega ya igual al filtro activo,
    // `setFilter` sigue notificando a los suscriptores (28 ago 2026, comportamiento
    // previo) — normalmente inofensivo, pero si el padre (V2App) deriva el prop
    // `elementsFilter` a partir del propio store, notificar sin cambiar nada real
    // puede reentrar en un ciclo de renders. Evitarlo con una comprobación barata.
    if (initialFilter && elementsBrowserStore.filter !== initialFilter) elementsBrowserStore.setFilter(initialFilter)
  }, [initialFilter])
  const scrollRef = useRef<HTMLDivElement>(null)
  // Vista: Tabla por defecto, Lista secundaria (27 ago 2026 — Alberto: "en
  // elementos me gusta la vista de tabla por defecto, y la lista como
  // secundaria"). Kanban/Calendario QUITADAS de aquí (28 ago 2026 — Alberto:
  // "no quedan bien aquí"): agrupar por estado/fecha no encaja con una lista
  // de tipos tan mixta (notas, PDFs, agentes...) — siguen existiendo tal
  // cual en WFHomeView, que sí es solo texto/tareas.
  // Vista y modo-selección viven ahora en el store compartido (28 ago 2026):
  // el toggle y el selector Tabla/Lista se pintan en la columna derecha
  // (ElementsFilters), este componente solo lee `view` y publica su estado
  // de selección para que el botón de allí sepa qué mostrar.
  const view = browser.view
  const changeView = (v: FilterView) => elementsBrowserStore.setView(v)
  // Si quedó una vista kanban/calendario guardada de antes de quitarlas, cae a Tabla.
  useEffect(() => { if (view === 'kanban' || view === 'calendario') changeView('tabla') }, [view]) // eslint-disable-line react-hooks/exhaustive-deps
  const changeSort = (v: SortBy) => elementsBrowserStore.setSortBy(v)

  // TODOS los elementos del lienzo (globalmente) — el orden final lo decide `sortBy`.
  const rows = useMemo(() => {
    void s.nodesVersion
    const out: ElemRow[] = []
    for (const n of store.allActive()) {
      const kind = classify(n); if (!kind) continue
      if (isInPapelera(n.id)) continue   // en Papelera (borrado) → no es un elemento vivo
      const snippet = (n.body || '').trimStart().startsWith('```from-pizarra') ? '' : stripHtml(n.body)
      // Quita el prefijo decorativo (✦ sesión / 💬 transcripción) para no duplicar
      // icono: la fila ya muestra el icono de tipo (KIND_ICON) a la izquierda.
      // `displayTitle` quita cualquier emoji decorativo que el nodo lleve escrito
      // como prefijo EN EL DATO (sesiones «✦ …», agentes «📈 …», raíces del sistema).
      const title = displayTitle(elementDisplayTitle(n) || snippet.slice(0, 60), t('common.noTitle'))
      out.push({ id: n.id, kind, title, snippet, updatedAt: n.updatedAt || '', createdAt: n.createdAt || '', due: n.due, status: n.status, typeId: elementTypeId(n) })
    }
    return out
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.nodesVersion, t])

  const nq = q.trim().toLowerCase()
  const showTaskSub = filter === 'task' && !customTypeId
  const byTypeAndSearch = useMemo(() => rows.filter(r => {
    // Filtro por TIPO CUSTOM (creado por el usuario, ver typeDefsHelper.ts):
    // exclusivo con el filtro por ElemKind — un tipo custom no es un `kind` fijo,
    // es una etiqueta adicional (`_typeId`) sobre elementos que ya son 'text'.
    if (customTypeId) { if (r.typeId !== customTypeId) return false }
    else if (filter === 'favorite') { if (!store.getNode(r.id)?.isFavorite) return false }
    else if (filter !== 'all' && r.kind !== filter) return false
    if (showTaskSub && !matchesTaskSub(r, taskSub)) return false
    if (!nq) return true
    return r.title.toLowerCase().includes(nq) || r.snippet.toLowerCase().includes(nq)
  }), [rows, filter, customTypeId, taskSub, showTaskSub, nq])

  // ⚠️ RETIRADO el sub-filtro por CONTEXTO (fila de chips jerárquica con drill-down),
  // 5 ago 2026: era un SEGUNDO camino a lo que ya hace la sidebar → ficha del contexto
  // (Alberto: "para buscar los elementos de un contexto vamos al contexto directamente,
  // lo cual ya está implementado; este sería un segundo camino innecesario"). Con él se
  // van `contextTree`/`ctxFilter`/`ctxStack` y ~60 líneas de drill-down. Si algún día
  // hace falta "los PDF DE La Isla", el sitio correcto es un filtro por tipo DENTRO de
  // la ficha del contexto, no devolver la fila aquí.
  const filtered = useMemo(() => {
    const sorted = [...byTypeAndSearch]
    // Sin fecha (createdAt/updatedAt vacío) SIEMPRE al final, sea cual sea la
    // dirección — antes un '' se colaba como "más reciente" en algunos casos
    // (Alberto, 15 jul: "Locución CREO Laura Martínez..." salía primero sin ser
    // ni de lejos lo más nuevo).
    if (sortBy === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title))
    else if (sortBy === 'kind') sorted.sort((a, b) => a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title))
    else if (sortBy === 'created') sorted.sort((a, b) => {
      if (!a.createdAt && !b.createdAt) return 0
      if (!a.createdAt) return 1
      if (!b.createdAt) return -1
      return b.createdAt.localeCompare(a.createdAt)
    })
    else sorted.sort((a, b) => {
      if (!a.updatedAt && !b.updatedAt) return 0
      if (!a.updatedAt) return 1
      if (!b.updatedAt) return -1
      return b.updatedAt.localeCompare(a.updatedAt)
    })
    return sorted
  }, [byTypeAndSearch, sortBy])

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: i => (filtered[i]?.kind === 'task' ? TASK_ROW_H : ROW_H),
    overscan: 12,
  })
  // Remedido forzado tras el primer pintado: con altura dinámica (medida por fila,
  // ver measureElement más abajo) la primera fila visible a veces se queda con el
  // tamaño ESTIMADO en vez del medido — la siguiente fila arrancaba unos px antes
  // de que la anterior terminase (solapamiento visto en vivo en Elementos, Alberto,
  // 4 ago 2026). `measure()` limpia la caché de tamaños y fuerza recalcular todas
  // las filas ya montadas contra su altura real.
  useEffect(() => {
    const id = requestAnimationFrame(() => virtualizer.measure())
    return () => cancelAnimationFrame(id)
  }, [filtered.length]) // eslint-disable-line react-hooks/exhaustive-deps

  function open(id: string) {
    openNodeDetail(id)
    window.dispatchEvent(new CustomEvent('from:pizarra-flyto', { detail: { nodeId: id } }))
  }

  // `window.prompt()` (diálogo nativo) sustituido por un modal propio — no se
  // puede probar/interactuar con él por script, y desentona con el resto de la
  // app (Alberto, 23 jul: "detecta fallos de usabilidad, luego repáralos").
  const [newNamedModal, setNewNamedModal] = useState<'agent' | 'prompt' | null>(null)
  function createNewAgent(name: string) {
    const created = createAgentUnder({ parentId: null, label: name, icon: '🤖' })
    open(created.id)
  }
  function createNewPrompt(name: string) {
    const created = createPromptUnder({ parentId: null, label: name, icon: '⚡' })
    open(created.id)
  }

  // ── Acciones de organización por fila (clic-derecho + botón ···) ──────────────
  const [menu, setMenu] = useState<{ id: string; x: number; y: number; ctx: boolean } | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [propsNodeId, setPropsNodeId] = useState<string | null>(null)
  const renameRef = useRef<HTMLInputElement>(null)

  function openMenu(id: string, x: number, y: number) {
    // Encima abajo si no cabe; el menú mide ~aprox, lo clampeamos.
    setMenu({ id, x: Math.min(x, window.innerWidth - 230), y: Math.min(y, window.innerHeight - 320), ctx: false })
  }
  function startRename(id: string) {
    const n = store.getNode(id); setRenaming(id); setRenameVal(n?.text || ''); setMenu(null)
    setTimeout(() => { renameRef.current?.focus(); renameRef.current?.select() }, 20)
  }
  function commitRename() {
    if (renaming && renameVal.trim()) store.updateNode(renaming, { text: renameVal.trim() })
    setRenaming(null); setRenameVal('')
  }
  function toggleFav(id: string) { const n = store.getNode(id); if (n) store.updateNode(id, { isFavorite: !n.isFavorite }); setMenu(null) }
  function del(id: string) {
    const deletedIds = store.deleteNode(id)
    setMenu(null)
    if (deletedIds.length === 0) return
    window.dispatchEvent(new CustomEvent('from:toast', {
      detail: {
        message: t('context.toastMovedToTrash', 'Movido a la papelera'),
        type: 'success',
        action: { label: t('tip.undo', 'Deshacer'), onClick: () => store.restoreDeleted(deletedIds) },
      },
    }))
  }

  // ── Selección múltiple — limpiar en bloque (Alberto, 14 jul: "tuve que borrar
  // huérfanos uno a uno vía base de datos porque no hay forma nativa"). Un overlay
  // transparente por fila intercepta el clic (checkbox) sin tocar TaskRow ni el resto
  // de tipos de fila — funciona igual para tareas, eventos y filas genéricas.
  // Selección + «Crear grupo» — hook COMPARTIDO con la lista de Elementos dentro de
  // un contexto (V2ContextView.tsx), ver hooks/useGroupSelection.ts.
  const { selectMode, selected, toggleSelect, toggleSelectMode, exitSelectMode, selectAll, createGroupFromSelection } =
    useGroupSelection(created => open(created.id))
  // Publica el estado real hacia el store compartido, para que el botón
  // "Seleccionar varios" pintado en la columna derecha (ElementsFilters) sepa
  // si está activo y pueda alternarlo sin duplicar useGroupSelection allí.
  useEffect(() => { elementsBrowserStore.setSelectModeState(selectMode, selected.size) }, [selectMode, selected.size])
  // BUG REAL (27 ago 2026, encontrado mientras se implementaban los tipos custom,
  // sin relación con esa función): `toggleSelectMode` es una función NUEVA en cada
  // render (useGroupSelection no la memoiza) — con ella en las deps, este efecto se
  // disparaba en CADA render y `registerToggleSelectMode` hace `notify()`, que
  // fuerza el re-render de todo suscriptor de `elementsBrowserStore` — incluido este
  // mismo componente (`useElementsBrowserStore()` más abajo) → nuevo render → nueva
  // función → el efecto vuelve a dispararse → bucle infinito ("Maximum update depth
  // exceeded" en consola, `landing/web` — reproducible con CUALQUIER elemento
  // abierto, no solo los de tipo custom). Fix: registrar una función ESTABLE (nunca
  // cambia de referencia) que siempre llama a la versión más reciente de
  // `toggleSelectMode` a través de un ref — el efecto pasa a depender de `[]`, se
  // registra una sola vez por montaje/desmontaje, sin volver a notificar al store.
  const toggleSelectModeRef = useRef(toggleSelectMode)
  toggleSelectModeRef.current = toggleSelectMode
  useEffect(() => {
    const stableToggle = () => toggleSelectModeRef.current()
    elementsBrowserStore.registerToggleSelectMode(stableToggle)
    return () => elementsBrowserStore.registerToggleSelectMode(null)
  }, [])
  function bulkDelete() {
    const ids = [...selected]
    if (ids.length === 0) return
    const allDeleted: string[] = []
    for (const id of ids) allDeleted.push(...store.deleteNode(id))
    exitSelectMode()
    if (allDeleted.length === 0) return
    window.dispatchEvent(new CustomEvent('from:toast', {
      detail: {
        message: t('elements.bulkDeletedToast', '{{count}} elemento(s) movidos a la papelera', { count: ids.length }),
        type: 'success',
        action: { label: t('tip.undo', 'Deshacer'), onClick: () => store.restoreDeleted(allDeleted) },
      },
    }))
  }
  // Salir de selección si cambia el filtro/búsqueda — evita seleccionar a ciegas
  // sobre filas que ya no se ven.
  useEffect(() => { if (selectMode) exitSelectMode() }, [filter, taskSub, nq]) // eslint-disable-line react-hooks/exhaustive-deps

  function moveToContext(id: string, ctxId: string) {
    // Mover a otro contexto: asignación lógica (_ctxRefs) + si NO está fijado con pin, lo
    // reparentamos para que fluya dentro de la caja del contexto en el lienzo.
    assignContext(id, ctxId)
    const n = store.getNode(id)
    let pinned = false; try { const e = JSON.parse(n?.extraData || '{}'); pinned = e._pinX != null || e._gx != null } catch { /* ignore */ }
    if (n && !pinned && !isMarkedContext(n)) store.updateNode(id, { parentId: ctxId })
    setMenu(null)
  }
  const contexts = useMemo(() => { void s.nodesVersion; return listMarkedContexts().filter(c => (c.text || '').trim()) }, [s.nodesVersion])

  // IDs filtrados (búsqueda + tipo + sub-filtro) para las vistas tabla/kanban/calendario —
  // reutilizan TableView/KanbanView/CalendarView de la v1 tal cual (mismo Set<string>).
  const filteredIds = useMemo(() => new Set(filtered.map(r => r.id)), [filtered])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '14px 14px 6px', flexShrink: 0 }}>
        {/* Buscador/filtro/orden, seleccionar-varios y el selector de vista
            viven ahora en la columna derecha (ElementsFilters, 28 ago 2026:
            "el boton de seleccionar y la vista tabla o lista podrian estar
            en la columna derecha tambien, hay espacio") — aquí solo queda el
            atajo de crear agente/prompt (necesita `open()`, de aquí) y la
            barra de acciones en bloque cuando hay selección activa. */}
        {(filter === 'agent' || filter === 'prompt') && (
          <div style={{ marginBottom: 6 }}>
            <button
              onClick={() => setNewNamedModal(filter === 'agent' ? 'agent' : 'prompt')}
              style={{ display: 'flex', alignItems: 'center', gap: 5, border: '1px dashed var(--border,#e2e2e2)', background: 'transparent', borderRadius: 7, padding: '5px 10px', fontSize: 12.5, fontWeight: 500, color: 'var(--accent,#6c5ce7)', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              + {filter === 'agent' ? t('elements.newAgent', 'Nuevo agente') : t('elements.newPrompt', 'Nuevo prompt')}
            </button>
          </div>
        )}
        {/* Filtrado por un TIPO CUSTOM del usuario (Libro, Persona…) → atajo de
            crear un elemento nuevo de ese tipo, mismo patrón que agente/prompt. */}
        {customTypeId && (() => {
          const td = getTypeDef(customTypeId)
          if (!td) return null
          return (
            <div style={{ marginBottom: 6 }}>
              <button
                onClick={() => { const created = createElementOfType(customTypeId, t('elements.newTypeDefault', 'Sin título')); open(created.id) }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, border: '1px dashed var(--border,#e2e2e2)', background: 'transparent', borderRadius: 7, padding: '5px 10px', fontSize: 12.5, fontWeight: 500, color: 'var(--accent,#6c5ce7)', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                + {t('elements.newOfType', 'Nuevo {{type}}', { type: td.name })}
              </button>
            </div>
          )
        })()}
        {filter === 'agent' && (
          <div style={{ marginBottom: 6, fontSize: 12, lineHeight: 1.4, color: 'var(--text-tertiary,#999)' }}>
            {t('elements.agentsDisabledHint', 'Los agentes predefinidos vienen desactivados. Ábrelos y activa el interruptor de Estado, o pulsa ▶ Ejecutar para probarlos primero.')}
          </div>
        )}
        {/* Barra de acciones en bloque — visible solo en modo selección. */}
        {selectMode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, padding: '6px 2px' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary,#666)' }}>
              {t('elements.selectedCount', '{{count}} seleccionados', { count: selected.size })}
            </span>
            <button
              onClick={() => selectAll(filtered.map(r => r.id))}
              style={{ fontSize: 12, fontWeight: 500, color: 'var(--accent,#6c5ce7)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
            >
              {t('elements.selectAllVisible', 'Seleccionar los {{count}} visibles', { count: filtered.length })}
            </button>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button onClick={exitSelectMode} style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-tertiary,#999)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', fontFamily: 'inherit' }}>
                {t('common.cancel', 'Cancelar')}
              </button>
              <button
                title={selected.size < 2 ? t('group.needTwo', 'Selecciona al menos 2 elementos') : undefined}
                onClick={createGroupFromSelection}
                disabled={selected.size < 2}
                style={{ fontSize: 12.5, fontWeight: 600, color: selected.size < 2 ? 'var(--text-tertiary,#bbb)' : '#fff', background: selected.size < 2 ? 'var(--bg,#fff)' : 'var(--accent,#6c5ce7)', border: '1px solid var(--border,#e2e2e2)', borderRadius: 6, cursor: selected.size < 2 ? 'default' : 'pointer', padding: '5px 12px', fontFamily: 'inherit' }}
              >
                {t('group.createGroup', 'Crear grupo')} {selected.size >= 2 ? `(${selected.size})` : ''}
              </button>
              <button
                onClick={bulkDelete}
                disabled={selected.size === 0}
                style={{ fontSize: 12.5, fontWeight: 600, color: '#fff', background: selected.size === 0 ? 'var(--text-tertiary,#bbb)' : '#dc2626', border: 'none', borderRadius: 6, cursor: selected.size === 0 ? 'default' : 'pointer', padding: '5px 12px', fontFamily: 'inherit' }}
              >
                {t('tip.delete', 'Eliminar')} {selected.size > 0 ? `(${selected.size})` : ''}
              </button>
            </div>
          </div>
        )}
      </div>

      {view !== 'lista' ? (
        filtered.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-tertiary,#999)', padding: '20px' }}>{t('elements.empty')}</div>
        ) : view === 'tabla' ? (
          <TableView matchIds={filteredIds} sortBy={sortBy as TableSortBy} onSortChange={changeSort} onOpen={open} selectMode={selectMode} selected={selected} onToggleSelect={toggleSelect} />
        ) : view === 'kanban' ? (
          <KanbanView matchIds={filteredIds} />
        ) : (
          <CalendarView matchIds={filteredIds} />
        )
      ) : filtered.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-tertiary,#999)', padding: '20px' }}>{t('elements.empty')}</div>
      ) : filter === 'canvas' ? (
        // Lienzos: NO tiene sentido listarlos como filas de texto — se ven como
        // miniaturas visuales de su contenido (trazos/dibujos), en rejilla.
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            {filtered.map(r => (
              <div
                key={r.id}
                onClick={() => open(r.id)}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); openMenu(r.id, e.clientX, e.clientY) }}
                style={{ cursor: 'pointer' }}
              >
                <PizarraThumbnail body={store.getNode(r.id)?.body} />
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text,#222)', marginTop: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.title}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 12px 80px' }}>
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map(vi => {
              const r = filtered[vi.index]
              const isRenaming = renaming === r.id
              const isSelected = selected.has(r.id)
              // Sin altura fija: react-virtual mide la altura REAL de cada fila vía
              // `measureElement` (ver más abajo) y reposiciona las siguientes en
              // consecuencia. Necesario desde que el título dejó de truncarse — antes
              // una altura fija por tipo (ROW_H/TASK_ROW_H) bastaba, pero un título largo
              // + chip de contexto puede envolver a más líneas de las previstas y las
              // filas se solapaban (Alberto, 4 ago 2026, visto en vivo en Elementos).
              const wrapStyle: React.CSSProperties = { position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vi.start}px)`, boxSizing: 'border-box' }

              let inner: React.ReactNode = null
              // Tarea → TaskRow ÚNICO compartido con toda la app (Hoy, Contexto, otros
              // días): mismo checkbox, texto, chips de hora/día/repetición, contexto y
              // acciones de hover en TODAS partes, no una copia distinta por pestaña.
              // Los EVENTOS entran por aquí desde el 5 ago 2026 (son tareas con día y
              // hora): tenían una copia propia de la fila justo debajo, que ya solo se
              // diferenciaba en no pintar el chip de repetición. TaskRow lo cubre —
              // el chip de hora sale solo cuando el `due` lleva hora (timeLabel).
              if (r.kind === 'task' && !isRenaming) {
                const n = store.getNode(r.id)
                if (n) inner = (
                  <TaskRow
                    node={n}
                    onOpenDate={(nn) => setPropsNodeId(id => id === nn.id ? null : nn.id)}
                    style={{ position: 'static', width: '100%', boxSizing: 'border-box' }}
                  />
                )
              } else {
                // Resto de tipos (nota, PDF, enlace, conversación…): título en una línea con
                // truncado — fecha + acciones abajo. Se probó dejar el título sin truncar
                // (envolviendo a 2 líneas), pero un título de 2 líneas dejaba la fecha de la l2
                // pegada al icono de la fila siguiente, sin aire entre filas (Alberto, 4 ago
                // 2026, visto en vivo: "la fecha de bajo se pega con el elemento siguiente...
                // en este caso sí que el título se debería truncar"). A diferencia de TaskRow
                // (que si necesita dos líneas completas por ser el foco de la fila), aquí el
                // título es solo el encabezado de una fila más densa — truncar es el patrón
                // correcto.
                inner = (
                  <div
                    className="dc-row el-row"
                    onClick={() => { if (!isRenaming) open(r.id) }}
                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); openMenu(r.id, e.clientX, e.clientY) }}
                    style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 4px 4px 6px', cursor: 'pointer', boxSizing: 'border-box' }}
                  >
                    <span style={{ flexShrink: 0, lineHeight: '20px', display: 'flex', alignItems: 'center', color: 'var(--text-tertiary)' }}><Icon name={KIND_ICON[r.kind]} size={15} /></span>
                    <div style={{ minWidth: 0, flex: 1 }} title={`${t('v2.rightColumn.created', 'Creado')}: ${fmtDateFull(r.createdAt, i18n.language)}\n${t('v2.rightColumn.updated', 'Modificado')}: ${fmtDateFull(r.updatedAt, i18n.language)}`}>
                      {isRenaming ? (
                        <input
                          ref={renameRef}
                          value={renameVal}
                          onClick={e => e.stopPropagation()}
                          onChange={e => setRenameVal(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitRename() } if (e.key === 'Escape') { setRenaming(null) } }}
                          onBlur={commitRename}
                          style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--accent,#6c5ce7)', borderRadius: 5, padding: '2px 6px', fontSize: 13, background: 'var(--bg,#fff)', color: 'var(--text,#222)', fontFamily: 'inherit' }}
                        />
                      ) : (
                        <div className="dc-row-l1">
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text,#222)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                        </div>
                      )}
                      {!isRenaming && (
                        <div className="dc-row-l2" style={{ marginTop: 2 }}>
                          {r.snippet && r.snippet !== r.title && (
                            <span style={{ fontSize: 11.5, color: 'var(--text-tertiary,#999)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>{r.snippet}</span>
                          )}
                          <span style={{ flexShrink: 0, fontSize: 11, color: 'var(--text-tertiary,#999)', whiteSpace: 'nowrap' }}>
                            {fmtDate(sortBy === 'created' ? r.createdAt : r.updatedAt, i18n.language)}
                          </span>
                          <span style={{ flex: 1 }} />
                          {/* Añadir a grupo — al hover, mismo patrón que Eliminar (27 ago 2026).
                              Un grupo no se añade a sí mismo. */}
                          {r.kind !== 'group' && (
                            <GroupAddButton
                              nodeId={r.id}
                              className="el-row-del"
                              size={13}
                              stopPropagation
                              popoverAlign="right"
                              style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary,#999)', padding: '4px 5px', borderRadius: 4, display: 'flex', alignItems: 'center' }}
                            />
                          )}
                          {/* Eliminar directo al hover — mismo patrón que el resto de listas de la app. */}
                          <button
                            className="el-row-del"
                            title={t('tip.delete', 'Eliminar')}
                            onClick={(e) => { e.stopPropagation(); del(r.id) }}
                            style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary,#999)', padding: '4px 5px', borderRadius: 4, display: 'flex', alignItems: 'center' }}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                          </button>
                          <button
                            className="el-more"
                            title={t('elements.actions', 'Acciones')}
                            onClick={(e) => { e.stopPropagation(); const rc = (e.currentTarget as HTMLElement).getBoundingClientRect(); openMenu(r.id, rc.right - 200, rc.bottom + 2) }}
                            style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary,#999)', fontSize: 16, lineHeight: 1, padding: '2px 6px', borderRadius: 4 }}
                          >⋯</button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              }

              if (!inner) return null
              return (
                <div key={r.id} data-index={vi.index} ref={virtualizer.measureElement} style={wrapStyle}>
                  {inner}
                  {/* Overlay de selección — intercepta el clic sin tocar TaskRow ni el resto
                      de filas; el contenido de debajo sigue visible (fondo transparente). */}
                  {selectMode && (
                    <div
                      onClick={() => toggleSelect(r.id)}
                      style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', alignItems: 'center', paddingLeft: 6, cursor: 'pointer', background: isSelected ? 'rgba(108,92,231,0.10)' : 'transparent' }}
                    >
                      <input type="checkbox" checked={isSelected} readOnly style={{ pointerEvents: 'none', width: 15, height: 15 }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Menú de acciones (clic-derecho / ···) — organizar cualquier elemento */}
      {menu && (() => {
        const n = store.getNode(menu.id)
        return (
          <>
            <div onClick={() => setMenu(null)} onContextMenu={e => { e.preventDefault(); setMenu(null) }} style={{ position: 'fixed', inset: 0, zIndex: 1000 }} />
            <div style={{ position: 'fixed', left: menu.x, top: menu.y, zIndex: 1001, minWidth: 200, maxHeight: 300, overflowY: 'auto', background: 'var(--bg-elevated,#fff)', border: '1px solid var(--border,#e2e2e2)', borderRadius: 8, boxShadow: '0 6px 24px rgba(0,0,0,0.14)', padding: 4, fontSize: 13 }}>
              {!menu.ctx ? (
                <>
                  <ElMenuItem label={t('elements.open', 'Abrir')} onClick={() => { open(menu.id); setMenu(null) }} />
                  <ElMenuItem label={t('common.rename', 'Renombrar')} onClick={() => startRename(menu.id)} />
                  <ElMenuItem label={n?.isFavorite ? t('tip.removeFavorite', 'Quitar favorito') : t('tip.addFavorite', 'Favorito')} onClick={() => toggleFav(menu.id)} />
                  <ElMenuItem label={t('elements.moveToContext', 'Mover a contexto') + ' ▸'} onClick={() => setMenu(m => m && { ...m, ctx: true })} />
                  <div style={{ height: 1, background: 'var(--border-subtle,#eee)', margin: '4px 0' }} />
                  <ElMenuItem label={t('tip.delete', 'Eliminar')} danger onClick={() => del(menu.id)} />
                </>
              ) : (
                <>
                  <ElMenuItem label={'‹ ' + t('common.back', 'Atrás')} onClick={() => setMenu(m => m && { ...m, ctx: false })} />
                  {contexts.length === 0 && <div style={{ padding: '6px 10px', color: 'var(--text-tertiary,#999)' }}>{t('elements.noContexts', 'Sin contextos')}</div>}
                  {contexts.map(c => (
                    <ElMenuItem key={c.id} label={c.text} dot={contextColor(c.id)} onClick={() => moveToContext(menu.id, c.id)} />
                  ))}
                </>
              )}
            </div>
          </>
        )
      })()}

      {/* Popover de propiedades de tarea (fecha/hora) — al hover en una tarea/evento */}
      {propsNodeId && (() => {
        const pn = store.getNode(propsNodeId)
        return pn ? <TaskPropsPopover node={pn} allowRename allowDelete onClose={() => setPropsNodeId(null)} /> : null
      })()}

      {newNamedModal && (
        <NewNamedItemModal
          onClose={() => setNewNamedModal(null)}
          onSubmit={name => (newNamedModal === 'agent' ? createNewAgent(name) : createNewPrompt(name))}
          icon={newNamedModal === 'agent' ? 'agent' : 'prompt'}
          title={newNamedModal === 'agent' ? t('elements.newAgent', 'Nuevo agente') : t('elements.newPrompt', 'Nuevo prompt')}
          placeholder={newNamedModal === 'agent' ? t('elements.newAgentPrompt', 'Nombre del agente:') : t('elements.newPromptPrompt', 'Nombre del prompt:')}
        />
      )}
    </div>
  )
}

function ElMenuItem({ label, onClick, danger, dot }: { label: string; onClick: () => void; danger?: boolean; dot?: string }) {
  return (
    <button
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 5, fontSize: 13, color: danger ? 'var(--color-error,#e53e3e)' : 'var(--text,#222)', fontFamily: 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover,#f4f4f5)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
    >
      {dot && <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0 }} />}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
    </button>
  )
}
