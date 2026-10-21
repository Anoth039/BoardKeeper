import { TestBed } from '@angular/core/testing';
import { CanActivateFn, Router } from '@angular/router';
import { vi } from 'vitest';
import { authGuard } from './auth-guard';
import { AuthService } from '../services/auth';

describe('Bejelentkezés ellenőrzése', () => {
  const auth = { isLoggedIn: vi.fn() };
  const router = { navigate: vi.fn() };
  const executeGuard: CanActivateFn = (...params) => TestBed.runInInjectionContext(() => authGuard(...params));

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({ providers: [
      { provide: AuthService, useValue: auth },
      { provide: Router, useValue: router },
    ] });
  });

  it('bejelentkezett felhasználónál engedélyezi az oldal megnyitását', () => {
    auth.isLoggedIn.mockReturnValue(true);
    expect(executeGuard({} as any, {} as any)).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('bejelentkezés nélkül a bejelentkezési oldalra irányít', () => {
    auth.isLoggedIn.mockReturnValue(false);
    expect(executeGuard({} as any, {} as any)).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
