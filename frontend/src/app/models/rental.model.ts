import { GameCopy } from './game.model';

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
  gameCopy?: GameCopy;
  createdAt: string;
}