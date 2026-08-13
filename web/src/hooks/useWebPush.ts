// useWebPush — el equivalente de POST /devices/register (iOS) para el
// navegador: registra el service worker, suscribe al Push API con la clave
// VAPID del servidor, y manda la suscripción para que notifyUser() (server)
// pueda avisar aunque la pestaña esté cerrada (Alberto, 13 ago: "en la web
// todavía no están saltando las notificaciones de agente... si el usuario no
// tiene la web abierta debería aparecer una notificación").
//
// Sigue el mismo patrón que useTaskNotifications.ts (pide el permiso al
// cargar, sin bloquear si el navegador lo deniega) — más un botón manual en
// Ajustes para cuando el navegador ya bloqueó el prompt automático o el
// usuario lo había rechazado antes.
import { useEffect, useState, useCallback } from 'react'
import { fetchVapidPublicKey, subscribeWebPush, unsubscribeWebPush } from '../api/webpush'

const SW_URL = '/app/sw.js'

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64Safe)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

function supported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export type WebPushStatus = 'unsupported' | 'default' | 'denied' | 'granted'

export function useWebPush() {
  const [status, setStatus] = useState<WebPushStatus>(() => {
    if (!supported()) return 'unsupported'
    return Notification.permission as WebPushStatus
  })

  const subscribeIfGranted = useCallback(async () => {
    if (!supported() || Notification.permission !== 'granted') return
    const publicKey = await fetchVapidPublicKey()
    if (!publicKey) return // VAPID no configurado en el servidor — no rompe nada, solo no se activa
    const reg = await navigator.serviceWorker.register(SW_URL, { scope: '/app/' })
    const existing = await reg.pushManager.getSubscription()
    const sub = existing ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    })
    await subscribeWebPush(sub.toJSON()).catch(() => { /* sin conexión, se reintenta en el próximo arranque */ })
  }, [])

  // Al cargar: si ya hay permiso concedido de una sesión anterior, renueva la
  // suscripción (los endpoints pueden caducar) sin volver a preguntar nada.
  useEffect(() => {
    if (Notification.permission === 'granted') subscribeIfGranted()
  }, [subscribeIfGranted])

  const enable = useCallback(async () => {
    if (!supported()) return
    const perm = await Notification.requestPermission()
    setStatus(perm as WebPushStatus)
    if (perm === 'granted') await subscribeIfGranted()
  }, [subscribeIfGranted])

  const disable = useCallback(async () => {
    if (!supported()) return
    const reg = await navigator.serviceWorker.getRegistration(SW_URL)
    const sub = await reg?.pushManager.getSubscription()
    if (sub) {
      await unsubscribeWebPush(sub.endpoint).catch(() => {})
      await sub.unsubscribe().catch(() => {})
    }
  }, [])

  return { status, enable, disable }
}
