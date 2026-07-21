import { Rental } from "./rental.model";

export interface Member {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  isActive: boolean;
  rentals?: Rental[];
  createdAt: string;
}