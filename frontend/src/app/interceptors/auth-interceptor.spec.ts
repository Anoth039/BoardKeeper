import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { authInterceptor } from './auth-interceptor';
import { AuthService } from '../services/auth';

describe('Hitelesítési interceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;
  let router: Router;
  let auth: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
    ] });
    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    auth = TestBed.inject(AuthService);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('a bejelentkezési tokent hozzáadja a kérésekhez', () => {
    localStorage.setItem('boardkeeper_token', 'test.jwt.token');
    httpClient.get('/api/games').subscribe();
    const req = httpMock.expectOne('/api/games');
    expect(req.request.headers.get('Authorization')).toBe('Bearer test.jwt.token');
    req.flush([]);
  });

  it('védett végpont 401-es válaszakor kijelentkeztet és a bejelentkezési oldalra irányít', () => {
    localStorage.setItem('boardkeeper_token', 'expired-token');
    localStorage.setItem('boardkeeper_user', JSON.stringify({ id: 1 }));
    httpClient.get('/api/games').subscribe({ error: () => undefined });
    const req = httpMock.expectOne('/api/games');
    req.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
    expect(auth.getToken()).toBeNull();
    expect(auth.getCurrentUser()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { reason: 'expired' } });
  });

  it('bejelentkezési végpont 401-es válasza esetén nem jelentkeztet ki újra', () => {
    localStorage.setItem('boardkeeper_token', 'existing-token');
    httpClient.post('/api/auth/login', {}).subscribe({ error: () => undefined });
    const req = httpMock.expectOne('/api/auth/login');
    req.flush({ message: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });
    expect(auth.getToken()).toBe('existing-token');
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
