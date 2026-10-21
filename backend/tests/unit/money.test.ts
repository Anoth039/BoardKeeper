import { describe, it, expect } from '@jest/globals';
import { round2, decimalTransformer } from '../../src/utils/money';

describe('utils/money', () => {
  describe('round2', () => {
    it('két tizedesre kerekít lefelé', () => {
      expect(round2(1.234)).toBe(1.23);
    });

    it('két tizedesre kerekít felfelé', () => {
      expect(round2(1.236)).toBe(1.24);
    });

    it('az egész számot nem változtatja', () => {
      expect(round2(5)).toBe(5);
    });

    it('kezeli a lebegőpontos pontatlanságot összegzésnél', () => {
      expect(round2(0.1 + 0.2)).toBe(0.3);
    });
  });

  describe('decimalTransformer', () => {
    it('az adatbázisból érkező DECIMAL szöveget számmá alakítja', () => {
      expect(decimalTransformer.from('12.50')).toBe(12.5);
    });

    it('a számot változatlanul hagyja', () => {
      expect(decimalTransformer.from(7)).toBe(7);
    });

    it('a null értéket null-ként tartja meg', () => {
      expect(decimalTransformer.from(null)).toBeNull();
    });

    it('mentéskor az értéket változatlanul adja át', () => {
      expect(decimalTransformer.to(3.5)).toBe(3.5);
      expect(decimalTransformer.to(null)).toBeNull();
    });
  });
});
