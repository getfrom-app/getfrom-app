import { useEffect } from 'react'
import { useStore } from '../store/nodeStore'

export function useTaskNotifications() {
  const s = useStore()

  useEffect(() => {
    // Solicitar permiso al cargar
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  useEffect(() => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return

    const CHECK_INTERVAL = 60 * 1000 // cada minuto
    const notified = new Set<string>()

    function checkDueTasks() {
      const now = new Date()
      const tasks = s.allActive().filter(n =>
        n.status === 'pending' &&
        n.due &&
        !n.deletedAt
      )

      for (const task of tasks) {
        if (notified.has(task.id)) continue
        const due = new Date(task.due!)
        const diff = due.getTime() - now.getTime()

        // Notificar 15 minutos antes o si ya ha vencido en los últimos 5 min
        if (diff > 0 && diff <= 15 * 60 * 1000) {
          notified.add(task.id)
          new Notification('📋 Tarea pronto vence', {
            body: `"${task.text}" vence en ${Math.round(diff / 60000)} minutos`,
            icon: '/icon.svg',
          })
        } else if (diff < 0 && diff > -5 * 60 * 1000) {
          notified.add(task.id)
          new Notification('⏰ Tarea vencida', {
            body: `"${task.text}" ha vencido`,
            icon: '/icon.svg',
          })
        }
      }
    }

    checkDueTasks()
    const interval = setInterval(checkDueTasks, CHECK_INTERVAL)
    return () => clearInterval(interval)
  }, [s])
}
