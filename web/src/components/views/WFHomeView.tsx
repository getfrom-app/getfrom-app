/**
 * WFHomeView — Vista raíz estilo Workflowy
 * Sin filtro: árbol normal. Con filtro activo: raíces flotantes con breadcrumb (FilteredList).
 *
 * Comportamiento universal de filtro (Workflowy-style):
 *   Cualquier filtro activo (contexto, tipo, texto, Sin clasificar) muestra los nodos resultado
 *   como raíces flotantes independientes con breadcrumb de texto plano indicando su posición
 *   real en el árbol. Nunca se expande el árbol real con ancestorIds.
 */
import { useMemo, useEffect, useState, useCallback } from 'react'
import Outliner from '../outliner/Outliner'
import { useStore, store } from '../../store/nodeStore'
import { applyWFFilter } from '../../utils/wfFilter'
import { normalizeSynonyms } from '../../utils/filterInterpreter'
import { FilterViewSwitcher, TableView, KanbanView, CalendarView } from './FilterResultsView'
import type { FilterView } from './FilterResultsView'
import { uploadFile } from '../../api/client'
import { findAgendaRoot } from '../../utils/agendaHelper'
import { findHomeRoot } from '../../utils/homeHelper'
import { UNCLASSIFIED_FILTER_ID } from '../panels/ContextListPanel'
import UnclassifiedList from './UnclassifiedList'
import FilteredList from './FilteredList'
const FILTER_VIEW_KEY = 'from_wf_filter_view'

interface Props {
  filterText?: string
  contextFilterId?: string | null
}

// Convierte el texto de un nodo contexto al slug usado en node.types
function ctxTextToSlug(text: string) {
  return text.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-\/]/g, '')
}

// Textos de raíces NO-Agenda que deben excluirse del filtro de contexto
const NON_AGENDA_SYSTEM_TEXTS = new Set([
  '🧠 Contexto',
  '📋 Plantillas',
  '🗑 Papelera',
  '🤖 Agentes',
  '🔍 Filtros',   // contenedor de filtros guardados (antes "📊 Paneles")
  '📊 Paneles',   // back-compat hasta migrar el nombre
  '📁 Paneles',
  '📁 Atajos',
])

// Construye filterMatchIds + ancestorIds para filtrar por contexto.
// Busca SOLO dentro del árbol de Agenda — excluye 🧠 Contexto y demás ramas del sistema.
// Matching por:
//   1. node.types incluye el ID del nodo contexto (via @ picker)
//   2. node.types incluye el slug o texto del contexto (via auto-sync de @mention)
//   3. El texto del nodo contiene @NombreContexto (case-insensitive)
function buildContextFilter(contextNodeId: string): {
  matchIds: Set<string>
  ancestorIds: Set<string>
} | null {
  const ctxNode = store.getNode(contextNodeId)
  if (!ctxNode) return null

  // ── Jerarquía: recoger el contexto + todos sus subcontextos descendientes ──
  // Un nodo asignado a un subcontexto hereda el contexto padre: filtrar por el
  // padre incluye los nodos de todos sus hijos. Excluir nodos de conocimiento (🧠).
  const ctxIds = new Set<string>()
  const ctxSlugs = new Set<string>()
  const ctxTexts = new Set<string>()
  const ctxNames: string[] = []
  const ctxQueue: string[] = [contextNodeId]
  while (ctxQueue.length > 0) {
    const curId = ctxQueue.pop()!
    const cur = store.getNode(curId)
    if (!cur || cur.deletedAt) continue
    ctxIds.add(cur.id)
    ctxSlugs.add(ctxTextToSlug(cur.text).toLowerCase())
    ctxTexts.add(cur.text.toLowerCase())
    ctxNames.push(cur.text.trim())
    store.children(cur.id).forEach(child => {
      if (!child.deletedAt && !(child.text || '').startsWith('🧠')) ctxQueue.push(child.id)
    })
  }

  // ── Pre-computar IDs de todos los descendientes de raíces NO-Agenda ────────
  // Traversal de arriba hacia abajo: O(n) total, no O(n×depth)
  const excludedIds = new Set<string>()
  const queue: string[] = []
  // Raíces de sistema NO-Agenda, buscadas por texto en TODO el árbol (no solo en
  // children(null)): tras introducir 🏠 From cuelgan de la raíz home, no de null.
  store.allActive().forEach(root => {
    if (NON_AGENDA_SYSTEM_TEXTS.has(root.text)) {
      excludedIds.add(root.id)
      queue.push(root.id)
    }
  })
  while (queue.length > 0) {
    const parentId = queue.pop()!
    store.children(parentId).forEach(child => {
      if (!child.deletedAt && !excludedIds.has(child.id)) {
        excludedIds.add(child.id)
        queue.push(child.id)
      }
    })
  }

  // Regex para @mention en texto: @From, @Café\ Olé, etc. — cualquier contexto de la jerarquía
  const escapedNames = ctxNames
    .filter(Boolean)
    .map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const atMentionPattern = escapedNames.length > 0
    ? new RegExp(`@(${escapedNames.join('|')})`, 'i')
    : null

  const matchIds = new Set<string>()
  const ancestorIds = new Set<string>()

  store.allActive().forEach(n => {
    if (n.deletedAt) return
    if (excludedIds.has(n.id)) return  // excluir ramas del sistema (O(1))

    const types = n.types || []
    const matchByTypes = types.some(t =>
      ctxIds.has(t) || ctxSlugs.has(t.toLowerCase()) || ctxTexts.has(t.toLowerCase())
    )
    const matchByAtMention = !!atMentionPattern && atMentionPattern.test(n.text || '')

    if (matchByTypes || matchByAtMention) {
      matchIds.add(n.id)
    }
  })

  // Recoger todos los ancestros para traversar el árbol correctamente
  matchIds.forEach(id => {
    let cur = store.getNode(id)
    while (cur?.parentId) {
      ancestorIds.add(cur.parentId)
      cur = store.getNode(cur.parentId)
    }
  })

  return { matchIds, ancestorIds }
}

export default function WFHomeView({ filterText, contextFilterId }: Props) {
  const s = useStore()

  // ── Loading gate ──────────────────────────────────────────────────────────
  const [storeReady, setStoreReady] = useState(() => store.isLoaded)
  useEffect(() => {
    if (storeReady) return
    const unsub = store.subscribe(() => { if (store.isLoaded) setStoreReady(true) })
    return () => unsub()
  }, [storeReady])

  // ── Vista activa del filtro ───────────────────────────────────────────────
  const [filterView, setFilterView] = useState<FilterView>(
    () => (localStorage.getItem(FILTER_VIEW_KEY) as FilterView) || 'lista'
  )
  function changeFilterView(v: FilterView) {
    setFilterView(v)
    localStorage.setItem(FILTER_VIEW_KEY, v)
  }

  // ── Raíz 🏠 From — la vista raíz muestra sus hijos (Agenda + Contexto + …) ───
  const homeRoot = useMemo(() => {
    if (!storeReady) return null
    // Fallback a Agenda por si el reparent aún no creó la raíz home (no debería).
    return findHomeRoot() ?? findAgendaRoot() ?? null
  }, [storeReady, s.nodes.size]) // eslint-disable-line react-hooks/exhaustive-deps

  const homeRootId = homeRoot?.id ?? null

  // Agenda — para el drop de archivos y el hint "Espacio" (su contenido es el diario).
  const agendaId = useMemo(() => {
    if (!storeReady) return null
    return findAgendaRoot()?.id ?? null
  }, [storeReady, s.nodes.size]) // eslint-disable-line react-hooks/exhaustive-deps

  // El colapsado por defecto lo gestiona store.collapseAllLocal() en el arranque
  // (MainLayout): el árbol abre colapsado y la expansión es efímera por sesión.

  // ── Filtro por contexto (sidebar) ─────────────────────────────────────────
  // UNCLASSIFIED_FILTER_ID se maneja con UnclassifiedList — no necesita buildContextFilter.
  // El resto de filtros de contexto calculan matchIds, que se pasan a FilteredList.

  const contextFilter = useMemo(() => {
    if (!contextFilterId) return null
    if (contextFilterId === UNCLASSIFIED_FILTER_ID) return null
    return buildContextFilter(contextFilterId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextFilterId, s.nodesVersion])

  // ── Filtro por texto ───────────────────────────────────────────────────────
  const filterResult = useMemo(() => {
    if (contextFilter) return null // el filtro de contexto tiene prioridad
    if (!filterText?.trim()) return null
    const effective = normalizeSynonyms(filterText) ?? filterText
    return applyWFFilter(s.nodes, effective)
  }, [filterText, contextFilter, s.nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Estado general del filtro ──────────────────────────────────────────────
  const isFiltering = !!filterText?.trim() || !!contextFilter || contextFilterId === UNCLASSIFIED_FILTER_ID

  // matchIds para FilteredList (contexto o texto en modo lista)
  const contextMatchIds = contextFilter?.matchIds ?? null
  const textMatchIds = filterResult?.matchIds ?? null
  const matchCount = contextMatchIds?.size ?? textMatchIds?.size ?? 0

  // Etiqueta para la cabecera de FilteredList cuando hay filtro de contexto activo
  const contextLabel = useMemo(() => {
    if (!contextFilterId || contextFilterId === UNCLASSIFIED_FILTER_ID) return undefined
    const ctxNode = store.getNode(contextFilterId)
    return ctxNode?.text ?? undefined
  }, [contextFilterId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Drag & drop de archivos desde el Finder → crear nodos ─────────────────
  const [isDragOver, setIsDragOver] = useState(false)

  const uploadFileAsNode = useCallback(async (file: File, parentId: string | null = null) => {
    // Crear nodo con el nombre del archivo
    const siblings = store.children(parentId)
    const maxOrder = siblings.length > 0 ? Math.max(...siblings.map(s => s.siblingOrder)) : 0
    const newNode = store.createNode({
      text: file.name.replace(/\.[^.]+$/, ''), // nombre sin extensión
      parentId,
      siblingOrder: maxOrder + 1,
    })
    try {
      const { key, publicUrl } = await uploadFile(file)
      const resourceType = file.type.startsWith('image/') ? 'image'
        : file.type === 'application/pdf' ? 'pdf' : 'file'
      store.updateNode(newNode.id, {
        isResource: true,
        extraData: JSON.stringify({ _resourceUrl: publicUrl, _resourceKey: key, _resourceType: resourceType }),
      })
    } catch (e) {
      console.error('Upload failed', e)
      store.deleteNode(newNode.id) // limpiar nodo vacío si el upload falla
    }
  }, [])

  function handleDragOver(e: React.DragEvent) {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      setIsDragOver(true)
    }
  }
  function handleDragLeave() { setIsDragOver(false) }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    if (!store.isLoaded) return
    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return
    files.forEach(file => uploadFileAsNode(file, agendaId))
  }

  if (!storeReady) return <div className="wf-home-view" />

  return (
    <div
      className={`wf-home-view${isDragOver ? ' wf-home-view--drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* ── Filtro "Sin clasificar" ── */}
      {contextFilterId === UNCLASSIFIED_FILTER_ID && (
        <UnclassifiedList onNavigate={undefined} />
      )}

      {/* ── Filtro por contexto — raíces flotantes con breadcrumb (Workflowy-style) ── */}
      {contextMatchIds && matchCount === 0 && (
        <div className="wf-filter-empty">Sin nodos con este contexto</div>
      )}
      {contextMatchIds && matchCount > 0 && (
        <FilteredList
          matchIds={contextMatchIds}
          label={contextLabel}
        />
      )}

      {/* ── Filtro por texto ── */}
      {!contextMatchIds && filterResult?.hasFilter && matchCount === 0 && (
        <div className="wf-filter-empty">
          Sin resultados para <strong>"{filterText}"</strong>
        </div>
      )}
      {/* Barra de vista (tabla/kanban/calendario/lista) — solo para filtro de texto */}
      {!contextMatchIds && filterResult?.hasFilter && matchCount > 0 && (
        <FilterViewSwitcher
          view={filterView}
          onChange={changeFilterView}
          count={matchCount}
          onClear={() => window.dispatchEvent(new CustomEvent('wf:clear-filter'))}
        />
      )}

      {/* Vistas alternativas para filtro de texto */}
      {!contextMatchIds && filterResult?.hasFilter && matchCount > 0 && filterView === 'tabla' && (
        <TableView matchIds={filterResult.matchIds} />
      )}
      {!contextMatchIds && filterResult?.hasFilter && matchCount > 0 && filterView === 'kanban' && (
        <KanbanView matchIds={filterResult.matchIds} />
      )}
      {!contextMatchIds && filterResult?.hasFilter && matchCount > 0 && filterView === 'calendario' && (
        <CalendarView matchIds={filterResult.matchIds} />
      )}
      {/* Vista lista para filtro de texto — raíces flotantes con breadcrumb */}
      {!contextMatchIds && filterResult?.hasFilter && matchCount > 0 && filterView === 'lista' && textMatchIds && (
        <FilteredList
          matchIds={textMatchIds}
          filterText={filterText}
        />
      )}

      {/* ── Árbol normal — sin filtro activo ── */}
      {!isFiltering && (
        <Outliner
          parentId={homeRootId}
          autoFocusEmpty={false}
          placeholder="Escribe algo… o pulsa Enter para crear un nodo"
        />
      )}

      {/* Hint — sólo en home sin filtro activo Y sin contenido visible en la agenda.
           storeReady garantiza que el árbol ya se cargó. Si hay años/meses/notas, se oculta. */}
      {!isFiltering && storeReady && agendaId && store.children(agendaId).filter(n => !n.deletedAt).length === 0 && (
        <div className="wf-home-space-hint">
          <span>Espacio</span> · crea o busca cualquier cosa
        </div>
      )}
    </div>
  )
}
