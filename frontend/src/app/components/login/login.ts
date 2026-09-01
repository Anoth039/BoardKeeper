import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth';
import { ToastService } from '../../services/toast';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  form: FormGroup;
  submitting = false;
  showPassword = false;
  
  constructor(private fb: FormBuilder, private authService: AuthService, private router: Router, private route: ActivatedRoute,
    private cdr: ChangeDetectorRef, private toastService: ToastService) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });

    const reason = this.route.snapshot.queryParamMap.get('reason');
    if (reason) {
      if (reason === 'logout') {
        setTimeout(() => this.toastService.success('You have been logged out successfully.'));
      } else if (reason === 'expired') {
        setTimeout(() => this.toastService.error('Your session has expired. Please log in again.'));
      }

      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {},
        replaceUrl: true
      });
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.cdr.detectChanges();
      return;
    }

    this.submitting = true;

    const { email, password } = this.form.value;

    this.authService.login(email, password).subscribe({
      next: () => {
        this.submitting = false;
        this.toastService.success('Welcome back!');
        this.router.navigate(['/stats']);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.submitting = false;
        const message = err.error?.message || 'Login failed. Please try again.';
        this.toastService.error(message);
        console.error(err);
        this.cdr.detectChanges();
      }
    });
  }
}