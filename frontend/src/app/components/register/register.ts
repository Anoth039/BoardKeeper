import { Component, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { AuthService } from '../../services/auth';
import { ToastService } from '../../services/toast';

function passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirmPassword = group.get('confirmPassword')?.value;
  return password !== confirmPassword ? { passwordsMismatch: true } : null;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register implements OnDestroy {
  form: FormGroup;
  submitting = false;
  sendingCode = false;
  codeSent = false;
  cooldownSeconds = 0;
  showPassword = false;
  showConfirmPassword = false;
  private cooldownInterval: any;

  constructor(private fb: FormBuilder, private authService: AuthService, private router: Router,
    private cdr: ChangeDetectorRef, private toastService: ToastService) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      verificationCode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required]
    }, { validators: passwordsMatchValidator });
  }

  ngOnDestroy(): void {
    if (this.cooldownInterval) {
      clearInterval(this.cooldownInterval);
    }
  }

  get canSendCode(): boolean {
    const emailCtrl = this.form.get('email');
    return !!emailCtrl && emailCtrl.valid && this.cooldownSeconds === 0 && !this.sendingCode;
  }

  sendCode(): void {
    const email = this.form.get('email')?.value;
    if (!email || this.form.get('email')?.invalid) {
      this.form.get('email')?.markAsTouched();
      this.cdr.detectChanges();
      return;
    }

    this.sendingCode = true;

    this.authService.sendVerificationCode(email).subscribe({
      next: () => {
        this.sendingCode = false;
        this.codeSent = true;
        this.toastService.success('A 6-digit code has been sent to your email.');
        this.startCooldown(60);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.sendingCode = false;
        if (err.status === 429 && err.error?.retryAfterSeconds) {
          this.startCooldown(err.error.retryAfterSeconds);
        }
        const message = err.error?.message || 'Failed to send code.';
        this.toastService.error(message);
        this.cdr.detectChanges();
      }
    });
  }

  private startCooldown(seconds: number): void {
    this.cooldownSeconds = seconds;
    clearInterval(this.cooldownInterval);
    this.cooldownInterval = setInterval(() => {
      this.cooldownSeconds--;
      if (this.cooldownSeconds <= 0) clearInterval(this.cooldownInterval);
      this.cdr.detectChanges();
    }, 1000);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.cdr.detectChanges();
      return;
    }

    this.submitting = true;

    const { email, password, verificationCode } = this.form.value;

    this.authService.register(email, password, verificationCode).subscribe({
      next: () => {
        this.submitting = false;
        this.toastService.success('Account created successfully! Please log in.');
        this.router.navigate(['/login']);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.submitting = false;
        const message = err.error?.message || 'Registration failed. Please try again.';
        this.toastService.error(message);
        this.cdr.detectChanges();
      }
    });
  }
}