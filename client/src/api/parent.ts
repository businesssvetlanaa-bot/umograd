import { apiRequest as request } from './request'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SessionSummary {
  id: string
  subject: 'math' | 'russian' | 'english'
  topic: string | null
  started_at: string
  ended_at: string | null
  xp_earned: number
  coins_earned: number
  completed: boolean
}

export interface SessionDetail {
  id: string
  subject: 'math' | 'russian' | 'english'
  topic: string | null
  task_text: string | null
  started_at: string
  ended_at: string | null
  completed: boolean
  xp_earned: number
}

export interface SessionMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface TopicProgress {
  id: string
  title: string
  mastery_level: number
  sessions_count: number
}

export interface SubjectProgressData {
  overall: number
  sessions_count: number
  topics: TopicProgress[]
}

export interface ProgressData {
  math: SubjectProgressData
  russian: SubjectProgressData
  english: SubjectProgressData
  total_sessions: number
  total_xp: number
}

export interface WeakSpot {
  topic_id: string
  title: string
  subject: 'math' | 'russian' | 'english'
  mastery_level: number
  sessions_count: number
}

export interface CurriculumTopic {
  id: string
  title: string
  description: string
  order: number
  enabled: boolean
}

export interface CurriculumItem {
  id: string
  name: string
  grade: number
  subject: 'math' | 'russian' | 'english'
  is_system: boolean
  topics: CurriculumTopic[]
  created_at: string
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const parentApi = {
  childSessions: (childId: string) =>
    request<SessionSummary[]>(`/parent/children/${childId}/sessions`),

  sessionMessages: (childId: string, sessionId: string) =>
    request<{ session: SessionDetail; messages: SessionMessage[] }>(
      `/parent/children/${childId}/sessions/${sessionId}/messages`,
    ),

  childProgress: (childId: string) =>
    request<ProgressData>(`/parent/children/${childId}/progress`),

  weakSpots: (childId: string) =>
    request<WeakSpot[]>(`/parent/children/${childId}/weak-spots`),

  getCurricula: () =>
    request<CurriculumItem[]>('/curricula'),

  createCurriculum: (body: { name: string; grade: number; subject: string; text_content: string }) =>
    request<CurriculumItem>('/curricula', { method: 'POST', body: JSON.stringify(body) }),

  toggleTopic: (curriculumId: string, topicId: string, enabled: boolean) =>
    request<{ ok: boolean }>(`/curricula/${curriculumId}/topics/${topicId}`, {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    }),
}
