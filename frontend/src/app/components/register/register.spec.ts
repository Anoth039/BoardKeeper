import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Register } from './register';
import { AuthService } from '../../services/auth';
import { ToastService } from '../../services/toast';

describe('Regisztráció', () => {
  let component: Register;
  let fixture: ComponentFixture<Register>;
  let router: Router;

  const auth = { sendVerificationCode: vi.fn(), register: vi.fn() };
  const toast = { success: vi.fn(), error: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    auth.sendVerificationCode.mockReturnValue(of({ message: 'Code sent' }));
    auth.register.mockReturnValue(of({ isApproved: false }));
    await TestBed.configureTestingModule({
      imports: [Register],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: ToastService, useValue: toast },
        provideRouter([]),
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(Register);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('érvénytelen e-mail-címmel nem kér ellenőrzőkódot', () => {
    component.form.get('email')?.setValue('hibas-email');

    component.sendCode();

    expect(auth.sendVerificationCode).not.toHaveBeenCalled();
    expect(component.form.get('email')?.touched).toBe(true);
  });

  it('sikeres kódigénylés után jelzi, hogy elküldte a kódot', () => {
    component.form.get('email')?.setValue('anna@example.com');

    component.sendCode();

    expect(auth.sendVerificationCode).toHaveBeenCalledWith('anna@example.com');
    expect(component.codeSent).toBe(true);
    expect(component.sendingCode).toBe(false);
    expect(component.cooldownSeconds).toBe(60);
    expect(toast.success).toHaveBeenCalledWith('A 6-digit code has been sent to your email.');
    component.ngOnDestroy();
  });

  it('ellenőrzi a kód formátumát, a jelszó hosszát és a jelszavak egyezését', () => {
    component.form.setValue({
      email: 'anna@example.com', verificationCode: '123', password: 'short', confirmPassword: 'different',
    });

    expect(component.form.invalid).toBe(true);
    expect(component.form.hasError('passwordsMismatch')).toBe(true);
    component.onSubmit();
    expect(auth.register).not.toHaveBeenCalled();
  });

  it('sikeres regisztráció után a bejelentkezési oldalra navigál', () => {
    component.form.setValue({
      email: 'anna@example.com', verificationCode: '123456', password: 'strongpass', confirmPassword: 'strongpass',
    });

    component.onSubmit();

    expect(auth.register).toHaveBeenCalledWith('anna@example.com', 'strongpass', '123456');
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
    expect(toast.success).toHaveBeenCalledWith('Account created! An administrator must approve it before you can log in.');
    expect(component.submitting).toBe(false);
  });

  it('a regisztrációs hibát jelzi a felhasználónak', () => {
    auth.register.mockReturnValue(throwError(() => ({ error: { message: 'Invalid verification code.' } })));
    component.form.setValue({
      email: 'anna@example.com', verificationCode: '123456', password: 'strongpass', confirmPassword: 'strongpass',
    });

    component.onSubmit();

    expect(toast.error).toHaveBeenCalledWith('Invalid verification code.');
    expect(component.submitting).toBe(false);
  });
});
