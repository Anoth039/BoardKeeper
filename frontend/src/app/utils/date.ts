const MS_PER_DAY = 86_400_000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const FORMATS = {
  short: { month: 'short', day: 'numeric' },
  medium: { year: 'numeric', month: 'short', day: 'numeric' },
  monthYear: { year: 'numeric', month: 'long' },
} as const;

export interface TimeAgoOptions {
  now?: Date;
  capitalize?: boolean;
}

export function toDate(value: string | Date): Date {
  if (value instanceof Date) return new Date(value);
  if (DATE_ONLY.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(value);
}

export function toDateString(value: string | Date): string {
  const d = toDate(value);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function dateString(offsetDays = 0, base: string | Date = new Date()): string {
  const d = toDate(base);
  d.setDate(d.getDate() + offsetDays);
  return toDateString(d);
}

export function daysBetween(from: string | Date, to: string | Date = new Date()): number {
  const a = toDate(from);
  a.setHours(0, 0, 0, 0);
  const b = toDate(to);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

export function pluralDays(n: number): string {
  return `${n} day${n === 1 ? '' : 's'}`;
}

export function timeAgo(value: string | Date, { now = new Date(), capitalize = false }: TimeAgoOptions = {}): string {
  const text = relativeText(value, now);
  return capitalize ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function relativeText(value: string | Date, now: Date): string {
  if (typeof value === 'string' && DATE_ONLY.test(value)) {
    const days = daysBetween(value, now);
    if (days < 30) return rtf.format(-days, 'day');
    if (days < 365) return rtf.format(-Math.floor(days / 30), 'month');
    return rtf.format(-Math.floor(days / 365), 'year');
  }

  const seconds = Math.floor((now.getTime() - toDate(value).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return rtf.format(-Math.floor(seconds / 60), 'minute');
  if (seconds < 86400) return rtf.format(-Math.floor(seconds / 3600), 'hour');
  return relativeText(toDateString(value), now);
}

export function formatDate(value: string | Date, style: keyof typeof FORMATS = 'medium'): string {
  return toDate(value).toLocaleDateString(undefined, FORMATS[style]);
}