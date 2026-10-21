import { describe, it, expect } from '@jest/globals';
import { hasActiveReservation, MAX_ACTIVE_RENTALS_PER_MEMBER, MAX_ACTIVE_RESERVATIONS_PER_MEMBER, MAX_RESERVATION_DAYS } from '../../src/entities/GameCopy';
import { Member } from '../../src/entities/Member';
import { dateString } from '../../src/utils/date';

describe('GameCopy.hasActiveReservation', () => {
  const member = { id: 1 } as Member;

  it('igaz, ha van foglaló és a foglalás még él', () => {
    expect(hasActiveReservation({ reservedFor: member, reservedUntil: dateString(1) })).toBe(true);
  });

  it('a lejárat napján még él a foglalás', () => {
    expect(hasActiveReservation({ reservedFor: member, reservedUntil: dateString() })).toBe(true);
  });

  it('a lejárat másnapján már nem él', () => {
    expect(hasActiveReservation({ reservedFor: member, reservedUntil: dateString(-1) })).toBe(false);
  });

  it('hamis, ha nincs foglaló', () => {
    expect(hasActiveReservation({ reservedFor: null, reservedUntil: dateString(1) })).toBe(false);
  });

  it('hamis, ha nincs lejárati dátum', () => {
    expect(hasActiveReservation({ reservedFor: member, reservedUntil: null })).toBe(false);
  });
});

describe('üzleti korlátok', () => {
  it('a konfigurált korlátok a dokumentált értékek', () => {
    expect(MAX_RESERVATION_DAYS).toBe(2);
    expect(MAX_ACTIVE_RESERVATIONS_PER_MEMBER).toBe(2);
    expect(MAX_ACTIVE_RENTALS_PER_MEMBER).toBe(3);
  });
});
