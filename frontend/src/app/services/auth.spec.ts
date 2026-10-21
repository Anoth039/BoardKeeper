import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth';
import { AuthUser, LoginResponse } from '../models/user.model';

describe('Hitelesítés', () => {
  let service: AuthService;
  let http: HttpTestingController;
  const api = 'http://localhost:3000/api/auth';
  const user: AuthUser = { id: 7, email: 'staff@example.com', role: 'staff', permissions: ['rentals:manage'] };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('ellenőrzőkódot kér a megadott e-mail-címhez', () => {
    service.sendVerificationCode('staff@example.com').subscribe();
    const req = http.expectOne(`${api}/send-verification-code`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'staff@example.com' });
    req.flush({ message: 'Code sent' });
  });

  it('a megadott e-mail-címmel, jelszóval és ellenőrzőkóddal regisztrál', () => {
    service.register('staff@example.com', 'strong-password', '123456').subscribe();
    const req = http.expectOne(`${api}/register`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'staff@example.com', password: 'strong-password', verificationCode: '123456' });
    req.flush({ message: 'Registered', isApproved: false });
  });

  it('sikeres bejelentkezéskor elmenti a tokent és a felhasználói adatokat', () => {
    const response: LoginResponse = { token: 'jwt-token', user };
    service.login(user.email, 'password').subscribe();
    expect(localStorage.getItem('boardkeeper_token')).toBeNull();
    const req = http.expectOne(`${api}/login`);
    expect(req.request.body).toEqual({ email: user.email, password: 'password' });
    req.flush(response);
    expect(service.getToken()).toBe('jwt-token');
    expect(service.getCurrentUser()).toEqual(user);
    expect(service.isLoggedIn()).toBe(true);
  });

  it('kijelentkezéskor törli a munkamenet adatait, és ellenőrzi a jogosultságokat', () => {
    localStorage.setItem('boardkeeper_token', 'jwt-token');
    localStorage.setItem('boardkeeper_user', JSON.stringify(user));
    expect(service.can('rentals:manage')).toBe(true);
    expect(service.can('users:manage')).toBe(false);
    service.logout();
    expect(service.getToken()).toBeNull();
    expect(service.getCurrentUser()).toBeNull();
    expect(service.isLoggedIn()).toBe(false);
    expect(service.can('rentals:manage')).toBe(false);
  });

  it('frissíti az aktuális felhasználó adatait a localStorage-ban', () => {
    service.refreshUser().subscribe(result => expect(result).toEqual(user));
    const req = http.expectOne(`${api}/me`);
    expect(req.request.method).toBe('GET');
    req.flush(user);
    expect(service.getCurrentUser()).toEqual(user);
  });

  it('elküldi az elfelejtett jelszóhoz és a jelszó visszaállításához szükséges kéréseket', () => {
    service.forgotPassword(user.email).subscribe();
    const forgot = http.expectOne(`${api}/forgot-password`);
    expect(forgot.request.body).toEqual({ email: user.email });
    forgot.flush({ message: 'If the account exists, an email has been sent.' });

    service.resetPassword(user.email, '654321', 'new-password').subscribe();
    const reset = http.expectOne(`${api}/reset-password`);
    expect(reset.request.method).toBe('POST');
    expect(reset.request.body).toEqual({ email: user.email, code: '654321', newPassword: 'new-password' });
    reset.flush({ message: 'Password updated' });
  });
});
