import { GameCopy } from './game.model';
import { Member } from './member.model';

export enum RentalStatus {
  ACTIVE = 'active',
  RETURNED = 'returned',
  OVERDUE = 'overdue',
  LOST = 'lost'
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
  handledBy?: { id: number; email: string } | null;
  returnedBy?: { id: number; email: string } | null;
  createdAt: string;
}

export function isRentalOverdue(rental: Rental): boolean {
  const today = new Date().toISOString().split('T')[0];
  return rental.status === RentalStatus.ACTIVE && rental.dueDate < today;
}

export function isRentalDueSoon(rental: Rental): boolean {
  if (rental.status !== RentalStatus.ACTIVE) return false;
  if (isRentalOverdue(rental)) return false;

  const today = new Date();
  const due = new Date(rental.dueDate);
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  return diffDays >= 0 && diffDays <= 2;
}

export function rentalStatusBadgeClass(rental: Rental): string {
  if (isRentalOverdue(rental)) return 'bg-danger';
  if (isRentalDueSoon(rental)) return 'bg-warning text-dark';
  switch (rental.status) {
    case RentalStatus.ACTIVE: return 'bg-primary';
    case RentalStatus.RETURNED: return 'bg-success';
    case RentalStatus.LOST: return 'bg-dark';
    default: return 'bg-secondary';
  }
}

export function rentalDisplayStatus(rental: Rental): string {
  if (isRentalOverdue(rental)) return 'overdue';
  if (isRentalDueSoon(rental)) return 'due soon';
  return rental.status;
}