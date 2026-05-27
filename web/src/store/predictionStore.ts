/**
 * predictionStore — Palabras personalizadas para la detección inteligente de From.
 * El usuario puede añadir sus propias palabras desde el menú contextual.
 * Se persisten en localStorage.
 */

const KEY = 'from_prediction_words'

export interface PredictionWords {
  task: string[]    // verbos que indican tarea
  event: string[]   // palabras que indican evento
}

export function getPredictionWords(): PredictionWords {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}')
    return { task: raw.task || [], event: raw.event || [] }
  } catch { return { task: [], event: [] } }
}

export function addPredictionWord(type: keyof PredictionWords, word: string): boolean {
  const w = word.trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // normalizar tildes
  if (!w || w.length < 2) return false
  const words = getPredictionWords()
  if (words[type].includes(w)) return false
  words[type] = [...words[type], w]
  localStorage.setItem(KEY, JSON.stringify(words))
  window.dispatchEvent(new Event('from:prediction-words-changed'))
  return true
}

export function removePredictionWord(type: keyof PredictionWords, word: string): void {
  const w = word.toLowerCase()
  const words = getPredictionWords()
  words[type] = words[type].filter(x => x !== w)
  localStorage.setItem(KEY, JSON.stringify(words))
  window.dispatchEvent(new Event('from:prediction-words-changed'))
}

/** Construye el regex de verbos de tarea combinando built-in + custom del usuario */
export function buildTaskVerbRegex(): RegExp {
  const custom = getPredictionWords().task
  const customPart = custom.length > 0 ? '|' + custom.join('|') : ''
  return new RegExp(
    `^(confirmar|hacer|pedir|esperar|llamar|enviar|revisar|preparar|crear|actualizar|contactar|comprar|escribir|buscar|entregar|completar|terminar|acabar|organizar|planificar|decidir|analizar|investigar|diseñar|implementar|instalar|configurar|probar|solucionar|arreglar|mejorar|añadir|anadir|quitar|cambiar|mover|hablar|reunirse|visitar|firmar|pagar|cobrar|facturar|contratar|presentar|mostrar|explicar|aprender|estudiar|leer|subir|bajar|descargar|comprobar|verificar|validar|corregir|editar|gestionar|coordinar|definir|publicar|lanzar|cerrar|abrir|iniciar|finalizar|solicitar|aprobar|rechazar|asignar|delegar|seguir|monitorizar|reportar|documentar|migrar|integrar|conectar|sincronizar|importar|exportar|generar|calcular|medir|evaluar|comparar|seleccionar|elegir|cancelar|posponer|priorizar|clasificar|ordenar|filtrar|agrupar|recibir|esperar|recoger|procesar|tramitar|registrar|anotar|tomar|pasar|mandar|sacar|poner|meter|quitar|ver|leer|escuchar|responder|contestar|informar|notificar|alertar|recordar|recordar|renovar|actualizar|revisar|ajustar|modificar|corregir${customPart})\\b`,
    'i'
  )
}

/** Construye el regex de palabras de evento combinando built-in + custom */
/**
 * Adivina el tipo de predicción más probable para una palabra.
 * - Infinitivos españoles (-ar/-er/-ir) → tarea
 * - Resto → evento
 */
export function guessWordType(word: string): { type: keyof PredictionWords; confidence: 'high' | 'medium' } {
  const w = word.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  // Infinitivo español: termina en -ar, -er, -ir
  if (/[aeiou]r$/.test(w)) return { type: 'task', confidence: 'high' }
  // Gerundio: -ando, -iendo
  if (/(ando|iendo)$/.test(w)) return { type: 'task', confidence: 'medium' }
  // Palabras típicas de evento
  const eventWords = /^(reunion|meeting|cita|llamada|clase|curso|taller|conferencia|webinar|formacion|entrevista|visita|presentacion|almuerzo|comida|cena|cafe|evento|seminario|charla|workshop)/
  if (eventWords.test(w)) return { type: 'event', confidence: 'high' }
  // Default: evento (probablemente un sustantivo)
  return { type: 'event', confidence: 'medium' }
}

export function buildEventWordRegex(): RegExp {
  const custom = getPredictionWords().event
  const customPart = custom.length > 0 ? '|' + custom.join('|') : ''
  return new RegExp(
    `(reunión|reunion|llamada|cita|meeting|evento|entrevista|clase|visita|presentación|presentacion|conferencia|webinar|taller|curso|formación|formacion|almuerzo|comida|cena|cafe|café${customPart})`,
    'i'
  )
}
