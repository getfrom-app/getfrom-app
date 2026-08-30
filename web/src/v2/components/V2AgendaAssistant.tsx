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
//     calculaba una vez) — una vez por día, como 1-3 mensajes cortos.
//   · una tarea de hoy/atrasada se completa mientras la columna está abierta.
//   · un evento con hora está a punto de empezar (< 15 min).
// Todo esto es LOCAL a esta pestaña — no reclama servidor nuevo, y no
// interfiere con el envío real de mensajes (`assistantStore.send`, intacto).
import { useEffect, useRef } from 'react'
import { assistantStore } from '../../store/assistantStore'
import { store, useStore } from '../../store/nodeStore'
import { assistantGetBrief } from '../../api/assistant'
import { isInPapelera } from '../../utils/papeleraHelper'
import V2Chat from './V2Chat'

/** `threadKey` estable del chat de Agenda — nunca un nodeId real (evita
 *  colisión con el hilo de un contexto/elemento cualquiera), mismo patrón que
 *  `'__ctx_sin_contexto__'` en V2RightColumn.tsx. */
export const AGENDA_THREAD_KEY = '__agenda__'

function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** Saludo del día → 1-3 mensajes cortos, una vez por día. Reutiliza el mismo
 *  endpoint que antes pintaba V2BriefCard (`GET /assistant/brief`), solo que
 *  ahora sus piezas (`lead`/`overnight`/`attention`) entran en el hilo real
 *  como turnos del asistente, no como texto suelto fuera del chat. */
async function injectDailyGreeting() {
  const key = `from_agenda_brief_injected_${todayKey()}`
  // ⚠️ Marca el flag ANTES del await, no después: en React 18 StrictMode (dev)
  // el efecto se invoca dos veces seguidas — con el guard solo al final, las
  // dos llamadas pasan el `if` (ninguna ha terminado su `fetch` todavía) y el
  // saludo se duplicaba en el hilo. Si la petición falla, se limpia el flag
  // para reintentar en el próximo montaje en vez de quedar "gastado" en vano.
  if (localStorage.getItem(key) === '1') return
  localStorage.setItem(key, '1')
  try {
    const brief = await assistantGetBrief()
    if (brief.overnight) assistantStore.addNotice(brief.overnight)
    assistantStore.addNotice(brief.title + (brief.lead ? ' — ' + brief.lead : ''))
    if (brief.attention) assistantStore.addNotice(brief.attention)
  } catch {
    localStorage.removeItem(key) // sin brief esta vez — reintentar en el próximo montaje
  }
}

export default function V2AgendaAssistant({ onFilesDropped }: { onFilesDropped: (files: File[]) => void }) {
  useStore()
  const seenPendingIds = useRef<Set<string> | null>(null)
  const remindedIds = useRef<Set<string>>(new Set(
    (() => { try { return JSON.parse(sessionStorage.getItem('from_agenda_reminded') || '[]') } catch { return [] } })(),
  ))

  useEffect(() => { injectDailyGreeting() }, [])

  // Tarea de hoy/atrasada completada mientras la columna está abierta → aviso
  // corto. `seenPendingIds` arranca en el primer render con lo que YA está
  // pendiente (nunca avisa de nada anterior a abrir la pantalla); cada
  // cambio de store compara contra esa foto — lo que faltaba y ahora está
  // `done` se acaba de completar aquí mismo.
  useEffect(() => {
    const now = new Date()
    const pending = new Set(
      store.allActive()
        .filter(n => n.status === 'pending' && !n.isEvent && !n.isDiaryEntry && !isInPapelera(n.id))
        .filter(n => !n.due || new Date(n.due) <= new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59))
        .map(n => n.id),
    )
    if (seenPendingIds.current) {
      for (const id of seenPendingIds.current) {
        if (pending.has(id)) continue
        const n = store.getNode(id)
        if (n && n.status === 'done') {
          assistantStore.addNotice(`Has completado «${n.text || 'una tarea'}».`)
        }
      }
    }
    seenPendingIds.current = pending
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.nodesVersion])

  // Recordatorio de un evento con hora que empieza en menos de 15 min —
  // revisa cada 60s mientras la columna está montada (Alberto: "que me
  // recuerde"). Una vez por evento y sesión (`remindedIds`, persistido en
  // sessionStorage para no repetirlo si el componente se remonta).
  useEffect(() => {
    const check = () => {
      const now = new Date()
      for (const n of store.allActive()) {
        if (!n.isEvent || n.status !== 'pending' || !n.due || isInPapelera(n.id)) continue
        if (remindedIds.current.has(n.id)) continue
        const due = new Date(n.due)
        if (!isSameLocalDay(due, now)) continue
        const minsUntil = (due.getTime() - now.getTime()) / 60000
        if (minsUntil > 0 && minsUntil <= 15) {
          assistantStore.addNotice(`Recuerda: «${n.text || 'evento'}» en ${Math.round(minsUntil)} min.`)
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
