import { getRole } from './auth'

export function isSuperAdmin(role) {
  return (role || getRole()) === 'SUPER_ADMIN'
}

export function isDeptAdmin(role) {
  return (role || getRole()) === 'DEPARTMENT_ADMIN'
}

export function isManager(role) {
  return (role || getRole()) === 'MANAGER'
}

export function isUser(role) {
  return (role || getRole()) === 'USER'
}

export function isDeptAdminOrAbove(role) {
  const r = role || getRole()
  return r === 'SUPER_ADMIN' || r === 'DEPARTMENT_ADMIN'
}

export function isManagerOrAbove(role) {
  const r = role || getRole()
  return r === 'SUPER_ADMIN' || r === 'DEPARTMENT_ADMIN' || r === 'MANAGER'
}
