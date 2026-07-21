import { Routes } from '@angular/router';
import { GameListComponent } from './components/game-list/game-list';
import { MemberListComponent } from './components/member-list/member-list';
import { RentalListComponent } from './components/rental-list/rental-list';
import { MemberDetail } from './components/member-detail/member-detail';

export const routes: Routes = [
  { path: '', redirectTo: 'games', pathMatch: 'full' },
  { path: 'games', component: GameListComponent },
  { path: 'members', component: MemberListComponent },
  { path: 'members/:id', component: MemberDetail },
  { path: 'rentals', component: RentalListComponent },
];