/**
 * tagsHelper — Sistema de tags como árbol de nodos
 *
 * Jerarquía: 🏷 Tags → La Isla → Ops
 * Slug:      #la-isla  /  #la-isla/ops
 *
 * Reutiliza al máximo el sistema existente:
 *  - _tagDefinition en extraData → fuente de verdad para AI context
 *  - body del nodo → contexto de IA (ya leído por tagDefinitionsForNode)
 *  - _tagPrompt en hijos → prompts ya procesados por enrichTag()
 *
 * NO duplica: getTagDefNode(), tagDefinitionsForNode(), enrichTag()
 * AÑADE: organización en árbol, slug jerárquico, auto-setup
 */
import { store } from '../store/nodeStore'
import type { Node } from '../types'
import { structuralId } from './deterministicId'
import { findContextRoot, findRootByKey } from './rootLookup'

export const TAGS_ROOT_NAME = '🧠 Contexto'

// ── Slug helpers ──────────────────────────────────────────────────────────────

/** Convierte texto de nodo → slug de tag. "La Isla" → "la-isla" */
export function textToTagSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quitar acentos
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-\/]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Construye el slug completo de un nodo dentro del árbol Tags.
 * La Isla → "la-isla"
 * La Isla / Ops → "la-isla/ops"
 * Returns null si el nodo no está bajo el Tags root.
 */
export function getNodeTagSlug(nodeId: string): string | null {
  const tagsRoot = findTagsRoot()
  if (!tagsRoot) return null

  const parts: string[] = []
  let cur = store.getNode(nodeId)
  while (cur && cur.id !== tagsRoot.id) {
    parts.unshift(textToTagSlug(cur.text || ''))
    if (!cur.parentId) return null
    cur = store.getNode(cur.parentId) ?? undefined
  }
  if (!cur || cur.id !== tagsRoot.id) return null
  return parts.join('/')
}

// ── Root ──────────────────────────────────────────────────────────────────────

export function findTagsRoot(): Node | undefined {
  return findContextRoot()
}

export function getOrCreateTagsRoot(): Node {
  return findTagsRoot() ?? store.createNode({ text: TAGS_ROOT_NAME, parentId: null, predefinedId: structuralId('contexto') ?? undefined })
}

/** Nodo raíz de plantillas (📋 Plantillas). */
export function getPlantillasRoot(): Node | null {
  return findRootByKey('plantillas', '📋 Plantillas', 'Plantillas') ?? null
}

/** ¿El nodo es una plantilla? (hijo directo de 📋 Plantillas). */
export function isTemplateNode(nodeId: string): boolean {
  const root = getPlantillasRoot()
  if (!root) return false
  const n = store.getNode(nodeId)
  return !!n && !n.deletedAt && n.parentId === root.id
}

/** Plantillas disponibles (hijos de 📋 Plantillas). */
export function listTemplates(): Node[] {
  const root = getPlantillasRoot()
  if (!root) return []
  return store.children(root.id).filter(n => !n.deletedAt && (n.text || '').trim())
    .sort((a, b) => a.siblingOrder - b.siblingOrder)
}

/** La plantilla marcada para aplicarse a la nota diaria (o null). */
export function getDailyTemplate(): Node | null {
  for (const t of listTemplates()) {
    try { if (JSON.parse(t.extraData || '{}')._dailyTemplate === '1') return t } catch { /* */ }
  }
  return null
}

/** Marca/desmarca una plantilla como la que se aplica a la nota diaria.
 *  Solo una a la vez: al activar una, desactiva las demás. */
export function setDailyTemplate(nodeId: string, on: boolean): void {
  for (const t of listTemplates()) {
    let ed: Record<string, unknown> = {}
    try { ed = JSON.parse(t.extraData || '{}') } catch { /* */ }
    const shouldBeOn = on && t.id === nodeId
    const isOn = ed._dailyTemplate === '1'
    if (shouldBeOn && !isOn) { ed._dailyTemplate = '1'; store.updateNode(t.id, { extraData: JSON.stringify(ed) }) }
    else if (!shouldBeOn && isOn) { delete ed._dailyTemplate; store.updateNode(t.id, { extraData: JSON.stringify(ed) }) }
  }
}

/** Recurrencia de una plantilla. freq = día/semana/mes; interval = cada cuántos;
 *  weekday (0 dom…6 sáb) para semanas; monthday (1..31) para meses; start = ancla. */
export interface TemplateRecurrence {
  freq: 'day' | 'week' | 'month'
  interval: number
  weekday?: number
  monthday?: number
  start?: string   // ISO date-only (ancla para contar intervalos)
}

/** Lee la recurrencia (objeto) de una plantilla, o null. Convierte el formato
 *  antiguo ('weekly:D' / 'monthly:N') al nuevo de forma transparente. */
export function getTemplateRecurrence(nodeId: string): TemplateRecurrence | null {
  const n = store.getNode(nodeId)
  if (!n) return null
  let raw: unknown
  try { raw = JSON.parse(n.extraData || '{}')._recur } catch { return null }
  if (!raw) return null
  if (typeof raw === 'string') {
    if (raw.startsWith('weekly:')) return { freq: 'week', interval: 1, weekday: parseInt(raw.slice(7), 10) }
    if (raw.startsWith('monthly:')) return { freq: 'month', interval: 1, monthday: parseInt(raw.slice(8), 10) }
    return null
  }
  const o = raw as TemplateRecurrence
  if (o && (o.freq === 'day' || o.freq === 'week' || o.freq === 'month')) return o
  return null
}

export function setTemplateRecurrence(nodeId: string, recur: TemplateRecurrence | null): void {
  const n = store.getNode(nodeId)
  if (!n) return
  try {
    const ed = JSON.parse(n.extraData || '{}')
    if (recur) ed._recur = recur; else delete ed._recur
    store.updateNode(nodeId, { extraData: JSON.stringify(ed) })
  } catch { /* */ }
}

const dayMs = 86400000
const atMidnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

/** ¿Toca la recurrencia en `date`? */
export function recurrenceMatches(r: TemplateRecurrence, date: Date): boolean {
  const interval = Math.max(1, r.interval || 1)
  const start = r.start ? new Date(r.start) : new Date(2026, 0, 1)
  const d0 = atMidnight(date)
  const s0 = atMidnight(start)
  if (d0 < s0) return false
  if (r.freq === 'day') {
    const days = Math.round((d0 - s0) / dayMs)
    return days % interval === 0
  }
  if (r.freq === 'week') {
    if (typeof r.weekday === 'number' && date.getDay() !== r.weekday) return false
    const weeks = Math.floor((d0 - s0) / (7 * dayMs))
    return weeks % interval === 0
  }
  // month
  if (typeof r.monthday === 'number' && date.getDate() !== r.monthday) return false
  const months = (date.getFullYear() - start.getFullYear()) * 12 + (date.getMonth() - start.getMonth())
  return months >= 0 && months % interval === 0
}

/** Aplica las plantillas recurrentes que toquen en `date` como secciones hijas
 *  de la nota del día (sin duplicar). Cada sección se marca con _fromTemplate. */
export function applyRecurringTemplatesToDay(dayNodeId: string, date: Date): void {
  for (const t of listTemplates()) {
    const recur = getTemplateRecurrence(t.id)
    if (!recur || !recurrenceMatches(recur, date)) continue
    // No duplicar: ¿ya hay una sección de esta plantilla en el día?
    const exists = store.children(dayNodeId).some(c => {
      if (c.deletedAt) return false
      try { return JSON.parse(c.extraData || '{}')._fromTemplate === t.id } catch { return false }
    })
    if (exists) continue
    const sibs = store.children(dayNodeId).filter(n => !n.deletedAt)
    const maxOrder = sibs.length > 0 ? Math.max(...sibs.map(c => c.siblingOrder)) : 0
    const section = store.createNode({ text: t.text, parentId: dayNodeId, siblingOrder: maxOrder + 1000 })
    store.updateNode(section.id, { extraData: JSON.stringify({ _fromTemplate: t.id }) })
    applyTemplate(t.id, section.id)
  }
}

/**
 * applyTemplate — copia (recursivamente) el contenido de una plantilla como hijos del
 * nodo destino (p.ej. la nota diaria). Copia texto/body/status/types; preserva el
 * orden. No mueve la plantilla original.
 */
export function applyTemplate(templateNodeId: string, targetNodeId: string): void {
  const copyChildren = (srcId: string, dstId: string) => {
    const kids = store.children(srcId).filter(n => !n.deletedAt).sort((a, b) => a.siblingOrder - b.siblingOrder)
    for (const child of kids) {
      const copy = store.createNode({
        text: child.text,
        parentId: dstId,
        types: child.types ? [...child.types] : [],
      })
      const patch: Partial<typeof child> = {}
      if (child.body) patch.body = child.body
      if (child.status) patch.status = child.status
      if (Object.keys(patch).length) store.updateNode(copy.id, patch)
      copyChildren(child.id, copy.id)
    }
  }
  copyChildren(templateNodeId, targetNodeId)
}

/**
 * cleanupNonAgendaContexts — limpia asignaciones de contexto HEREDADAS en nodos que
 * no deben tenerlas: los propios nodos de contexto (hijos de 🧠 Contexto, que tenían
 * su propio slug en types[] → mostraban un chip de sí mismos) y las raíces de sistema
 * fuera de Agenda. Quita del types[] los slugs que correspondan a un contexto y los
 * flags _autoContextId/_autoContextConfidence/_contextManuallySet de extraData.
 * Idempotente. La clasificación nueva ya está acotada a la Agenda (isContextAnchor).
 */
export function cleanupNonAgendaContexts(): void {
  const ctxRoot = findContextRoot()
  if (!ctxRoot) return
  const slugify = (t: string) => t.toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9\-\/]/g, '')
  const contextNodes = store.children(ctxRoot.id).filter(n => !n.deletedAt && n.text)
  const ctxSlugs = new Set(contextNodes.map(n => slugify(n.text)))
  const ctxNames = new Set(contextNodes.map(n => n.text))

  const strip = (node: Node) => {
    let changed = false
    const patch: Partial<Node> = {}
    const types = node.types || []
    const clean = types.filter(t => !ctxSlugs.has(t) && !ctxNames.has(t))
    if (clean.length !== types.length) { patch.types = clean; changed = true }
    try {
      const ed = JSON.parse(node.extraData || '{}')
      if (ed._autoContextId !== undefined || ed._autoContextConfidence !== undefined || ed._contextManuallySet !== undefined) {
        delete ed._autoContextId; delete ed._autoContextConfidence; delete ed._contextManuallySet
        patch.extraData = JSON.stringify(ed); changed = true
      }
    } catch { /* extraData no parseable */ }
    if (changed) store.updateNode(node.id, patch)
  }

  // Nodos de contexto en sí mismos
  for (const ctx of contextNodes) strip(ctx)
  // Raíces de sistema fuera de Agenda
  for (const name of ['📋 Plantillas', '⚡ Prompts', '🤖 Agentes', '📊 Paneles', '🔍 Filtros']) {
    const root = store.allActive().find(n => (n.text || '').trim() === name)
    if (root) strip(root)
  }
}

// ── Buscar tag por slug ───────────────────────────────────────────────────────

/**
 * Busca el nodo correspondiente a un slug dentro del árbol Tags.
 * "la-isla"     → nodo "La Isla" hijo directo de Tags
 * "la-isla/ops" → nodo "Ops" hijo de "La Isla"
 * Returns null si no encuentra.
 */
export function findTagNodeBySlug(slug: string): Node | null {
  const root = findTagsRoot()
  if (!root) return null

  const parts = slug.toLowerCase().split('/')
  let parent = root
  for (const part of parts) {
    const match = store.children(parent.id).find(c =>
      !c.deletedAt && textToTagSlug(c.text || '') === part
    )
    if (!match) return null
    parent = match
  }
  return parent.id === root.id ? null : parent
}

/**
 * Busca el nodo de definición de un tag por su nombre/slug.
 * Primero mira en el árbol Tags (nueva forma), luego en _tagDefinition (legacy).
 */
export function resolveTagDefNode(tagName: string): Node | null {
  // 1. Buscar en árbol Tags por slug
  const bySlug = findTagNodeBySlug(tagName)
  if (bySlug) return bySlug

  // 2. Fallback: sistema legacy (_tagDefinition en extraData)
  return store.getTagDefNode(tagName)
}

// ── Auto-setup de nodos bajo Tags ────────────────────────────────────────────

/**
 * Cuando un nodo se crea/modifica bajo el árbol Tags, asegura que tenga
 * _tagDefinition en extraData con el slug correcto.
 * Llamar después de crear o renombrar un nodo bajo Tags.
 */
export function ensureTagDefinition(nodeId: string): void {
  const slug = getNodeTagSlug(nodeId)
  if (!slug) return // no está bajo Tags

  const node = store.getNode(nodeId)
  if (!node) return

  try {
    const ed = JSON.parse(node.extraData || '{}')
    if (ed._tagDefinition !== slug) {
      ed._tagDefinition = slug
      store.updateNode(nodeId, { extraData: JSON.stringify(ed) })
    }
  } catch { /* ignore */ }
}

// ── Obtener contexto de AI para un slug ──────────────────────────────────────

/**
 * Devuelve el contexto completo de un tag para inyectar a la IA.
 * Incluye: body del tag + body de subtags con sus nombres.
 * Compatible con el formato que ya espera aiChatStore.enrichTag().
 */
export function getTagAIContext(slug: string): string | null {
  const node = resolveTagDefNode(slug)
  if (!node?.body?.trim() && !node) return null

  const parts: string[] = []
  if (node?.body?.trim()) parts.push(node.body.trim())

  // Incluir subtags si los hay
  if (node) {
    const children = store.children(node.id).filter(c => !c.deletedAt && c.body?.trim())
    for (const child of children) {
      const childSlug = getNodeTagSlug(child.id) || textToTagSlug(child.text || '')
      parts.push(`\n**#${childSlug}:**\n${child.body!.trim()}`)
    }
  }

  return parts.join('\n') || null
}

// ── Auto-creación de tag en el árbol ─────────────────────────────────────────

/**
 * Asegura que existe un nodo para el tag (o subtag) dado.
 * Si el árbol Tags no existe, lo crea.
 * Si el tag tiene jerarquía ("la-isla/ops"), crea cada nivel.
 *
 * "la-isla"     → 🏷 Tags → La Isla
 * "la-isla/ops" → 🏷 Tags → La Isla → Ops
 *
 * Returns el nodo hoja del tag.
 */
export function ensureTagInTree(slug: string): Node {
  const root = getOrCreateTagsRoot()

  const parts = slug.toLowerCase().split('/').filter(Boolean)
  let parent = root

  for (const part of parts) {
    const existing = store.children(parent.id).find(c =>
      !c.deletedAt && textToTagSlug(c.text || '') === part
    )
    if (existing) {
      parent = existing
    } else {
      // Convertir slug → nombre legible: "la-isla" → "La Isla"
      const displayName = part
        .replace(/-/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
      const newNode = store.createNode({ text: displayName, parentId: parent.id })
      // Auto-poner _tagDefinition para que la IA lo reconozca
      ensureTagDefinition(newNode.id)
      parent = newNode
    }
  }

  return parent
}

// ── Inicialización ────────────────────────────────────────────────────────────

/**
 * Elimina nodos huérfanos bajo Tags que no tienen hijos ni body ni fueron creados
 * con intención (texto muy corto < 3 chars y sin contenido). Limpia los accidentes
 * de la auto-creación keystroke-by-keystroke.
 */
export function cleanupSpuriousTags(): void {
  const root = findTagsRoot()
  if (!root) return
  function clean(parentId: string) {
    for (const child of store.children(parentId)) {
      if (child.deletedAt) continue
      clean(child.id) // limpiar hijos primero
      const text = (child.text || '').trim()
      const hasChildren = store.children(child.id).filter(c => !c.deletedAt).length > 0
      const hasBody = !!(child.body?.trim())
      // Eliminar si: texto muy corto (< 3 chars) Y sin hijos ni body
      if (text.length < 3 && !hasChildren && !hasBody) {
        store.updateNode(child.id, { deletedAt: new Date().toISOString() })
      }
    }
  }
  clean(root.id)
}

/**
 * migrateTagsToContexto — renombra el nodo raíz '🏷 Tags' a '🧠 Contexto'
 * si aún existe el nombre antiguo. Solo se ejecuta una vez.
 */
export function migrateTagsToContexto(): void {
  const OLD_NAME = '🏷 Tags'
  const oldRoot = store.children(null).find(n => !n.deletedAt && n.text === OLD_NAME)
  if (oldRoot) {
    store.updateNode(oldRoot.id, { text: TAGS_ROOT_NAME })
  }
}

// Plantilla de onboarding para el perfil IA — se pre-rellena al crearlo.
// El usuario edita y borra las instrucciones que no necesite.
const PERFIL_IA_ONBOARDING = `Cuéntale a From quién eres para que te entienda sin que tengas que explicarlo cada vez.

## Quién soy
Nombre:
Ubicación:
Profesión / actividad principal:

## Mis proyectos
(Describe brevemente cada proyecto o área de tu vida. From usará esto para asignar contexto automáticamente.)

## Cómo quiero que me responda
- Directo, sin rodeos, en español
(Añade tus preferencias)

## Contexto adicional
(Cualquier cosa que From deba saber siempre: familia, rutinas, herramientas habituales…)`

/**
 * ensurePerfilInsideContexto — garantiza que el nodo Perfil IA existe
 * y está dentro de 🧠 Contexto. Se llama en cada arranque de la app.
 *
 * Casos que maneja:
 *   · No existe → lo crea dentro de Contexto con plantilla de onboarding
 *   · Existe en root (parentId=null) → lo mueve dentro de Contexto
 *   · Existe con padre → no hace nada
 */
export function ensurePerfilInsideContexto(): void {
  // El Perfil IA NO es un contexto ni vive en el árbol: es una raíz flotante
  // (parentId=null) accesible solo desde el menú ···. Antes colgaba de 🧠 Contexto.
  const perfil = store.perfilIANode?.() ?? null

  if (!perfil) {
    // Primera vez: crear como raíz flotante (fuera del árbol home y de Contextos)
    const newPerfil = store.createNode({
      text: '🧠 Perfil de IA',
      parentId: null,
      extraData: { _perfilIA: '1' },
      predefinedId: structuralId('perfil') ?? undefined,
    })
    // Las secciones como nodos hijos — el usuario rellena en el outliner normal
    const sections = [
      { title: 'Quién soy', children: ['Nombre:', 'Ubicación:', 'Profesión / actividad principal:'] },
      { title: 'Mis proyectos', children: ['Describe aquí tus proyectos. From los usará para asignar contexto automáticamente.'] },
      { title: 'Cómo quiero que me responda', children: ['Directo, sin rodeos, en español', '(Añade tus preferencias)'] },
      { title: 'Contexto adicional', children: ['(Familia, rutinas, herramientas habituales, lo que From deba saber siempre)'] },
    ]
    for (const section of sections) {
      const sNode = store.createNode({ text: section.title, parentId: newPerfil.id })
      store.updateNode(sNode.id, { isCollapsed: false })
      for (const child of section.children) {
        store.createNode({ text: child, parentId: sNode.id })
      }
    }
    return
  }

  // Migración: si el Perfil quedó dentro de 🧠 Contexto (o de cualquier otro nodo),
  // sacarlo a raíz flotante (parentId=null) — nunca debió ser un contexto.
  if (perfil.parentId !== null) {
    store.updateNode(perfil.id, { parentId: null })
  }

  // ── Migración: si tiene .body pero no nodos hijos, convertir a nodos ──────
  // Esto arregla nodos creados antes de la actualización que usaban el editor
  // de body (markdown editor) en lugar del outliner nativo de From.
  const hasBody = !!(perfil.body?.trim())
  const hasChildren = store.children(perfil.id).filter(n => !n.deletedAt).length > 0

  if (hasBody && !hasChildren) {
    // El body puede ser: el template antiguo con secciones ## o texto libre del usuario
    const bodyText = perfil.body!.trim()
    const sections = bodyText.split(/\n{2,}/).map(s => s.trim()).filter(Boolean)

    if (sections.length > 0) {
      for (const section of sections) {
        const lines = section.split('\n').map(l => l.trim()).filter(Boolean)
        if (lines.length === 0) continue

        // Primera línea es el título del nodo (si empieza con ## la limpiamos)
        const title = lines[0].replace(/^#+\s*/, '').trim()
        const sNode = store.createNode({ text: title, parentId: perfil.id })
        store.updateNode(sNode.id, { isCollapsed: false })

        // Resto de líneas → nodos hijos
        for (const line of lines.slice(1)) {
          const clean = line.replace(/^[-*]\s*/, '').trim()
          if (clean) store.createNode({ text: clean, parentId: sNode.id })
        }
      }
    } else {
      // Texto simple → un nodo por línea
      for (const line of bodyText.split('\n').map(l => l.trim()).filter(Boolean)) {
        store.createNode({ text: line, parentId: perfil.id })
      }
    }

    // Limpiar el body ahora que el contenido está en nodos
    store.updateNode(perfil.id, { body: null })
  }
}

/**
 * ensurePlantillasNode — crea el nodo raíz '📋 Plantillas' si no existe.
 *
 * Problemas que resuelve:
 * - StrictMode de React invoca el effect dos veces → flag _plantillasDone
 * - Array stale: NO se guarda el array inicial; se re-consulta el store tras
 *   cada mutación para que las eliminaciones sean visibles antes de continuar
 */
let _plantillasDone = false
export function ensurePlantillasNode(): void {
  if (_plantillasDone) return
  _plantillasDone = true

  const PLANTILLAS_NAME = '📋 Plantillas'

  // Helper que siempre consulta el store fresco (evita array stale)
  // IMPORTANTE: busca en TODOS los nodos (no solo root) porque algunos pueden
  // haber quedado bajo Agenda u otro nodo por bugs anteriores
  const getAll = () => store.allActive().filter(
    n => n.text === PLANTILLAS_NAME || n.text === 'Plantillas'
  )

  // Paso 1: limpiar duplicados (borrar todos excepto el primero)
  const initial = getAll()
  for (const dup of initial.slice(1)) store.deleteNode(dup.id)

  // Paso 2: consultar de nuevo tras las eliminaciones
  const remaining = getAll()

  if (remaining.length === 0) {
    // No existe ninguno → crear en root con orden fijo
    store.createNode({ text: PLANTILLAS_NAME, parentId: null, siblingOrder: 9997, predefinedId: structuralId('plantillas') ?? undefined })
  } else {
    const keeper = remaining[0]
    // Asegurar solo el nombre correcto. NO forzar parentId=null: la raíz 🏠 From
    // reparenta Plantillas bajo ella (ensureHomeRootAndReparent); forzar null aquí
    // la devolvería a la raíz en cada arranque, peleando con el reparent.
    if (keeper.text !== PLANTILLAS_NAME) {
      store.updateNode(keeper.id, { text: PLANTILLAS_NAME })
    }
  }
}

/**
 * Asegura que todos los nodos bajo Tags tienen _tagDefinition sincronizado.
 * Llamar una vez al arrancar el store (tras initialLoad).
 */
export function syncTagDefinitions(): void {
  const root = findTagsRoot()
  if (!root) return

  function processNode(nodeId: string) {
    ensureTagDefinition(nodeId)
    for (const child of store.children(nodeId)) {
      if (!child.deletedAt) processNode(child.id)
    }
  }

  for (const child of store.children(root.id)) {
    if (!child.deletedAt) processNode(child.id)
  }
}
