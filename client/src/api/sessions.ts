import { apiRequest as request } from './request'

export interface Message {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface SessionData {
  id: string
  child_id: string
  subject: 'math' | 'russian' | 'english'
  task_text: string | null
  completed: boolean
  xp_earned: number
  coins_earned: number
  messages: Message[]
  topic: { id: string; title: string; rules: string } | null
  child: { name: string }
}

export const sessionsApi = {
  start: (body: {
    child_id: string
    image_base64?: string
    image_mime_type?: string
    task_text?: string
    task_hint?: string
    subject?: string
  }) =>
    request<{
      session_id: string
      first_message: string
      subject: string
      topic: string
      task_text: string
    }>('/sessions/start', { method: 'POST', body: JSON.stringify(body) }),

  get: (sessionId: string) =>
    request<SessionData>(`/sessions/${sessionId}`),

  sendMessage: (sessionId: string, payload: { content?: string; image_base64?: string; image_mime_type?: string }) =>
    request<{
      message: string
      session_complete: boolean
      reward_granted?: boolean
      xp_earned?: number
      coins_earned?: number
      user_content: string
    }>(`/sessions/${sessionId}/message`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  trackVoiceUsage: (
    sessionId: string,
    payload: {
      kind: 'speech_input' | 'speech_output' | 'speech_output_english'
      duration_ms?: number
      characters?: number
    },
  ) => request<{ ok: true }>(`/sessions/${sessionId}/voice-usage`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
}
