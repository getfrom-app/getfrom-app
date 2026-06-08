import { describe, it, expect, beforeEach } from 'vitest'
import { store } from '../store/nodeStore'
import {
  ensureHomeRootAndReparent,
  findHomeRoot,
  classifyNodeRoot,
  HOME_ROOT_NAME,
} from '../utils/homeHelper'

// Sin mock de api/client: getToken() devuelve null → structuralId() null →
// findRootByKey cae al fallback por texto. Es justo el camino a blindar
// (también cubre cuentas legacy con ids aleatorios). El reparent debe funcionar.

// Crea las raíces de sistema en parentId=null, como en una cuenta real antes de
// introducir 🏠 From.
function seedRoots() {
  store.nodes.clear()
  const agenda     = store.createNode({ text: '📅 Agenda',     parentId: null })
  const contexto   = store.createNode({ text: '🧠 Contexto',   parentId: null })
  const prompts    = store.createNode({ text: '⚡ Prompts',     parentId: null })
  const agentes    = store.createNode({ text: '🤖 Agentes',    parentId: null })
  const plantillas = store.createNode({ text: '📋 Plantillas', parentId: null })
  const papelera   = store.createNode({ text: '🗑 Papelera',   parentId: null })
  const paneles    = store.createNode({ text: '📊 Paneles',    parentId: null })
  return { agenda, contexto, prompts, agentes, plantillas, papelera, paneles }
}

describe('homeHelper — raíz 🏠 From + reparent', () => {
  beforeEach(() => { store.nodes.clear() })

  it('crea 🏠 From y reparenta las 5 raíces visibles bajo ella', () => {
    const r = seedRoots()
    ensureHomeRootAndReparent()

    const home = findHomeRoot()
    expect(home).toBeTruthy()
    expect(home!.text).toBe(HOME_ROOT_NAME)

    // Las 5 visibles cuelgan de home
    for (const id of [r.agenda.id, r.contexto.id, r.prompts.id, r.agentes.id, r.plantillas.id]) {
      expect(store.getNode(id)!.parentId).toBe(home!.id)
    }
    // Papelera y Paneles permanecen en la raíz (fuera del árbol home)
    expect(store.getNode(r.papelera.id)!.parentId).toBeNull()
    expect(store.getNode(r.paneles.id)!.parentId).toBeNull()

    // children(home) = exactamente esas 5
    const homeChildren = store.children(home!.id).filter(n => !n.deletedAt)
    expect(homeChildren.length).toBe(5)
  })

  it('Agenda queda primera (siblingOrder 1)', () => {
    const r = seedRoots()
    ensureHomeRootAndReparent()
    const home = findHomeRoot()!
    const ordered = store.children(home.id).filter(n => !n.deletedAt)
      .sort((a, b) => a.siblingOrder - b.siblingOrder)
    expect(ordered[0].id).toBe(r.agenda.id)
    expect(store.getNode(r.agenda.id)!.siblingOrder).toBe(1)
  })

  it('es idempotente: ejecutar 2 veces no crea otra home ni re-mueve', () => {
    seedRoots()
    ensureHomeRootAndReparent()
    const home1 = findHomeRoot()!
    const agendaParent1 = store.getNode(store.children(home1.id)[0].id)!.parentId

    ensureHomeRootAndReparent()
    const homes = store.allActive().filter(n => n.text === HOME_ROOT_NAME)
    expect(homes.length).toBe(1)              // no duplica la raíz home
    expect(findHomeRoot()!.id).toBe(home1.id) // misma raíz
    // los parents siguen apuntando a la misma home
    const agendaParent2 = store.getNode(store.children(home1.id)[0].id)!.parentId
    expect(agendaParent2).toBe(agendaParent1)
  })

  it('classifyNodeRoot detecta el tipo por ancestro', () => {
    const r = seedRoots()
    ensureHomeRootAndReparent()

    // hijos profundos de cada raíz de configuración
    const agente = store.createNode({ text: 'Mi agente', parentId: r.agentes.id })
    const agenteSub = store.createNode({ text: 'config', parentId: agente.id })
    const prompt = store.createNode({ text: 'Mi prompt', parentId: r.prompts.id })
    const ctx = store.createNode({ text: 'Trabajo', parentId: r.contexto.id })
    const diaBullet = store.createNode({ text: 'tarea de hoy', parentId: r.agenda.id })
    const plantilla = store.createNode({ text: 'Plantilla X', parentId: r.plantillas.id })

    expect(classifyNodeRoot(agente.id)).toBe('agent')
    expect(classifyNodeRoot(agenteSub.id)).toBe('agent')   // descendiente profundo
    expect(classifyNodeRoot(prompt.id)).toBe('prompt')
    expect(classifyNodeRoot(ctx.id)).toBe('context')
    expect(classifyNodeRoot(diaBullet.id)).toBeNull()      // Agenda → sin panel
    expect(classifyNodeRoot(plantilla.id)).toBe('template') // Plantillas → panel de plantilla
    // Las raíces MISMAS no abren propiedades (muestran su lista en el centro)
    expect(classifyNodeRoot(r.agentes.id)).toBeNull()
    expect(classifyNodeRoot(r.prompts.id)).toBeNull()
    expect(classifyNodeRoot(r.contexto.id)).toBeNull()
    expect(classifyNodeRoot(r.plantillas.id)).toBeNull()
  })
})
