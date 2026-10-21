import { TestBed } from '@angular/core/testing';
import { CanActivateFn, Router } from '@angular/router';
import { vi } from 'vitest';
import { adminGuard } from './admin-guard';
import { AuthService } from '../services/auth';

describe('Adminisztrátori jogosultság ellenőrzése', () => {
  const auth = { can: vi.fn() };
  const router = { navigate: vi.fn() };
  const executeGuard: CanActivateFn = (...params) => TestBed.runInInjectionContext(() => adminGuard(...params));

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({ providers: [
      { provide: AuthService, useValue: auth },
      { provide: Router, useValue: router },
    ] });
  });

  it('engedélyezi a felhasználókezelési jogosultsággal rendelkező felhasználókat', () => {
    auth.can.mockReturnValue(true);
    expect(executeGuard({} as any, {} as any)).toBe(true);
    expect(auth.can).toHaveBeenCalledWith('users:manage');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('jogosultság hiányában a statisztikai oldalra irányít', () => {
    auth.can.mockReturnValue(false);
    expect(executeGuard({} as any, {} as any)).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/stats']);
  });
});
