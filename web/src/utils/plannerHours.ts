/**
 * plannerHours — la franja del día que pinta el planificador.
 *
 * Estaba fija en el código (`HOUR_START = 6`, `HOUR_END = 24`), así que quien
 * empieza a las 9 se comía tres horas vacías y quien trabaja de noche no veía
 * las suyas. Ahora se ajusta y, sobre todo, es LA MISMA en web y en la app:
 * vive en `assistant_prefs` del servidor (`day_start_hour`/`day_end_hour`), que
 * es lo que ya sincroniza el resto de preferencias del asistente (Alberto,
 * 22 ago 2026).
 *
 * En local se guarda una copia para que la rejilla no parpadee mientras llega
 * la respuesta del servidor.
 */
import { useSyncExternalStore } from 'react'

export interface PlannerHours { start: number; end: number }

// Las MISMAS claves que ya usaba Ajustes → Apariencia desde antes. No se
// inventa un ajuste nuevo: el que había existía y funcionaba, lo que pasaba es
// que el planificador lo ignoraba y pintaba 6→24 a pelo.
const K_START = 'from_day_start_hour'
const K_END = 'from_day_end_hour'
const EVENT = 'from-day-hours-changed'
export const DEFAULT_HOURS: PlannerHours = { start: 7, end: 22 }

function clamp(h: PlannerHours): PlannerHours {
  const start = Math.min(23, Math.max(0, Math.round(h.start)))
  const end = Math.min(24, Math.max(start + 1, Math.round(h.end)))
  return { start, end }
}

function read(): PlannerHours {
  try {
    const s = parseInt(localStorage.getItem(K_START) || '', 10)
    const e = parseInt(localStorage.getItem(K_END) || '', 10)
    if (isNaN(s) || isNaN(e)) return DEFAULT_HOURS
    return clamp({ start: s, end: e })
  } catch { return DEFAULT_HOURS }
}

const listeners = new Set<() => void>()
let cache: PlannerHours = read()

function emit() { cache = read(); listeners.forEach(l => l()) }

// Ajustes → Apariencia ya avisaba con este evento; escucharlo es lo que hace
// que la rejilla se redibuje al momento al cambiar la franja.
if (typeof window !== 'undefined') window.addEventListener(EVENT, emit)

/** Lo que debe usar cualquier vista para saber qué horas pintar. */
export function usePlannerHours(): PlannerHours {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb) } },
    () => cache,
    () => cache,
  )
}

export function getPlannerHours(): PlannerHours { return cache }

/** Guarda en local y sube al servidor para que la app use la misma franja. */
export async function setPlannerHours(next: PlannerHours, apiBase?: string, token?: string): Promise<void> {
  const v = clamp(next)
  localStorage.setItem(K_START, String(v.start))
  localStorage.setItem(K_END, String(v.end))
  emit()
  if (!apiBase || !token) return
  try {
    await fetch(`${apiBase}/assistant/prefs`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ dayStartHour: v.start, dayEndHour: v.end }),
    })
  } catch { /* sin red se queda en local y se reintenta al volver a guardar */ }
}

/** Siembra la copia local con lo que diga el servidor (al arrancar la app). */
export function seedPlannerHoursFromPrefs(prefs: { dayStartHour?: number; dayEndHour?: number } | null): void {
  if (!prefs || typeof prefs.dayStartHour !== 'number' || typeof prefs.dayEndHour !== 'number') return
  const v = clamp({ start: prefs.dayStartHour, end: prefs.dayEndHour })
  const cur = read()
  if (cur.start === v.start && cur.end === v.end) return
  localStorage.setItem(K_START, String(v.start))
  localStorage.setItem(K_END, String(v.end))
  emit()
}
