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

  findChildProfiles: (parentEmail: string) =>
    request<import('../types/auth').ChildLoginProfile[]>(`/children/by-parent-email?email=${encodeURIComponent(parentEmail)}`),

  me: () => request<{ role: 'parent' | 'child'; user?: import('../types/auth').User; child?: import('../types/auth').Child }>('/auth/me'),

  getChildren: (parentId: string) =>
    request<import('../types/auth').Child[]>(`/children?parent_id=${parentId}`),

  changePassword: (body: { current_password: string; new_password: string }) =>
    request<{ success: true; token: string }>('/auth/password', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  deleteAccount: (body: { current_password: string; confirmation: string }) =>
    request<{ success: true }>('/auth/account', {
      method: 'DELETE',
      body: JSON.stringify(body),
    }),
}
