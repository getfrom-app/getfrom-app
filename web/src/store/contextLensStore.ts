// Lente de contexto GLOBAL: filtra la app por un contexto. null = sin lente.
// Estado mínimo observable (mismo patrón que otros stores ligeros). Persistente.
import { useSyncExternalStore } from 'react'

const KEY = 'from_context_lens'
let activeId: string | null = (() => { try { return localStorage.getItem(KEY) || null } catch { return null } })()
const listeners = new Set<() => void>()

export function getLensContextId(): string | null { return activeId }

export function setLensContextId(id: string | null): void {
  if (id === activeId) return
  activeId = id
  try { id ? localStorage.setItem(KEY, id) : localStorage.removeItem(KEY) } catch { /* ignore */ }
  listeners.forEach(l => l())
}

function subscribe(l: () => void): () => void { listeners.add(l); return () => { listeners.delete(l) } }

/** Hook reactivo: devuelve el id del contexto activo de la lente (o null). */
export function useLensContextId(): string | null {
  return useSyncExternalStore(subscribe, getLensContextId, getLensContextId)
}
