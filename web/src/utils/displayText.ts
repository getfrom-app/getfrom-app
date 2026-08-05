// Limpieza de texto para MOSTRAR — Fromly ya no pinta emojis en ningún sitio
// (rediseño 5 ago 2026, ver v2/components/Icon.tsx), pero muchos nodos los llevan
// escritos EN EL DATO como prefijo decorativo: agentes («📈 Informe de mercado»,
// createAgentUnder), raíces del sistema («📅 Agenda», «🧠 Contexto»), sesiones de
// chat («✦ …»), plantillas, etc.
//
// Migrar esos textos sería reescribir datos del usuario (y romper helpers que
// buscan la raíz por su nombre exacto, p.ej. `isContextKnowledge`). En su lugar,
// el emoji se quita AL PINTAR: el dato queda intacto y la UI queda limpia.
//
// Solo se quita el prefijo — un emoji en medio de un texto escrito por el usuario
// es contenido suyo y no se toca.

// Pictogramas + símbolos + dingbats + selectores de variación + ZWJ + banderas,
// repetidos al principio de la cadena junto con los espacios que los separan.
const LEADING_EMOJI = /^(?:[\u{1F000}-\u{1FAFF}\u{2190}-\u{2BFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]+\s*)+/u

/** Quita el emoji decorativo inicial de un título (si lo hay). */
export function stripLeadingEmoji(text: string | null | undefined): string {
  return (text || '').replace(LEADING_EMOJI, '').trim()
}

/** Igual que `stripLeadingEmoji`, pero nunca devuelve vacío: si el título ERA
 *  solo un emoji, se conserva el original en vez de dejar la fila en blanco. */
export function displayTitle(text: string | null | undefined, fallback = ''): string {
  const clean = stripLeadingEmoji(text)
  if (clean) return clean
  return (text || '').trim() || fallback
}
