// Vista de contexto de Fromly 2.0 (modo «Contexto» de la columna derecha).
// Como en la v1: contenido agrupado por tipo (Tareas / Notas / …), indicador de
// contexto padre, botón ARCHIVAR (mapea al flag _closed de la v1 → sale del árbol
// pero sigue buscable + rastreable por el RAG), y «Lo que Fromly sabe» al final.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import {
  contextColor, contextParent, isContextClosed, setContextClosed,
  isContextFollowed, setContextFollowed,
  getOrCreateContextKnowledgeDoc, nodesInContext,
  containerNotesNode, reparentContext, clearContextParent,
  firstContextOf,
} from '../../utils/cajones'
import { htmlToMarkdown } from '../../utils/htmlMarkdown'
import { parseExtraData, isInPapelera } from '../../utils/papeleraHelper'
import { isContextKnowledge } from '../../utils/knowledgeNodes'
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
import type { Node } from '../../types'

interface Props {
  ctxId: string | null
  onSelectCtx: (id: string) => void
  onOpenNode: (id: string) => void
  onOpenConversation?: (id: string) => void
}

export default function V2ContextView({ ctxId, onSelectCtx, onOpenNode, onOpenConversation }: Props) {
  const { t, i18n } = useTranslation()
  useStore()
  // General = sin contexto asignado (ctxId null). No es un nodo real: no tiene
  // padre, no se archiva, no se sigue, no tiene documento de conocimiento propio
  // — pero sí sus propias tareas/elementos (todo lo que no cuelga de ningún
  // contexto), que es lo mínimo que pidió Alberto (17 jul).
  const isGeneral = ctxId === null
  const node = isGeneral ? null : store.getNode(ctxId)
  const parent = isGeneral ? null : contextParent(ctxId)
  const closed = node ? isContextClosed(node) : false
  const followed = node ? isContextFollowed(node) : false
  const canArchive = !isGeneral && !!parent // solo subcontextos (las áreas no se archivan)
  // Mismo alcance que Archivar: solo subcontextos. Un contexto nace neutro (ni
  // seguido ni archivado) — «Seguir» es el opt-in explícito para que aparezca en
  // Seguimiento (tab Hoy). Sin él, es un simple contenedor de elementos (Alberto,
  // 15 jul: "Documentos personales" no necesita seguimiento; "Radio Elche" sí).
  const canFollow = !isGeneral && !!parent

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

  // «Lo que Fromly sabe» — documento unificado (memoria de la IA + notas libres del
  // usuario en un único bloque, Alberto: "debería quedarse, pero en formato nota").
  // getOrCreateContextKnowledgeDoc migra automáticamente el formato antiguo (hijos-
  // línea) la primera vez que se abre el contexto. Get-or-create UNA vez por
  // contexto (no en cada render), igual que notesNode antes.
  const knowledgeDoc = useMemo(() => {
    if (ctxId === null) return null
    const doc = getOrCreateContextKnowledgeDoc(ctxId)
    // Fusión con las "Notas" antiguas (ahora eliminadas de la UI de contexto): si el
    // usuario ya había escrito algo en el bloque "📝 Notas" separado y el nuevo
    // documento de conocimiento está vacío, usamos las Notas como base (no perder lo
    // ya escrito). Si AMBOS tienen contenido, se concatenan con un separador claro
    // — decisión: preferimos no perder ningún texto ya escrito antes que decidir
    // arbitrariamente cuál "gana". Se ejecuta una sola vez (idempotente: las Notas
    // legado quedan vacías tras la fusión, así no se repite en próximas aperturas).
    const legacyNotes = containerNotesNode(ctxId)
    const legacyText = legacyNotes ? htmlToMarkdown(legacyNotes.body || '').trim() : ''
    if (legacyText) {
      const currentText = htmlToMarkdown(doc.body || '').trim()
      const mergedHtml = currentText
        ? `${doc.body || ''}<p>---</p>${legacyNotes!.body || ''}`
        : (legacyNotes!.body || '<p></p>')
      store.updateNode(doc.id, { body: mergedHtml })
      store.updateNode(legacyNotes!.id, { body: '<p></p>' })
    }
    return store.getNode(doc.id)!
  }, [ctxId]) // eslint-disable-line react-hooks/exhaustive-deps

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
    const isTask = (n: Node) => !n.deletedAt && (n.status != null || (n.types || []).includes('tarea'))
    if (ctxId === null) return store.allActive().filter(n => isTask(n) && !firstContextOf(n))
    const seen = new Set<string>()
    const out: Node[] = []
    for (const n of [...store.children(ctxId), ...nodesInContext(ctxId)]) {
      if (seen.has(n.id) || !isTask(n) || isInPapelera(n.id)) continue
      seen.add(n.id)
      out.push(n)
    }
    return out
  }, [ctxId, store.nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  // ELEMENTOS del contexto: TODO lo que cuelga de él — documentos, PDF, imágenes,
  // enlaces, audios, AGENTES y CONVERSACIONES — en una única lista, cada uno con su
  // icono, ordenada de más reciente a más antigua. Antes iban en bloques separados
  // (Elementos/Agentes/Conversaciones); Alberto pidió fusionarlos: "deberían aparecer
  // junto y organizado de más reciente más antiguo, cada elemento con su icono".
  // Las notas de texto planas se omiten (las gestiona la migración, para no volver a
  // llenar la columna) y las tareas tienen su propia lista arriba (con due/checkbox).
  const elements = useMemo(() => {
    void store.nodesVersion
    const out: { node: Node; icon: IconName; kind: string; isConversation?: boolean }[] = []
    const seen = new Set<string>()
    const consider = (n: Node) => {
      if (seen.has(n.id) || n.deletedAt) return
      // "Lo que Fromly sabe" ya tiene su propia sección fija más abajo (knowledgeDoc) —
      // no debe duplicarse como una fila más en Elementos. classifyElement() lo clasifica
      // como 'document' (tiene _doc:'1'), no 'note', así que sin esta exclusión explícita
      // se colaba en la lista (Alberto, 14 jul).
      if (isContextKnowledge(n.text)) return
      // Defensa extra: un nodo movido a la papelera por una vía que no reparenta (además
      // del caso normal, ya cubierto porque deja de ser hijo directo) nunca debe listarse.
      if (isInPapelera(n.id)) return
      // El emoji guardado en `_agentIcon`/`_promptIcon` es un DATO del usuario; la
      // UI ya no lo pinta — cada tipo tiene su icono del sistema, siempre el mismo.
      if (isAgentNode(n)) { seen.add(n.id); out.push({ node: n, icon: 'agent', kind: 'agent' }); return }
      if (isPromptNode(n)) { seen.add(n.id); out.push({ node: n, icon: 'prompt', kind: 'prompt' }); return }
      const c = classifyElement(n)
      if (!c || c.kind === 'note') return
      seen.add(n.id)
      out.push({ node: n, icon: c.icon, kind: c.kind })
    }
    if (ctxId === null) {
      // General: todo lo que no pertenece a ningún contexto real, en un único
      // barrido (no hay "hijos directos" ni "miembros por referencia" que valgan
      // aquí — el criterio es puramente firstContextOf === null).
      for (const n of store.allActive()) {
        if (seen.has(n.id) || n.deletedAt || firstContextOf(n)) continue
        const ed = parseExtraData(n.extraData)
        if (ed._aiSession === '1') {
          if (isInPapelera(n.id)) continue
          seen.add(n.id)
          out.push({ node: n, icon: 'conversation', kind: 'conversation', isConversation: true })
          continue
        }
        consider(n)
      }
    } else {
      for (const n of store.children(ctxId)) consider(n)      // hijos directos (incluye agentes)
      const members = nodesInContext(ctxId)
      for (const m of members) {
        consider(m)                                            // miembros por referencia
        // Recursos dentro de una conversación-miembro (PDF/imagen subidos al chat).
        if (parseExtraData(m.extraData)._aiSession === '1') {
          for (const child of store.children(m.id)) consider(child)
        }
      }
      // Conversaciones del contexto: TODOS los chats (_aiSession='1', fuera de papelera,
      // incluidas las sesiones de comando rápido — ya no se ocultan, 15 jul), filtradas a
      // las que pertenecen a ESTE contexto (firstContextOf).
      for (const n of store.allActive()) {
        if (seen.has(n.id) || n.deletedAt) continue
        const ed = parseExtraData(n.extraData)
        if (ed._aiSession !== '1') continue
        if (isInPapelera(n.id)) continue
        if (firstContextOf(n)?.id !== ctxId) continue
        seen.add(n.id)
        out.push({ node: n, icon: 'conversation', kind: 'conversation', isConversation: true })
      }
    }
    // Por fecha de CREACIÓN, no de modificación (Alberto, 5 ago 2026): con
    // `updatedAt` la lista se reordenaba sola cada vez que se tocaba cualquier
    // elemento — imposible acordarse de dónde estaba nada.
    return out.sort((a, b) => (b.node.createdAt || '').localeCompare(a.node.createdAt || ''))
  }, [ctxId, store.nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps

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
    { key: 'conversation', label: t('elements.conversations', 'Conversaciones') },
  ]
  const elCounts = useMemo(() => {
    const acc: Record<string, number> = {}
    for (const el of elements) acc[el.kind] = (acc[el.kind] || 0) + 1
    return acc
  }, [elements])
  const elKindChips = ELKIND_ORDER.filter(k => elCounts[k.key] > 0)
  useEffect(() => { if (elFilter !== 'all' && !elCounts[elFilter]) setElFilter('all') }, [ctxId]) // eslint-disable-line react-hooks/exhaustive-deps
  const filteredElements = elFilter === 'all' ? elements : elements.filter(e => e.kind === elFilter)

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
        {(canFollow || canArchive) && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            {canFollow && (
              <button className="v2-ctx-archive-btn-inline" onClick={() => setContextFollowed(ctxId, !followed)}
                title={followed
                  ? t('v2.context.unfollowHint', 'Dejar de mostrarlo en Seguimiento (tab Hoy)')
                  : t('v2.context.followHint', 'Mostrarlo en Seguimiento (tab Hoy) para revisarlo día a día')}>
                {followed ? t('v2.context.unfollow', 'Dejar de seguir') : t('v2.context.follow', 'Seguir')}
              </button>
            )}
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
      <V2TaskList tasks={tasks} />
      {/* Añadir tarea rápida cuelga la tarea del contexto — en General no hay un
          nodo real del que colgarla, así que se omite (la lista sigue viéndose). */}
      {ctxId !== null && <V2QuickAddTask parentId={ctxId} />}

      {/* Elementos del contexto: documentos, archivos, audios, enlaces, AGENTES y
          CONVERSACIONES — todo junto, ordenado de más reciente a más antigua, cada
          uno con su icono. */}
      {elements.length > 0 && (
        <>
          <div className="v2-section-label" style={{ padding: '16px 0 4px' }}>{t('v2.context.elements', 'Elementos')} ({elements.length})</div>
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
          {filteredElements.map(({ node: n, icon, isConversation }) => {
            const agentData = isAgentNode(n) ? getAgentData(n.id) : null
            return (
              <V2ElementRow
                key={n.id}
                node={n}
                icon={icon}
                onOpen={id => (isConversation && onOpenConversation ? onOpenConversation(id) : onOpenNode(id))}
                hideContext
                extraMeta={agentData ? (agentData.enabled ? t('agents.enabled', 'Activo') : t('agents.disabled', 'Pausado')) : fmtDate(n.createdAt, i18n.language)}
              />
            )
          })}
        </>
      )}
    </div>
  )
}
