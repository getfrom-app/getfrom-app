// Vista de contexto de Fromly 2.0 (modo «Contexto» de la columna derecha).
// Como en la v1: contenido agrupado por tipo (Tareas / Notas / …), indicador de
// contexto padre, botón ARCHIVAR (mapea al flag _closed de la v1 → sale del árbol
// pero sigue buscable + rastreable por el RAG), y «Lo que Fromly sabe» al final.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import {
  contextColor, contextParent, isContextClosed, setContextClosed,
  getOrCreateContextKnowledgeDoc, nodesInContext,
  reparentContext, clearContextParent,
  firstContextOf,
} from '../../utils/cajones'
import { parseExtraData, isInPapelera } from '../../utils/papeleraHelper'
import { isContextMemoryNode } from '../../utils/knowledgeNodes'
import { isTaskNode } from '../../utils/taskNode'
import { legacyNotesOf, migrateContextNotesToDoc } from '../migrateContextNotes'
import { classifyElement } from '../elementKind'
import ContextPicker from '../../components/panels/ContextPicker'
import V2TaskList from './V2TaskList'
import V2QuickAddTask from './V2QuickAddTask'
import V2ElementRow from './V2ElementRow'
import { isAgentNode, getAgentData } from '../../utils/agentesHelper'
import { isPromptNode } from '../../utils/promptsHelper'
import { fmtDate, fmtRelative } from '../../utils/formatDate'
import Icon, { type IconName } from './Icon'
import { displayTitle } from '../../utils/displayText'
import { useGroupSelection } from '../../hooks/useGroupSelection'
import { allGroups, groupMemberIds, groupMembers, isGroupNode } from '../../utils/groups'
import type { Node } from '../../types'

interface Props {
  ctxId: string | null
  onSelectCtx: (id: string) => void
  onOpenNode: (id: string) => void
}

export default function V2ContextView({ ctxId, onSelectCtx, onOpenNode }: Props) {
  const { t, i18n } = useTranslation()
  useStore()
  // General = sin contexto asignado (ctxId null). No es un nodo real: no tiene
  // padre, no se archiva, no tiene documento de conocimiento propio — pero sí
  // sus propias tareas/elementos (todo lo que no cuelga de ningún contexto),
  // que es lo mínimo que pidió Alberto (17 jul).
  // (Retirado 24 ago 2026: el botón «Seguir»/sección Seguimiento de contextos.)
  const isGeneral = ctxId === null
  const node = isGeneral ? null : store.getNode(ctxId)
  const parent = isGeneral ? null : contextParent(ctxId)
  const closed = node ? isContextClosed(node) : false
  const canArchive = !isGeneral && !!parent // solo subcontextos (las áreas no se archivan)

  // Contexto PADRE — picker inline (mismo patrón que «Cambiar contexto» de nota/tarea).
  const [parentPickerOpen, setParentPickerOpen] = useState(false)
  const parentPickWrap = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!parentPickerOpen) return
    const onDoc = (e: MouseEvent) => { if (parentPickWrap.current && !parentPickWrap.current.contains(e.target as HTMLElement)) setParentPickerOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [parentPickerOpen])
  // Un contexto no puede colgar de sí mismo ni de uno de sus propios descendientes (ciclo).
  const isDescendantOf = (candidateId: string) => {
    let cur: Node | null | undefined = store.getNode(candidateId)
    let guard = 0
    while (cur && guard++ < 60) { if (cur.id === ctxId) return true; cur = cur.parentId ? store.getNode(cur.parentId) : null }
    return false
  }

  // La MEMORIA del contexto se crea/repara al abrir el contexto, pero NO se pinta
  // aquí ni ocupa el centro: es interna (`_ctxMemory`) y se consulta desde el menú
  // ··· de la sidebar (Alberto, 6 ago 2026). Antes esto además FUSIONABA la nota
  // libre del usuario dentro de la memoria y le dejaba la nota vacía — con el centro
  // del contexto siendo ya esa nota libre (V2App.onSelectCtx), esa fusión se llevaría
  // por delante justo lo que el usuario acaba de escribir.
  useEffect(() => {
    if (ctxId === null) return
    getOrCreateContextKnowledgeDoc(ctxId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxId])

  // TAREAS del contexto, estilo Hoy.
  // ⚠️ BUG REAL (Alberto, 5 ago 2026: "hay una tarea que no tenía contexto, le he
  // puesto el contexto y al entrar al contexto no aparece"): esto miraba SOLO
  // `store.children(ctxId)` — los hijos directos en el árbol. Asignar un contexto a
  // una tarea que ya existe NO la mueve de sitio: `assignContext` escribe una
  // REFERENCIA (`extraData._ctxRefs`, ver FROM.md «Contextos y proyectos»), que es
  // justo lo que hace el badge de contexto de la fila. Resultado: la tarea quedaba
  // asignada de verdad pero invisible aquí. Ahora se usa la MISMA fuente que la
  // lista de Elementos de más abajo — `nodesInContext`, que resuelve las 3 vías
  // (referencia por id, slug clásico en `types[]`, y escrita dentro de la nota del
  // contexto) — unida a los hijos directos, deduplicando por id.
  // En General (ctxId null) no hay contexto que consultar: son las tareas activas
  // que no pertenecen a ninguno.
  const tasks = useMemo(() => {
    void store.nodesVersion
    // Los EVENTOS entran aquí desde el 5 ago 2026 (son tareas con día y hora,
    // utils/taskNode.ts) — antes se quedaban fuera de la lista de tareas de su
    // propio contexto. No se duplican con la lista de Elementos de abajo:
    // `classifyElement` devuelve null para cualquier tarea/evento.
    const isTask = (n: Node) => !n.deletedAt && isTaskNode(n)
    // `isInPapelera` también aquí: `allActive()` devuelve los nodos de la PAPELERA
    // (se reparentan, no se marcan `deletedAt`), así que «General» seguía listando
    // tareas ya borradas — la rama con contexto sí lo filtraba, esta se olvidó.
    if (ctxId === null) return store.allActive().filter(n => isTask(n) && !firstContextOf(n) && !isInPapelera(n.id))
    const seen = new Set<string>()
    const out: Node[] = []
    for (const n of [...store.children(ctxId), ...nodesInContext(ctxId)]) {
      if (seen.has(n.id) || !isTask(n) || isInPapelera(n.id)) continue
      seen.add(n.id)
      out.push(n)
    }
    return out
  }, [ctxId, store.nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  // Eventos aparte de las tareas (26 ago 2026, Alberto: "si es evento debe
  // aparecer en un grupo aparte de Eventos") — mismo criterio visual que el
  // planificador (isEvent sin checkbox), separado aquí en su propia sección
  // en vez de mezclado con las tareas de verdad bajo "Tareas".
  const plainTasks = useMemo(() => tasks.filter(n => !n.isEvent), [tasks])
  const events = useMemo(() => tasks.filter(n => n.isEvent), [tasks])

  // ELEMENTOS del contexto: TODO lo que cuelga de él — documentos, PDF, imágenes,
  // enlaces, audios, AGENTES y CONVERSACIONES — en una única lista, cada uno con su
  // icono, ordenada de más reciente a más antigua. Antes iban en bloques separados
  // (Elementos/Agentes/Conversaciones); Alberto pidió fusionarlos: "deberían aparecer
  // junto y organizado de más reciente más antiguo, cada elemento con su icono".
  // Las notas de texto planas se omiten (las gestiona la migración, para no volver a
  // llenar la columna) y las tareas tienen su propia lista arriba (con due/checkbox).
  const elements = useMemo(() => {
    void store.nodesVersion
    const out: { node: Node; icon: IconName; kind: string }[] = []
    const seen = new Set<string>()
    const consider = (n: Node) => {
      if (seen.has(n.id) || n.deletedAt) return
      // "Lo que Fromly sabe" ya tiene su propia sección fija más abajo (knowledgeDoc) —
      // no debe duplicarse como una fila más en Elementos. classifyElement() lo clasifica
      // como 'document' (tiene _doc:'1'), no 'note', así que sin esta exclusión explícita
      // se colaba en la lista (Alberto, 14 jul).
      if (isContextMemoryNode(n)) return
      // Defensa extra: un nodo movido a la papelera por una vía que no reparenta (además
      // del caso normal, ya cubierto porque deja de ser hijo directo) nunca debe listarse.
      if (isInPapelera(n.id)) return
      // Un GRUPO ya tiene su propia sección "Grupos" más abajo (derivada del
      // contexto de sus miembros, ver `contextGroups`) — listarlo también aquí
      // sería duplicarlo (Alberto, 26 ago 2026: "los grupos van en el apartado
      // grupos, por tanto ya no deben aparecer en la lista de elementos").
      if (isGroupNode(n)) return
      // El emoji guardado en `_agentIcon`/`_promptIcon` es un DATO del usuario; la
      // UI ya no lo pinta — cada tipo tiene su icono del sistema, siempre el mismo.
      if (isAgentNode(n)) { seen.add(n.id); out.push({ node: n, icon: 'agent', kind: 'agent' }); return }
      if (isPromptNode(n)) { seen.add(n.id); out.push({ node: n, icon: 'prompt', kind: 'prompt' }); return }
      const c = classifyElement(n)
      if (!c || c.kind === 'note') return
      seen.add(n.id)
      out.push({ node: n, icon: c.icon, kind: c.kind })
    }
    // Las CONVERSACIONES (`_aiSession='1'`) ya NO aparecen aquí (26 ago 2026,
    // Alberto: "el histórico de conversaciones de un contexto debería estar en
    // la pestaña Chat de ese contexto... tiene más sentido que las
    // conversaciones estén en Chat") — viven en la tab "Chat" de este mismo
    // contexto (`V2RightColumn.tsx`, `listConversationsWithSubcontexts`), no
    // mezcladas con notas/PDFs/imágenes. `consider()` ya las descarta solo:
    // `classifyElement` devuelve `null` para un nodo `_aiSession='1'`.
    if (ctxId === null) {
      // General: todo lo que no pertenece a ningún contexto real, en un único
      // barrido (no hay "hijos directos" ni "miembros por referencia" que valgan
      // aquí — el criterio es puramente firstContextOf === null).
      for (const n of store.allActive()) {
        if (seen.has(n.id) || n.deletedAt || firstContextOf(n)) continue
        consider(n)
      }
    } else {
      for (const n of store.children(ctxId)) consider(n)      // hijos directos (incluye agentes)
      const members = nodesInContext(ctxId)
      for (const m of members) {
        consider(m)                                            // miembros por referencia
        // Recursos dentro de una conversación-miembro (PDF/imagen subidos al chat)
        // — la conversación en sí no se lista aquí, pero lo que se le adjuntó sí.
        if (parseExtraData(m.extraData)._aiSession === '1') {
          for (const child of store.children(m.id)) consider(child)
        }
      }
    }
    // Por fecha de CREACIÓN, no de modificación (Alberto, 5 ago 2026): con
    // `updatedAt` la lista se reordenaba sola cada vez que se tocaba cualquier
    // elemento — imposible acordarse de dónde estaba nada.
    return out.sort((a, b) => (b.node.createdAt || '').localeCompare(a.node.createdAt || ''))
  }, [ctxId, store.nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  // Grupo (si hay) de cada elemento — botón "editar grupo" al hover en su fila
  // (26 ago 2026). Mapa único por render en vez de un `groupsContaining` por
  // fila: evita recorrer todos los grupos una vez por elemento visible.
  const groupByElementId = useMemo(() => {
    void store.nodesVersion
    const map = new Map<string, Node>()
    for (const g of allGroups()) {
      for (const id of groupMemberIds(g)) if (!map.has(id)) map.set(id, g)
    }
    return map
  }, [store.nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  // GRUPOS de este contexto (26 ago 2026, Alberto: "los grupos tendrán los
  // contextos de sus elementos, y aparecerán en la columna derecha del
  // contexto de los elementos"). Un grupo no tiene contexto propio — se
  // DERIVA: aparece aquí si al menos uno de sus miembros pertenece a este
  // contexto (o, en General, no tiene contexto asignado). Así un grupo con
  // elementos de #autonomo y #inversion aparece en los dos sitios a la vez.
  const contextGroups = useMemo(() => {
    void store.nodesVersion
    return allGroups()
      .filter(g => groupMembers(g).some(m => (firstContextOf(m)?.id ?? null) === ctxId))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  }, [ctxId, store.nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  // GRUPOS dentro del propio bloque Elementos (28 ago 2026 — Alberto revierte la
  // decisión del 26 ago: "los grupos ponlos dentro del bloque elementos, quitando
  // el bloque de grupos... así estará más ordenado"). Se fusionan aquí, no en
  // `elements` arriba: un grupo se DERIVA por sus miembros (`contextGroups`), no
  // aparece nunca como hijo/miembro directo del propio contexto.
  //
  // Orden: MANUAL por defecto (28 ago 2026, Alberto: "quiero poder reordenar
  // elementos... arrastrando con el ratón. y que se mantenga el orden que el
  // usuario ha puesto"). Se guarda en `extraData._ctxOrder` (número, ascendente)
  // — un campo propio, no `siblingOrder`: los elementos de un contexto no son
  // hijos reales suyos (muchos llegan por `_ctxRefs`), así que no comparten
  // padre para que `siblingOrder` tuviera sentido. Sin orden manual guardado,
  // cae al criterio de siempre (creación, más reciente primero). Los otros 3
  // modos (nombre/fecha/modificación) son vistas alternativas explícitas —
  // volver a arrastrar cualquier fila vuelve a "manual" con el nuevo orden.
  const ctxOrderOf = (n: Node): number => {
    const v = parseExtraData(n.extraData)._ctxOrder
    return typeof v === 'number' ? v : Number.POSITIVE_INFINITY
  }
  const [elSortBy, setElSortBy] = useState<'manual' | 'title' | 'created' | 'updated'>('manual')
  const [elSortMenuOpen, setElSortMenuOpen] = useState(false)
  const elementsWithGroups = useMemo(() => {
    // Un elemento que YA está dentro de uno de estos grupos no se lista suelto
    // también arriba — solo se ve al desplegar su grupo (28 ago 2026, Alberto:
    // "los elementos de dentro deben verse cuando se despliega el grupo, no
    // fuera del mismo. ahora mismo se ven duplicados").
    const inAnyGroup = new Set(contextGroups.flatMap(g => groupMemberIds(g)))
    const combined: { node: Node; icon: IconName; kind: string }[] = elements.filter(el => !inAnyGroup.has(el.node.id))
    for (const g of contextGroups) combined.push({ node: g, icon: 'folder', kind: 'group' })
    if (elSortBy === 'title') combined.sort((a, b) => (a.node.text || '').localeCompare(b.node.text || ''))
    else if (elSortBy === 'updated') combined.sort((a, b) => (b.node.updatedAt || '').localeCompare(a.node.updatedAt || ''))
    else if (elSortBy === 'created') combined.sort((a, b) => (b.node.createdAt || '').localeCompare(a.node.createdAt || ''))
    else combined.sort((a, b) => {
      const oa = ctxOrderOf(a.node), ob = ctxOrderOf(b.node)
      if (oa !== ob) return oa - ob
      return (b.node.createdAt || '').localeCompare(a.node.createdAt || '')
    })
    return combined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements, contextGroups, elSortBy, store.nodesVersion])

  // Arrastrar para reordenar — nativo (sin librería nueva). Al soltar, renumera
  // TODOS los visibles en el orden resultante y los persiste en `_ctxOrder`;
  // fuerza el modo a "manual" para que se vea inmediatamente.
  const [draggedId, setDraggedId] = useState<string | null>(null)
  function reorderDrop(targetId: string) {
    if (!draggedId || draggedId === targetId) { setDraggedId(null); return }
    const ids = filteredElements.map(e => e.node.id)
    const from = ids.indexOf(draggedId), to = ids.indexOf(targetId)
    if (from === -1 || to === -1) { setDraggedId(null); return }
    ids.splice(to, 0, ids.splice(from, 1)[0])
    ids.forEach((id, i) => {
      const n = store.getNode(id); if (!n) return
      const e = parseExtraData(n.extraData)
      if (e._ctxOrder === i) return
      e._ctxOrder = i
      store.updateNode(id, { extraData: JSON.stringify(e) })
    })
    setElSortBy('manual')
    setDraggedId(null)
  }

  // Filtro por tipo de la lista de Elementos — mismo estilo que la tab Elementos
  // (ElementsPanel): chips en una fila con subrayado activo, solo los tipos que
  // realmente aparecen en este contexto (con su recuento).
  const [elFilter, setElFilter] = useState<string>('all')
  const ELKIND_ORDER: { key: string; label: string }[] = [
    { key: 'document',     label: t('elements.texts', 'Textos') },
    { key: 'pdf',          label: t('elements.pdfs', 'PDFs') },
    { key: 'image',        label: t('elements.images', 'Imágenes') },
    { key: 'link',         label: t('elements.links', 'Enlaces') },
    { key: 'audio',        label: t('elements.audios', 'Audios') },
    { key: 'highlight',    label: t('elements.highlights', 'Subrayados') },
    { key: 'cita',         label: t('elements.citas', 'Citas') },
    { key: 'agent',        label: t('elements.agents', 'Agentes') },
    { key: 'prompt',       label: t('elements.prompts', 'Prompts') },
    { key: 'group',        label: t('elements.groups', 'Grupos') },
  ]
  const elCounts = useMemo(() => {
    const acc: Record<string, number> = {}
    for (const el of elementsWithGroups) acc[el.kind] = (acc[el.kind] || 0) + 1
    return acc
  }, [elementsWithGroups])
  const elKindChips = ELKIND_ORDER.filter(k => elCounts[k.key] > 0)
  useEffect(() => { if (elFilter !== 'all' && !elCounts[elFilter]) setElFilter('all') }, [ctxId]) // eslint-disable-line react-hooks/exhaustive-deps
  const filteredElements = elFilter === 'all' ? elementsWithGroups : elementsWithGroups.filter(e => e.kind === elFilter)
  // Grupos desplegados (chevron) — qué grupos muestran sus miembros anidados debajo.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const toggleGroupExpanded = (id: string) => setExpandedGroups(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  // Selección múltiple + «Crear grupo (N)» — mismo mecanismo que la tab global
  // Elementos (ElementsPanel.tsx), hook compartido (Alberto, 25 ago 2026: "lo de
  // seleccionar elementos también debe poder hacerse en la lista de elementos de
  // un contexto concreto"). El grupo creado aquí es idéntico en todo (modelo,
  // enlace público) al creado desde la página global — ver utils/groups.ts.
  const { selectMode, selected, toggleSelect, toggleSelectMode, exitSelectMode, selectAll, createGroupFromSelection } =
    useGroupSelection(created => onOpenNode(created.id))
  useEffect(() => { exitSelectMode() }, [ctxId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Migración de notas antiguas → documento del contexto (no aplica a General).
  const legacyCount = ctxId === null ? 0 : legacyNotesOf(ctxId).length
  const doMigrate = () => {
    if (ctxId === null) return
    if (!window.confirm(t('v2.context.confirmMigrate', '¿Convertir {{count}} nota(s) antigua(s) de este contexto en un documento?\n\nEs reversible: los originales van a la papelera.', { count: legacyCount }))) return
    const docId = migrateContextNotesToDoc(ctxId)
    if (docId) onOpenNode(docId)
  }

  if (!isGeneral && !node) return <div className="v2-right-empty">{t('v2.context.notFound', 'Contexto no encontrado.')}</div>

  return (
    <div>
      {/* Título del contexto — antes no se mostraba en ningún sitio de esta tab (solo
          el chip del padre). Alberto: "como título en la parte superior del tab pon el
          nombre del contexto". */}
      <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, lineHeight: 1.3 }}>
        {isGeneral ? t('v2.general', 'General') : displayTitle(node!.text)}
      </div>

      {/* Contexto PADRE — chip navegable + cambiar/quitar (mismo patrón que el resto).
          General no tiene padre ni se archiva/sigue — no es un nodo real. */}
      {!isGeneral && ctxId !== null && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        {parent ? (
          <span className="v2-chip" style={{ ['--chip' as string]: contextColor(parent.id), cursor: 'default' }}>
            <span style={{ cursor: 'pointer' }} onClick={() => onSelectCtx(parent.id)}>{displayTitle(parent.text)}</span>
          </span>
        ) : null}
        <div className="v2-ctxpick-wrap" ref={parentPickWrap}>
          <button className="v2-ctx-edit-btn" onClick={() => setParentPickerOpen(o => !o)} title={parent ? t('v2.context.changeParent', 'Cambiar contexto padre') : t('v2.context.addParent', 'Añadir contexto padre')}>
            <Icon name="pencil" size={12} />
          </button>
          {parentPickerOpen && (
            <div className="v2-ctxpick-pop">
              <ContextPicker
                currentId={parent?.id ?? null}
                exclude={c => c.id === ctxId || isDescendantOf(c.id)}
                onPick={id => {
                  if (id) reparentContext(ctxId, id)
                  else clearContextParent(ctxId)
                  setParentPickerOpen(false)
                }}
              />
            </div>
          )}
        </div>
        {!parent && <span className="v2-el-meta">{t('v2.context.noParent', 'Sin contexto padre')}</span>}
        {canArchive && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            {canArchive && (
              <button className="v2-ctx-archive-btn-inline" onClick={() => setContextClosed(ctxId, !closed)}
                title={closed ? t('v2.context.restoreToTree', 'Devolver al árbol de contextos') : t('v2.context.removeFromTree', 'Sacar del árbol (sigue buscable y en el RAG)')}>
                {closed ? t('v2.context.unarchive', 'Desarchivar') : t('v2.context.archive', 'Archivar')}
              </button>
            )}
          </div>
        )}
      </div>
      )}

      {/* Migración: notas antiguas del contexto → un documento colgado del contexto. */}
      {legacyCount > 0 && (
        <button className="v2-ctx-migrate-btn" onClick={doMigrate}>
          {t('v2.context.convertLegacyNotes', 'Convertir {{count}} nota(s) antigua(s) en documento', { count: legacyCount })}
        </button>
      )}

      {/* «Lo que Fromly sabe» — YA NO se edita embebido aquí (rediseño 30 jul, Alberto:
          "el espacio de texto del contexto... debería mostrarse en el espacio central
          como un documento normal, para no quitar espacio a los elementos y tareas de
          debajo"). Al seleccionar el contexto se abre SIEMPRE en el centro
          (V2App.onSelectCtx → centerElementId es incondicional), así que una fila de
          acceso rápido aquí es pura duplicación del mismo documento que ya está abierto
          al lado (Alberto, 4 ago 2026: "veo que ahora en todos los contextos aparece
          una nota de Memoria con iconos de cerebros. esto sobra"). Se quitó la fila
          (antes V2ElementRow con icono 🧠) — antes existía por si el usuario navegaba
          el centro a otra cosa sin cambiar de tab, pero en la práctica onSelectCtx
          fuerza el centro cada vez que se entra al contexto, así que casi nunca se veía
          «vacía»: aparecía duplicada nada más entrar. */}

      {/* Tareas del contexto — estilo Hoy. */}
      <div className="v2-section-label" style={{ padding: '18px 0 6px' }}>
        <span>{t('v2.context.tasks', 'Tareas')}</span>
      </div>
      <V2TaskList tasks={plainTasks} />
      {/* Añadir tarea rápida cuelga la tarea del contexto — en General no hay un
          nodo real del que colgarla, así que se omite (la lista sigue viéndose). */}
      {ctxId !== null && <V2QuickAddTask parentId={ctxId} />}

      {/* Eventos del contexto — aparte de las tareas, sin mezclar (un evento no
          lleva checkbox, ver PlannerPanel.tsx 26 ago 2026). */}
      {events.length > 0 && (
        <>
          <div className="v2-section-label" style={{ padding: '16px 0 6px' }}>
            <span>{t('v2.context.events', 'Eventos')}</span>
          </div>
          <V2TaskList tasks={events} hideCheckbox />
        </>
      )}

      {/* Elementos del contexto: documentos, archivos, audios, enlaces, AGENTES y
          CONVERSACIONES — todo junto, ordenado de más reciente a más antigua, cada
          uno con su icono. */}
      {elementsWithGroups.length > 0 && (
        <>
          <div className="v2-section-label" style={{ padding: '16px 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{t('v2.context.elements', 'Elementos')} ({elementsWithGroups.length})</span>
            <div style={{ marginLeft: 'auto', position: 'relative' }}>
              <button
                title={t('elements.sortBy', 'Ordenar por')}
                onClick={() => setElSortMenuOpen(v => !v)}
                style={{ flexShrink: 0, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: '1px solid var(--border,#e2e2e2)', background: elSortMenuOpen ? 'var(--bg-hover,#f4f4f5)' : 'var(--bg,#fff)', color: 'var(--text-secondary,#666)', cursor: 'pointer' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h10M3 12h6M3 18h3M17 4v16m0 0l4-4m-4 4l-4-4"/></svg>
              </button>
              {elSortMenuOpen && (
                <>
                  <div onClick={() => setElSortMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1000 }} />
                  <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 1001, minWidth: 170, background: 'var(--bg-elevated,#fff)', border: '1px solid var(--border,#e2e2e2)', borderRadius: 8, boxShadow: '0 6px 24px rgba(0,0,0,0.14)', padding: 4, fontSize: 13 }}>
                    {([
                      ['manual', t('elements.sortManual', 'Tu orden (arrastrar)')],
                      ['title', t('elements.sortTitle', 'Título')],
                      ['created', t('elements.sortCreated', 'Fecha de creación')],
                      ['updated', t('elements.sortUpdated', 'Última modificación')],
                    ] as const).map(([key, label]) => (
                      <button key={key} onClick={() => { setElSortBy(key); setElSortMenuOpen(false) }}
                        style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 5, fontSize: 13, color: 'var(--text,#222)', fontFamily: 'inherit' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover,#f4f4f5)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                      >{elSortBy === key ? '✓ ' : ''}{label}</button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button
              title={selectMode ? t('elements.exitSelect', 'Salir de selección') : t('elements.selectMultiple', 'Seleccionar varios')}
              onClick={toggleSelectMode}
              style={{ flexShrink: 0, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: '1px solid var(--border,#e2e2e2)', background: selectMode ? 'var(--accent,#3E5C76)' : 'var(--bg,#fff)', color: selectMode ? '#fff' : 'var(--text-secondary,#666)', cursor: 'pointer' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12l2.5 2.5L16 9"/></svg>
            </button>
          </div>
          {selectMode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, padding: '4px 2px' }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary,#666)' }}>
                {t('elements.selectedCount', '{{count}} seleccionados', { count: selected.size })}
              </span>
              <button
                onClick={() => selectAll(filteredElements.map(el => el.node.id))}
                style={{ fontSize: 12, fontWeight: 500, color: 'var(--accent,#3E5C76)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
              >
                {t('elements.selectAllVisible', 'Seleccionar los {{count}} visibles', { count: filteredElements.length })}
              </button>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button onClick={exitSelectMode} style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-tertiary,#999)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', fontFamily: 'inherit' }}>
                  {t('common.cancel', 'Cancelar')}
                </button>
                <button
                  title={selected.size < 2 ? t('group.needTwo', 'Selecciona al menos 2 elementos') : undefined}
                  onClick={createGroupFromSelection}
                  disabled={selected.size < 2}
                  style={{ fontSize: 12.5, fontWeight: 600, color: selected.size < 2 ? 'var(--text-tertiary,#bbb)' : '#fff', background: selected.size < 2 ? 'var(--bg,#fff)' : 'var(--accent,#3E5C76)', border: '1px solid var(--border,#e2e2e2)', borderRadius: 6, cursor: selected.size < 2 ? 'default' : 'pointer', padding: '5px 12px', fontFamily: 'inherit' }}
                >
                  {t('group.createGroup', 'Crear grupo')} {selected.size >= 2 ? `(${selected.size})` : ''}
                </button>
              </div>
            </div>
          )}
          {elKindChips.length > 1 && (
            <div className="el-filterbar" style={{ marginBottom: 4 }}>
              {[{ key: 'all', label: t('elements.all', 'Todos') }, ...elKindChips].map(c => {
                const active = elFilter === c.key
                const n = c.key === 'all' ? elements.length : elCounts[c.key]
                return (
                  <button key={c.key} onClick={() => setElFilter(c.key)}
                    style={{
                      flex: '0 0 auto', border: 'none', background: 'transparent', cursor: 'pointer', padding: '3px 0',
                      fontSize: 12.5, fontWeight: active ? 700 : 500, whiteSpace: 'nowrap', fontFamily: 'inherit',
                      color: active ? 'var(--accent,#3E5C76)' : 'var(--text-tertiary,#999)',
                      borderBottom: '2px solid ' + (active ? 'var(--accent,#3E5C76)' : 'transparent'),
                    }}>
                    {c.label} <span style={{ opacity: 0.55, fontWeight: 400 }}>{n}</span>
                  </button>
                )
              })}
            </div>
          )}
          {filteredElements.map(({ node: n, icon, kind }) => {
            const agentData = isAgentNode(n) ? getAgentData(n.id) : null
            const isSelected = selected.has(n.id)
            const isGroupRow = kind === 'group'
            const isExpanded = isGroupRow && expandedGroups.has(n.id)
            const members = isGroupRow ? groupMembers(n) : []
            return (
              <div
                key={n.id}
                draggable={!selectMode}
                onDragStart={e => { setDraggedId(n.id); e.dataTransfer.effectAllowed = 'move' }}
                onDragOver={e => { if (draggedId) e.preventDefault() }}
                onDrop={e => { e.preventDefault(); reorderDrop(n.id) }}
                onDragEnd={() => setDraggedId(null)}
                style={{ opacity: draggedId === n.id ? 0.4 : 1, cursor: selectMode ? undefined : 'grab' }}
              >
                <div style={{ position: 'relative' }}>
                  <V2ElementRow
                    node={n}
                    icon={icon}
                    onOpen={onOpenNode}
                    hideContext
                    extraMeta={isGroupRow
                      ? t('group.memberCount', '{{count}} elemento(s)', { count: members.length })
                      : agentData ? (agentData.enabled ? t('agents.enabled', 'Activo') : t('agents.disabled', 'Pausado')) : fmtDate(n.createdAt, i18n.language)}
                    group={isGroupRow ? undefined : groupByElementId.get(n.id)}
                    onOpenGroup={onOpenNode}
                    expandable={isGroupRow && members.length > 0}
                    expanded={isExpanded}
                    onToggleExpand={() => toggleGroupExpanded(n.id)}
                  />
                  {/* Overlay de selección — mismo patrón que ElementsPanel: intercepta el
                      clic sin tocar V2ElementRow, el contenido de debajo sigue visible. */}
                  {selectMode && !isGroupRow && (
                    <div
                      onClick={() => toggleSelect(n.id)}
                      style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', alignItems: 'center', paddingLeft: 6, cursor: 'pointer', background: isSelected ? 'rgba(62,92,118,0.10)' : 'transparent' }}
                    >
                      <input type="checkbox" checked={isSelected} readOnly style={{ pointerEvents: 'none', width: 15, height: 15 }} />
                    </div>
                  )}
                </div>
                {/* Miembros del grupo, anidados debajo cuando está desplegado (28 ago
                    2026 — sustituye a la sección "Grupos" aparte, "así estará más
                    ordenado"). Mismo V2ElementRow, indentado (`child`). */}
                {isGroupRow && isExpanded && members.map(m => (
                  <V2ElementRow
                    key={m.id}
                    node={m}
                    icon={classifyElement(m)?.icon || 'document'}
                    onOpen={onOpenNode}
                    hideContext
                    child
                    extraMeta={fmtDate(m.createdAt, i18n.language)}
                  />
                ))}
              </div>
            )
          })}
        </>
      )}
      {/* Empty state SIEMPRE visible: un contexto con elementos ocultos (o sin
          ninguno) mostraba solo dos títulos y un input — parecía roto y no
          decía cómo llenarlo (auditoría 28 ago 2026). */}
      {elementsWithGroups.length === 0 && (
        <>
          <div className="v2-section-label" style={{ padding: '16px 0 4px' }}>
            <span>{t('v2.context.elements', 'Elementos')}</span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-tertiary,#999)', padding: '2px 0 8px' }}>
            {t('v2.context.elementsEmpty', 'Aún no hay elementos aquí. Crea una nota con «+», arrastra archivos, o pídeselo al chat de este contexto.')}
          </div>
        </>
      )}
    </div>
  )
}
