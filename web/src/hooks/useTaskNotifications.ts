import { useEffect, useState } from 'react'
import { useStore } from '../store/nodeStore'

export function useTaskNotifications() {
  const s = useStore()

  // Cargar estado de notificaciones persistido (solo del día actual)
  const [notifiedToday, setNotifiedToday] = useState<Set<string>>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('from_notified_today') || '{}')
      const today = new Date().toDateString()
      return stored.date === today ? new Set(stored.ids) : new Set()
    } catch { return new Set() }
  })

  useEffect(() => {
    // Solicitar permiso al cargar
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  useEffect(() => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return

    const CHECK_INTERVAL = 60 * 1000 // cada minuto
    const notified = new Set<string>(notifiedToday)

    function persistNotified() {
      const today = new Date().toDateString()
      localStorage.setItem('from_notified_today', JSON.stringify({ date: today, ids: Array.from(notified) }))
      setNotifiedToday(new Set(notified))
    }

    function checkDueTasks() {
      const now = new Date()
      const tasks = s.allActive().filter(n =>
        n.status === 'pending' &&
        n.due &&
        !n.deletedAt
      )

      // Tareas vencidas: agrupar si hay más de 5
      const overdue = tasks.filter(task => {
        if (notified.has(task.id)) return false
        const due = new Date(task.due!)
        const diff = due.getTime() - now.getTime()
        return diff < 0 && diff > -5 * 60 * 1000
      })

      if (overdue.length > 5) {
        const groupKey = `overdue_group_${new Date().toDateString()}`
        if (!notified.has(groupKey)) {
          notified.add(groupKey)
          overdue.forEach(t => notified.add(t.id))
          new Notification('⚠ Tareas vencidas', {
            body: `${overdue.length} tareas vencidas. Revisa tu lista.`,
            icon: '/icon.svg',
          })
          persistNotified()
        }
      } else {
        for (const task of overdue) {
          notified.add(task.id)
          new Notification('⏰ Tarea vencida', {
            body: `"${task.text}" ha vencido`,
            icon: '/icon.svg',
          })
        }
        if (overdue.length > 0) persistNotified()
      }

      // Tareas con hora exacta — 5 minutos antes (precisión alta).
      // Tareas sin hora (medianoche) — 15 min antes (recordatorio general).
      for (const task of tasks) {
        if (notified.has(task.id)) continue
        const due = new Date(task.due!)
        const diff = due.getTime() - now.getTime()
        const hasExactTime = due.getHours() !== 0 || due.getMinutes() !== 0

        const window = hasExactTime ? 5 * 60 * 1000 : 15 * 60 * 1000
        if (diff > 0 && diff <= window) {
          notified.add(task.id)
          new Notification(hasExactTime ? '⏰ Tarea en 5 min' : '📋 Tarea pronto vence', {
            body: `"${task.text}" — ${hasExactTime ? `${Math.round(diff / 60000)} min` : 'esta tarde'}`,
            icon: '/icon.svg',
          })
          persistNotified()
        }
      }

      // Notificar tareas de hoy a las 9:00 AM si no se ha hecho
      const todayMorningKey = `morning_9am_${new Date().toDateString()}`
      if (!notified.has(todayMorningKey) && now.getHours() === 9 && now.getMinutes() < 2) {
        const todayTasks = tasks.filter(task => {
          const due = new Date(task.due!)
          return due.toDateString() === now.toDateString()
        })
        if (todayTasks.length > 0) {
          notified.add(todayMorningKey)
          new Notification('📅 Tareas para hoy', {
            body: `Tienes ${todayTasks.length} tarea${todayTasks.length !== 1 ? 's' : ''} para hoy`,
            icon: '/icon.svg',
          })
          persistNotified()
        }
      }
    }

    checkDueTasks()
    const interval = setInterval(checkDueTasks, CHECK_INTERVAL)
    return () => clearInterval(interval)
  }, [s]) // eslint-disable-line react-hooks/exhaustive-deps
}
