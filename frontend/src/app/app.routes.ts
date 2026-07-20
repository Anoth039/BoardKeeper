import { Routes } from '@angular/router';
import { GameListComponent } from './components/game-list/game-list';
import { MemberListComponent } from './components/member-list/member-list';
import { RentalListComponent } from './components/rental-list/rental-list';

export const routes: Routes = [
  { path: '', redirectTo: 'games', pathMatch: 'full' },
  { path: 'games', component: GameListComponent },
  { path: 'members', component: MemberListComponent },
  { path: 'rentals', component: RentalListComponent },
];