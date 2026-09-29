import { Rental } from './rental.model';
import { Member } from './member.model';
import { dateString } from '../utils/date';

export enum AgeRating {
  AGE_3 = 3,
  AGE_7 = 7,
  AGE_12 = 12,
  AGE_16 = 16,
  AGE_18 = 18,
}

export interface Game {
  id: number;
  title: string;
  description?: string;
  minPlayers: number;
  maxPlayers: number;
  category?: string;
  imageUrl?: string;
  ageRating?: AgeRating;
  estimatedTimeMinutes?: number;
  pricePerDay?: number;
  replacementValue?: number;
  copies?: GameCopy[];
  createdAt: string;
}

export interface GameCopy {
  id: number;
  condition: string;
  copyNumber: string;
  isAvailable: boolean;
  notes: string | null;
  reservedFor?: Member | null;
  reservedUntil?: string | null;
  game?: Game;
  rentals?: Rental[];
  createdAt: string;
}

export function isCopyReserved(copy: GameCopy): boolean {
  return !!copy.reservedFor && !!copy.reservedUntil && copy.reservedUntil >= dateString();
}

export interface QueueEntry {
  id: number;
  createdAt: string;
  member: Member;
}

export interface CopyAuditLog {
  id: number;
  copyNumber: string;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  performedBy: { email: string } | null;
  createdAt: string;
}