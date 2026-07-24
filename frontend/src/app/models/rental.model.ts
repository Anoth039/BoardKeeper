import { GameCopy } from './game.model';
import { Member } from './member.model';

export enum RentalStatus {
  ACTIVE = 'active',
  RETURNED = 'returned',
  OVERDUE = 'overdue',
}

export interface Rental {
  id: number;
  rentalDate: string;
  dueDate: string;
  returnDate: string | null;
  status: RentalStatus;
  member?: Member;
  gameCopy?: GameCopy;
  createdAt: string;
}