// Hand-off entre la pizarra de un día y el calendario-lienzo (Agenda) al "bucear"
// con zoom. Cuando la pizarra de un día hace zoom-out hasta el umbral, navega a la
// Agenda y deja aquí la fecha + nivel destino para que TemporalCanvasView arranque
// en el nivel correcto (meses 3×4) centrado en ese año/mes.
export type TemporalLevel = 'roots' | 'years' | 'months' | 'days'
export interface TemporalFocus { date: number; level: TemporalLevel }

let pending: TemporalFocus | null = null

export function setTemporalFocus(f: TemporalFocus | null): void { pending = f }
export function takeTemporalFocus(): TemporalFocus | null {
  const f = pending
  pending = null
  return f
}
