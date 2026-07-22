// MARK: - aiChatExecutor (web)
//
// Ejecuta una acción de chat IA (extraída del bloque from-action) usando
// nodeStore. Paridad con AIChatExecutor.swift (Mac).

import { store } from './nodeStore'
import type { ExecutedAction } from './aiChatStore'
import { ensureDayPath } from '../utils/agendaHelper'
import { pushEventToGcal } from '../utils/gcalNodesSync'
import { createAgentUnder, getAgentData, setAgentEnabled, isAgentNode } from '../utils/agentesHelper'
import { createPromptUnder } from '../utils/promptsHelper'
import { markdownToHtml } from '../utils/importMarkdown'
import { createContext, appendContextFacts, maybeUpdateContextKnowledge, assignContext, isRootContext, isMarkedContext, firstContextOf } from '../utils/cajones'
import { extractDateFromEnd, recurrenceToString } from '../utils/naturalDate'
import { userStore } from './userStore'

/** Quita prefijos de lista de un título de nodo: "1. ", "12) ", "- ", "* ", "• ".
 * (Magic a veces genera cada idea como "1. ..." → todos salían con un "1." delante.) */
function cleanNodeTitle(text: string): string {
  return text.replace(/^\s*(\d{1,3}[.)]\s+|[-*•]\s+)/, '').trim() || text.trim()
}

/** Retorna el nodo padre correcto: si due es un día diferente a hoy, usar ese día; si no, usar sessionId */
function resolveParent(due: string | null | undefined, sessionId: string | null): string | null {
  if (!due) return sessionId
  const dueDate = new Date(due)
  const today = new Date(); today.setHours(0,0,0,0)
  const dueMidnight = new Date(dueDate); dueMidnight.setHours(0,0,0,0)
  if (dueMidnight.getTime() !== today.getTime()) {
    return ensureDayPath(dueDate).id
  }
  return sessionId
}

/** Contexto activo a partir de `currentNodeId` (mismo criterio que
 *  aiChatStore.learnFromUserMessage): si el nodo YA es un contexto (área raíz
 *  o marcado), es él mismo; si no, el contexto más cercano hacia arriba. */
function resolveActiveContextId(currentNodeId?: string): string | null {
  if (!currentNodeId) return null
  const n = store.nodes.get(currentNodeId)
  if (!n) return null
  if (isRootContext(currentNodeId) || isMarkedContext(n)) return currentNodeId
  return firstContextOf(n)?.id ?? null
}

export async function executeChatAction(
  action: Record<string, unknown>,
  sessionId: string,
  currentNodeId?: string   // fallback parent cuando el AI no especifica parent_id
): Promise<ExecutedAction> {
  const name = (action.action as string) || ''
  switch (name) {
    case 'create_note':    return createNote(action, sessionId, currentNodeId)
    case 'create_document':return createDocument(action, sessionId, currentNodeId)
    case 'create_task':    return createTask(action, sessionId, currentNodeId)
    case 'create_context': return createContextAction(action)
    case 'create_agent':   return createAgentAction(action, sessionId, currentNodeId)
    case 'update_agent':   return updateAgentAction(action)
    case 'create_prompt':  return createPromptAction(action, sessionId, currentNodeId)
    case 'create_event':   return createEvent(action, sessionId)
    case 'update_node':    return updateNode(action)
    case 'read_node':      return readNode(action)
    case 'find_nodes':     return findNodes(action)
    case 'add_column':     return addColumn(action)
    case 'fill_column':    return fillColumn(action)
    case 'add_row':        return addRow(action)
    case 'change_view':    return changeView(action)
    case 'create_resource':return createResource(action)
    case 'run_prompt':     return runPrompt(action)
    case 'navigate_to':    return navigateTo(action)
    case 'set_filter':     return setFilter(action)
    default:
      return result(name || 'unknown', false, `Acción desconocida: ${name}`)
  }
}

function navigateTo(a: Record<string, unknown>): ExecutedAction {
  const nodeId = (a.node_id as string | undefined) || null
  const path   = (a.path   as string | undefined) || null
  const dest = nodeId ? `/node/${nodeId}` : path
  if (dest) {
    window.dispatchEvent(new CustomEvent('from:navigate', { detail: { path: dest } }))
    return result('navigate_to', true, `Navegando.`)
  }
  return result('navigate_to', false, 'Destino no especificado.')
}

function setFilter(a: Record<string, unknown>): ExecutedAction {
  const query = ((a.query as string | undefined) || '').trim()
  // Navegar a raíz para que el filtro sea visible en todo el árbol
  window.dispatchEvent(new CustomEvent('from:navigate', { detail: { path: '/' } }))
  // Aplicar el filtro (pequeño delay para que la navegación ocurra primero)
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('wf:set-filter', { detail: { query } }))
  }, 80)
  return result('set_filter', true, query ? `Filtrando: ${query}` : 'Filtro limpio.')
}

/** ¿El body trae una jerarquía real (encabezados markdown o sub-items indentados)?
 *  create_note aplana todo a hijos de un solo nivel — si el modelo manda esto
 *  (a veces pide "nota" para algo que en realidad tiene secciones con sub-items,
 *  pese a la regla del prompt), es mejor crear un documento y conservar la
 *  estructura que perderla en una lista plana (Alberto, 17 jul). */
function hasNestedStructure(body: string): boolean {
  return body.split('\n').some(l => /^#{1,3}\s+\S/.test(l.trim()) || /^\s{2,}[-*•]\s+\S/.test(l))
}

function createNote(a: Record<string, unknown>, sessionId?: string, currentNodeId?: string): ExecutedAction {
  const body = a.body as string | undefined
  if (body && hasNestedStructure(body)) {
    return createDocument(a, sessionId, currentNodeId)
  }
  const text = cleanNodeTitle((a.text as string) || 'Nota sin título')
  const tags = (a.tags as string[]) || []
  // Validar parent_id: solo usarlo si es un UUID real que existe en el store
  const rawParent = (a.parent_id as string | undefined) || null
  const explicitParent = rawParent && store.nodes.get(rawParent) ? rawParent : null

  const created = store.createNode({
    text,
    parentId: explicitParent ?? sessionId ?? null,
    types: tags,
    extraData: {},
  })
  // Si hay body, crear nodos hijos en lugar de usar el editor de body
  if (body) {
    const lines = body.split('\n').map((l: string) => l.trim()).filter(Boolean)
    for (const line of lines) {
      store.createNode({ text: cleanNodeTitle(line), parentId: created.id })
    }
  }
  const tagPart = tags.length > 0 ? ` con tags #${tags.join(' #')}` : ''
  maybeUpdateContextKnowledge(store.getNode(created.id))
  return result('create_note', true, `Nota «${text}» creada${tagPart}.`, [created.id])
}

/** Markdown ligero → HTML para el body de un documento (`_doc`). El usuario lo
 *  refina luego en el editor. Cubre encabezados, viñetas, negrita/cursiva y párrafos. */
function mdToHtml(md: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const inline = (s: string) => esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
  const out: string[] = []
  let inList = false
  const closeList = () => { if (inList) { out.push('</ul>'); inList = false } }
  for (const raw of md.split('\n')) {
    const line = raw.trimEnd()
    if (!line.trim()) { closeList(); continue }
    const h = line.match(/^(#{1,3})\s+(.*)$/)
    if (h) { closeList(); const lvl = h[1].length; out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`); continue }
    const li = line.match(/^\s*[-*•]\s+(.*)$/)
    if (li) { if (!inList) { out.push('<ul>'); inList = true } out.push(`<li>${inline(li[1])}</li>`); continue }
    closeList()
    out.push(`<p>${inline(line)}</p>`)
  }
  closeList()
  return out.join('') || '<p></p>'
}

/** create_document — crea un DOCUMENTO (`_doc`): su contenido vive en el body (HTML).
 *  Es la excepción a «la IA nunca escribe body»: un documento ES su body. Se abre
 *  editable en la columna derecha (artifact). */
function createDocument(a: Record<string, unknown>, sessionId?: string, currentNodeId?: string): ExecutedAction {
  const title = cleanNodeTitle((a.text as string) || (a.title as string) || 'Documento')
  const content = ((a.body as string) || (a.content as string) || '').trim()
  const tags = (a.tags as string[]) || []
  const rawParent = (a.parent_id as string | undefined) || null
  const explicitParent = rawParent && store.nodes.get(rawParent) ? rawParent : null
  const created = store.createNode({
    text: title,
    parentId: explicitParent ?? sessionId ?? currentNodeId ?? null,
    types: tags,
    extraData: { _doc: '1' },
  })
  store.updateNode(created.id, { body: mdToHtml(content) })
  maybeUpdateContextKnowledge(store.getNode(created.id))
  return result('create_document', true, `Documento «${title}» creado.`, [created.id])
}

function createTask(a: Record<string, unknown>, sessionId?: string, currentNodeId?: string): ExecutedAction {
  const rawTitle = (a.text as string) || 'Tarea'
  // El esquema de create_task que maneja el modelo no tiene un campo de
  // recurrencia propio — sin este parseo (idéntico al de captureHelper.
  // createNodeFromText, usado por la captura rápida manual), una recurrencia
  // en lenguaje natural al final del título ("cada quince días") se perdía
  // siempre: el modelo la deja tal cual en el texto y aquí nunca se leía
  // (Alberto, 22 jul: "no se le ha añadido ni la recurrencia ni el contexto").
  const dp = extractDateFromEnd(rawTitle)
  const text = cleanNodeTitle(dp ? dp.cleanText : rawTitle)
  const tags = (a.tags as string[]) || []
  const due = parseDate(a.due) ?? (dp?.parsed.date ? dp.parsed.date.toISOString() : undefined)
  const priority = a.priority as string | undefined
  // Validar parent_id: solo usarlo si es un UUID real que existe en el store
  const rawParent = (a.parent_id as string | undefined) || null
  const explicitParent = rawParent && store.nodes.get(rawParent) ? rawParent : null

  // Prioridad: explicitParent > due futuro (día distinto) > sessionId (diario hoy)
  // currentNodeId NO se usa como PADRE — los recordatorios genéricos van al diario.
  // Solo se usa si el AI lo pasa explícitamente como parent_id. El CONTEXTO (más
  // abajo, assignContext) es independiente de dónde cuelgue el nodo.
  const dueFutureNode = resolveParent(due, null)
  const parentId = explicitParent ?? dueFutureNode ?? sessionId ?? null

  const created = store.createNode({
    text,
    parentId,
    isTask: true,
    types: [...tags, 'tarea'],
    extraData: { _atomic: '1', _inline: '1' },
  })
  const updates: Record<string, unknown> = { status: 'pending' }
  if (due) updates.due = due
  if (priority) updates.priority = priority
  if (dp?.parsed.recurrence) updates.recurrence = recurrenceToString(dp.parsed.recurrence)
  store.updateNode(created.id, updates)
  // Contexto explícito: una tarea con `due` futuro cuelga del diario de ese día
  // (árbol completamente separado del de contextos), así que heredar por
  // ancestro nunca la habría enlazado a "La Isla del Trading" — necesita su
  // propio `_ctxRefs`, igual que ya hacía la captura rápida manual.
  const ctxId = resolveActiveContextId(currentNodeId)
  if (ctxId) assignContext(created.id, ctxId)
  const datePart = due ? ` para ${new Date(due).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}` : ''
  return result('create_task', true, `Tarea «${text}»${datePart} creada.`, [created.id])
}

function createContextAction(a: Record<string, unknown>): ExecutedAction {
  const name = cleanNodeTitle((a.name as string) || (a.text as string) || 'Contexto')
  const rawParent = (a.parent_context_id as string | undefined) || null
  const explicitParent = rawParent && store.nodes.get(rawParent) ? rawParent : null

  const created = createContext(name, explicitParent)

  // Sembrar "Lo que Fromly sabe" con el resumen de para qué es el contexto, si la
  // IA lo aportó — así la siguiente conversación abierta en este contexto ya sabe
  // de qué va, en vez de saludar genérico (ver enrichTag en aiChatStore.ts).
  const about = ((a.about as string) || (a.knowledge as string) || '').trim()
  if (about) appendContextFacts(created.id, [about])

  return result('create_context', true, `Contexto «${name}» creado.`, [created.id])
}

/** create_agent — crea una automatización recurrente (agente) colgada del contexto
 *  activo (contexto padre libre, v2), SIEMPRE desactivada: el usuario la revisa y
 *  activa explícitamente (gate de seguridad, no de suscripción — el gate Pro actúa
 *  al ACTIVAR, en AgentPropertiesPanel/setAgentEnabled). Mismo patrón de result()
 *  que create_task/create_note, con tarjeta de confirmación en el chat. */
function createAgentAction(a: Record<string, unknown>, sessionId?: string, currentNodeId?: string): ExecutedAction {
  const label = cleanNodeTitle((a.text as string) || (a.title as string) || 'Agente')
  const systemPrompt = (a.system_prompt as string) || (a.systemPrompt as string) || ''
  const userMessage = (a.user_message as string) || (a.userMessage as string) || ''
  const schedule = (a.schedule as string) || ''
  const conversational = a.conversational === true || a.conversational === 'true'
  const rawParent = (a.parent_id as string | undefined) || null
  const explicitParent = rawParent && store.nodes.get(rawParent) ? rawParent : null
  const parentId = explicitParent ?? sessionId ?? currentNodeId ?? null

  const created = createAgentUnder({
    parentId, label, systemPrompt, userMessage, schedule, enabled: false, conversational,
  })
  const schedulePart = schedule ? ` (programado: ${schedule})` : ' (sin programar todavía)'
  const convoPart = conversational ? ' Al ejecutarse, abrirá una conversación nueva con esa pregunta y esperará tu respuesta.' : ''
  // Abrir SIEMPRE en la columna derecha + toast — antes dependía de que fuera la
  // ÚNICA acción del turno (send() en aiChatStore.ts), así que a veces no se
  // abría (Alberto, 15 jul: "debe aparecer allí mismo en el chat... y abrirse a
  // la derecha. Añade además un toast de confirmación").
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('from:open-detail', { detail: { nodeId: created.id } }))
    window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: `Agente «${label}» creado`, type: 'success' } }))
  }
  return result('create_agent', true,
    `Agente «${label}» creado${schedulePart}. Está DESACTIVADO — revísalo y actívalo cuando estés listo.${convoPart}`,
    [created.id])
}

/** create_prompt — crea un prompt reutilizable (plantilla de texto que el usuario
 *  lanza luego desde el desplegable ⚡ del composer) colgado del contexto activo.
 *  Mismo patrón que create_agent: la IA redacta el contenido a partir de lo que
 *  pida el usuario y lo crea directamente (sin gate de activación — un prompt no
 *  hace nada por sí solo hasta que el usuario lo envía). */
function createPromptAction(a: Record<string, unknown>, sessionId?: string, currentNodeId?: string): ExecutedAction {
  const label = cleanNodeTitle((a.text as string) || (a.title as string) || 'Prompt')
  const content = (a.content as string) || (a.body as string) || ''
  const rawParent = (a.parent_id as string | undefined) || null
  const explicitParent = rawParent && store.nodes.get(rawParent) ? rawParent : null
  const parentId = explicitParent ?? sessionId ?? currentNodeId ?? null

  const created = createPromptUnder({ parentId, label, content })
  // Abrir SIEMPRE en la columna derecha + toast, igual que create_agent (Alberto, 15 jul).
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('from:open-detail', { detail: { nodeId: created.id } }))
    window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: `Prompt «${label}» creado`, type: 'success' } }))
  }
  return result('create_prompt', true, `Prompt «${label}» creado.`, [created.id])
}

/** update_agent — activa/pausa, reprograma o cambia el prompt de un agente YA
 *  EXISTENTE (la IA solo tenía create_agent, no podía gestionar uno creado —
 *  antes contestaba "listo, activado" sin tocar nada). Reutiliza setAgentEnabled
 *  (mismo gate Pro que AgentPropertiesPanel.toggleEnabled) y, si llega
 *  user_message, reemplaza los HIJOS-instrucción del nodo (mismo lugar que edita
 *  el usuario a mano en V2AgentDetailView/Outliner) para que el cambio se vea
 *  también en el editor de la columna derecha. */
function updateAgentAction(a: Record<string, unknown>): ExecutedAction {
  const nodeId = (a.node_id as string | undefined) || (a.nodeId as string | undefined) || ''
  const node = nodeId ? store.nodes.get(nodeId) : undefined
  if (!node || !isAgentNode(node)) return result('update_agent', false, 'Agente no encontrado (node_id inválido).')

  const data = getAgentData(nodeId)
  if (!data) return result('update_agent', false, 'Agente no encontrado.')

  const changes: string[] = []

  if ('user_message' in a || 'userMessage' in a) {
    const userMessage = String((a.user_message as string) ?? (a.userMessage as string) ?? '').trim()
    if (userMessage) {
      // Mismo patrón que createAgentUnder: la nota central = UN hijo-documento
      // (`_doc='1'`, editor de texto normal, sin viñetas de outliner). Al
      // ACTUALIZAR, se borran los hijos-instrucción viejos y se crea uno nuevo
      // (evita mezclar el texto anterior con el nuevo en el editor).
      for (const child of store.children(nodeId)) store.deleteNode(child.id)
      const doc = store.createNode({ text: '', parentId: nodeId })
      store.updateNode(doc.id, { extraData: JSON.stringify({ _doc: '1' }), body: markdownToHtml(userMessage) })
      try {
        const ed = JSON.parse(node.extraData || '{}')
        ed._agentUserMessage = userMessage
        store.updateNode(nodeId, { extraData: JSON.stringify(ed) })
      } catch { /* ignore */ }
      changes.push('instrucción')
    }
  }

  if ('schedule' in a) {
    const schedule = String(a.schedule ?? '')
    try {
      const ed = JSON.parse((store.nodes.get(nodeId)?.extraData) || '{}')
      ed._agentSchedule = schedule
      store.updateNode(nodeId, { extraData: JSON.stringify(ed) })
      changes.push(schedule ? `programación: ${schedule}` : 'programación eliminada')
    } catch { /* ignore */ }
  }

  if ('enabled' in a) {
    const enabled = !!a.enabled
    // Gate Pro: solo al ACTIVAR, mismo criterio que AgentPropertiesPanel.toggleEnabled.
    if (enabled && !userStore.isPremium) {
      return result('update_agent', false,
        'No se pudo activar: activar agentes requiere Fromly Pro. El agente sigue pausado.')
    }
    setAgentEnabled(nodeId, enabled)
    changes.push(enabled ? 'activado' : 'pausado')
  }

  if (!changes.length) return result('update_agent', false, 'No se especificó ningún cambio (enabled/schedule/user_message).')

  return result('update_agent', true,
    `Agente «${node.text}» actualizado: ${changes.join(', ')}.`,
    [nodeId])
}

function createEvent(a: Record<string, unknown>, sessionId?: string): ExecutedAction {
  const text = (a.text as string) || 'Evento'
  const tags = (a.tags as string[]) || []
  const due = parseDate(a.due)
  if (!due) return result('create_event', false, "Falta 'due' (ISO 8601).")
  const dueEnd = parseDate(a.due_end)
  const location = a.location as string | undefined
  const explicitParent = (a.parent_id as string | undefined) || null

  // Los eventos siempre van bajo el nodo diario de su fecha
  const parentId = explicitParent ?? resolveParent(due, sessionId ?? null) ?? null

  const created = store.createNode({
    text,
    parentId,
    types: [...tags, 'evento'],
  })
  const updates: Record<string, unknown> = { isEvent: true, due }
  if (dueEnd) updates.dueEnd = dueEnd
  if (location) {
    let ed: Record<string, unknown> = {}
    try { ed = JSON.parse(created.extraData || '{}') } catch { /* ignore */ }
    ed.location = location
    updates.extraData = JSON.stringify(ed)
  }
  store.updateNode(created.id, updates)
  // Sincroniza con Google Calendar (no-op si el usuario no está conectado).
  const eventNode = store.getNode(created.id)
  if (eventNode) pushEventToGcal(eventNode).catch(() => {})
  return result('create_event', true,
    `Evento «${text}» — ${new Date(due).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })} creado.`,
    [created.id])
}

function updateNode(a: Record<string, unknown>): ExecutedAction {
  const id = a.id as string | undefined
  if (!id) return result('update_node', false, 'Falta id.')
  const node = store.nodes.get(id)
  if (!node) return result('update_node', false, 'Nodo no encontrado.')

  const updates: Record<string, unknown> = {}
  if (typeof a.text === 'string') updates.text = a.text
  // body nunca se escribe — en Fromly todo el contenido va en nodos hijos
  if (Array.isArray(a.tags)) updates.types = a.tags
  if ('status' in a) updates.status = a.status === null ? null : a.status
  if ('due' in a) updates.due = parseDate(a.due) ?? null
  store.updateNode(id, updates)
  return result('update_node', true,
    `Nodo «${node.text}» actualizado (${Object.keys(updates).join(', ')}).`,
    [id])
}

function readNode(a: Record<string, unknown>): ExecutedAction {
  const id = a.id as string | undefined
  if (!id) return result('read_node', false, 'Falta id.')
  const node = store.nodes.get(id)
  if (!node) return result('read_node', false, 'Nodo no encontrado.')

  const parts: string[] = [`title=${node.text}`]
  if (node.body) {
    const snippet = node.body.length > 2000 ? node.body.slice(0, 2000) + '…' : node.body
    parts.push(`body=${snippet}`)
  }
  if (node.types && node.types.length > 0) parts.push(`tags=${node.types.join(',')}`)
  if (node.status) parts.push(`status=${node.status}`)
  if (node.due) parts.push(`due=${node.due}`)
  try {
    const ed = JSON.parse(node.extraData || '{}')
    if (ed._props) parts.push(`props=${ed._props}`)
  } catch { /* ignore */ }
  const childrenTitles = store.children(id).slice(0, 10).map(c => c.text)
  if (childrenTitles.length > 0) parts.push(`children=[${childrenTitles.join(' | ')}]`)
  return result('read_node', true, parts.join(' | '), [id])
}

function findNodes(a: Record<string, unknown>): ExecutedAction {
  const query = ((a.query as string) || '').toLowerCase()
  const limit = (a.limit as number) || 5
  if (!query) return result('find_nodes', false, 'Falta query.')

  const matches = [...store.nodes.values()]
    .filter(n => {
      if (n.deletedAt) return false
      if (!n.text) return false
      if (n.text.toLowerCase().includes(query)) return true
      if ((n.body || '').toLowerCase().includes(query)) return true
      if ((n.types || []).some(t => t.toLowerCase().includes(query))) return true
      return false
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit)

  const ids = matches.map(n => n.id)
  const summary = matches.length === 0
    ? `Sin resultados para «${query}».`
    : `Encontrados ${matches.length}: ` + matches.map(n => `[${n.id}] ${n.text}`).join(' | ')
  return result('find_nodes', true, summary, ids)
}

// ── F2 tablas + vistas ─────────────────────────────────────────────────

function parsePropsArray(raw: string | null | undefined): Array<Record<string, unknown>> {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

function parsePropsObject(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {}
  } catch { return {} }
}

function addColumn(a: Record<string, unknown>): ExecutedAction {
  const tableId = a.table_id as string | undefined
  if (!tableId) return result('add_column', false, 'Falta table_id.')
  const node = store.nodes.get(tableId)
  if (!node) return result('add_column', false, 'Tabla no encontrada.')

  const name = (a.name as string) || 'Columna'
  const type = (a.type as string) || 'text'
  // CORRECTO: usa store.addPropColumn que escribe en extraData._props
  // (el executor viejo escribía en node.props → campo incorrecto, UI no lo veía)
  const colId = store.addPropColumn(tableId, name, type,
    Array.isArray(a.options) ? (a.options as Array<{ id: string; label: string }>) : undefined
  )
  return result('add_column', true,
    `Columna «${name}» (${type}) añadida a «${node.text}». col_id=${colId}`,
    [tableId])
}

function fillColumn(a: Record<string, unknown>): ExecutedAction {
  const tableId = a.table_id as string | undefined
  const columnId = a.column_id as string | undefined
  if (!tableId || !columnId) return result('fill_column', false, 'Faltan table_id o column_id.')
  const node = store.nodes.get(tableId)
  if (!node) return result('fill_column', false, 'Tabla no encontrada.')

  const updated: string[] = []
  const byId = a.values_by_row_id as Record<string, unknown> | undefined
  const arr = a.values as unknown[] | undefined
  const children = store.children(tableId)

  if (byId) {
    for (const [rowId, value] of Object.entries(byId)) {
      if (!store.nodes.get(rowId)) continue
      // CORRECTO: usa store.setPropValue que escribe en extraData._props del hijo
      store.setPropValue(rowId, columnId, value)
      updated.push(rowId)
    }
  } else if (Array.isArray(arr)) {
    for (let i = 0; i < arr.length && i < children.length; i++) {
      store.setPropValue(children[i].id, columnId, arr[i])
      updated.push(children[i].id)
    }
  } else {
    return result('fill_column', false, 'Falta values o values_by_row_id.')
  }
  return result('fill_column', true, `Columna ${columnId} rellenada en ${updated.length} filas.`, updated)
}

function addRow(a: Record<string, unknown>): ExecutedAction {
  const tableId = a.table_id as string | undefined
  if (!tableId) return result('add_row', false, 'Falta table_id.')
  const node = store.nodes.get(tableId)
  if (!node) return result('add_row', false, 'Tabla no encontrada.')

  const text = (a.text as string) || (a.title as string) || 'Nueva fila'
  const values = (a.values as Record<string, unknown> | undefined) || {}

  const created = store.createNode({
    text,
    parentId: tableId,
  })
  // CORRECTO: usa setPropValue para cada valor en extraData._props
  for (const [colId, value] of Object.entries(values)) {
    store.setPropValue(created.id, colId, value)
  }
  return result('add_row', true, `Fila «${text}» añadida.`, [created.id])
}

function changeView(a: Record<string, unknown>): ExecutedAction {
  const id = a.node_id as string | undefined
  if (!id) return result('change_view', false, 'Falta node_id.')
  const node = store.nodes.get(id)
  if (!node) return result('change_view', false, 'Nodo no encontrado.')
  const kind = (a.kind as string) || 'list'
  const viewBlock = kind === 'table' ? 'tabla'
                  : kind === 'kanban' ? 'kanban'
                  : kind === 'calendar' ? 'calendario'
                  : kind === 'list' ? 'lista' : kind
  let ed: Record<string, unknown> = {}
  try { ed = JSON.parse(node.extraData || '{}') } catch { /* ignore */ }
  ed.viewBlock = viewBlock
  ed._inline = '1'
  store.updateNode(id, { extraData: JSON.stringify(ed) })
  return result('change_view', true, `Vista cambiada a ${kind} en «${node.text}».`, [id])
}

function createResource(a: Record<string, unknown>): ExecutedAction {
  const text = (a.text as string) || 'Recurso'
  const url = (a.url as string) || ''
  const type = (a.type as string) || 'url'
  const tags = (a.tags as string[]) || []
  const parentId = (a.parent_id as string | undefined) || null

  const created = store.createNode({
    text,
    parentId,
    types: tags,
  })
  store.updateNode(created.id, {
    isResource: true,
    resourceUrl: url,
    resourceType: type,
    resourceStatus: 'pending',
  })
  return result('create_resource', true, `Recurso «${text}» creado.`, [created.id])
}

// ── F3 run_prompt ──────────────────────────────────────────────────────

interface SavedPrompt { id: string; name: string; body: string }

function runPrompt(a: Record<string, unknown>): ExecutedAction {
  const identifier = String((a.prompt_id as string) || (a.id as string) || (a.title as string) || '').trim()
  if (!identifier) return result('run_prompt', false, 'Falta prompt_id o title.')
  let prompts: SavedPrompt[] = []
  try { prompts = JSON.parse(localStorage.getItem('from_prompts_v1') || '[]') } catch { /* ignore */ }
  const lower = identifier.toLowerCase()
  const match = prompts.find(p =>
    p.id.toLowerCase() === lower
    || p.name.toLowerCase() === lower
    || p.name.toLowerCase().includes(lower)
  )
  if (!match) {
    const available = prompts.map(p => `«${p.name}»`).join(', ')
    return result('run_prompt', false,
      `Prompt no encontrado. Disponibles: ${available || 'ninguno'}`)
  }
  const input = String(a.input ?? '')
  let content = match.body
  if (content.includes('{{input}}')) content = content.replace(/\{\{input\}\}/g, input)
  else if (input) content = content + '\n\n' + input
  return result('run_prompt', true, `Prompt «${match.name}» cargado:\n\n${content}`)
}

function notImplemented(name: string): ExecutedAction {
  return result(name, false, `Acción «${name}» disponible en una fase futura.`)
}

function result(action: string, ok: boolean, summary: string, createdIds: string[] = []): ExecutedAction {
  return { action, ok, summary, createdIds }
}

/// Normaliza la fecha/hora que manda la IA antes de parsearla. Dos bugs reales
/// (Alberto, 21 jul) compartían la misma causa: el string llegaba con un sufijo
/// de zona horaria ("Z"/offset) etiquetando como UTC una hora que en realidad
/// era LOCAL — "15:00" guardado como "15:00Z" se mostraba como 17:00 en Madrid
/// verano. Y una fecha "solo día" ("2026-07-21", sin hora) el motor JS la trata
/// como medianoche UTC (no local) — se mostraba como evento "todo el día" a las
/// 02:00 en vez de medianoche. Aquí forzamos SIEMPRE hora local explícita: quita
/// cualquier sufijo de zona de un datetime, y completa "T00:00:00" (local, sin Z)
/// si solo viene la fecha — mismo criterio que ya usa correctamente
/// `utils/dates.ts` `makeDueISO()`/`NewEventModal.tsx`.
function parseDate(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || !raw) return undefined
  let normalized = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    normalized = `${normalized}T00:00:00`
  } else {
    const withZone = normalized.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?)(Z|[+-]\d{2}:?\d{2})$/)
    if (withZone) normalized = withZone[1]
  }
  const d = new Date(normalized)
  if (isNaN(d.getTime())) return undefined
  return d.toISOString()
}
