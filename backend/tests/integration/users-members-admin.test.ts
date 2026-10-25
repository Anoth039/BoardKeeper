import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app';
import { sendApprovalEmail } from '../../src/mailer';
import { AppDataSource } from '../../src/data-source';
import { User } from '../../src/entities/User';
import { Member } from '../../src/entities/Member';
import { dateString } from '../../src/utils/date';
import { initDb, closeDb, resetDb, createUser, createAdmin, createStaff, createGame, createCopy, createMember, createRentalDirect, bearer } from '../helpers';
import { RentalStatus } from '../../src/entities/Rental';
import { GameQueueEntry } from '../../src/entities/GameQueueEntry';

jest.mock('../../src/mailer', () => ({
  sendCodeEmail: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  sendReservationEmail: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  sendApprovalEmail: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));

const mockedApprovalMail = jest.mocked(sendApprovalEmail);

let admin: User;
let staff: User;
const asAdmin = () => ({ Authorization: bearer(admin) });
const asStaff = () => ({ Authorization: bearer(staff) });

beforeAll(initDb);
afterAll(closeDb);
beforeEach(async () => {
  mockedApprovalMail.mockReset();
  mockedApprovalMail.mockResolvedValue(undefined);
  await resetDb();
  admin = await createAdmin();
  staff = await createStaff();
});

describe('Felhasználók jóváhagyása (admin)', () => {
  it('a jóváhagyásra váró felhasználó jóváhagyható, utána be tud lépni', async () => {
    const pending = await createUser({ isApproved: false, password: 'Titok1234' });

    const before = await request(app).post('/api/auth/login').send({ email: pending.email, password: 'Titok1234' });
    expect(before.status).toBe(403);

    const res = await request(app).patch(`/api/users/${pending.id}/toggle-approval`).set(asAdmin());
    expect(res.status).toBe(200);
    expect(res.body.isApproved).toBe(true);

    const after = await request(app).post('/api/auth/login').send({ email: pending.email, password: 'Titok1234' });
    expect(after.status).toBe(200);
  });

  it('a jóváhagyás visszavonható (kapcsoló)', async () => {
    const user = await createUser({ isApproved: true, password: 'Titok1234' });
    const res = await request(app).patch(`/api/users/${user.id}/toggle-approval`).set(asAdmin());
    expect(res.body.isApproved).toBe(false);
    const login = await request(app).post('/api/auth/login').send({ email: user.email, password: 'Titok1234' });
    expect(login.status).toBe(403);
  });

  it('admin fiók jóváhagyása nem módosítható (400)', async () => {
    const other = await createAdmin();
    const res = await request(app).patch(`/api/users/${other.id}/toggle-approval`).set(asAdmin());
    expect(res.status).toBe(400);
  });

  it('nem létező felhasználóra 404', async () => {
    const res = await request(app).patch('/api/users/999999/toggle-approval').set(asAdmin());
    expect(res.status).toBe(404);
  });

  it('staff nem hagyhat jóvá felhasználót (403) – nem emelheti saját magát sem', async () => {
    const pending = await createUser({ isApproved: false });
    const res = await request(app).patch(`/api/users/${pending.id}/toggle-approval`).set(asStaff());
    expect(res.status).toBe(403);
    expect((await AppDataSource.getRepository(User).findOneByOrFail({ id: pending.id })).isApproved).toBe(false);
  });

  it('staff fiók törölhető (204)', async () => {
    const victim = await createStaff();
    const res = await request(app).delete(`/api/users/${victim.id}`).set(asAdmin());
    expect(res.status).toBe(204);
    expect(await AppDataSource.getRepository(User).findOneBy({ id: victim.id })).toBeNull();
  });

  it('admin fiók nem törölhető (400)', async () => {
    const res = await request(app).delete(`/api/users/${admin.id}`).set(asAdmin());
    expect(res.status).toBe(400);
    expect(await AppDataSource.getRepository(User).findOneBy({ id: admin.id })).not.toBeNull();
  });

  it('staff nem törölhet felhasználót (403), nem létezőre 404', async () => {
    const victim = await createStaff();
    expect((await request(app).delete(`/api/users/${victim.id}`).set(asStaff())).status).toBe(403);
    expect((await request(app).delete('/api/users/999999').set(asAdmin())).status).toBe(404);
  });
});

describe('Jóváhagyás szerepkör megadásával', () => {
  it('jóváhagyáskor megadható a szerepkör (admin)', async () => {
    const pending = await createUser({ isApproved: false });
    const res = await request(app).patch(`/api/users/${pending.id}/toggle-approval`).set(asAdmin()).send({ role: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('admin');
    expect(res.body.isApproved).toBe(true);
    expect((await AppDataSource.getRepository(User).findOneByOrFail({ id: pending.id })).role).toBe('admin');
  });

  it('szerepkör nélkül staff marad', async () => {
    const pending = await createUser({ isApproved: false });
    const res = await request(app).patch(`/api/users/${pending.id}/toggle-approval`).set(asAdmin()).send({});
    expect(res.body.role).toBe('staff');
  });

  it('érvénytelen szerepkört elutasít (400), és nem módosít semmit', async () => {
    const pending = await createUser({ isApproved: false });
    const res = await request(app).patch(`/api/users/${pending.id}/toggle-approval`).set(asAdmin()).send({ role: 'superuser' });
    expect(res.status).toBe(400);
    const after = await AppDataSource.getRepository(User).findOneByOrFail({ id: pending.id });
    expect(after.isApproved).toBe(false);
    expect(after.role).toBe('staff');
  });

  it('visszavonáskor a szerepkör nem változik', async () => {
    const user = await createUser({ isApproved: true });
    const res = await request(app).patch(`/api/users/${user.id}/toggle-approval`).set(asAdmin()).send({ role: 'admin' });
    expect(res.body.isApproved).toBe(false);
    expect(res.body.role).toBe('staff');
  });
});

describe('Jóváhagyási értesítő e-mail', () => {
  it('jóváhagyáskor értesítő levél megy a megadott szerepkörrel', async () => {
    const pending = await createUser({ isApproved: false });
    await request(app).patch(`/api/users/${pending.id}/toggle-approval`).set(asAdmin()).send({ role: 'admin' }).expect(200);
    expect(mockedApprovalMail).toHaveBeenCalledTimes(1);
    expect(mockedApprovalMail).toHaveBeenCalledWith(pending.email, 'admin');
  });

  it('visszavonáskor nem megy levél', async () => {
    const user = await createUser({ isApproved: true });
    await request(app).patch(`/api/users/${user.id}/toggle-approval`).set(asAdmin()).expect(200);
    expect(mockedApprovalMail).not.toHaveBeenCalled();
  });

  it('a levélküldés hibája nem akadályozza meg a jóváhagyást', async () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      mockedApprovalMail.mockRejectedValueOnce(new Error('SMTP hiba'));

      const pending = await createUser({ isApproved: false });
      const res = await request(app)
        .patch(`/api/users/${pending.id}/toggle-approval`)
        .set(asAdmin());

      expect(res.status).toBe(200);
      expect(res.body.isApproved).toBe(true);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to send approval email:',
        expect.any(Error),
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});

describe('Tag módosítása', () => {
  it('adatok módosíthatók', async () => {
    const member = await createMember({ firstName: 'Régi' });
    const res = await request(app).put(`/api/members/${member.id}`).set(asStaff()).send({ firstName: 'Új', phone: '+36 30 111 2222' });
    expect(res.status).toBe(200);
    expect(res.body.firstName).toBe('Új');
    expect(res.body.phone).toBe('+36 30 111 2222');
  });

  it('a nem küldött mezők változatlanok maradnak', async () => {
    const member = await createMember({ firstName: 'Anna', lastName: 'Kiss' });
    await request(app).put(`/api/members/${member.id}`).set(asStaff()).send({ firstName: 'Anikó' }).expect(200);
    const after = await AppDataSource.getRepository(Member).findOneByOrFail({ id: member.id });
    expect(after.lastName).toBe('Kiss');
  });

  it('érvénytelen adatokat elutasít (400)', async () => {
    const member = await createMember();
    const put = (body: object) => request(app).put(`/api/members/${member.id}`).set(asStaff()).send(body);
    expect((await put({ firstName: 'x'.repeat(31) })).status).toBe(400);
    expect((await put({ lastName: 'x'.repeat(31) })).status).toBe(400);
    expect((await put({ phone: 'abc' })).status).toBe(400);
  });

  it('nem létező tagra 404', async () => {
    const res = await request(app).put('/api/members/999999').set(asStaff()).send({ firstName: 'X' });
    expect(res.status).toBe(404);
  });

  it('inaktiválható, ha nincs aktív kölcsönzése és foglalása', async () => {
    const member = await createMember();
    const res = await request(app).put(`/api/members/${member.id}`).set(asStaff()).send({ isActive: false });
    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
  });

  it('aktív kölcsönzéssel rendelkező tag nem inaktiválható (409)', async () => {
    const member = await createMember();
    await createRentalDirect(member, await createCopy(await createGame()));
    const res = await request(app).put(`/api/members/${member.id}`).set(asStaff()).send({ isActive: false });
    expect(res.status).toBe(409);
    expect((await AppDataSource.getRepository(Member).findOneByOrFail({ id: member.id })).isActive).toBe(true);
  });

  it('lefoglalt példánnyal rendelkező tag nem inaktiválható (409)', async () => {
    const member = await createMember();
    const copy = await createCopy(await createGame());
    await request(app).put(`/api/game-copies/${copy.id}/reserve`).set(asStaff()).send({ memberId: member.id, reservedUntil: dateString(1) }).expect(200);
    const res = await request(app).put(`/api/members/${member.id}`).set(asStaff()).send({ isActive: false });
    expect(res.status).toBe(409);
  });

  it('várólistán álló tag nem inaktiválható (409)', async () => {
    const member = await createMember();
    const game = await createGame();
    const repo = AppDataSource.getRepository(GameQueueEntry);
    await repo.save(repo.create({ game, member }));
    const res = await request(app).put(`/api/members/${member.id}`).set(asStaff()).send({ isActive: false });
    expect(res.status).toBe(409);
  });

  it('visszahozás után már inaktiválható', async () => {
    const member = await createMember();
    const rental = await createRentalDirect(member, await createCopy(await createGame()));
    await request(app).put(`/api/rentals/${rental.id}/return`).set(asStaff()).send({}).expect(200);
    const res = await request(app).put(`/api/members/${member.id}`).set(asStaff()).send({ isActive: false });
    expect(res.status).toBe(200);
  });

  it('inaktív tag újra aktiválható', async () => {
    const member = await createMember({ isActive: false });
    const res = await request(app).put(`/api/members/${member.id}`).set(asStaff()).send({ isActive: true });
    expect(res.body.isActive).toBe(true);
  });
});

describe('Tag törlése (admin)', () => {
  it('kölcsönzési előzmény nélküli tag törölhető (204)', async () => {
    const member = await createMember();
    const res = await request(app).delete(`/api/members/${member.id}`).set(asAdmin());
    expect(res.status).toBe(204);
    expect(await AppDataSource.getRepository(Member).findOneBy({ id: member.id })).toBeNull();
  });

  it('kölcsönzési előzménnyel rendelkező tag nem törölhető, csak inaktiválható (409)', async () => {
    const member = await createMember();
    const rental = await createRentalDirect(member, await createCopy(await createGame()), { status: RentalStatus.RETURNED });
    expect(rental.id).toBeDefined();
    const res = await request(app).delete(`/api/members/${member.id}`).set(asAdmin());
    expect(res.status).toBe(409);
  });

  it('lefoglalt példánnyal rendelkező tag nem törölhető (409)', async () => {
    const member = await createMember();
    const copy = await createCopy(await createGame());
    await request(app).put(`/api/game-copies/${copy.id}/reserve`).set(asAdmin()).send({ memberId: member.id, reservedUntil: dateString(1) }).expect(200);
    const res = await request(app).delete(`/api/members/${member.id}`).set(asAdmin());
    expect(res.status).toBe(409);
  });

  it('nem létező tagra 404', async () => {
    const res = await request(app).delete('/api/members/999999').set(asAdmin());
    expect(res.status).toBe(404);
  });
});
