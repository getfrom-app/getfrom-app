/**
 * normalizeText — normaliza texto para búsquedas insensibles a
 * mayúsculas y tildes/acentos.
 *
 * "Códigos" → "codigos"
 * "CAFÉ"    → "cafe"
 * "niño"    → "nino"
 */
export function normalizeText(s: string): string {
  return s
    .normalize('NFD')                        // descomponer caracteres con acento
    .replace(/[̀-ͯ]/g, '')         // eliminar diacríticos (tildes, etc.)
    .toLowerCase()
}

/** Devuelve true si haystack contiene needle, ignorando tildes y mayúsculas */
export function includesNormalized(haystack: string, needle: string): boolean {
  return normalizeText(haystack).includes(normalizeText(needle))
}
