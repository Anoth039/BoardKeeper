import { describe, it, expect } from '@jest/globals';
import { isValidDateString, validateNewRentalDates, validateExtensionDate, MAX_RENTAL_DAYS, MAX_EXTENSION_DAYS } from '../../src/utils/rentalRules';
import { dateString } from '../../src/utils/date';

describe('isValidDateString', () => {
  it('valódi ÉÉÉÉ-HH-NN dátumot elfogad', () => {
    expect(isValidDateString('2026-10-18')).toBe(true);
    expect(isValidDateString('2028-02-29')).toBe(true);
  });

  it('rossz formátumot és nem létező dátumot elutasít', () => {
    for (const bad of ['', '9', '2026-1-5', '2026-02-30', '2027-02-29', '2026-13-01', 'holnap', null, undefined, 20261018]) {
      expect(isValidDateString(bad)).toBe(false);
    }
  });
});

describe('validateNewRentalDates', () => {
  it('érvényes kölcsönzésre nincs hiba', () => {
    expect(validateNewRentalDates(dateString(), dateString(3))).toBeNull();
  });

  it('a 60. napig rendben van, a 61. naptól hiba', () => {
    expect(validateNewRentalDates(dateString(), dateString(MAX_RENTAL_DAYS))).toBeNull();
    expect(validateNewRentalDates(dateString(), dateString(MAX_RENTAL_DAYS + 1))).not.toBeNull();
  });

  it('a határidő nem lehet a kezdet előtt, de egyező napon igen', () => {
    expect(validateNewRentalDates(dateString(2), dateString(1))).not.toBeNull();
    expect(validateNewRentalDates(dateString(2), dateString(2))).toBeNull();
  });

  it('a kezdet a -7 és +7 nap közötti sávon kívül hiba', () => {
    expect(validateNewRentalDates(dateString(-7), dateString(1))).toBeNull();
    expect(validateNewRentalDates(dateString(-8), dateString(1))).not.toBeNull();
    expect(validateNewRentalDates(dateString(7), dateString(9))).toBeNull();
    expect(validateNewRentalDates(dateString(8), dateString(9))).not.toBeNull();
  });

  it('érvénytelen formátumra hiba', () => {
    expect(validateNewRentalDates('holnap', dateString(3))).not.toBeNull();
    expect(validateNewRentalDates(dateString(), undefined)).not.toBeNull();
  });
});

describe('validateExtensionDate', () => {
  const current = '2026-10-20';

  it('a következő naptól a 14. napig rendben van', () => {
    expect(validateExtensionDate(current, '2026-10-21')).toBeNull();
    expect(validateExtensionDate(current, dateString(MAX_EXTENSION_DAYS, current))).toBeNull();
  });

  it('a jelenlegi vagy korábbi dátum hiba', () => {
    expect(validateExtensionDate(current, current)).not.toBeNull();
    expect(validateExtensionDate(current, '2026-10-19')).not.toBeNull();
  });

  it('a 14 napnál hosszabb hosszabbítás hiba', () => {
    expect(validateExtensionDate(current, dateString(MAX_EXTENSION_DAYS + 1, current))).not.toBeNull();
  });

  it('érvénytelen formátumra hiba (a sima szövegösszehasonlítás nem csúszhat át)', () => {
    expect(validateExtensionDate(current, '9')).not.toBeNull();
    expect(validateExtensionDate(current, 'zzz')).not.toBeNull();
  });
});
