import { Routes } from '@angular/router';
import { GameListComponent } from './components/game-list/game-list';
import { MemberListComponent } from './components/member-list/member-list';
import { RentalListComponent } from './components/rental-list/rental-list';
import { MemberDetail } from './components/member-detail/member-detail';
import { Register } from './components/register/register';
import { Login } from './components/login/login';
import { authGuard } from './guards/auth-guard';
import { StatsPage } from './components/stats/stats';
import { adminGuard } from './guards/admin-guard';

export const routes: Routes = [
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  { path: '', redirectTo: 'games', pathMatch: 'full' },
  { path: 'games', component: GameListComponent, canActivate: [authGuard] },
  { path: 'members', component: MemberListComponent, canActivate: [authGuard] },
  { path: 'members/:id', component: MemberDetail, canActivate: [authGuard] },
  { path: 'rentals', component: RentalListComponent, canActivate: [authGuard] },
  { path: 'stats', component: StatsPage, canActivate: [authGuard, adminGuard] },
];