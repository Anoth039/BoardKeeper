import { CopyCondition } from "../entities/GameCopy";
import { round2 } from "./money";

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
