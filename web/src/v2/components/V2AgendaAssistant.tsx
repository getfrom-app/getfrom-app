// V2AgendaAssistant — sustituye a V2BriefCard (30 ago 2026, Alberto: "que sea
// un asistente real, que me ayude y me recuerde... columna derecha... formato
// chat y se pueda escribir debajo" + "por supuesto el chat es interactivo, se
// puede preguntar, construir, anotar... que entiende, que se pueden crear
// tareas... todo el trabajo de chat que debería funcionar en web y iOS").
//
// Es el chat REAL (assistantStore → /assistant/chat, el mismo motor que
// iOS/Telegram — ver FROM.md "assistantStore es el ÚNICO motor de chat
// real"), no una lista de avisos de mentira: se embebe `<V2Chat>` con un
// `threadKey` propio y estable (`AGENDA_THREAD_KEY`), así que escribir aquí
// crea tareas, contesta preguntas, todo lo que ya hace el chat de cualquier
// contexto — solo que además, sin que el usuario escriba nada, este
// componente va soltando avisos cortos con `assistantStore.addNotice()` (un
// mensaje LOCAL, sin turno de servidor — ver assistantStore.ts) cuando pasa
// algo real:
//   · el saludo del día (antes V2BriefCard, un párrafo estático que solo se
//     calculaba una vez) — una vez por día, como 1-3 mensajes cortos, con el
//     repaso de la noche anterior (`brief.overnight`) cuando lo hay.
//   · a media tarde, "Buenas tardes" + una pregunta real de perfil.
//   · un evento con hora está a punto de empezar (< 15 min).
// (Retirado 2 sep 2026, Alberto: "no es necesario que diga nada cuando
// termino una tarea" — completar una tarea ya NO dispara ningún aviso; el
// chat debe ser proactivo por sí mismo — saludos, comentarios, repaso — no
// reactivo a cada checkbox.)
// Todo esto es LOCAL a esta pestaña — no reclama servidor nuevo, y no
// interfiere con el envío real de mensajes (`assistantStore.send`, intacto).
import { useEffect, useRef } from 'react'
import { assistantStore, AGENDA_THREAD_KEY } from '../../store/assistantStore'
import { store, useStore } from '../../store/nodeStore'
import { assistantGetBrief } from '../../api/assistant'
import { isInPapelera } from '../../utils/papeleraHelper'
import { hasTimeOfDay } from '../../utils/taskNode'
import V2Chat from './V2Chat'

export { AGENDA_THREAD_KEY }

function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// Franja para el guardado del saludo — a propósito NO es la misma función que
// `dayPart()` del servidor (assistantBrief.ts), que clasifica 00:00-04:59
// como "evening" (para no llamar "buenos días" a las 2 de la mañana). Aquí
// hace falta distinguir esa franja de la noche real (20h-24h): si se
// reutilizara la etiqueta "evening" del servidor como clave del guardado,
// un tick del setInterval a las 00:30 con la pestaña abierta desde ayer
// consumía el ÚNICO saludo del día como "Buenas noches" y el de verdad — el
// de las 8-9 de la mañana — nunca llegaba a inyectarse (Alberto, 1 sept
// 2026: seguía viendo "Buenas noches" a las 8 de la mañana sin recargar).
// `null` = madrugada, no hay saludo que mostrar, no gasta turno.
type GreetSlot = 'morning' | 'afternoon' | 'evening'
function greetSlot(d = new Date()): GreetSlot | null {
  const h = d.getHours()
  if (h < 5) return null
  if (h < 12) return 'morning'
  if (h < 20) return 'afternoon'
  return 'evening'
}
const SLOT_ORDER: Record<GreetSlot, number> = { morning: 1, afternoon: 2, evening: 3 }

/** Saludo del día → 1-3 mensajes cortos, una vez por franja (mañana/tarde/
 *  noche), no una vez por día — así el cambio de franja con la pestaña
 *  abierta desde antes también dispara el saludo nuevo. Reutiliza el mismo
 *  endpoint que antes pintaba V2BriefCard (`GET /assistant/brief`), solo que
 *  ahora sus piezas (`lead`/`overnight`/`attention`) entran en el hilo real
 *  como turnos del asistente, no como texto suelto fuera del chat. */
async function injectDailyGreeting() {
  const slot = greetSlot()
  if (!slot) return // madrugada: nada que enseñar, no se toca el guardado
  const key = `from_agenda_brief_injected_${todayKey()}_${slot}`
  // ⚠️ Marca el flag ANTES del await, no después: en React 18 StrictMode (dev)
  // el efecto se invoca dos veces seguidas — con el guard solo al final, las
  // dos llamadas pasan el `if` (ninguna ha terminado su `fetch` todavía) y el
  // saludo se duplicaba en el hilo. Si la petición falla, se limpia el flag
  // para reintentar en el próximo montaje en vez de quedar "gastado" en vano.
  if (localStorage.getItem(key) === '1') return
  localStorage.setItem(key, '1')
  try {
    const brief = await assistantGetBrief()
    // Etiquetados por día+franja — V2Chat.tsx pliega el bloque de una franja
    // anterior (p.ej. un "Buenos días" que se quedó ahí al llegar la tarde,
    // o el "Buenas tardes" de un día previo) en cuanto este ya está en el
    // hilo, en vez de enseñar los dos seguidos. El orden numérico al final
    // garantiza que la comparación de texto (`m.tag > latestGreetingTag`)
    // coincide con el orden cronológico real dentro del mismo día.
    const tag = `daily-greeting:${todayKey()}-${SLOT_ORDER[slot]}`
    if (brief.overnight) assistantStore.addNotice(brief.overnight, tag)
    assistantStore.addNotice(brief.title + (brief.lead ? ' — ' + brief.lead : ''), tag)
    if (brief.attention) assistantStore.addNotice(brief.attention, tag)
  } catch {
    localStorage.removeItem(key) // sin brief esta vez — reintentar en el próximo montaje
  }
}

export default function V2AgendaAssistant({ onFilesDropped }: { onFilesDropped: (files: File[]) => void }) {
  useStore()
  const remindedIds = useRef<Set<string>>(new Set(
    (() => { try { return JSON.parse(sessionStorage.getItem('from_agenda_reminded') || '[]') } catch { return [] } })(),
  ))

  // Ambos avisos dependen del RELOJ, no de cuándo se montó el componente —
  // la web puede quedarse abierta todo el día sin recargar (a diferencia de
  // iOS, que se abre y cierra), así que comprobar la hora solo una vez al
  // montar los deja pillados para siempre en la franja de cuando se abrió la
  // pestaña por la mañana (Alberto, 31 ago 2026: "no debe depender de
  // abrirse, debe depender de la hora, momento del día"). Se revisa cada
  // minuto — cada función ya tiene su propio guardado en localStorage, así
  // que llamarlas de más no duplica nada, solo detecta el cambio de franja
  // (o de día) mientras la pestaña sigue viva.
  useEffect(() => {
    const checkGreeting = () => { injectDailyGreeting() }
    checkGreeting()
    const id = setInterval(checkGreeting, 60_000)
    return () => clearInterval(id)
  }, [])

  // Pregunta de perfil, una vez al día, dentro del propio hilo de Agenda —
  // reutiliza `assistantStore.askProfileQuestion()` (ya existía, solo se
  // ofrecía manualmente al abrir "Perfil" desde Ajustes) para que el
  // asistente tome la iniciativa aquí también: pregunte algo real, grounded
  // en contexto (nunca genérico — lo decide el servidor), no solo informe.
  // A media tarde, para no competir con el saludo de la mañana ni sonar a
  // interrogatorio nada más entrar. El saludo del día (`injectDailyGreeting`)
  // sale UNA vez al día — si la pestaña ya estaba abierta desde la mañana,
  // nunca llega un "Buenas tardes" en toda la sesión (Alberto, 31 ago 2026:
  // "aun no ha dicho buenas tardes... sigue siendo un chat sin vida"). Este
  // es el único otro momento programado del día, así que abre con el saludo
  // que toque antes de la pregunta — no un mensaje suelto más, es lo que
  // hace que se note que ha cambiado de franja horaria.
  useEffect(() => {
    const checkIn = () => {
      const key = `from_agenda_checkin_asked_${todayKey()}`
      if (localStorage.getItem(key) === '1') return
      const hour = new Date().getHours()
      if (hour < 15 || hour >= 20) return
      localStorage.setItem(key, '1')
      assistantStore.addNotice('Buenas tardes.')
      assistantStore.askProfileQuestion()
    }
    checkIn()
    const id = setInterval(checkIn, 60_000)
    return () => clearInterval(id)
  }, [])

  // Recordatorio de un evento con hora que empieza en menos de 15 min —
  // revisa cada 60s mientras la columna está montada (Alberto: "que me
  // recuerde"). Una vez por evento y sesión (`remindedIds`, persistido en
  // sessionStorage para no repetirlo si el componente se remonta).
  useEffect(() => {
    const check = () => {
      const now = new Date()
      for (const n of store.allActive()) {
        // `hasTimeOfDay`, no `isEvent` — mismo criterio que el recordatorio por
        // push del servidor (`assistantReminders.ts`, el que SÍ le llegó a
        // Alberto en iOS para "Estudiar" a las 11:00): cualquier tarea pendiente
        // con hora, tenga o no `isEvent` puesto. Antes exigir `isEvent` dejaba
        // fuera tareas con hora que nunca pasaron por la vía que fija ese flag
        // (p.ej. una recurrente creada antes de esa migración) — el aviso nunca
        // llegaba en web aunque la tarea SÍ tuviera hora (Alberto, 31 ago 2026).
        if (!hasTimeOfDay(n) || n.status !== 'pending' || !n.due || isInPapelera(n.id)) continue
        if (remindedIds.current.has(n.id)) continue
        const due = new Date(n.due)
        if (!isSameLocalDay(due, now)) continue
        const minsUntil = (due.getTime() - now.getTime()) / 60000
        if (minsUntil > 0 && minsUntil <= 15) {
          assistantStore.addNotice(`Recuerda: «${n.text || 'evento'}» en ${Math.round(minsUntil)} min.`, undefined, { kind: 'reminder', dueAt: due.toISOString() })
          remindedIds.current.add(n.id)
          try { sessionStorage.setItem('from_agenda_reminded', JSON.stringify([...remindedIds.current])) } catch { /* ignore */ }
        }
      }
    }
    check()
    const id = setInterval(check, 60_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="v2-agenda-assistant">
      <V2Chat embedded hideHeader currentNodeId={AGENDA_THREAD_KEY} contextLabel={null} onFilesDropped={onFilesDropped} />
    </div>
  )
}
