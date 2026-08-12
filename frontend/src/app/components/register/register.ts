import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { AuthService } from '../../services/auth';

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
export class Register {
  form: FormGroup;
  submitting = false;
  sendingCode = false;
  errorMessage = '';
  successMessage = '';
  codeSent = false;
  cooldownSeconds = 0;
  showPassword = false;
  showConfirmPassword = false;
  private cooldownInterval: any;

  constructor(private fb: FormBuilder, private authService: AuthService, private router: Router, private cdr: ChangeDetectorRef) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      verificationCode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required]
    }, { validators: passwordsMatchValidator });
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
    this.errorMessage = '';

    this.authService.sendVerificationCode(email).subscribe({
      next: () => {
        this.sendingCode = false;
        this.codeSent = true;
        this.successMessage = 'A 6-digit code has been sent to your email.';
        this.startCooldown(60);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.sendingCode = false;
        if (err.status === 429 && err.error?.retryAfterSeconds) {
          this.startCooldown(err.error.retryAfterSeconds);
        }
        this.errorMessage = err.error?.message || 'Failed to send code.';
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
    this.errorMessage = '';
    this.successMessage = '';

    const { email, password, verificationCode } = this.form.value;

    this.authService.register(email, password, verificationCode).subscribe({
      next: () => {
        this.submitting = false;
        this.successMessage = 'Account created! You can now log in.';
        this.form.reset();
        this.codeSent = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.submitting = false;
        this.errorMessage = err.error?.message || 'Registration failed. Please try again.';
        this.cdr.detectChanges();
      }
    });
  }
}