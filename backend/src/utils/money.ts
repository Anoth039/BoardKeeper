export const round2 = (value: number): number => Math.round(value * 100) / 100;

export const decimalTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | number | null): number | null =>
    value === null || value === undefined ? null : Number(value),
};
