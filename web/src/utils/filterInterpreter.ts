/**
 * filterInterpreter — Traduce lenguaje natural a consulta de filtro de From.
 *
 * Usa Haiku con systemBudget (gratuito para todos los usuarios).
 * Responde solo la query técnica, sin texto adicional.
 */

import { aiInlineStream, getToken } from '../api/client'
import { isSmartQuery } from './wfFilter'

const FILTER_SYSTEM = `Eres un intérprete de filtros para From, una app de notas y tareas.
Convierte la petición del usuario a una consulta de filtro usando ÚNICAMENTE estos operadores:

  Fecha:    hoy · mañana · semana · mes · pasado · futuro
  Estado:   tarea · pendiente · hecho · vencido · evento
  Especial: sin-fecha · con-fecha · favorito · diario · recurso
  Lógica:   y (AND, mayor precedencia) · o (OR)

REGLAS:
1. Responde SOLO con la cadena de filtro. Sin texto, sin puntos, sin comillas.
2. AND tiene mayor precedencia que OR.
3. Máximo 8 palabras.
4. Si no entiendes, usa el operador más aproximado.

Ejemplos:
tareas de hoy → tarea y hoy
tareas pendientes de hoy y días pasados → pendiente y hoy o pendiente y pasado
lo que tengo vencido → vencido
eventos de esta semana → evento y semana
tareas sin fecha → tarea y sin-fecha
favoritos pendientes → favorito y pendiente
todo de hoy o mañana → hoy o mañana
tareas hechas → hecho
notas del diario de este mes → diario y mes`

// ── Tabla de sinónimos: frases y plurales → token canónico ────────────────
// Se aplica de forma local, sin IA, antes de cualquier interpretación.

// 1. Primero frases multi-palabra (orden importa: más largas primero)
const PHRASE_SYNONYMS: [RegExp, string][] = [
  [/\besta semana\b/gi, 'semana'],
  [/\bla semana\b/gi, 'semana'],
  [/\bsemana que viene\b/gi, 'semana'],
  [/\bsemana actual\b/gi, 'semana'],
  [/\bthis week\b/gi, 'semana'],
  [/\beste mes\b/gi, 'mes'],
  [/\bel mes\b/gi, 'mes'],
  [/\bsin fecha\b/gi, 'sin-fecha'],
  [/\bcon fecha\b/gi, 'con-fecha'],
  [/\bpor hacer\b/gi, 'pendiente'],
  [/\bsin hacer\b/gi, 'pendiente'],
  [/\bsin completar\b/gi, 'pendiente'],
  [/\bno hechas?\b/gi, 'pendiente'],
  [/\btomorrow\b/gi, 'mañana'],
  [/\btoday\b/gi, 'hoy'],
]

// 2. Tokens individuales (después de reemplazar frases)
const TOKEN_SYNONYMS: Record<string, string> = {
  // pendiente
  'pendientes': 'pendiente',
  'pending': 'pendiente',
  // hecho
  'hechas': 'hecho',
  'hechos': 'hecho',
  'done': 'hecho',
  'completado': 'hecho',
  'completados': 'hecho',
  'completadas': 'hecho',
  'terminado': 'hecho',
  'terminados': 'hecho',
  'terminada': 'hecho',
  'terminadas': 'hecho',
  'finished': 'hecho',
  // vencido
  'vencida': 'vencido',
  'vencidas': 'vencido',
  'vencidos': 'vencido',
  'atrasado': 'vencido',
  'atrasados': 'vencido',
  'atrasada': 'vencido',
  'atrasadas': 'vencido',
  'expirado': 'vencido',
  'pasado': 'vencido',
  'pasada': 'vencido',
  'pasados': 'vencido',
  'pasadas': 'vencido',
  'anteriores': 'vencido',
  'anterior': 'vencido',
  'overdue': 'vencido',
  'expired': 'vencido',
  // tarea
  'tareas': 'tarea',
  'task': 'tarea',
  'tasks': 'tarea',
  'acción': 'tarea',
  'accion': 'tarea',
  'acciones': 'tarea',
  'pendient': 'tarea',
  // evento
  'eventos': 'evento',
  'event': 'evento',
  'events': 'evento',
  'cita': 'evento',
  'citas': 'evento',
  'reunion': 'evento',
  'reunión': 'evento',
  'reuniones': 'evento',
  'meeting': 'evento',
  'meetings': 'evento',
  // semana
  'semanas': 'semana',
  'week': 'semana',
  'weekly': 'semana',
  // favorito
  'favoritos': 'favorito',
  'favorita': 'favorito',
  'favoritas': 'favorito',
  'starred': 'favorito',
  'favorite': 'favorito',
  'favorites': 'favorito',
  // diario
  'diarios': 'diario',
  'diary': 'diario',
  'journal': 'diario',
  // recurso
  'recursos': 'recurso',
  'resource': 'recurso',
  'resources': 'recurso',
  'enlace': 'recurso',
  'link': 'recurso',
}

/**
 * Normaliza sinónimos y plurales al token canónico del filtro.
 * Opera localmente sin IA. Devuelve null si no hay cambios.
 */
export function normalizeSynonyms(text: string): string | null {
  let t = text
  // Fase 1: frases multi-palabra
  for (const [regex, canonical] of PHRASE_SYNONYMS) {
    t = t.replace(regex, canonical)
  }
  // Fase 2: tokens individuales
  const tokens = t.trim().split(/\s+/)
  const normalized = tokens.map(tok => TOKEN_SYNONYMS[tok.toLowerCase()] ?? tok)
  const result = normalized.join(' ')
  return result !== text.trim() ? result : null
}

/**
 * Determina si el texto parece lenguaje natural (no es una query técnica ya).
 */
export function needsInterpretation(text: string): boolean {
  const t = text.trim()
  if (t.length < 4) return false
  if (t.startsWith('#') || t.startsWith('@') || t.startsWith('[[')) return false
  if (isSmartQuery(t)) return false
  // Si normalizeSynonyms lo resuelve localmente, no necesita IA
  if (normalizeSynonyms(t) !== null) return false
  return true
}

let _controller: AbortController | null = null

/**
 * Interpreta texto en lenguaje natural y devuelve la query técnica.
 * Cancela automáticamente llamadas anteriores pendientes.
 */
export async function interpretFilterQuery(naturalText: string): Promise<string | null> {
  if (!getToken()) return null
  if (!needsInterpretation(naturalText)) return null

  // Cancelar petición anterior si la hay
  _controller?.abort()
  _controller = new AbortController()

  try {
    const result = await aiInlineStream(
      naturalText,
      undefined,
      undefined,
      {
        systemBudget: true,
        systemOverride: FILTER_SYSTEM,
        signal: _controller.signal,
      }
    )
    const query = result.trim().toLowerCase()
    if (!query || query.length > 80) return null
    return query
  } catch {
    return null
  }
}

/** Cancela cualquier interpretación en curso. */
export function cancelInterpretation() {
  _controller?.abort()
  _controller = null
}
