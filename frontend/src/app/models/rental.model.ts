import { GameCopy } from './game.model';
import { Member } from './member.model';
import { dateString, daysBetween } from '../utils/date';

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
  feeCharged: number;
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
  pricePerDaySnapshot?: number | null;
  rentalCharge?: number | null;
  lateFeeCharged?: number | null;
  extensionFeeCharged?: number | null;
  replacementFeeCharged?: number | null;
  totalCharged?: number | null;
  handledBy?: { id: number; email: string } | null;
  returnedBy?: { id: number; email: string } | null;
  extensions?: RentalExtension[];
  createdAt: string;
}

export function isRentalOverdue(rental: Rental): boolean {
  return rental.status === RentalStatus.ACTIVE && rental.dueDate < dateString();
}

export function isRentalDueSoon(rental: Rental): boolean {
  if (rental.status !== RentalStatus.ACTIVE) return false;
  if (isRentalOverdue(rental)) return false;

  const daysLeft = daysBetween(new Date(), rental.dueDate);
  return daysLeft >= 0 && daysLeft <= 2;
}