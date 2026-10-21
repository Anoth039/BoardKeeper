import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Login } from './login';
import { AuthService } from '../../services/auth';
import { ToastService } from '../../services/toast';

describe('Bejelentkezés', () => {
  let fixture: ComponentFixture<Login>;
  let component: Login;
  const auth = { login: vi.fn() };
  let router: Router;
  const toast = { success: vi.fn(), error: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    auth.login.mockReturnValue(of({ token: 'jwt', user: { id: 1, email: 'staff@example.com', role: 'staff', permissions: [] } }));
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: ToastService, useValue: toast },
        provideRouter([]),
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
  });

  it('csak érvényes e-mail-címmel és jelszóval engedi a bejelentkezést', () => {
    expect(component.form.invalid).toBe(true);
    component.form.patchValue({ email: 'not-an-email', password: '' });
    expect(component.form.invalid).toBe(true);
    component.onSubmit();
    expect(component.form.touched).toBe(true);
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('sikeres bejelentkezés után az áttekintő oldalra navigál', () => {
    component.form.setValue({ email: 'staff@example.com', password: 'correct-password' });
    component.onSubmit();
    expect(auth.login).toHaveBeenCalledWith('staff@example.com', 'correct-password');
    expect(toast.success).toHaveBeenCalledWith('Welcome back!');
    expect(router.navigate).toHaveBeenCalledWith(['/stats']);
    expect(component.submitting).toBe(false);
  });

  it('hibaüzenetet jelenít meg, és sikertelen belépés után újra engedélyezi a beküldést', () => {
    auth.login.mockReturnValue(throwError(() => ({ status: 401, error: { message: 'Invalid credentials' } })));
    component.form.setValue({ email: 'staff@example.com', password: 'wrong-password' });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    component.onSubmit();
    expect(toast.error).toHaveBeenCalledWith('Invalid credentials');
    expect(component.submitting).toBe(false);
    errorSpy.mockRestore();
  });
});
