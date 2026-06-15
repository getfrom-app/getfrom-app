// Hand-off entre la pizarra de un día y el calendario-lienzo (Agenda) al "bucear"
// con zoom. Cuando la pizarra de un día hace zoom-out hasta el umbral, navega a la
// Agenda y deja aquí la fecha + zoom destino para que TemporalCanvasView arranque
// centrado en ese mes/día (en vez de en hoy).
export interface TemporalFocus { date: number; scale: number }

let pending: TemporalFocus | null = null

export function setTemporalFocus(f: TemporalFocus | null): void { pending = f }
export function takeTemporalFocus(): TemporalFocus | null {
  const f = pending
  pending = null
  return f
}
