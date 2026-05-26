// MARK: - aiChatExecutor (web)
//
// Ejecuta una acción de chat IA (extraída del bloque from-action) usando
// nodeStore. Paridad con AIChatExecutor.swift (Mac).

import { store } from './nodeStore'
import type { ExecutedAction } from './aiChatStore'

export async function executeChatAction(
  action: Record<string, unknown>,
  _sessionId: string
): Promise<ExecutedAction> {
  const name = (action.action as string) || ''
  switch (name) {
    case 'create_note':    return createNote(action)
    case 'create_task':    return createTask(action)
    case 'create_event':   return createEvent(action)
    case 'update_node':    return updateNode(action)
    case 'read_node':      return readNode(action)
    case 'find_nodes':     return findNodes(action)
    case 'add_column':     return addColumn(action)
    case 'fill_column':    return fillColumn(action)
    case 'add_row':        return addRow(action)
    case 'change_view':    return changeView(action)
    case 'create_resource':return createResource(action)
    case 'run_prompt':     return runPrompt(action)
    default:
      return result(name || 'unknown', false, `Acción desconocida: ${name}`)
  }
}

function createNote(a: Record<string, unknown>): ExecutedAction {
  const text = (a.text as string) || 'Nota sin título'
  const body = a.body as string | undefined
  const tags = (a.tags as string[]) || []
  const parentId = (a.parent_id as string | undefined) || null

  // Si no hay parent_id explícito, crear bajo la nota diaria de hoy
  // (paridad con createTask y Mac — mejor UX que soltar en raíz).
  const created = store.createNode({
    text,
    parentId: parentId ?? store.todayDiary()?.id ?? null,
    types: tags,
    extraData: {},
  })
  if (body) store.updateNode(created.id, { body })
  const tagPart = tags.length > 0 ? ` con tags #${tags.join(' #')}` : ''
  return result('create_note', true, `Nota «${text}» creada${tagPart}.`, [created.id])
}

function createTask(a: Record<string, unknown>): ExecutedAction {
  const text = (a.text as string) || 'Tarea'
  const tags = (a.tags as string[]) || []
  const due = parseDate(a.due)
  const priority = a.priority as string | undefined
  const parentId = (a.parent_id as string | undefined) || null

  const created = store.createNode({
    text,
    parentId: parentId ?? store.todayDiary()?.id ?? null,
    isTask: true,
    types: [...tags, 'tarea'],
    extraData: { _atomic: '1', _inline: '1' },
  })
  const updates: Record<string, unknown> = { status: 'pending' }
  if (due) updates.due = due
  if (priority) updates.priority = priority
  store.updateNode(created.id, updates)
  const datePart = due ? ` para ${new Date(due).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}` : ''
  return result('create_task', true, `Tarea «${text}»${datePart} creada.`, [created.id])
}

function createEvent(a: Record<string, unknown>): ExecutedAction {
  const text = (a.text as string) || 'Evento'
  const tags = (a.tags as string[]) || []
  const due = parseDate(a.due)
  if (!due) return result('create_event', false, "Falta 'due' (ISO 8601).")
  const dueEnd = parseDate(a.due_end)
  const location = a.location as string | undefined

  const created = store.createNode({
    text,
    parentId: null,
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
  if (typeof a.body === 'string') updates.body = a.body
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
  const schema = parsePropsArray(node.props ?? null)
  const colId = 'col_' + Math.random().toString(36).slice(2, 12)
  const newCol: Record<string, unknown> = { id: colId, name, type }
  if (Array.isArray(a.options)) newCol.options = a.options
  schema.push(newCol)
  store.updateNode(tableId, { props: JSON.stringify(schema) })
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
      const child = store.nodes.get(rowId)
      if (!child) continue
      const props = parsePropsObject(child.props ?? null)
      props[columnId] = value
      store.updateNode(rowId, { props: JSON.stringify(props) })
      updated.push(rowId)
    }
  } else if (Array.isArray(arr)) {
    for (let i = 0; i < arr.length && i < children.length; i++) {
      const child = children[i]
      const props = parsePropsObject(child.props ?? null)
      props[columnId] = arr[i]
      store.updateNode(child.id, { props: JSON.stringify(props) })
      updated.push(child.id)
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
  if (Object.keys(values).length > 0) {
    store.updateNode(created.id, { props: JSON.stringify(values) })
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

function parseDate(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || !raw) return undefined
  const d = new Date(raw)
  if (isNaN(d.getTime())) return undefined
  return d.toISOString()
}
