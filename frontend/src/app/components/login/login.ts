import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth';

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
  errorMessage = '';
  successMessage = '';
  showPassword = false;
  
  constructor(private fb: FormBuilder, private authService: AuthService, private router: Router, 
    private route: ActivatedRoute, private cdr: ChangeDetectorRef) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });

    const reason = this.route.snapshot.queryParamMap.get('reason');
    if (reason === 'logout') {
      this.successMessage = 'You have been logged out successfully.';
    } else if (reason === 'expired') {
      this.errorMessage = 'Your session has expired. Please log in again.';
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.cdr.detectChanges();
      return;
    }

    this.submitting = true;
    this.errorMessage = '';

    const { email, password } = this.form.value;

    this.authService.login(email, password).subscribe({
      next: () => {
        this.submitting = false;
        this.router.navigate(['/stats']);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.submitting = false;
        this.errorMessage = err.error?.message || 'Login failed. Please try again.';
        console.error(err);
        this.cdr.detectChanges();
      }
    });
  }
}