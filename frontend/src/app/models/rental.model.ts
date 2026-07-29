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
  gameCopy?: GameCopy | null;
  gameTitleSnapshot?: string;
  copyLabelSnapshot?: string;
  createdAt: string;
}

export function isRentalOverdue(rental: Rental): boolean {
  const today = new Date().toISOString().split('T')[0];
  return rental.status === RentalStatus.ACTIVE && rental.dueDate < today;
}

export function rentalStatusBadgeClass(rental: Rental): string {
  if (isRentalOverdue(rental)) return 'bg-danger';
  switch (rental.status) {
    case RentalStatus.ACTIVE: return 'bg-primary';
    case RentalStatus.RETURNED: return 'bg-success';
    default: return 'bg-secondary';
  }
}

export function rentalDisplayStatus(rental: Rental): string {
  if (isRentalOverdue(rental)) return 'overdue';
  return rental.status;
}