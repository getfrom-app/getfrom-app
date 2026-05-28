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

/**
 * Determina si el texto parece lenguaje natural (no es una query técnica ya).
 */
export function needsInterpretation(text: string): boolean {
  const t = text.trim()
  if (t.length < 4) return false
  if (t.startsWith('#') || t.startsWith('@') || t.startsWith('[[')) return false
  if (isSmartQuery(t)) return false
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
