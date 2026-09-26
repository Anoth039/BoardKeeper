const MS_PER_DAY = 86_400_000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export const toDate = (value: string | Date): Date => {
  if (value instanceof Date) return new Date(value);
  if (DATE_ONLY.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(value);
};

export const toDateString = (value: string | Date): string => {
  const d = toDate(value);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

export const dateString = (offsetDays = 0, base: string | Date = new Date()): string => {
  const d = toDate(base);
  d.setDate(d.getDate() + offsetDays);
  return toDateString(d);
};

export const monthStartString = (base: string | Date = new Date()): string => {
  const d = toDate(base);
  d.setDate(1);
  return toDateString(d);
};

export const daysBetween = (from: string | Date, to: string | Date = new Date()): number => {
  const a = toDate(from);
  a.setHours(0, 0, 0, 0);
  const b = toDate(to);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
};
