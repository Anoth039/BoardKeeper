import { CopyCondition } from "../entities/GameCopy";
import { round2 } from "./money";
import { daysBetween } from "./date";

export const CONDITION_PRICE_MULTIPLIER: Record<CopyCondition, number> = {
  [CopyCondition.NEW]: 1,
  [CopyCondition.GOOD]: 1,
  [CopyCondition.WORN]: 0.75,
  [CopyCondition.DAMAGED]: 0.5,
  [CopyCondition.LOST]: 0,
};

export const LATE_FEE_RATE_MULTIPLIER = 1.5;

export const EXTENSION_FEE = 2;

export function effectiveDailyRate(gamePricePerDay: number | undefined | null, condition: CopyCondition): number {
  return round2((gamePricePerDay || 0) * (CONDITION_PRICE_MULTIPLIER[condition] ?? 1));
}

export interface ChargeInput {
  rentalDate: string | Date;
  dueDate: string | Date;
  returnDate: string | Date;
  ratePerDay: number | null | undefined;
  extensionFeeCharged?: number | null;
  replacementFee?: number | null;
}

export interface Charges {
  rentalCharge: number;
  lateFeeCharged: number;
  replacementFeeCharged: number;
  totalCharged: number;
}

export function calculateCharges(input: ChargeInput): Charges {
  const rate = input.ratePerDay || 0;
  const daysRented = Math.max(1, daysBetween(input.rentalDate, input.returnDate));
  const lateDays = Math.max(0, daysBetween(input.dueDate, input.returnDate));

  const rentalCharge = round2(rate * daysRented);
  const lateFeeCharged = lateDays > 0 ? round2(rate * LATE_FEE_RATE_MULTIPLIER * lateDays) : 0;
  const replacementFeeCharged = round2(input.replacementFee || 0);
  const totalCharged = round2(rentalCharge + lateFeeCharged + (input.extensionFeeCharged || 0) + replacementFeeCharged);

  return { rentalCharge, lateFeeCharged, replacementFeeCharged, totalCharged };
}