import { apiRequest } from './client'

export interface DrivePickedFile {
  id: string
  name: string
  mimeType: string
}

export interface DriveImportResult {
  key: string
  publicUrl: string
  name: string
  resourceType: 'image' | 'pdf' | 'file'
}

// Mismo client OAuth que Calendar (landing/web/src/api/googleCalendar.ts) —
// un solo proyecto Google Cloud, un solo client_id.
const GOOGLE_CLIENT_ID = '143465280704-214j5sukru3sh673njls98uudcn1h2ed.apps.googleusercontent.com'

// Solo el archivo que el usuario elige explícitamente en el Picker — scope
// NO sensible (no requiere la auditoría de seguridad que sí exige
// drive.readonly), no reabre la verificación ya hecha para Calendar.
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

/**
 * URL de consentimiento incremental: se pide SOLO el scope de Drive (no se
 * repiten openid/email/profile/calendar). `include_granted_scopes=true` hace
 * que el refresh_token resultante conserve también el acceso a Calendar si
 * el usuario ya lo había concedido antes — un único token cubre ambos.
 */
export function getGoogleDriveOAuthUrl(): string {
  const redirectUri = window.location.origin + '/app/google-callback'
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: DRIVE_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

/** Access token de corta duración para el Picker (nunca se expone el refresh_token). */
export async function getDriveAccessToken(): Promise<string> {
  const res = await apiRequest<{ accessToken: string }>('/google/drive/access-token')
  return res.accessToken
}

/** Importa el archivo elegido en el Picker: el servidor lo descarga de Drive y lo sube a R2. */
export async function importDriveFile(file: DrivePickedFile): Promise<DriveImportResult> {
  return apiRequest<DriveImportResult>('/google/drive/import', {
    method: 'POST',
    body: JSON.stringify(file),
  })
}
