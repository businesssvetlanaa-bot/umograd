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

  buildings: (id: string) =>
    request<BuildingItem[]>(`/children/${id}/buildings`),

  placeBuilding: (id: string, body: { building_type: string; position_x: number; position_y: number }) =>
    request<{ id: string }>(`/children/${id}/buildings`, { method: 'POST', body: JSON.stringify(body) }),
}
