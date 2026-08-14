import { Rental } from './rental.model';

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
  copies?: GameCopy[];
  createdAt: string;
}

export interface GameCopy {
  id: number;
  condition: string;
  copyNumber: string;
  isAvailable: boolean;
  notes: string | null;
  game?: Game;
  rentals?: Rental[];
  createdAt: string;
}