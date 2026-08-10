import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { AuthService } from '../../services/auth';

function passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
  const password = group.get('newPassword')?.value;
  const confirmPassword = group.get('confirmPassword')?.value;
  return password !== confirmPassword ? { passwordsMismatch: true } : null;
}

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.css'
})
export class ForgotPassword {
  step: 'email' | 'reset' = 'email';

  emailForm: FormGroup;
  resetForm: FormGroup;

  submittedEmail = '';
  submitting = false;
  errorMessage = '';
  successMessage = '';
  showNewPassword = false;
  showConfirmPassword = false;

  cooldownSeconds = 0;
  private cooldownInterval: any;

  constructor(private fb: FormBuilder, private authService: AuthService, private cdr: ChangeDetectorRef) {
    this.emailForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });

    this.resetForm = this.fb.group({
      code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required]
    }, { validators: passwordsMatchValidator });
  }

  requestCode(): void {
    if (this.emailForm.invalid) {
      this.emailForm.markAllAsTouched();
      this.cdr.detectChanges();
      return;
    }

    this.submitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    const email = this.emailForm.value.email;

    this.authService.forgotPassword(email).subscribe({
      next: () => {
        this.submitting = false;
        this.submittedEmail = email;
        this.step = 'reset';
        this.successMessage = 'A 6-digit code has been sent to your email.';
        this.startCooldown(60);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.submitting = false;
        if (err.status === 429 && err.error?.retryAfterSeconds) {
          this.startCooldown(err.error.retryAfterSeconds);
        }
        this.errorMessage = err.error?.message || 'Failed to send reset code.';
        console.error(err);
        this.cdr.detectChanges();
      }
    });
  }

  resendCode(): void {
    if (this.cooldownSeconds > 0) return;
    this.requestCode();
  }

  private startCooldown(seconds: number): void {
    this.cooldownSeconds = seconds;
    clearInterval(this.cooldownInterval);

    this.cooldownInterval = setInterval(() => {
      this.cooldownSeconds--;
      if (this.cooldownSeconds <= 0) {
        clearInterval(this.cooldownInterval);
      }
      this.cdr.detectChanges();
    }, 1000);
  }

  submitReset(): void {
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      this.cdr.detectChanges();
      return;
    }

    this.submitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    const { code, newPassword } = this.resetForm.value;

    this.authService.resetPassword(this.submittedEmail, code, newPassword).subscribe({
      next: () => {
        this.submitting = false;
        this.successMessage = 'Password reset successfully! You can now log in.';
        this.resetForm.reset();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.submitting = false;
        this.errorMessage = err.error?.message || 'Failed to reset password.';
        console.error(err);
        this.cdr.detectChanges();
      }
    });
  }

  backToEmailStep(): void {
    this.step = 'email';
    this.errorMessage = '';
    this.successMessage = '';
    clearInterval(this.cooldownInterval);
    this.cooldownSeconds = 0;
    this.cdr.detectChanges();
  }
}