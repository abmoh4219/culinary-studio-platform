export const ROLE = {
  MEMBER: 'MEMBER',
  INSTRUCTOR: 'INSTRUCTOR',
  FRONT_DESK: 'FRONT_DESK',
  ADMIN: 'ADMIN'
} as const;

export type AuthoritativeRole = (typeof ROLE)[keyof typeof ROLE];

export function hasRole(roles: string[], role: AuthoritativeRole): boolean {
  return roles.includes(role);
}

export function isAdminRole(roles: string[]): boolean {
  return hasRole(roles, ROLE.ADMIN);
}

export function isFrontDeskRole(roles: string[]): boolean {
  return hasRole(roles, ROLE.FRONT_DESK);
}

export function isInstructorRole(roles: string[]): boolean {
  return hasRole(roles, ROLE.INSTRUCTOR);
}

export function isMemberRole(roles: string[]): boolean {
  return hasRole(roles, ROLE.MEMBER) || roles.includes('USER');
}
