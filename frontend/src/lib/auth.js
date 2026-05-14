let currentUser = null

export function setCurrentUser(user) {
  currentUser = user
}

export function getUser() {
  return currentUser
}

export function getRole() {
  return currentUser?.role_name || null
}
