// Shared authentication helpers for pages with role-based controls.
// The backend remains the final authority for every protected request.
const AUTH_API_BASE_URL = 'http://localhost:3000/api'

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
  })

  if (response.status === 401) {
    window.location.href = 'login.html'
    throw new Error('Authentication required.')
  }

  if (response.status === 403) {
    const permissionError = new Error('You do not have permission to perform this action.')
    permissionError.name = 'PermissionError'
    throw permissionError
  }

  return response
}

async function getAuthenticatedUser() {
  const response = await apiFetch(`${AUTH_API_BASE_URL}/user/profile`)

  if (!response.ok) {
    throw new Error(`Unable to load user role. Status: ${response.status}`)
  }

  return response.json()
}

function canManageContent(user) {
  const role = String(user?.role || '').toLowerCase()
  return role === 'cr' || role === 'professor'
}

window.CampusAuth = Object.freeze({
  apiFetch,
  canManageContent,
  getAuthenticatedUser,
})
