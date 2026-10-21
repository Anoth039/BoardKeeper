import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app';
import { AppDataSource } from '../../src/data-source';
import { GameCopy, CopyCondition } from '../../src/entities/GameCopy';
import { Rental, RentalStatus } from '../../src/entities/Rental';
import { RentalExtension } from '../../src/entities/RentalExtension';
import { CopyAuditLog, AuditAction } from '../../src/entities/CopyAuditLog';
import { User } from '../../src/entities/User';
import { dateString } from '../../src/utils/date';
import { EXTENSION_FEE } from '../../src/utils/pricing';
import { MAX_RENTAL_DAYS, MAX_EXTENSION_DAYS, MAX_EXTENSIONS_PER_RENTAL } from '../../src/utils/rentalRules';
import { initDb, closeDb, resetDb, createStaff, createAdmin, createGame, createCopy, createMember, createRentalDirect, bearer } from '../helpers';

jest.mock('../../src/mailer', () => ({
  sendCodeEmail: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  sendReservationEmail: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  sendApprovalEmail: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));

let staff: User;
let admin: User;
const auth = () => ({ Authorization: bearer(staff) });
const adminAuth = () => ({ Authorization: bearer(admin) });

const rentBody = (memberId: number, gameCopyId: number, over: Record<string, unknown> = {}) => ({
  memberId, gameCopyId, rentalDate: dateString(), dueDate: dateString(3), ...over,
});
const postRental = (body: object) => request(app).post('/api/rentals').set(auth()).send(body);
const reloadCopy = (id: number) => AppDataSource.getRepository(GameCopy).findOneByOrFail({ id });
const reloadRental = (id: number) => AppDataSource.getRepository(Rental).findOneByOrFail({ id });

beforeAll(initDb);
afterAll(closeDb);
beforeEach(async () => {
  await resetDb();
  staff = await createStaff();
  admin = await createAdmin();
});

describe('Kölcsönzés indítása (POST /api/rentals)', () => {
  it('sikeres kölcsönzés: 201, a példány kikölcsönzötté válik, az ár és a cím rögzül', async () => {
    const game = await createGame({ title: 'Catan', pricePerDay: 4 });
    const copy = await createCopy(game);
    const member = await createMember();

    const res = await postRental(rentBody(member.id, copy.id));

    expect(res.status).toBe(201);
    expect(res.body.status).toBe(RentalStatus.ACTIVE);
    expect(res.body.gameTitleSnapshot).toBe('Catan');
    expect(res.body.pricePerDaySnapshot).toBe(4);
    expect(res.body.originalDueDate).toBe(dateString(3));
    expect((await reloadCopy(copy.id)).isAvailable).toBe(false);
  });

  it('a kölcsönzést végző munkatárs rögzítésre kerül', async () => {
    const copy = await createCopy(await createGame());
    const member = await createMember();
    const res = await postRental(rentBody(member.id, copy.id));
    const saved = await AppDataSource.getRepository(Rental).findOneOrFail({ where: { id: res.body.id }, relations: { handledBy: true } });
    expect(saved.handledBy?.id).toBe(staff.id);
  });

  it('kopott példánynál csökkentett napi díjat (75%) rögzít', async () => {
    const copy = await createCopy(await createGame({ pricePerDay: 4 }), { condition: CopyCondition.WORN });
    const member = await createMember();
    const res = await postRental(rentBody(member.id, copy.id));
    expect(res.body.pricePerDaySnapshot).toBe(3);
  });

  it('a díj a kölcsönzéskori árat rögzíti: a játék későbbi áremelése nem hat vissza', async () => {
    const game = await createGame({ pricePerDay: 2 });
    const copy = await createCopy(game);
    const member = await createMember();
    const res = await postRental(rentBody(member.id, copy.id));

    const admin = await createAdmin();
    await request(app).put(`/api/games/${game.id}`).set({ Authorization: bearer(admin) }).send({ pricePerDay: 10 }).expect(200);

    expect((await reloadRental(res.body.id)).pricePerDaySnapshot).toBe(2);
  });

  it.each(['memberId', 'gameCopyId', 'rentalDate', 'dueDate'])('hiányzó %s esetén 400', async (field) => {
    const copy = await createCopy(await createGame());
    const member = await createMember();
    const body: Record<string, unknown> = rentBody(member.id, copy.id);
    delete body[field];
    const res = await postRental(body);
    expect(res.status).toBe(400);
  });

  it('ismeretlen tagra 404', async () => {
    const copy = await createCopy(await createGame());
    const res = await postRental(rentBody(999999, copy.id));
    expect(res.status).toBe(404);
  });

  it('ismeretlen példányra 404', async () => {
    const member = await createMember();
    const res = await postRental(rentBody(member.id, 999999));
    expect(res.status).toBe(404);
  });

  it('inaktív tag nem kölcsönözhet (409)', async () => {
    const copy = await createCopy(await createGame());
    const member = await createMember({ isActive: false });
    const res = await postRental(rentBody(member.id, copy.id));
    expect(res.status).toBe(409);
    expect((await reloadCopy(copy.id)).isAvailable).toBe(true);
  });

  it('már kikölcsönzött példány nem adható ki újra (409)', async () => {
    const copy = await createCopy(await createGame());
    const first = await createMember();
    const second = await createMember();
    await postRental(rentBody(first.id, copy.id)).expect(201);

    const res = await postRental(rentBody(second.id, copy.id));
    expect(res.status).toBe(409);
    expect(await AppDataSource.getRepository(Rental).count()).toBe(1);
  });

  it('elveszett példány nem adható ki (409)', async () => {
    const copy = await createCopy(await createGame(), { condition: CopyCondition.LOST, isAvailable: true });
    const member = await createMember();
    const res = await postRental(rentBody(member.id, copy.id));
    expect(res.status).toBe(409);
  });

  it('késedelmes kölcsönzéssel rendelkező tag nem kölcsönözhet újat (409)', async () => {
    const game = await createGame();
    const member = await createMember();
    const oldCopy = await createCopy(game);
    await createRentalDirect(member, oldCopy, { rentalOffset: -10, dueOffset: -3 });

    const newCopy = await createCopy(game);
    const res = await postRental(rentBody(member.id, newCopy.id));
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/overdue/i);
  });

  it('legfeljebb 3 aktív kölcsönzés lehet tagonként: a 4. elutasítva (409)', async () => {
    const game = await createGame();
    const member = await createMember();
    for (let i = 0; i < 3; i++) {
      const c = await createCopy(game);
      await postRental(rentBody(member.id, c.id)).expect(201);
    }
    const fourth = await createCopy(game);
    const res = await postRental(rentBody(member.id, fourth.id));
    expect(res.status).toBe(409);
    expect(await AppDataSource.getRepository(Rental).count()).toBe(3);
  });

  it('visszahozás után a korlát felszabadul', async () => {
    const game = await createGame();
    const member = await createMember();
    const rentals = [];
    for (let i = 0; i < 3; i++) {
      const c = await createCopy(game);
      rentals.push((await postRental(rentBody(member.id, c.id)).expect(201)).body);
    }
    await request(app).put(`/api/rentals/${rentals[0].id}/return`).set(auth()).send({}).expect(200);

    const another = await createCopy(game);
    const res = await postRental(rentBody(member.id, another.id));
    expect(res.status).toBe(201);
  });

  it('másnak lefoglalt példány nem adható ki (409)', async () => {
    const copy = await createCopy(await createGame());
    const holder = await createMember();
    const other = await createMember();
    await AppDataSource.getRepository(GameCopy).update(copy.id, { reservedFor: holder, reservedUntil: dateString(1) });

    const res = await postRental(rentBody(other.id, copy.id));
    expect(res.status).toBe(409);
  });

  it('a foglaló tagnak kiadható, és a foglalás megszűnik', async () => {
    const copy = await createCopy(await createGame());
    const holder = await createMember();
    await AppDataSource.getRepository(GameCopy).update(copy.id, { reservedFor: holder, reservedUntil: dateString(1) });

    const res = await postRental(rentBody(holder.id, copy.id));
    expect(res.status).toBe(201);

    const after = await AppDataSource.getRepository(GameCopy).findOneOrFail({ where: { id: copy.id }, relations: { reservedFor: true } });
    expect(after.reservedFor).toBeNull();
    expect(after.reservedUntil).toBeNull();
    expect(after.isAvailable).toBe(false);
  });

  it('lejárt foglalású példány már bárkinek kiadható', async () => {
    const copy = await createCopy(await createGame());
    const holder = await createMember();
    const other = await createMember();
    await AppDataSource.getRepository(GameCopy).update(copy.id, { reservedFor: holder, reservedUntil: dateString(-1) });

    const res = await postRental(rentBody(other.id, copy.id));
    expect(res.status).toBe(201);
  });
});

describe('Kölcsönzés dátumainak ellenőrzése a backenden (POST /api/rentals)', () => {
  const setup = async () => ({
    copy: await createCopy(await createGame()),
    member: await createMember(),
  });

  it('pontosan a maximális időtartamra (60 nap) kiadható', async () => {
    const { copy, member } = await setup();
    const res = await postRental(rentBody(member.id, copy.id, { dueDate: dateString(MAX_RENTAL_DAYS) }));
    expect(res.status).toBe(201);
  });

  it('a maximális időtartamnál hosszabb kölcsönzés elutasítva (400), a példány szabad marad', async () => {
    const { copy, member } = await setup();
    const res = await postRental(rentBody(member.id, copy.id, { dueDate: dateString(MAX_RENTAL_DAYS + 1) }));
    expect(res.status).toBe(400);
    expect((await reloadCopy(copy.id)).isAvailable).toBe(true);
    expect(await AppDataSource.getRepository(Rental).count()).toBe(0);
  });

  it('a 60 napot a kölcsönzés kezdetétől számolja, nem a mai naptól', async () => {
    const { copy, member } = await setup();
    const res = await postRental(rentBody(member.id, copy.id, { rentalDate: dateString(5), dueDate: dateString(5 + MAX_RENTAL_DAYS + 1) }));
    expect(res.status).toBe(400);
  });

  it('a határidő nem előzheti meg a kölcsönzés kezdetét (400)', async () => {
    const { copy, member } = await setup();
    const res = await postRental(rentBody(member.id, copy.id, { rentalDate: dateString(2), dueDate: dateString(1) }));
    expect(res.status).toBe(400);
  });

  it('a kezdete legfeljebb 7 nappal lehet a jövőben (400)', async () => {
    const { copy, member } = await setup();
    const res = await postRental(rentBody(member.id, copy.id, { rentalDate: dateString(8), dueDate: dateString(10) }));
    expect(res.status).toBe(400);
  });

  it('a kezdete legfeljebb 7 nappal lehet a múltban (400)', async () => {
    const { copy, member } = await setup();
    const res = await postRental(rentBody(member.id, copy.id, { rentalDate: dateString(-8), dueDate: dateString(3) }));
    expect(res.status).toBe(400);
  });

  it('érvénytelen dátumformátumot elutasít (400)', async () => {
    const { copy, member } = await setup();
    for (const bad of ['holnap', '2026-13-40', '2026-02-30', '20261020', 12345]) {
      const res = await postRental(rentBody(member.id, copy.id, { dueDate: bad }));
      expect(res.status).toBe(400);
    }
  });
});

describe('Visszavétel (PUT /api/rentals/:id/return)', () => {
  it('határidőn belül: lezárul, a díj a töltött napokból jön, a példány újra elérhető', async () => {
    const game = await createGame();
    const copy = await createCopy(game);
    const member = await createMember();
    const rental = await createRentalDirect(member, { ...copy, game } as GameCopy, { rentalOffset: -2, dueOffset: 1, rate: 3 });

    const res = await request(app).put(`/api/rentals/${rental.id}/return`).set(auth()).send({});

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(RentalStatus.RETURNED);
    expect(res.body.returnDate).toBe(dateString());
    expect(res.body.rentalCharge).toBe(6); // 2 nap * 3
    expect(res.body.lateFeeCharged).toBe(0);
    expect(res.body.totalCharged).toBe(6);
    expect((await reloadCopy(copy.id)).isAvailable).toBe(true);
  });

  it('késve: a késedelmi díj a napi díj 1,5-szerese késett naponként', async () => {
    const copy = await createCopy(await createGame());
    const member = await createMember();
    // 5 napja kölcsönözve, 2 napja járt le, napi díj 2
    const rental = await createRentalDirect(member, copy, { rentalOffset: -5, dueOffset: -2, rate: 2 });

    const res = await request(app).put(`/api/rentals/${rental.id}/return`).set(auth()).send({});

    expect(res.status).toBe(200);
    expect(res.body.rentalCharge).toBe(10);       // 5 nap * 2
    expect(res.body.lateFeeCharged).toBe(6);      // 2 késett nap * 2 * 1,5
    expect(res.body.totalCharged).toBe(16);
  });

  it('ugyanazon a napon visszahozva legalább 1 napot számláz', async () => {
    const copy = await createCopy(await createGame());
    const member = await createMember();
    const rental = await createRentalDirect(member, copy, { rentalOffset: 0, dueOffset: 2, rate: 5 });
    const res = await request(app).put(`/api/rentals/${rental.id}/return`).set(auth()).send({});
    expect(res.body.totalCharged).toBe(5);
  });

  it('a visszavevő munkatárs rögzítésre kerül', async () => {
    const copy = await createCopy(await createGame());
    const member = await createMember();
    const rental = await createRentalDirect(member, copy);
    await request(app).put(`/api/rentals/${rental.id}/return`).set(auth()).send({}).expect(200);
    const saved = await AppDataSource.getRepository(Rental).findOneOrFail({ where: { id: rental.id }, relations: { returnedBy: true } });
    expect(saved.returnedBy?.id).toBe(staff.id);
  });

  it('kétszer nem vehető vissza (409)', async () => {
    const copy = await createCopy(await createGame());
    const member = await createMember();
    const rental = await createRentalDirect(member, copy);
    await request(app).put(`/api/rentals/${rental.id}/return`).set(auth()).send({}).expect(200);
    const again = await request(app).put(`/api/rentals/${rental.id}/return`).set(auth()).send({});
    expect(again.status).toBe(409);
  });

  it('nem létező kölcsönzésre 404', async () => {
    const res = await request(app).put('/api/rentals/999999/return').set(auth()).send({});
    expect(res.status).toBe(404);
  });

  it('visszavételkor az állapot rosszabbra állítható, és auditnaplóba kerül', async () => {
    const copy = await createCopy(await createGame(), { condition: CopyCondition.GOOD });
    const member = await createMember();
    const rental = await createRentalDirect(member, copy);

    await request(app).put(`/api/rentals/${rental.id}/return`).set(auth()).send({ condition: 'damaged' }).expect(200);

    expect((await reloadCopy(copy.id)).condition).toBe(CopyCondition.DAMAGED);
    const logs = await AppDataSource.getRepository(CopyAuditLog).find({ where: { action: AuditAction.CONDITION_CHANGED } });
    expect(logs).toHaveLength(1);
    expect(logs[0].oldValue).toBe('good');
    expect(logs[0].newValue).toBe('damaged');
  });

  it('az állapot visszavételkor nem javítható (400), a kölcsönzés aktív marad', async () => {
    const copy = await createCopy(await createGame(), { condition: CopyCondition.WORN });
    const member = await createMember();
    const rental = await createRentalDirect(member, copy);

    const res = await request(app).put(`/api/rentals/${rental.id}/return`).set(auth()).send({ condition: 'new' });

    expect(res.status).toBe(400);
    expect((await reloadRental(rental.id)).status).toBe(RentalStatus.ACTIVE);
  });

  it('"lost" állapot visszavételnél nem adható meg (400)', async () => {
    const copy = await createCopy(await createGame());
    const member = await createMember();
    const rental = await createRentalDirect(member, copy);
    const res = await request(app).put(`/api/rentals/${rental.id}/return`).set(auth()).send({ condition: 'lost' });
    expect(res.status).toBe(400);
  });

  it('ismeretlen állapotértéket elutasít (400)', async () => {
    const copy = await createCopy(await createGame());
    const member = await createMember();
    const rental = await createRentalDirect(member, copy);
    const res = await request(app).put(`/api/rentals/${rental.id}/return`).set(auth()).send({ condition: 'tokeletes' });
    expect(res.status).toBe(400);
  });

  it('a megjegyzés frissül és auditnaplóba kerül', async () => {
    const copy = await createCopy(await createGame());
    const member = await createMember();
    const rental = await createRentalDirect(member, copy);

    await request(app).put(`/api/rentals/${rental.id}/return`).set(auth()).send({ notes: 'Hiányzik egy kocka' }).expect(200);

    expect((await reloadCopy(copy.id)).notes).toBe('Hiányzik egy kocka');
    expect(await AppDataSource.getRepository(CopyAuditLog).count({ where: { action: AuditAction.NOTES_CHANGED } })).toBe(1);
  });
});

describe('Hosszabbítás (PUT /api/rentals/:id/extend)', () => {
  it('sikeres hosszabbítás: új határidő, díj, hosszabbítási bejegyzés', async () => {
    const copy = await createCopy(await createGame());
    const member = await createMember();
    const rental = await createRentalDirect(member, copy, { dueOffset: 2 });

    const res = await request(app).put(`/api/rentals/${rental.id}/extend`).set(auth()).send({ newDueDate: dateString(5) });

    expect(res.status).toBe(200);
    expect(res.body.dueDate).toBe(dateString(5));
    expect(res.body.extensionFeeCharged).toBe(EXTENSION_FEE);
    const ext = await AppDataSource.getRepository(RentalExtension).find({ where: { rental: { id: rental.id } } });
    expect(ext).toHaveLength(1);
    expect(ext[0].previousDueDate).toBe(dateString(2));
    expect(ext[0].newDueDate).toBe(dateString(5));
  });

  it('az eredeti határidő megmarad az originalDueDate mezőben', async () => {
    const copy = await createCopy(await createGame());
    const member = await createMember();
    const rental = await createRentalDirect(member, copy, { dueOffset: 2 });
    await request(app).put(`/api/rentals/${rental.id}/extend`).set(auth()).send({ newDueDate: dateString(5) }).expect(200);
    expect((await reloadRental(rental.id)).originalDueDate).toBe(dateString(2));
  });

  it('többszöri hosszabbításnál a díjak összeadódnak', async () => {
    const copy = await createCopy(await createGame());
    const member = await createMember();
    const rental = await createRentalDirect(member, copy, { dueOffset: 2 });
    await request(app).put(`/api/rentals/${rental.id}/extend`).set(auth()).send({ newDueDate: dateString(4) }).expect(200);
    const res = await request(app).put(`/api/rentals/${rental.id}/extend`).set(auth()).send({ newDueDate: dateString(6) });
    expect(res.body.extensionFeeCharged).toBe(EXTENSION_FEE * 2);
  });

  it('a hosszabbítási díj a visszavételkor a végösszegbe kerül', async () => {
    const copy = await createCopy(await createGame());
    const member = await createMember();
    const rental = await createRentalDirect(member, copy, { rentalOffset: -1, dueOffset: 2, rate: 2 });
    await request(app).put(`/api/rentals/${rental.id}/extend`).set(auth()).send({ newDueDate: dateString(4) }).expect(200);

    const res = await request(app).put(`/api/rentals/${rental.id}/return`).set(auth()).send({});
    expect(res.body.totalCharged).toBe(2 + EXTENSION_FEE); // 1 nap * 2 + hosszabbítás
  });

  it('hiányzó newDueDate esetén 400', async () => {
    const copy = await createCopy(await createGame());
    const member = await createMember();
    const rental = await createRentalDirect(member, copy);
    const res = await request(app).put(`/api/rentals/${rental.id}/extend`).set(auth()).send({});
    expect(res.status).toBe(400);
  });

  it('a jelenlegi határidőnél nem későbbi dátum elutasítva (400)', async () => {
    const copy = await createCopy(await createGame());
    const member = await createMember();
    const rental = await createRentalDirect(member, copy, { dueOffset: 3 });
    const same = await request(app).put(`/api/rentals/${rental.id}/extend`).set(auth()).send({ newDueDate: dateString(3) });
    const earlier = await request(app).put(`/api/rentals/${rental.id}/extend`).set(auth()).send({ newDueDate: dateString(1) });
    expect(same.status).toBe(400);
    expect(earlier.status).toBe(400);
  });

  it('egyetlen hosszabbítás legfeljebb 14 nap lehet', async () => {
    const copy = await createCopy(await createGame());
    const member = await createMember();
    const rental = await createRentalDirect(member, copy, { dueOffset: 3 });

    const tooLong = await request(app).put(`/api/rentals/${rental.id}/extend`).set(auth()).send({ newDueDate: dateString(3 + MAX_EXTENSION_DAYS + 1) });
    expect(tooLong.status).toBe(400);
    expect((await reloadRental(rental.id)).dueDate).toBe(dateString(3));

    const exact = await request(app).put(`/api/rentals/${rental.id}/extend`).set(auth()).send({ newDueDate: dateString(3 + MAX_EXTENSION_DAYS) });
    expect(exact.status).toBe(200);
  });

  it('érvénytelen dátumformátumú newDueDate elutasítva (400)', async () => {
    const copy = await createCopy(await createGame());
    const member = await createMember();
    const rental = await createRentalDirect(member, copy, { dueOffset: 3 });
    for (const bad of ['9', 'holnap', '2026-02-30', 12345]) {
      const res = await request(app).put(`/api/rentals/${rental.id}/extend`).set(auth()).send({ newDueDate: bad });
      expect(res.status).toBe(400);
    }
  });

  it(`legfeljebb ${MAX_EXTENSIONS_PER_RENTAL} alkalommal hosszabbítható, a következő elutasítva (409) és nem számláz`, async () => {
    const copy = await createCopy(await createGame());
    const member = await createMember();
    const rental = await createRentalDirect(member, copy, { dueOffset: 2 });

    for (let i = 1; i <= MAX_EXTENSIONS_PER_RENTAL; i++) {
      await request(app).put(`/api/rentals/${rental.id}/extend`).set(auth()).send({ newDueDate: dateString(2 + i) }).expect(200);
    }
    const res = await request(app).put(`/api/rentals/${rental.id}/extend`).set(auth()).send({ newDueDate: dateString(2 + MAX_EXTENSIONS_PER_RENTAL + 1) });

    expect(res.status).toBe(409);
    const saved = await reloadRental(rental.id);
    expect(saved.dueDate).toBe(dateString(2 + MAX_EXTENSIONS_PER_RENTAL));
    expect(Number(saved.extensionFeeCharged)).toBe(EXTENSION_FEE * MAX_EXTENSIONS_PER_RENTAL);
    expect(await AppDataSource.getRepository(RentalExtension).count({ where: { rental: { id: rental.id } } })).toBe(MAX_EXTENSIONS_PER_RENTAL);
  });

  it('már késedelmes kölcsönzés nem hosszabbítható (409)', async () => {
    const copy = await createCopy(await createGame());
    const member = await createMember();
    const rental = await createRentalDirect(member, copy, { rentalOffset: -6, dueOffset: -1 });
    const res = await request(app).put(`/api/rentals/${rental.id}/extend`).set(auth()).send({ newDueDate: dateString(3) });
    expect(res.status).toBe(409);
  });

  it('visszahozott kölcsönzés nem hosszabbítható (409)', async () => {
    const copy = await createCopy(await createGame());
    const member = await createMember();
    const rental = await createRentalDirect(member, copy);
    await request(app).put(`/api/rentals/${rental.id}/return`).set(auth()).send({}).expect(200);
    const res = await request(app).put(`/api/rentals/${rental.id}/extend`).set(auth()).send({ newDueDate: dateString(9) });
    expect(res.status).toBe(409);
  });

  it('nem létező kölcsönzésre 404', async () => {
    const res = await request(app).put('/api/rentals/999999/extend').set(auth()).send({ newDueDate: dateString(3) });
    expect(res.status).toBe(404);
  });
});

describe('Elveszett játék (PUT /api/rentals/:id/lost) – csak admin', () => {
  it('a kölcsönzés "lost" lesz, a példány elveszettnek és nem elérhetőnek jelölve', async () => {
    const game = await createGame({ replacementValue: 40 });
    const copy = await createCopy(game);
    const member = await createMember();
    const rental = await createRentalDirect(member, { ...copy, game } as GameCopy, { rentalOffset: -2, dueOffset: 1, rate: 2 });

    const res = await request(app).put(`/api/rentals/${rental.id}/lost`).set(adminAuth()).send();

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(RentalStatus.LOST);
    const after = await reloadCopy(copy.id);
    expect(after.condition).toBe(CopyCondition.LOST);
    expect(after.isAvailable).toBe(false);
  });

  it('a végösszeg tartalmazza a pótlási értéket', async () => {
    const game = await createGame({ replacementValue: 40 });
    const copy = await createCopy(game);
    const member = await createMember();
    const rental = await createRentalDirect(member, { ...copy, game } as GameCopy, { rentalOffset: -2, dueOffset: 1, rate: 2 });

    const res = await request(app).put(`/api/rentals/${rental.id}/lost`).set(adminAuth()).send();

    expect(res.body.replacementFeeCharged).toBe(40);
    expect(res.body.rentalCharge).toBe(4);   // 2 nap * 2
    expect(res.body.totalCharged).toBe(44);
  });

  it('kétszer nem jelölhető elveszettnek (409)', async () => {
    const game = await createGame();
    const copy = await createCopy(game);
    const member = await createMember();
    const rental = await createRentalDirect(member, { ...copy, game } as GameCopy);
    await request(app).put(`/api/rentals/${rental.id}/lost`).set(adminAuth()).send().expect(200);
    const again = await request(app).put(`/api/rentals/${rental.id}/lost`).set(adminAuth()).send();
    expect(again.status).toBe(409);
  });

  it('az elveszett példány utána nem kölcsönözhető', async () => {
    const game = await createGame();
    const copy = await createCopy(game);
    const member = await createMember();
    const rental = await createRentalDirect(member, { ...copy, game } as GameCopy);
    await request(app).put(`/api/rentals/${rental.id}/lost`).set(adminAuth()).send().expect(200);

    const other = await createMember();
    const res = await postRental(rentBody(other.id, copy.id));
    expect(res.status).toBe(409);
  });
});

describe('Kölcsönzés törlése (DELETE /api/rentals/:id) – csak admin, csak aktív', () => {
  it('az aktív kölcsönzés törölhető, és a példány újra elérhető lesz', async () => {
    const copy = await createCopy(await createGame());
    const member = await createMember();
    const rental = await createRentalDirect(member, copy);
    expect((await reloadCopy(copy.id)).isAvailable).toBe(false);

    const res = await request(app).delete(`/api/rentals/${rental.id}`).set(adminAuth());

    expect(res.status).toBe(204);
    expect(await AppDataSource.getRepository(Rental).findOneBy({ id: rental.id })).toBeNull();
    expect((await reloadCopy(copy.id)).isAvailable).toBe(true);
  });

  it('a törlés után a példány újra kikölcsönözhető', async () => {
    const copy = await createCopy(await createGame());
    const member = await createMember();
    const rental = await createRentalDirect(member, copy);
    await request(app).delete(`/api/rentals/${rental.id}`).set(adminAuth()).expect(204);

    const again = await postRental(rentBody(member.id, copy.id));
    expect(again.status).toBe(201);
  });

  it('a törölt kölcsönzés hosszabbításai is törlődnek (kaszkád), a példány nem', async () => {
    const copy = await createCopy(await createGame());
    const member = await createMember();
    const rental = await createRentalDirect(member, copy);
    await request(app).put(`/api/rentals/${rental.id}/extend`).set(auth()).send({ newDueDate: dateString(5) }).expect(200);
    expect(await AppDataSource.getRepository(RentalExtension).count()).toBe(1);

    await request(app).delete(`/api/rentals/${rental.id}`).set(adminAuth()).expect(204);

    expect(await AppDataSource.getRepository(RentalExtension).count()).toBe(0);
    expect(await AppDataSource.getRepository(GameCopy).findOneBy({ id: copy.id })).not.toBeNull();
  });

  it('visszahozott kölcsönzés nem törölhető (409), az előzmény megmarad', async () => {
    const copy = await createCopy(await createGame());
    const member = await createMember();
    const rental = await createRentalDirect(member, copy, { status: RentalStatus.RETURNED });

    const res = await request(app).delete(`/api/rentals/${rental.id}`).set(adminAuth());

    expect(res.status).toBe(409);
    expect((await reloadRental(rental.id)).status).toBe(RentalStatus.RETURNED);
  });

  it('elveszettnek jelölt kölcsönzés nem törölhető (409), a példány elveszett marad', async () => {
    const game = await createGame();
    const copy = await createCopy(game);
    const member = await createMember();
    const rental = await createRentalDirect(member, { ...copy, game } as GameCopy);
    await request(app).put(`/api/rentals/${rental.id}/lost`).set(adminAuth()).send().expect(200);

    const res = await request(app).delete(`/api/rentals/${rental.id}`).set(adminAuth());

    expect(res.status).toBe(409);
    const after = await reloadCopy(copy.id);
    expect(after.condition).toBe(CopyCondition.LOST);
    expect(after.isAvailable).toBe(false);
  });

  it('nem létező kölcsönzésre 404', async () => {
    const res = await request(app).delete('/api/rentals/999999').set(adminAuth());
    expect(res.status).toBe(404);
  });

  it('staff nem törölhet (403), a kölcsönzés és a példány állapota változatlan', async () => {
    const copy = await createCopy(await createGame());
    const member = await createMember();
    const rental = await createRentalDirect(member, copy);

    const res = await request(app).delete(`/api/rentals/${rental.id}`).set(auth());

    expect(res.status).toBe(403);
    expect((await reloadRental(rental.id)).status).toBe(RentalStatus.ACTIVE);
    expect((await reloadCopy(copy.id)).isAvailable).toBe(false);
  });
});

describe('Díj előnézet (GET /api/rentals/:id/charges)', () => {
  it('aktív kölcsönzésnél a mai napra számolt díjakat adja, és nem módosít semmit', async () => {
    const copy = await createCopy(await createGame());
    const member = await createMember();
    const rental = await createRentalDirect(member, copy, { rentalOffset: -4, dueOffset: -1, rate: 2 });

    const res = await request(app).get(`/api/rentals/${rental.id}/charges`).set(auth());

    expect(res.status).toBe(200);
    expect(res.body.rentalCharge).toBe(8);
    expect(res.body.lateFeeCharged).toBe(3);
    expect(res.body.totalCharged).toBe(11);
    expect((await reloadRental(rental.id)).status).toBe(RentalStatus.ACTIVE);
  });

  it('lezárt kölcsönzésnél 409', async () => {
    const copy = await createCopy(await createGame());
    const member = await createMember();
    const rental = await createRentalDirect(member, copy);
    await request(app).put(`/api/rentals/${rental.id}/return`).set(auth()).send({}).expect(200);
    const res = await request(app).get(`/api/rentals/${rental.id}/charges`).set(auth());
    expect(res.status).toBe(409);
  });

  it('nem létező kölcsönzésre 404', async () => {
    const res = await request(app).get('/api/rentals/999999/charges').set(auth());
    expect(res.status).toBe(404);
  });
});

describe('Listázás', () => {
  it('a kölcsönzések listája tartalmazza a taghoz és a példányhoz tartozó adatokat', async () => {
    const game = await createGame({ title: 'Azul' });
    const copy = await createCopy(game);
    const member = await createMember({ firstName: 'Dóra' });
    await createRentalDirect(member, copy);

    const res = await request(app).get('/api/rentals').set(auth());

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].member.firstName).toBe('Dóra');
    expect(res.body[0].gameCopy.game.title).toBe('Azul');
  });

  it('staff nem látja, hogy melyik munkatárs kezelte (csak admin)', async () => {
    const copy = await createCopy(await createGame());
    const member = await createMember();
    await postRental(rentBody(member.id, copy.id)).expect(201);

    const res = await request(app).get('/api/rentals').set(auth());
    expect(res.body[0].handledBy).toBeUndefined();
  });
});
