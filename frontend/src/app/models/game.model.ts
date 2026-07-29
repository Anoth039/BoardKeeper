import { Rental } from './rental.model';

export interface Game {
  id: number;
  title: string;
  description?: string;
  minPlayers: number;
  maxPlayers: number;
  category?: string;
  imageUrl?: string;
  copies?: GameCopy[];
  createdAt: string;
}

export interface GameCopy {
  id: number;
  condition: string;
  copyNumber: string;
  isAvailable: boolean;
  game?: Game;
  rentals?: Rental[];
  createdAt: string;
}