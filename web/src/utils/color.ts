// Utilidades mínimas de color para derivar la paleta de acento (--accent-hover,
// --accent-soft, --text-accent) a partir de un único hex — usado para aplicar el
// color de acento de un contexto a toda la app (ver dynamicAccent en V2App.tsx).

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r},${g},${b},${alpha})`
}

/** Oscurece un hex un `amount` (0-1) — para --accent-hover / --text-accent en claro. */
export function darkenHex(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex)
  const d = (c: number) => Math.max(0, Math.round(c * (1 - amount)))
  return `#${[d(r), d(g), d(b)].map(c => c.toString(16).padStart(2, '0')).join('')}`
}

/** Aclara un hex un `amount` (0-1) — para --text-accent en oscuro (legible sobre fondo negro). */
export function lightenHex(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex)
  const l = (c: number) => Math.min(255, Math.round(c + (255 - c) * amount))
  return `#${[l(r), l(g), l(b)].map(c => c.toString(16).padStart(2, '0')).join('')}`
}
