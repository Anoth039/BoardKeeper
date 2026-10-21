import { dateString, daysBetween, formatDate, pluralDays, timeAgo, toDate, toDateString } from './date';

describe('Dátumkezelés', () => {
  it('a dátumot helyi idő szerint értelmezi, napeltolás nélkül', () => {
    const date = toDate('2026-10-15');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(9);
    expect(date.getDate()).toBe(15);
  });

  it('ÉÉÉÉ-HH-NN formátumban adja vissza a dátumot', () => {
    expect(toDateString(new Date(2026, 9, 5))).toBe('2026-10-05');
    expect(toDateString('2026-01-02')).toBe('2026-01-02');
  });

  it('a megadott számú nappal előre vagy hátra módosítja a dátumot', () => {
    expect(dateString(7, '2026-10-15')).toBe('2026-10-22');
    expect(dateString(-1, '2026-01-01')).toBe('2025-12-31');
    expect(dateString(0, '2024-02-28')).toBe('2024-02-28');
  });

  it('a napok közötti különbséget a napszaktól függetlenül számítja ki', () => {
    expect(daysBetween('2026-10-10', '2026-10-15')).toBe(5);
    expect(daysBetween('2026-10-15', '2026-10-10')).toBe(-5);
    expect(daysBetween(new Date(2026, 9, 15, 23), new Date(2026, 9, 16, 1))).toBe(1);
  });

  it('helyesen használja az egyes és többes számú nap alakot', () => {
    expect(pluralDays(1)).toBe('1 day');
    expect(pluralDays(0)).toBe('0 days');
    expect(pluralDays(3)).toBe('3 days');
  });

  it('relatív időt jelző szöveget ad vissza, szükség esetén nagybetűvel kezdve', () => {
    const now = new Date('2026-10-15T12:00:00');
    expect(timeAgo('2026-10-15', { now })).toBe('today');
    expect(timeAgo('2026-10-14', { now, capitalize: true })).toBe('Yesterday');
    expect(timeAgo('2026-10-15T11:59:00', { now })).toBe('1 minute ago');
  });

  it('a megadott formátumban jeleníti meg a dátumot', () => {
    const result = formatDate('2026-10-15', 'medium');
    expect(result).toContain('2026');
    expect(result).toContain('15');
  });
});
