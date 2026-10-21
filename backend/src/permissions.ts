export enum Role {
  STAFF = "staff",
  ADMIN = "admin",
}

export const PERMISSIONS = [
  "games:read",
  "games:write",
  "copies:read",
  "copies:write",
  "copies:audit",
  "copies:reserve",
  "queue:read",
  "queue:manage",
  "members:read",
  "members:write",
  "members:delete",
  "rentals:read",
  "rentals:create",
  "rentals:return",
  "rentals:extend",
  "rentals:mark_lost",
  "rentals:delete",
  "rentals:view_handlers",
  "rentals:export",
  "stats:view",
  "users:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const STAFF_PERMISSIONS: readonly Permission[] = [
  "games:read",
  "copies:read",
  "copies:reserve",
  "queue:read",
  "queue:manage",
  "members:read",
  "members:write",
  "rentals:read",
  "rentals:create",
  "rentals:return",
  "rentals:extend",
  "stats:view",
];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  [Role.STAFF]: STAFF_PERMISSIONS,
  [Role.ADMIN]: PERMISSIONS,
};

export const isRole = (value: unknown): value is Role =>
  value === Role.STAFF || value === Role.ADMIN;

export const permissionsOf = (role: string | undefined): readonly Permission[] =>
  isRole(role) ? ROLE_PERMISSIONS[role] : [];

export const hasPermission = (role: string | undefined, permission: Permission): boolean =>
  permissionsOf(role).includes(permission);
