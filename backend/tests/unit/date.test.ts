import { describe, it, expect } from '@jest/globals';
import { toDate, toDateString, dateString, monthStartString, daysBetween } from '../../src/utils/date';

describe('utils/date', () => {
  describe('toDate', () => {
    it('az ÉÉÉÉ-HH-NN szöveget helyi időként értelmezi (nem UTC-ként)', () => {
      const d = toDate('2026-03-05');
      expect(d.getFullYear()).toBe(2026);
      expect(d.getMonth()).toBe(2);
      expect(d.getDate()).toBe(5);
      expect(d.getHours()).toBe(0);
    });

    it('Date bemenetből másolatot készít, az eredetit nem módosítja', () => {
      const original = new Date(2026, 0, 10);
      const copy = toDate(original);
      copy.setDate(20);
      expect(original.getDate()).toBe(10);
    });
  });

  describe('toDateString', () => {
    it('kétjegyűre egészíti ki a hónapot és a napot', () => {
      expect(toDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
    });

    it('oda-vissza konvertálva ugyanazt a szöveget adja', () => {
      expect(toDateString('2026-12-31')).toBe('2026-12-31');
    });
  });

  describe('dateString', () => {
    it('eltolás nélkül a mai napot adja', () => {
      expect(dateString()).toBe(toDateString(new Date()));
    });

    it('pozitív eltolással átlép a hónap határán', () => {
      expect(dateString(2, '2026-01-31')).toBe('2026-02-02');
    });

    it('átlép az év határán', () => {
      expect(dateString(1, '2026-12-31')).toBe('2027-01-01');
    });

    it('negatív eltolással visszafelé lép', () => {
      expect(dateString(-1, '2026-03-01')).toBe('2026-02-28');
    });

    it('szökőévben létezik február 29.', () => {
      expect(dateString(1, '2028-02-28')).toBe('2028-02-29');
    });
  });

  describe('monthStartString', () => {
    it('a hónap első napját adja', () => {
      expect(monthStartString('2026-07-19')).toBe('2026-07-01');
    });
  });

  describe('daysBetween', () => {
    it('ugyanazon a napon 0', () => {
      expect(daysBetween('2026-05-10', '2026-05-10')).toBe(0);
    });

    it('a napok számát adja', () => {
      expect(daysBetween('2026-05-10', '2026-05-15')).toBe(5);
    });

    it('visszafelé negatív értéket ad', () => {
      expect(daysBetween('2026-05-15', '2026-05-10')).toBe(-5);
    });

    it('a napon belüli időpontot figyelmen kívül hagyja', () => {
      const morning = new Date(2026, 4, 10, 8, 0);
      const night = new Date(2026, 4, 11, 23, 59);
      expect(daysBetween(morning, night)).toBe(1);
    });

    it('a nyári időszámítás átállásánál (Europe/Budapest, 2026-03-29) is egész napot ad', () => {
      expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    });

    it('a téli időszámítás átállásánál (2026-10-25) is egész napot ad', () => {
      expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
    });
  });
});
