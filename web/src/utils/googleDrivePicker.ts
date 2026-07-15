// Selector de archivos de Google Drive (scope drive.file — solo lo que el
// usuario elige aquí, nunca todo el Drive). Carga el script de Google bajo
// demanda (nadie paga ese peso si no usa Drive) y coordina: comprobar
// conexión → si falta, mandar a consentimiento incremental → mostrar Picker
// → importar el archivo elegido al servidor (descarga de Drive + sube a R2).
import { getGoogleStatus } from '../api/googleCalendar'
import { getGoogleDriveOAuthUrl, getDriveAccessToken, importDriveFile } from '../api/googleDrive'
import type { DriveImportResult } from '../api/googleDrive'

const PICKER_API_KEY = import.meta.env.VITE_GOOGLE_PICKER_API_KEY as string | undefined

const SUPPORTED_MIME_TYPES = [
  'application/vnd.google-apps.document',
  'application/pdf',
  'text/plain',
  'text/markdown',
].join(',')

// Casts locales en vez de `declare global` — Window.google ya está tipado
// (para Sign In With Google) en components/auth/AuthPage.tsx con una forma
// distinta; una segunda declaración global con otro tipo choca en tsc.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const w = window as any

let gapiLoadPromise: Promise<void> | null = null

function loadGapiScript(): Promise<void> {
  if (w.gapi) return Promise.resolve()
  if (!gapiLoadPromise) {
    gapiLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://apis.google.com/js/api.js'
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('No se pudo cargar el script de Google (apis.google.com)'))
      document.head.appendChild(script)
    })
  }
  return gapiLoadPromise
}

let pickerLoadPromise: Promise<void> | null = null

async function ensurePickerLoaded(): Promise<void> {
  await loadGapiScript()
  if (w.google?.picker) return
  if (!pickerLoadPromise) {
    pickerLoadPromise = new Promise((resolve, reject) => {
      w.gapi.load('picker', { callback: resolve, onerror: reject })
    })
  }
  return pickerLoadPromise
}

interface PickedFile { id: string; name: string; mimeType: string }

async function showPicker(accessToken: string): Promise<PickedFile | null> {
  await ensurePickerLoaded()
  const google = w.google
  return new Promise((resolve) => {
    const view = new google.picker.DocsView(google.picker.ViewId.DOCS).setMimeTypes(SUPPORTED_MIME_TYPES)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const builder = new google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .setCallback((data: any) => {
        if (data.action === google.picker.Action.PICKED) {
          const doc = data.docs[0]
          resolve({ id: doc.id, name: doc.name, mimeType: doc.mimeType })
        } else if (data.action === google.picker.Action.CANCEL) {
          resolve(null)
        }
      })
    if (PICKER_API_KEY) builder.setDeveloperKey(PICKER_API_KEY)
    builder.build().setVisible(true)
  })
}

/**
 * Flujo completo: si Drive no está conectado, redirige a Google (vuelve a
 * `/app/google-callback` como Calendar). Si ya está conectado, abre el
 * Picker y, al elegir un archivo, lo importa (servidor descarga de Drive →
 * sube a R2) y devuelve el resultado listo para crear el nodo-recurso.
 * `null` = el usuario canceló el Picker o se le redirigió a conectar.
 */
export async function pickAndImportDriveFile(): Promise<DriveImportResult | null> {
  const status = await getGoogleStatus()
  if (!status.connected || !status.driveConnected) {
    window.location.href = getGoogleDriveOAuthUrl()
    return null
  }

  const accessToken = await getDriveAccessToken()
  const picked = await showPicker(accessToken)
  if (!picked) return null

  return importDriveFile(picked)
}
