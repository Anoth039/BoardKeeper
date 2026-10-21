import { Component } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from './components/navbar/navbar';
import { filter } from 'rxjs';
import { AuthService } from './services/auth';
import { BackToTopComponent } from './components/back-to-top/back-to-top';
import { DialogComponent } from './components/dialog/dialog';
import { ToastComponent } from './components/toast/toast';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, NavbarComponent, BackToTopComponent, DialogComponent, ToastComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  showNavbar = true;

  constructor(private router: Router, private authService: AuthService) {
    if (this.authService.isLoggedIn()) {
      this.authService.refreshUser().subscribe({
        error: (err) => {
          if (err.status === 401) {
            this.authService.logout();
            this.router.navigate(['/login'], { queryParams: { reason: 'expired' } });
          }
        }
      });
    }
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        const path = event.urlAfterRedirects.split('?')[0];
        this.showNavbar = !['/login', '/register', '/forgot-password'].includes(path);
      });
  }
}