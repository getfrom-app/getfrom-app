// Idioma efectivo para IA y voz (transcripción / reconocimiento de voz).
//
// Regla: respeta la elección explícita del usuario en Ajustes (es/en). Si está
// en «auto» o sin definir, sigue el idioma de la INTERFAZ (la misma fuente que
// i18n: la clave `fromly-lang` o el navegador). NUNCA defaultea a español: un
// usuario alemán/griego/etc. obtiene IA y voz en su idioma, no en español.

const BCP47: Record<string, string> = {
  es: 'es-ES', en: 'en-US', de: 'de-DE', fr: 'fr-FR', it: 'it-IT', pt: 'pt-PT',
  el: 'el-GR', nl: 'nl-NL', pl: 'pl-PL', ru: 'ru-RU', tr: 'tr-TR', sv: 'sv-SE',
}

function uiBase(): string {
  const raw = (typeof localStorage !== 'undefined' && localStorage.getItem('fromly-lang'))
    || (typeof navigator !== 'undefined' && navigator.language) || 'en'
  const b = raw.toLowerCase().split('-')[0]
  return b in BCP47 ? b : 'en'
}

// Código base (es, en, de, …) para enviar al servidor en /ai/transcribe?lang=
export function aiLangBase(): string {
  const v = typeof localStorage !== 'undefined' ? localStorage.getItem('from_ai_language') : null
  if (v === 'es' || v === 'en') return v
  return uiBase() // 'auto' o sin definir → idioma de la interfaz
}

// BCP-47 (es-ES, de-DE, …) para la Web Speech API (reconocimiento de voz).
export function aiLangBCP47(): string {
  return BCP47[aiLangBase()] || 'en-US'
}
