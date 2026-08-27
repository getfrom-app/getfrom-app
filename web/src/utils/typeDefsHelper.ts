/**
 * typeDefsHelper — tipos de elemento personalizados por el usuario (Persona, Libro,
 * Película, Receta…), creados desde la columna derecha de Elementos («Tipos» → «+»).
 *
 * Un TIPO es un nodo bajo la raíz 🏷️ Tipos con un icono y un esquema de propiedades.
 * El esquema reutiliza LITERALMENTE el mismo mecanismo que las columnas de una tabla
 * (`store.getPropSchema/addPropColumn/...`, ver NodeTableView.tsx) — esos métodos solo
 * miran `extraData._props` del nodo que reciben, sin exigir que sea el padre real en el
 * árbol, así que el nodo-tipo funciona como "nodo-tabla" reutilizado para guardar el
 * esquema sin duplicar ni una línea de esa lógica.
 *
 * Un ELEMENTO de un tipo custom sigue siendo un documento normal (`_doc='1'`, se edita
 * con DocEditor como cualquier nota) más `_typeId` apuntando al nodo-tipo. Sus valores
 * de propiedad van en su propio `extraData._props` — igual que una fila de tabla,
 * vía `store.getPropValue`/`store.setPropValue`.
 */
import { store } from '../store/nodeStore'
import { structuralId } from './deterministicId'
import { findRootByKey } from './rootLookup'
import type { Node } from '../types'
import type { IconName } from '../v2/components/Icon'

const TIPOS_NAME = 'Tipos'
const DEFAULT_ICON: IconName = 'template'

export interface TypeDef {
  id: string
  name: string
  icon: IconName
  color?: string
}

function ed(n: Node): Record<string, unknown> {
  try { return JSON.parse(n.extraData || '{}') } catch { return {} }
}

export function getTiposRoot(): Node | undefined {
  return findRootByKey('tipos', TIPOS_NAME)
}

let _ensureDone = false
/** Crea la raíz 🏷️ Tipos si no existe. Llamar una vez al arranque (utils/appInit.ts). */
export function ensureTiposNode(): void {
  if (_ensureDone) return
  _ensureDone = true
  if (!getTiposRoot()) {
    store.createNode({
      text: TIPOS_NAME,
      parentId: null,
      siblingOrder: 9999,
      predefinedId: structuralId('tipos') ?? undefined,
    })
  }
}

export function isTypeDefNode(n: Node | null | undefined): boolean {
  if (!n) return false
  return ed(n)._typeDef === '1'
}

function toTypeDef(n: Node): TypeDef {
  const e = ed(n)
  return {
    id: n.id,
    name: n.text || '',
    icon: (typeof e._typeIcon === 'string' ? e._typeIcon : DEFAULT_ICON) as IconName,
    color: typeof e._typeColor === 'string' && e._typeColor ? e._typeColor : undefined,
  }
}

/** Todos los tipos custom del usuario, alfabético. */
export function listTypeDefs(): TypeDef[] {
  const root = getTiposRoot()
  if (!root) return []
  return store.allActive()
    .filter(n => n.parentId === root.id && isTypeDefNode(n))
    .map(toTypeDef)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function getTypeDef(id: string | null | undefined): TypeDef | undefined {
  if (!id) return undefined
  const n = store.getNode(id)
  if (!n || n.deletedAt || !isTypeDefNode(n)) return undefined
  return toTypeDef(n)
}

/** Esquema de propiedades del tipo — mismo shape que una tabla (PropDef[]). */
export function getTypeProps(typeId: string) {
  return store.getPropSchema(typeId)
}

/** Añade una opción nueva a una propiedad select/multi_select del TIPO (no del
 *  elemento) — se llama al escribir un valor nuevo en el panel de propiedades. */
export function addTypePropOption(typeId: string, propId: string, label: string): string {
  const schema = store.getPropSchema(typeId)
  const prop = schema.find(c => c.id === propId)
  const id = 'opt_' + Math.random().toString(36).slice(2, 8)
  if (prop) {
    prop.options = [...(prop.options || []), { id, label }]
    store.setPropSchema(typeId, schema)
  }
  return id
}

export function createTypeDef(name: string, icon: IconName, color?: string): TypeDef {
  ensureTiposNode()
  const root = getTiposRoot()!
  const created = store.createNode({ text: name.trim(), parentId: root.id })
  store.updateNode(created.id, {
    extraData: JSON.stringify({ _typeDef: '1', _typeIcon: icon, _typeColor: color || '', _props: [] }),
  })
  return { id: created.id, name: name.trim(), icon, color }
}

export function updateTypeDef(id: string, patch: { name?: string; icon?: IconName; color?: string }): void {
  const n = store.getNode(id)
  if (!n) return
  if (patch.name !== undefined && patch.name.trim() && patch.name.trim() !== n.text) {
    store.updateNode(id, { text: patch.name.trim() })
  }
  if (patch.icon !== undefined || patch.color !== undefined) {
    const cur = store.getNode(id)
    if (!cur) return
    const e = ed(cur)
    if (patch.icon !== undefined) e._typeIcon = patch.icon
    if (patch.color !== undefined) e._typeColor = patch.color
    store.updateNode(id, { extraData: JSON.stringify(e) })
  }
}

/** Borra el tipo (papelera). Los elementos ya creados con ese `_typeId` conservan
 *  sus propiedades guardadas, solo dejan de tener un tipo activo que las muestre. */
export function deleteTypeDef(id: string): string[] {
  return store.deleteNode(id)
}

/** `_typeId` del elemento, si lo tiene. */
export function elementTypeId(n: Node | null | undefined): string | null {
  if (!n) return null
  const v = ed(n)._typeId
  return typeof v === 'string' && v ? v : null
}

/** Crea un elemento (documento) nuevo del tipo dado, listo para abrir. */
export function createElementOfType(typeId: string, name: string): Node {
  const created = store.createNode({
    text: name.trim(),
    parentId: null,
    extraData: { _doc: '1', _typeId: typeId },
  })
  store.updateNode(created.id, { body: '<p></p>' })
  return store.getNode(created.id)!
}
