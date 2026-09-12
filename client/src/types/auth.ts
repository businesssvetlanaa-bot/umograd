export interface User {
  id: string
  name: string
  email: string
}

export interface Child {
  id: string
  name: string
  avatar_type: string
  avatar_color: string
  xp: number
  level: number
  coins: number
  streak_days: number
}

export interface AuthState {
  token: string | null
  role: 'parent' | 'child' | null
  user: User | null
  child: Child | null
}
