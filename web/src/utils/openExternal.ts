// Abrir una URL externa (checkout de LemonSqueezy, portal de facturación...) en
// el navegador del sistema. `window.open()` normal no abre fiablemente el
// navegador del sistema dentro del webview de Tauri (Mac) — mismo problema ya
// resuelto para OAuth en components/auth/AuthPage.tsx (tauri-plugin-shell).
// Sin esto, el checkout de Pro quedaba roto en la app de Mac.
const isTauri = import.meta.env.VITE_TAURI === 'true'

export async function openExternalUrl(url: string): Promise<void> {
  if (isTauri) {
    const { open } = await import('@tauri-apps/plugin-shell')
    await open(url)
  } else {
    window.open(url, '_blank')
  }
}
