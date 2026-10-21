import { dateString, daysBetween, toDateString } from "./date";

export const MAX_RENTAL_DAYS = 60;
export const MAX_RENTAL_START_PAST_DAYS = 7;
export const MAX_RENTAL_START_FUTURE_DAYS = 7;
export const MAX_EXTENSION_DAYS = 14;
export const MAX_EXTENSIONS_PER_RENTAL = 3;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export const isValidDateString = (value: unknown): value is string => {
  if (typeof value !== "string" || !DATE_ONLY.test(value)) return false;
  return toDateString(value) === value;
};

export const validateNewRentalDates = (rentalDate: unknown, dueDate: unknown): string | null => {
  if (!isValidDateString(rentalDate) || !isValidDateString(dueDate)) {
    return "rentalDate and dueDate must be valid dates in YYYY-MM-DD format";
  }
  const today = dateString();
  if (daysBetween(today, rentalDate) < -MAX_RENTAL_START_PAST_DAYS) {
    return `The rental date cannot be more than ${MAX_RENTAL_START_PAST_DAYS} days in the past`;
  }
  if (daysBetween(today, rentalDate) > MAX_RENTAL_START_FUTURE_DAYS) {
    return `The rental date cannot be more than ${MAX_RENTAL_START_FUTURE_DAYS} days in the future`;
  }
  if (dueDate < rentalDate) {
    return "Due date cannot be before the rental date";
  }
  if (daysBetween(rentalDate, dueDate) > MAX_RENTAL_DAYS) {
    return `A rental cannot be longer than ${MAX_RENTAL_DAYS} days`;
  }
  return null;
};

export const validateExtensionDate = (currentDueDate: string, newDueDate: unknown): string | null => {
  if (!isValidDateString(newDueDate)) {
    return "newDueDate must be a valid date in YYYY-MM-DD format";
  }
  if (newDueDate <= currentDueDate) {
    return "New due date must be after the current due date";
  }
  if (daysBetween(currentDueDate, newDueDate) > MAX_EXTENSION_DAYS) {
    return `A single extension cannot be longer than ${MAX_EXTENSION_DAYS} days`;
  }
  return null;
};
