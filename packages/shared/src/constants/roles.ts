export const Role = {
  ADMIN: 'ADMIN',
  OPERATOR: 'OPERATOR',
  USER: 'USER',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

// 权限层级：ADMIN > OPERATOR > USER
export const ROLE_HIERARCHY: Record<Role, number> = {
  ADMIN: 3,
  OPERATOR: 2,
  USER: 1,
};
