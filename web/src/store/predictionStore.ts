/**
 * predictionStore — Palabras personalizadas para la detección inteligente de From.
 * Se guardan en el nodo sistema "⚙️ Ajustes" (sincronizado con el servidor).
 * Así son por cuenta, no por dispositivo.
 */
import { store } from './nodeStore'

export interface PredictionWords {
  task: string[]
  event: string[]
}

// Cache local para lecturas rápidas (se invalida cuando cambia el nodo)
let _cache: PredictionWords | null = null

function getSettingsNode() {
  return store.children(null).find(n => !n.deletedAt && n.text === '⚙️ Ajustes')
}

function ensureSettingsNode() {
  const existing = getSettingsNode()
  if (existing) return existing
  // Crear el nodo si no existe
  const newNode = store.createNode({ text: '⚙️ Ajustes', parentId: null, siblingOrder: 9999 })
  // Marcarlo como nodo sistema (no aparece en el árbol principal)
  store.updateNode(newNode.id, { extraData: JSON.stringify({ _system: true, _predictionWords: { task: [], event: [] } }) })
  return store.getNode(newNode.id)!
}

export function getPredictionWords(): PredictionWords {
  if (_cache) return _cache
  const node = getSettingsNode()
  if (!node) return { task: [], event: [] }
  try {
    const ed = JSON.parse(node.extraData || '{}')
    const pw = ed._predictionWords || {}
    _cache = { task: pw.task || [], event: pw.event || [] }
    return _cache
  } catch { return { task: [], event: [] } }
}

export function addPredictionWord(type: keyof PredictionWords, word: string): boolean {
  const w = word.trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (!w || w.length < 2) return false
  const words = getPredictionWords()
  if (words[type].includes(w)) return false
  words[type] = [...words[type], w]
  _cache = words
  _persist(words)
  return true
}

export function removePredictionWord(type: keyof PredictionWords, word: string): void {
  const w = word.toLowerCase()
  const words = getPredictionWords()
  words[type] = words[type].filter(x => x !== w)
  _cache = words
  _persist(words)
}

function _persist(words: PredictionWords) {
  const node = ensureSettingsNode()
  if (!node) return
  let ed: Record<string, unknown> = {}
  try { ed = JSON.parse(node.extraData || '{}') } catch {}
  ed._predictionWords = words
  store.updateNode(node.id, { extraData: JSON.stringify(ed) })
  window.dispatchEvent(new Event('from:prediction-words-changed'))
}

/** Invalidar caché cuando el store actualiza (llamar desde MainLayout o al montar) */
export function invalidatePredictionCache() {
  _cache = null
}

/**
 * Construye el regex de verbos de tarea combinando built-in + custom del usuario.
 * Se llama en cada detección — buildTaskVerbRegex() es barato (no va al servidor).
 */
export function buildTaskVerbRegex(): RegExp {
  const custom = getPredictionWords().task
  const customPart = custom.length > 0 ? '|' + custom.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') : ''
  return new RegExp(
    `^(confirmar|hacer|pedir|esperar|llamar|enviar|revisar|preparar|crear|actualizar|contactar|comprar|escribir|buscar|entregar|completar|terminar|acabar|organizar|planificar|decidir|analizar|investigar|diseñar|implementar|instalar|configurar|probar|solucionar|arreglar|mejorar|añadir|anadir|quitar|cambiar|mover|hablar|reunirse|visitar|firmar|pagar|cobrar|facturar|contratar|presentar|mostrar|explicar|aprender|estudiar|leer|subir|bajar|descargar|comprobar|verificar|validar|corregir|editar|gestionar|coordinar|definir|publicar|lanzar|cerrar|abrir|iniciar|empezar|comenzar|finalizar|solicitar|aprobar|rechazar|asignar|delegar|seguir|monitorizar|reportar|documentar|migrar|integrar|conectar|sincronizar|importar|exportar|generar|calcular|medir|evaluar|comparar|seleccionar|elegir|cancelar|posponer|priorizar|clasificar|ordenar|filtrar|agrupar|recibir|esperar|recoger|procesar|tramitar|registrar|anotar|tomar|pasar|mandar|sacar|poner|meter|ver|leer|escuchar|responder|contestar|informar|notificar|alertar|recordar|renovar|ajustar|modificar|prepararse|conseguir|obtener|reservar|confirmar|agendar|planear|establecer|definir|fijar|acordar|cerrar|negociar|revisar|actualizar|eliminar|borrar|limpiar|ordenar|automatizar|delegar|escalar|acelerar|pausar|reanudar|revisar|auditar|optimizar|refactorizar|desplegar|testear|depurar|corregir|mejorar|simplificar${customPart})\\b`,
    'i'
  )
}

/** Construye el regex de palabras de evento */
export function buildEventWordRegex(): RegExp {
  const custom = getPredictionWords().event
  const customPart = custom.length > 0 ? '|' + custom.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') : ''
  return new RegExp(
    `(reunión|reunion|llamada|cita|meeting|evento|entrevista|clase|visita|presentación|presentacion|conferencia|webinar|taller|curso|formación|formacion|almuerzo|comida|cena|cafe|café${customPart})`,
    'i'
  )
}

/**
 * Adivina el tipo de predicción más probable para una palabra.
 * Infinitivos españoles (-ar/-er/-ir) → tarea; resto → evento.
 */
export function guessWordType(word: string): { type: keyof PredictionWords; confidence: 'high' | 'medium' } {
  const w = word.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (/[aeiou]r$/.test(w)) return { type: 'task', confidence: 'high' }
  if (/(ando|iendo)$/.test(w)) return { type: 'task', confidence: 'medium' }
  const eventWords = /^(reunion|meeting|cita|llamada|clase|curso|taller|conferencia|webinar|formacion|entrevista|visita|presentacion|almuerzo|comida|cena|cafe|evento|seminario|charla|workshop)/
  if (eventWords.test(w)) return { type: 'event', confidence: 'high' }
  return { type: 'event', confidence: 'medium' }
}
