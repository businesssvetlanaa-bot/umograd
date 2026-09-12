const BASE = '/api'

function getErrorMessage(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || !('error' in data)) return null
  return typeof data.error === 'string' ? data.error : null
}

export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token')
  let response: Response

  try {
    response = await fetch(BASE + path, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...options,
    })
  } catch {
    throw new Error('Не удалось связаться с сервером. Подождите немного и попробуйте ещё раз.')
  }

  const raw = await response.text()
  let data: unknown = null

  if (raw) {
    try {
      data = JSON.parse(raw)
    } catch {
      throw new Error('Сервер временно недоступен. Попробуйте ещё раз через минуту.')
    }
  }

  if (!response.ok) {
    throw new Error(getErrorMessage(data) ?? 'Не удалось выполнить действие. Попробуйте ещё раз.')
  }

  if (data === null) {
    throw new Error('Сервер не прислал ответ. Попробуйте ещё раз.')
  }

  return data as T
}
