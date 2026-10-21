import { describe, it, expect } from '@jest/globals';
import { PERMISSIONS, Role, hasPermission, isRole, permissionsOf } from '../../src/permissions';

describe('jogosultsági mátrix', () => {
  it('az admin minden jogosultsággal rendelkezik', () => {
    for (const p of PERMISSIONS) {
      expect(hasPermission(Role.ADMIN, p)).toBe(true);
    }
  });

  it('a staff nem rendelkezik a törzsadat-, pénzügyi és felhasználókezelési jogokkal', () => {
    for (const p of [
      'games:write', 'copies:write', 'copies:audit', 'members:delete',
      'rentals:mark_lost', 'rentals:delete', 'rentals:view_handlers', 'rentals:export', 'users:manage',
    ] as const) {
      expect(hasPermission(Role.STAFF, p)).toBe(false);
    }
  });

  it('a staff elvégezheti a napi operatív feladatokat', () => {
    for (const p of [
      'games:read', 'copies:read', 'copies:reserve', 'queue:manage', 'members:read', 'members:write',
      'rentals:read', 'rentals:create', 'rentals:return', 'rentals:extend', 'stats:view',
    ] as const) {
      expect(hasPermission(Role.STAFF, p)).toBe(true);
    }
  });

  it('a staff jogai az admin jogainak részhalmaza', () => {
    for (const p of permissionsOf(Role.STAFF)) {
      expect(hasPermission(Role.ADMIN, p)).toBe(true);
    }
  });

  it('ismeretlen vagy hiányzó szerepkör semmit nem tehet', () => {
    expect(permissionsOf('superuser')).toEqual([]);
    expect(permissionsOf(undefined)).toEqual([]);
    expect(hasPermission('superuser', 'games:read')).toBe(false);
  });

  it('isRole csak az érvényes szerepköröket fogadja el', () => {
    expect(isRole('staff')).toBe(true);
    expect(isRole('admin')).toBe(true);
    expect(isRole('root')).toBe(false);
    expect(isRole(undefined)).toBe(false);
  });
});
