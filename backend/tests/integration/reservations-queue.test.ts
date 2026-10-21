import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app';
import { AppDataSource } from '../../src/data-source';
import { GameCopy } from '../../src/entities/GameCopy';
import { GameQueueEntry } from '../../src/entities/GameQueueEntry';
import { CopyAuditLog, AuditAction } from '../../src/entities/CopyAuditLog';
import { User } from '../../src/entities/User';
import { sendReservationEmail } from '../../src/mailer';
import { assignQueuedReservations } from '../../src/controllers/queueController';
import { dateString } from '../../src/utils/date';
import { initDb, closeDb, resetDb, createStaff, createAdmin, createGame, createCopy, createMember, createRentalDirect, bearer } from '../helpers';

jest.mock('../../src/mailer', () => ({
  sendCodeEmail: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  sendReservationEmail: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  sendApprovalEmail: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));
const mockedReservationMail = jest.mocked(sendReservationEmail);

let staff: User;
const auth = () => ({ Authorization: bearer(staff) });
const reserve = (copyId: number, memberId: number, reservedUntil = dateString(1)) =>
  request(app).put(`/api/game-copies/${copyId}/reserve`).set(auth()).send({ memberId, reservedUntil });
const copyWithHolder = (id: number) =>
  AppDataSource.getRepository(GameCopy).findOneOrFail({ where: { id }, relations: { reservedFor: true } });

beforeAll(initDb);
afterAll(closeDb);
beforeEach(async () => {
  await resetDb();
  mockedReservationMail.mockClear();
  staff = await createStaff();
});

describe('Példány foglalása', () => {
  it('sikeres foglalás: 200, a foglaló és a lejárat rögzül, e-mail megy, auditnapló készül', async () => {
    const copy = await createCopy(await createGame());
    const member = await createMember();

    const res = await reserve(copy.id, member.id, dateString(2));

    expect(res.status).toBe(200);
    const after = await copyWithHolder(copy.id);
    expect(after.reservedFor?.id).toBe(member.id);
    expect(after.reservedUntil).toBe(dateString(2));
    expect(mockedReservationMail).toHaveBeenCalledTimes(1);
    expect(mockedReservationMail.mock.calls[0][0]).toBe(member.email);
    expect(await AppDataSource.getRepository(CopyAuditLog).count({ where: { action: AuditAction.RESERVED } })).toBe(1);
  });

  it('a foglalás egy tag másik példányát nem érinti, a példány kölcsönözhető a foglalónak (lásd rentals teszt)', async () => {
    const game = await createGame();
    const a = await createCopy(game);
    const b = await createCopy(game);
    const member = await createMember();
    await reserve(a.id, member.id).expect(200);
    expect((await copyWithHolder(b.id)).reservedFor).toBeNull();
  });

  it('hiányzó adatokkal 400', async () => {
    const copy = await createCopy(await createGame());
    const res = await request(app).put(`/api/game-copies/${copy.id}/reserve`).set(auth()).send({});
    expect(res.status).toBe(400);
  });

  it.each(['2026-13-45', '2026/05/10', 'holnap', '2026-02-30'])('érvénytelen dátumformátum (%s) esetén 400', async (bad) => {
    const copy = await createCopy(await createGame());
    const member = await createMember();
    const res = await reserve(copy.id, member.id, bad);
    expect(res.status).toBe(400);
  });

  it('múltbeli dátumra nem lehet foglalni (400)', async () => {
    const copy = await createCopy(await createGame());
    const member = await createMember();
    const res = await reserve(copy.id, member.id, dateString(-1));
    expect(res.status).toBe(400);
  });

  it('legfeljebb 2 napra előre lehet foglalni (400)', async () => {
    const copy = await createCopy(await createGame());
    const member = await createMember();
    expect((await reserve(copy.id, member.id, dateString(2))).status).toBe(200);
    const other = await createCopy(await createGame());
    const tooLate = await reserve(other.id, member.id, dateString(3));
    expect(tooLate.status).toBe(400);
  });

  it('ismeretlen példányra / tagra 404', async () => {
    const copy = await createCopy(await createGame());
    const member = await createMember();
    expect((await reserve(999999, member.id)).status).toBe(404);
    expect((await reserve(copy.id, 999999)).status).toBe(404);
  });

  it('inaktív tag nem foglalhat (409)', async () => {
    const copy = await createCopy(await createGame());
    const member = await createMember({ isActive: false });
    expect((await reserve(copy.id, member.id)).status).toBe(409);
  });

  it('kikölcsönzött példány nem foglalható (409)', async () => {
    const copy = await createCopy(await createGame());
    const renter = await createMember();
    const member = await createMember();
    await createRentalDirect(renter, copy);
    expect((await reserve(copy.id, member.id)).status).toBe(409);
  });

  it('már lefoglalt példány nem foglalható újra (409)', async () => {
    const copy = await createCopy(await createGame());
    const first = await createMember();
    const second = await createMember();
    await reserve(copy.id, first.id).expect(200);
    expect((await reserve(copy.id, second.id)).status).toBe(409);
  });

  it('tagonként legfeljebb 2 aktív foglalás/várólista-hely lehet (409)', async () => {
    const member = await createMember();
    const game = await createGame();
    const c1 = await createCopy(game);
    const c2 = await createCopy(game);
    const c3 = await createCopy(game);
    await reserve(c1.id, member.id).expect(200);
    await reserve(c2.id, member.id).expect(200);
    const res = await reserve(c3.id, member.id);
    expect(res.status).toBe(409);
  });
});

describe('Foglalás lemondása', () => {
  it('a foglalás megszűnik, auditnapló készül', async () => {
    const copy = await createCopy(await createGame());
    const member = await createMember();
    await reserve(copy.id, member.id).expect(200);

    const res = await request(app).delete(`/api/game-copies/${copy.id}/reserve`).set(auth());

    expect(res.status).toBe(200);
    const after = await copyWithHolder(copy.id);
    expect(after.reservedFor).toBeNull();
    expect(after.reservedUntil).toBeNull();
    expect(await AppDataSource.getRepository(CopyAuditLog).count({ where: { action: AuditAction.RESERVATION_CANCELLED } })).toBe(1);
  });

  it('nem lefoglalt példány foglalása nem mondható le (409)', async () => {
    const copy = await createCopy(await createGame());
    const res = await request(app).delete(`/api/game-copies/${copy.id}/reserve`).set(auth());
    expect(res.status).toBe(409);
  });

  it('nem létező példányra 404', async () => {
    const res = await request(app).delete('/api/game-copies/999999/reserve').set(auth());
    expect(res.status).toBe(404);
  });

  it('lemondás után a várólistán következő automatikusan megkapja a példányt', async () => {
    const game = await createGame();
    const copy = await createCopy(game);
    const holder = await createMember();
    const waiting = await createMember();
    await reserve(copy.id, holder.id).expect(200);
    await request(app).post(`/api/games/${game.id}/queue`).set(auth()).send({ memberId: waiting.id }).expect(201);

    await request(app).delete(`/api/game-copies/${copy.id}/reserve`).set(auth()).expect(200);

    expect((await copyWithHolder(copy.id)).reservedFor?.id).toBe(waiting.id);
    expect(await AppDataSource.getRepository(GameQueueEntry).count()).toBe(0);
  });
});

describe('Várólista', () => {
  it('ha van szabad példány, nem lehet sorba állni (409)', async () => {
    const game = await createGame();
    await createCopy(game);
    const member = await createMember();
    const res = await request(app).post(`/api/games/${game.id}/queue`).set(auth()).send({ memberId: member.id });
    expect(res.status).toBe(409);
  });

  it('ha minden példány kikölcsönzött, sorba lehet állni (201)', async () => {
    const game = await createGame();
    const copy = await createCopy(game);
    await createRentalDirect(await createMember(), copy);
    const member = await createMember();

    const res = await request(app).post(`/api/games/${game.id}/queue`).set(auth()).send({ memberId: member.id });

    expect(res.status).toBe(201);
    expect(await AppDataSource.getRepository(GameQueueEntry).count()).toBe(1);
  });

  async function gameWithAllCopiesRented() {
    const game = await createGame();
    const copy = await createCopy(game);
    const renter = await createMember();
    const rental = await createRentalDirect(renter, copy);
    return { game, copy, rental };
  }

  it('ugyanaz a tag kétszer nem állhat be ugyanabba a sorba (409)', async () => {
    const { game } = await gameWithAllCopiesRented();
    const member = await createMember();
    await request(app).post(`/api/games/${game.id}/queue`).set(auth()).send({ memberId: member.id }).expect(201);
    const again = await request(app).post(`/api/games/${game.id}/queue`).set(auth()).send({ memberId: member.id });
    expect(again.status).toBe(409);
  });

  it('hiányzó memberId esetén 400, ismeretlen játékra/tagra 404, inaktív tagra 409', async () => {
    const { game } = await gameWithAllCopiesRented();
    const inactive = await createMember({ isActive: false });
    const member = await createMember();
    expect((await request(app).post(`/api/games/${game.id}/queue`).set(auth()).send({})).status).toBe(400);
    expect((await request(app).post('/api/games/999999/queue').set(auth()).send({ memberId: member.id })).status).toBe(404);
    expect((await request(app).post(`/api/games/${game.id}/queue`).set(auth()).send({ memberId: 999999 })).status).toBe(404);
    expect((await request(app).post(`/api/games/${game.id}/queue`).set(auth()).send({ memberId: inactive.id })).status).toBe(409);
  });

  it('a sorrend érkezési sorrendű (FIFO)', async () => {
    const { game } = await gameWithAllCopiesRented();
    const first = await createMember({ firstName: 'Első' });
    const second = await createMember({ firstName: 'Második' });
    await request(app).post(`/api/games/${game.id}/queue`).set(auth()).send({ memberId: first.id }).expect(201);
    await request(app).post(`/api/games/${game.id}/queue`).set(auth()).send({ memberId: second.id }).expect(201);

    const res = await request(app).get(`/api/games/${game.id}/queue`).set(auth());

    expect(res.status).toBe(200);
    expect(res.body.map((e: { member: { firstName: string } }) => e.member.firstName)).toEqual(['Első', 'Második']);
  });

  it('visszahozáskor a sor elején álló tag automatikusan lefoglalja a példányt és e-mailt kap', async () => {
    const { game, copy, rental } = await gameWithAllCopiesRented();
    const first = await createMember();
    const second = await createMember();
    await request(app).post(`/api/games/${game.id}/queue`).set(auth()).send({ memberId: first.id }).expect(201);
    await request(app).post(`/api/games/${game.id}/queue`).set(auth()).send({ memberId: second.id }).expect(201);

    await request(app).put(`/api/rentals/${rental.id}/return`).set(auth()).send({}).expect(200);

    const after = await copyWithHolder(copy.id);
    expect(after.reservedFor?.id).toBe(first.id);
    expect(after.reservedUntil).toBe(dateString(2));
    // a másodikat még várakozik
    const remaining = await AppDataSource.getRepository(GameQueueEntry).find({ relations: { member: true } });
    expect(remaining.map(e => e.member.id)).toEqual([second.id]);
    expect(mockedReservationMail).toHaveBeenCalledTimes(1);
    expect(mockedReservationMail.mock.calls[0][0]).toBe(first.email);
  });

  it('inaktív tagot kihagy a sorból, és a következőnek adja a példányt', async () => {
    const { game, copy } = await gameWithAllCopiesRented();
    const leaving = await createMember();
    const next = await createMember();
    await request(app).post(`/api/games/${game.id}/queue`).set(auth()).send({ memberId: leaving.id }).expect(201);
    await request(app).post(`/api/games/${game.id}/queue`).set(auth()).send({ memberId: next.id }).expect(201);
    await AppDataSource.getRepository('Member').update(leaving.id, { isActive: false });

    await AppDataSource.getRepository(GameCopy).update(copy.id, { isAvailable: true });
    await assignQueuedReservations();

    expect((await copyWithHolder(copy.id)).reservedFor?.id).toBe(next.id);
  });

  it('új példány felvételekor a várakozó megkapja', async () => {
    const { game } = await gameWithAllCopiesRented();
    const waiting = await createMember();
    await request(app).post(`/api/games/${game.id}/queue`).set(auth()).send({ memberId: waiting.id }).expect(201);

    const admin = await createAdmin();
    const res = await request(app).post('/api/game-copies').set({ Authorization: bearer(admin) })
      .send({ gameId: game.id, copyNumber: 'UJ-0001' });

    expect(res.status).toBe(201);
    expect(res.body.reservedFor?.id).toBe(waiting.id);
  });

  it('a sorból ki lehet lépni (204), nem létező bejegyzésre 404', async () => {
    const { game } = await gameWithAllCopiesRented();
    const member = await createMember();
    const joined = await request(app).post(`/api/games/${game.id}/queue`).set(auth()).send({ memberId: member.id }).expect(201);

    const del = await request(app).delete(`/api/games/${game.id}/queue/${joined.body.id}`).set(auth());
    const missing = await request(app).delete(`/api/games/${game.id}/queue/999999`).set(auth());

    expect(del.status).toBe(204);
    expect(missing.status).toBe(404);
  });

  it('a tag legfeljebb 2 foglalást/sorhelyet tarthat (409 a harmadikra)', async () => {
    const member = await createMember();
    const games = [];
    for (let i = 0; i < 3; i++) {
      const g = await createGame();
      await createRentalDirect(await createMember(), await createCopy(g));
      games.push(g);
    }
    await request(app).post(`/api/games/${games[0].id}/queue`).set(auth()).send({ memberId: member.id }).expect(201);
    await request(app).post(`/api/games/${games[1].id}/queue`).set(auth()).send({ memberId: member.id }).expect(201);
    const third = await request(app).post(`/api/games/${games[2].id}/queue`).set(auth()).send({ memberId: member.id });
    expect(third.status).toBe(409);
  });
});

describe('Példányok kezelése (admin)', () => {
  let admin: User;
  beforeEach(async () => { admin = await createAdmin(); });
  const post = (body: object) => request(app).post('/api/game-copies').set({ Authorization: bearer(admin) }).send(body);

  it('létrehozás: 201, alapállapot "good", auditnapló készül', async () => {
    const game = await createGame();
    const res = await post({ gameId: game.id, copyNumber: 'ABC-001' });
    expect(res.status).toBe(201);
    expect(res.body.condition).toBe('good');
    expect(await AppDataSource.getRepository(CopyAuditLog).count({ where: { action: AuditAction.CREATED } })).toBe(1);
  });

  it('a példányazonosító 3-12 karakter lehet (400 egyébként)', async () => {
    const game = await createGame();
    expect((await post({ gameId: game.id, copyNumber: 'AB' })).status).toBe(400);
    expect((await post({ gameId: game.id, copyNumber: 'A'.repeat(13) })).status).toBe(400);
    expect((await post({ gameId: game.id, copyNumber: 'ABC' })).status).toBe(201);
  });

  it('azonos játékon belül az azonosító egyedi, kis/nagybetűtől függetlenül (409)', async () => {
    const game = await createGame();
    await post({ gameId: game.id, copyNumber: 'abc-001' }).expect(201);
    expect((await post({ gameId: game.id, copyNumber: 'ABC-001' })).status).toBe(409);
  });

  it('másik játéknál ugyanaz az azonosító használható', async () => {
    const g1 = await createGame();
    const g2 = await createGame();
    await post({ gameId: g1.id, copyNumber: 'ABC-001' }).expect(201);
    expect((await post({ gameId: g2.id, copyNumber: 'ABC-001' })).status).toBe(201);
  });

  it('hiányzó adatok / ismeretlen játék: 400 / 404', async () => {
    expect((await post({})).status).toBe(400);
    expect((await post({ gameId: 999999, copyNumber: 'ABC-001' })).status).toBe(404);
  });
});

describe('Párhuzamosság', () => {
  it('két egyszerre érkező kölcsönzés ugyanarra a példányra: pontosan egy sikerülhet', async () => {
    const copy = await createCopy(await createGame());
    const a = await createMember();
    const b = await createMember();
    const body = (memberId: number) => ({ memberId, gameCopyId: copy.id, rentalDate: dateString(), dueDate: dateString(3) });

    const [r1, r2] = await Promise.all([
      request(app).post('/api/rentals').set(auth()).send(body(a.id)),
      request(app).post('/api/rentals').set(auth()).send(body(b.id)),
    ]);

    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([201, 409]);
    expect(await AppDataSource.getRepository('Rental').count()).toBe(1);
  });
});
