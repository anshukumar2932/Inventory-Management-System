import { API_BASE } from '../config/api'
export { API_BASE }

let accessToken = null
let onLogout = null
let isRefreshing = false
let refreshPromise = null

export function setAccessToken(token) {
  accessToken = token
}

export function setLogoutHandler(handler) {
  onLogout = handler
}

function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' }
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
  return headers
}

async function tryRefreshToken() {
  if (isRefreshing) return refreshPromise

  isRefreshing = true
  refreshPromise = fetch(`${API_BASE}/api/v1/auth/token/refresh/`, {
    method: 'POST',
    credentials: 'include',
  })
    .then(async (res) => {
      if (!res.ok) throw new Error('Refresh failed')
      const data = await res.json()
      if (!data.access) throw new Error('Refresh response missing access token')
      setAccessToken(data.access)
      return data.access
    })
    .catch((err) => {
      accessToken = null
      if (onLogout) onLogout()
      throw err
    })
    .finally(() => {
      isRefreshing = false
      refreshPromise = null
    })

  return refreshPromise
}

async function request(url, options = {}) {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`
  const headers = { ...getAuthHeaders(), ...options.headers }
  if (options.body instanceof FormData) delete headers['Content-Type']

  let res = await fetch(fullUrl, {
    ...options,
    headers,
    credentials: 'include',
  })

  if (res.status === 401) {
    try {
      await tryRefreshToken()
      headers['Authorization'] = `Bearer ${accessToken}`
      res = await fetch(fullUrl, {
        ...options,
        headers,
        credentials: 'include',
      })
    } catch {
      throw new Error('Session expired')
    }
  }

  return res
}

export async function apiGet(url, opts) {
  return request(url, { ...opts, method: 'GET' })
}

export async function apiPost(url, body, opts) {
  return request(url, {
    ...opts,
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function apiPatch(url, body, opts) {
  return request(url, {
    ...opts,
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function apiPut(url, body, opts) {
  return request(url, {
    ...opts,
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function apiDelete(url, opts) {
  return request(url, { ...opts, method: 'DELETE' })
}

export async function apiUpload(url, formData, opts) {
  return request(url, {
    ...opts,
    method: 'POST',
    body: formData,
  })
}
