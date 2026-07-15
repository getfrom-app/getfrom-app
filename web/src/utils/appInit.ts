/**
 * appInit — inicialización de nodos de sistema y migraciones que deben correr en
 * CADA arranque de la app, tras store.initialLoad().
 *
 * Hasta el 15 jul 2026 esta cadena solo vivía inline en MainLayout.tsx (la UI v1,
 * montada en /v1/*). Desde el pivote a v2 chat-first, /app (ruta por defecto) monta
 * V2App.tsx en su lugar, que nunca llamaba a esta cadena — ensureAgentesNode,
 * ensurePromptsNode, ensurePlantillasNode, ensureAtajosNode, ensurePapeleraNode y
 * el resto de migraciones de Perfil/Contexto eran código muerto para cualquier
 * usuario que solo usara v2 (la app principal). Un usuario 100% nuevo en v2 no
 * recibía ni los agentes/prompts predefinidos ni el resto de nodos de sistema.
 * Extraído a función compartida para que MainLayout (v1) y V2App (v2) llamen
 * exactamente a la misma cadena, sin duplicar ni divergir con el tiempo.
 */
import { store } from '../store/nodeStore'
import { syncTagDefinitions, cleanupSpuriousTags, migrateTagsToContexto, ensurePerfilInsideContexto, ensurePlantillasNode, cleanupNonAgendaContexts } from './tagsHelper'
import { ensureAtajosNode, migrateLocalStorageShortcuts, migrateNodeShortcutsToFavorites } from './atajosHelper'
import { ensureAgentesNode, migrateAgentsV2, migrateAgentMetaChildren } from './agentesHelper'
import { cleanupOrphanProfileKnowledge, migrateKnowledgeNodesToFromly, migrateContextKnowledgeToMemoria } from '../api/userKnowledge'
import { ensurePapeleraNode } from './papeleraHelper'
import { ensureHomeRootAndReparent } from './homeHelper'
import { ensurePromptsNode } from './promptsHelper'
import { relocateRootDiariesToAgenda, cleanupYearMonthContexts } from './agendaHelper'
import { revertContextReferenceOnce } from './migrateContextReference'

let _ranInThisSession = false

/** Idempotente por función individual (cada ensure/migrate comprueba su propio
 *  estado), pero además se guarda con un flag de módulo para no repetir la cadena
 *  completa dos veces en la misma sesión si MainLayout y V2App llegaran a montarse
 *  ambos (no debería pasar, pero es una salvaguarda barata). */
export async function runStartupMigrations(): Promise<void> {
  if (_ranInThisSession) return
  _ranInThisSession = true

  migrateTagsToContexto()
  ensurePerfilInsideContexto()
  cleanupOrphanProfileKnowledge()
  migrateKnowledgeNodesToFromly()
  migrateContextKnowledgeToMemoria()
  ensurePlantillasNode()
  ensureAtajosNode()
  migrateLocalStorageShortcuts()
  migrateNodeShortcutsToFavorites()
  migrateAgentsV2()
  ensureAgentesNode()
  migrateAgentMetaChildren()
  ensurePromptsNode()
  ensurePapeleraNode()
  ensureHomeRootAndReparent()
  await relocateRootDiariesToAgenda()
  cleanupYearMonthContexts()
  cleanupNonAgendaContexts()
  cleanupSpuriousTags()
  syncTagDefinitions()
  // Persistir ya: si el usuario recarga antes del debounce, los nodos de sistema
  // recién creados no deben recrearse en cada recarga.
  await store.sync(true)
  try {
    const r = revertContextReferenceOnce()
    if (r && r.moved > 0) console.info(`[from] reversión conocimiento→contexto: ${r.moved} nodos`)
  } catch (e) { console.warn('[from] reversión conocimiento→contexto falló:', e) }
}
