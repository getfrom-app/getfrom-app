import { apiRequest } from './client'

export interface UnfurlMeta {
  title: string
  description: string | null
  image: string | null
  favicon: string | null
  domain: string
  url: string
  type: 'youtube' | 'url'
  channel: string | null
  duration: string | null
  videoId: string | null
}

export async function unfurlUrl(url: string): Promise<UnfurlMeta> {
  return apiRequest<UnfurlMeta>(`/unfurl?url=${encodeURIComponent(url)}`)
}

export function isUrl(text: string): boolean {
  try {
    const u = new URL(text.trim())
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export function isYouTubeUrl(text: string): boolean {
  return /(?:youtube\.com\/watch|youtu\.be\/|youtube\.com\/embed)/.test(text)
}
