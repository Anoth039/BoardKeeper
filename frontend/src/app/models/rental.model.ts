import { GameCopy } from './game.model';
import { Member } from './member.model';

export enum RentalStatus {
  ACTIVE = 'active',
  RETURNED = 'returned',
  OVERDUE = 'overdue',
  LOST = 'lost'
}

export interface RentalExtension {
  id: number;
  previousDueDate: string;
  newDueDate: string;
  extendedBy: { id: number; email: string } | null;
  extendedAt: string;
}

export interface Rental {
  id: number;
  rentalDate: string;
  dueDate: string;
  originalDueDate: string | null;
  returnDate: string | null;
  status: RentalStatus;
  member?: Member;
  gameCopy?: GameCopy | null;
  gameTitleSnapshot?: string;
  copyLabelSnapshot?: string;
  handledBy?: { id: number; email: string } | null;
  returnedBy?: { id: number; email: string } | null;
  extensions?: RentalExtension[];
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