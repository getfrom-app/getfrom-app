// api/webpush — cliente REST de la suscripción Web Push. La mecánica del
// navegador (Service Worker, permiso, pushManager.subscribe) vive en
// lib/webPushClient.ts; esto solo habla con el servidor.
import { apiRequest } from './client'

export async function fetchVapidPublicKey(): Promise<string | null> {
  try {
    const r = await apiRequest<{ publicKey: string }>('/webpush/vapid-public-key')
    return r.publicKey
  } catch {
    return null
  }
}

export async function subscribeWebPush(sub: PushSubscriptionJSON): Promise<void> {
  if (!sub.endpoint || !sub.keys) return
  await apiRequest('/webpush/subscribe', {
    method: 'POST',
    body: JSON.stringify({ endpoint: sub.endpoint, keys: sub.keys }),
  })
}

export async function unsubscribeWebPush(endpoint: string): Promise<void> {
  await apiRequest('/webpush/unsubscribe', {
    method: 'POST',
    body: JSON.stringify({ endpoint }),
  })
}
