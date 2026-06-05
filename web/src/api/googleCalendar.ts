import { apiRequest } from './client'

export interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  allDay: boolean
  /** Color del calendario al que pertenece el evento (hex). */
  backgroundColor?: string | null
  foregroundColor?: string | null
  /** Override de color del evento (Google event color palette 1-11). */
  colorId?: string | null
}

// Web OAuth client (Aplicación web en Google Cloud Console)
const GOOGLE_CLIENT_ID = '143465280704-214j5sukru3sh673njls98uudcn1h2ed.apps.googleusercontent.com'
const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar',
].join(' ')

export async function getGoogleStatus(): Promise<{ connected: boolean; email: string | null }> {
  return apiRequest<{ connected: boolean; email: string | null }>('/google/status')
}

export function getGoogleOAuthUrl(): string {
  const redirectUri = window.location.origin + '/app/google-callback'
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export async function connectGoogle(code: string, redirectUri: string): Promise<void> {
  await apiRequest('/google/connect', {
    method: 'POST',
    body: JSON.stringify({ code, redirectUri }),
  })
}

export async function disconnectGoogle(): Promise<void> {
  await apiRequest('/google/disconnect', { method: 'DELETE' })
}

function toDateStr(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function getTimeZone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid' } catch { return 'Europe/Madrid' }
}

export async function getCalendarEvents(date: Date): Promise<CalendarEvent[]> {
  const tz = getTimeZone()
  const res = await apiRequest<{ events: CalendarEvent[] }>(`/google/calendar/events?date=${toDateStr(date)}&tz=${encodeURIComponent(tz)}`)
  return res.events
}

export async function getCalendarEventsRange(start: Date, end: Date): Promise<CalendarEvent[]> {
  const tz = getTimeZone()
  const res = await apiRequest<{ events: CalendarEvent[] }>(
    `/google/calendar/events/range?start=${toDateStr(start)}&end=${toDateStr(end)}&tz=${encodeURIComponent(tz)}`
  )
  return res.events
}

/** Convierte el formato de recurrencia de From ('weekly:2') a RRULE para GCal */
export function fromRecToRRule(rec: string | null | undefined): string[] {
  if (!rec) return []
  const [unit, nStr] = rec.split(':')
  const n = parseInt(nStr || '1') || 1
  const freq: Record<string, string> = { daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY', yearly: 'YEARLY' }
  const f = freq[unit]
  if (!f) return []
  return [`RRULE:FREQ=${f};INTERVAL=${n}`]
}

export async function createCalendarEvent(event: {
  title: string
  start: string
  end: string
  description?: string
  location?: string
  recurrence?: string[] // RRULE strings
}): Promise<CalendarEvent> {
  return apiRequest<CalendarEvent>('/google/calendar/events', {
    method: 'POST',
    body: JSON.stringify(event),
  })
}

export async function updateCalendarEvent(
  id: string,
  event: { title?: string; start?: string; end?: string; description?: string; location?: string; recurrence?: string[] }
): Promise<CalendarEvent> {
  return apiRequest<CalendarEvent>(`/google/calendar/events/${id}`, {
    method: 'PUT',
    body: JSON.stringify(event),
  })
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  await apiRequest<{ ok: boolean }>(`/google/calendar/events/${id}`, {
    method: 'DELETE',
  })
}
