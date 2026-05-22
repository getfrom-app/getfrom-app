import { apiRequest } from './client'

export interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  allDay: boolean
}

const GOOGLE_CLIENT_ID = '143465280704-27jike0dng73c8sp8ib8elbp0i4s7jrq.apps.googleusercontent.com'
const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/drive.file',
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

export async function getCalendarEvents(date: Date): Promise<CalendarEvent[]> {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const dateStr = `${yyyy}-${mm}-${dd}`
  const res = await apiRequest<{ events: CalendarEvent[] }>(`/google/calendar/events?date=${dateStr}`)
  return res.events
}

export async function createCalendarEvent(event: {
  title: string
  start: string
  end: string
  description?: string
}): Promise<CalendarEvent> {
  return apiRequest<CalendarEvent>('/google/calendar/events', {
    method: 'POST',
    body: JSON.stringify(event),
  })
}
