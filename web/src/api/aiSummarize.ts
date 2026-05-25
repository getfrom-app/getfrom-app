import { apiRequest } from './client'

export interface SummaryResult {
  summary: string
  tokensUsed: number
  kind: 'youtube' | 'article' | 'podcast'
  mode: 'short' | 'long'
}

export async function summarizeResource(
  url: string,
  kind?: 'youtube' | 'article' | 'podcast',
  mode: 'short' | 'long' = 'short'
): Promise<SummaryResult> {
  return apiRequest<SummaryResult>('/ai/summarize-resource', {
    method: 'POST',
    body: JSON.stringify({ url, kind, mode }),
  })
}
