import { apiRequest as request } from './request'

export const authApi = {
  register: (body: { name: string; email: string; password: string }) =>
    request<{ token: string; user: { id: string; name: string; email: string } }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  login: (body: { email: string; password: string }) =>
    request<{ token: string; user: { id: string; name: string; email: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  childLogin: (body: { child_id: string; pin: string }) =>
    request<{ token: string; child: import('../types/auth').Child }>('/auth/child-login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  me: () => request<{ role: 'parent' | 'child'; user?: import('../types/auth').User; child?: import('../types/auth').Child }>('/auth/me'),

  getChildren: (parentId: string) =>
    request<import('../types/auth').Child[]>(`/children?parent_id=${parentId}`),
}
