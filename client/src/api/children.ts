export interface BuildingItem {
  building_type: string
  name: string
  emoji: string
  description: string
  cost: number
  required_level: number
  required_sessions: number
  unlock_hint: string
  unlocked: boolean
  owned: boolean
  placed: boolean
  position_x: number | null
  position_y: number | null
  id: string | null
}

export interface BuildingPlacementResult {
  success: true
  purchased_now: boolean
  coins: number
  building: {
    id: string
    building_type: string
    placed: boolean
    position_x: number | null
    position_y: number | null
  }
}
export interface ChildDashboard {
  id: string
  name: string
  grade: number
  avatar_type: string
  avatar_color: string
  xp: number
  level: number
  coins: number
  streak_days: number
  last_active: string | null
  has_pin: boolean
  direct_answer_allowed: boolean
  subject_progress: Array<{
    subject: 'math' | 'russian' | 'english'
    mastery_level: number
    sessions_count: number
  }>
  buildings: Array<{
    id: string
    building_type: string
    placed: boolean
    position_x: number | null
    position_y: number | null
  }>
}

export interface LearningTopic {
  curriculum_id: string
  topic_key: string
  title: string
  description: string
  order: number
}

export interface ChildCurriculum {
  id: string
  name: string
  grade: number
  subject: 'math' | 'russian' | 'english'
  is_system: boolean
  created_at: string
  topics: Array<{
    topic_key: string
    title: string
    description: string
    order: number
    enabled: boolean
  }>
}

import { apiRequest as request } from './request'

export const childrenApi = {
  create: (body: { name: string; grade: number; avatar_type: string; avatar_color: string; pin?: string }) =>
    request<{ id: string; name: string; grade: number; avatar_type: string; avatar_color: string; xp: number; level: number; coins: number; streak_days: number }>('/children', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  list: () =>
    request<Array<{ id: string; name: string; grade: number; avatar_type: string; avatar_color: string; xp: number; level: number; coins: number; streak_days: number; last_active: string | null }>>('/children'),

  dashboard: (id: string) =>
    request<ChildDashboard>(`/children/${id}/dashboard`),

  update: (id: string, body: { name?: string; grade?: number; avatar_type?: string; avatar_color?: string; direct_answer_allowed?: boolean }) =>
    request<{ id: string }>(`/children/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  setPin: (id: string, pin: string) =>
    request<{ success: true; has_pin: true }>(`/children/${id}/pin`, { method: 'PUT', body: JSON.stringify({ pin }) }),

  disablePin: (id: string) =>
    request<{ success: true; has_pin: false }>(`/children/${id}/pin`, { method: 'DELETE' }),

  buildings: (id: string) =>
    request<BuildingItem[]>(`/children/${id}/buildings`),

  placeBuilding: (id: string, body: { building_type: string; position_x: number; position_y: number }) =>
    request<BuildingPlacementResult>(`/children/${id}/buildings`, { method: 'POST', body: JSON.stringify(body) }),

  curricula: (id: string) =>
    request<ChildCurriculum[]>(`/children/${id}/curricula`),

  learningTopics: (id: string, subject: 'math' | 'russian' | 'english') =>
    request<LearningTopic[]>(`/children/${id}/topics?subject=${subject}`),

  setTopicEnabled: (childId: string, curriculumId: string, topicKey: string, enabled: boolean) =>
    request<{ ok: boolean }>(`/children/${childId}/curricula/${curriculumId}/topics/${encodeURIComponent(topicKey)}`, {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    }),

  delete: (id: string, confirmation: string) =>
    request<{ success: true }>(`/children/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ confirmation }),
    }),
}
