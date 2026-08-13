// Service worker de Fromly — solo Web Push (13 ago). Sin caché de assets: la
// app ya se sirve fresca en cada carga, meter un service worker cacheador
// aquí sería un problema nuevo (versiones viejas pegadas) para resolver uno
// que no se pidió. El único trabajo de este archivo es recibir el push
// cuando la pestaña está cerrada y mostrar la notificación del sistema.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let data = { title: 'Fromly', body: '' }
  try { data = event.data.json() } catch { /* payload no-JSON, se ignora */ }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Fromly', {
      body: data.body || '',
      icon: '/icon.svg',
      badge: '/icon.svg',
      data: { nodeId: data.nodeId || null },
    })
  )
})

// Clic en la notificación: si ya hay una pestaña de Fromly abierta, la enfoca
// (y le pasa el nodeId para que navegue); si no, abre una nueva.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const nodeId = event.notification.data?.nodeId

  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of clientsList) {
      if (client.url.includes('/app/') && 'focus' in client) {
        client.postMessage({ type: 'from:push-open', nodeId })
        return client.focus()
      }
    }
    const url = nodeId ? `/app/?openNode=${encodeURIComponent(nodeId)}` : '/app/'
    return self.clients.openWindow(url)
  })())
})
