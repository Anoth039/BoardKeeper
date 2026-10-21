import { describe, it, expect } from '@jest/globals';
import { calculateCharges, effectiveDailyRate, CONDITION_PRICE_MULTIPLIER, LATE_FEE_RATE_MULTIPLIER, EXTENSION_FEE } from '../../src/utils/pricing';
import { CopyCondition } from '../../src/entities/GameCopy';

describe('utils/pricing', () => {
  describe('effectiveDailyRate', () => {
    it('új és jó állapotú példánynál a teljes napi díjat adja', () => {
      expect(effectiveDailyRate(4, CopyCondition.NEW)).toBe(4);
      expect(effectiveDailyRate(4, CopyCondition.GOOD)).toBe(4);
    });

    it('kopott példánynál 25% kedvezményt ad', () => {
      expect(effectiveDailyRate(4, CopyCondition.WORN)).toBe(3);
    });

    it('sérült példánynál 50% kedvezményt ad', () => {
      expect(effectiveDailyRate(4, CopyCondition.DAMAGED)).toBe(2);
    });

    it('elveszett példánynál 0', () => {
      expect(effectiveDailyRate(4, CopyCondition.LOST)).toBe(0);
    });

    it('hiányzó napi díjat 0-nak tekint', () => {
      expect(effectiveDailyRate(undefined, CopyCondition.GOOD)).toBe(0);
      expect(effectiveDailyRate(null, CopyCondition.GOOD)).toBe(0);
    });

    it('két tizedesre kerekít', () => {
      expect(effectiveDailyRate(3.33, CopyCondition.WORN)).toBe(2.5);
    });

    it('minden állapothoz tartozik szorzó', () => {
      for (const c of Object.values(CopyCondition)) {
        expect(CONDITION_PRICE_MULTIPLIER[c]).toBeDefined();
      }
    });
  });

  describe('calculateCharges', () => {
    const base = { rentalDate: '2026-05-01', dueDate: '2026-05-04', ratePerDay: 2 };

    it('határidőn belüli visszahozásnál csak a bérleti díjat számolja', () => {
      const c = calculateCharges({ ...base, returnDate: '2026-05-04' });
      expect(c.rentalCharge).toBe(6); // 3 nap * 2
      expect(c.lateFeeCharged).toBe(0);
      expect(c.replacementFeeCharged).toBe(0);
      expect(c.totalCharged).toBe(6);
    });

    it('határidő előtti visszahozásnál a ténylegesen eltöltött napokat számolja', () => {
      const c = calculateCharges({ ...base, returnDate: '2026-05-02' });
      expect(c.rentalCharge).toBe(2);
      expect(c.lateFeeCharged).toBe(0);
    });

    it('azonnali (ugyanaznapi) visszahozásnál is legalább 1 napot számláz', () => {
      const c = calculateCharges({ ...base, returnDate: '2026-05-01' });
      expect(c.rentalCharge).toBe(2);
    });

    it('késésnél a késedelmi díj a napi díj 1,5-szerese késett naponként', () => {
      const c = calculateCharges({ ...base, returnDate: '2026-05-06' }); // 5 nap, 2 nap késés
      expect(c.rentalCharge).toBe(10);
      expect(c.lateFeeCharged).toBe(2 * LATE_FEE_RATE_MULTIPLIER * 2);
      expect(c.totalCharged).toBe(16);
    });

    it('a hosszabbítási díj bekerül a végösszegbe, de nem a bérleti díjba', () => {
      const c = calculateCharges({ ...base, returnDate: '2026-05-04', extensionFeeCharged: EXTENSION_FEE });
      expect(c.rentalCharge).toBe(6);
      expect(c.totalCharged).toBe(6 + EXTENSION_FEE);
    });

    it('elveszett játéknál a pótlási érték hozzáadódik', () => {
      const c = calculateCharges({ ...base, returnDate: '2026-05-04', replacementFee: 40 });
      expect(c.replacementFeeCharged).toBe(40);
      expect(c.totalCharged).toBe(46);
    });

    it('minden tétel együtt szerepel a végösszegben', () => {
      const c = calculateCharges({
        ...base,
        returnDate: '2026-05-05', // 4 nap, 1 nap késés
        extensionFeeCharged: 2,
        replacementFee: 10,
      });
      expect(c.totalCharged).toBe(8 + 3 + 2 + 10);
    });

    it('hiányzó napi díj esetén 0 Ft-ot számol', () => {
      const c = calculateCharges({ ...base, ratePerDay: null, returnDate: '2026-05-06' });
      expect(c.totalCharged).toBe(0);
    });
  });
});
