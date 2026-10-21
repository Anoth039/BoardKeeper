import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app';
import { sendCodeEmail } from '../../src/mailer';
import { AppDataSource } from '../../src/data-source';
import { User } from '../../src/entities/User';
import { Role } from '../../src/permissions';
import { initDb, closeDb, resetDb, createUser, uid, bearer } from '../helpers';

jest.mock('../../src/mailer', () => ({
  sendCodeEmail: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  sendReservationEmail: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  sendApprovalEmail: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));

const mockedSendCode = jest.mocked(sendCodeEmail);
const lastSentCode = (): string => mockedSendCode.mock.calls[mockedSendCode.mock.calls.length - 1][1];

beforeAll(initDb);
afterAll(closeDb);
beforeEach(async () => {
  await resetDb();
  mockedSendCode.mockClear();
});

describe('Regisztráció', () => {
  beforeEach(async () => {
    await createUser();
  });

  it('kód nélkül nem lehet regisztrálni (400)', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'a@b.hu', password: 'Password123' });
    expect(res.status).toBe(400);
  });

  it('e-mail nélkül nem kér ellenőrző kódot (400)', async () => {
    const res = await request(app).post('/api/auth/send-verification-code').send({});
    expect(res.status).toBe(400);
  });

  it('teljes folyamat: kód kérése → regisztráció → belépés jóváhagyásig tiltva', async () => {
    const email = `new_${uid()}@test.hu`;

    const send = await request(app).post('/api/auth/send-verification-code').send({ email });
    expect(send.status).toBe(200);
    expect(mockedSendCode).toHaveBeenCalledTimes(1);
    const code = lastSentCode();
    expect(code).toMatch(/^\d{6}$/);

    const reg = await request(app).post('/api/auth/register').send({ email, password: 'Password123', verificationCode: code });
    expect(reg.status).toBe(201);

    const saved = await AppDataSource.getRepository(User).findOneBy({ email });
    expect(saved).not.toBeNull();
    expect(saved!.isApproved).toBe(false);
    expect(saved!.role).toBe(Role.STAFF);
    expect(saved!.passwordHash).not.toBe('Password123'); // hash, nem nyílt jelszó

    const login = await request(app).post('/api/auth/login').send({ email, password: 'Password123' });
    expect(login.status).toBe(403);
    expect(login.body.token).toBeUndefined();
  });

  it('az első regisztrált felhasználó automatikusan jóváhagyott admin', async () => {
    await resetDb(); // üres felhasználótábla
    const email = `first_${uid()}@test.hu`;
    await request(app).post('/api/auth/send-verification-code').send({ email }).expect(200);
    const reg = await request(app).post('/api/auth/register').send({ email, password: 'Password123', verificationCode: lastSentCode() });
    expect(reg.status).toBe(201);

    const saved = await AppDataSource.getRepository(User).findOneByOrFail({ email });
    expect(saved.role).toBe(Role.ADMIN);
    expect(saved.isApproved).toBe(true);

    const login = await request(app).post('/api/auth/login').send({ email, password: 'Password123' });
    expect(login.status).toBe(200);
  });

  it('a második regisztrált felhasználó már staff és jóváhagyásra vár', async () => {
    const email = `second_${uid()}@test.hu`;
    await request(app).post('/api/auth/send-verification-code').send({ email }).expect(200);
    await request(app).post('/api/auth/register').send({ email, password: 'Password123', verificationCode: lastSentCode() }).expect(201);

    const saved = await AppDataSource.getRepository(User).findOneByOrFail({ email });
    expect(saved.role).toBe(Role.STAFF);
    expect(saved.isApproved).toBe(false);
  });

  it('rossz ellenőrző kóddal elutasítja (400)', async () => {
    const email = `new_${uid()}@test.hu`;
    await request(app).post('/api/auth/send-verification-code').send({ email });
    const wrong = lastSentCode() === '000000' ? '111111' : '000000';

    const res = await request(app).post('/api/auth/register').send({ email, password: 'Password123', verificationCode: wrong });
    expect(res.status).toBe(400);
  });

  it('rövid jelszót (< 8 karakter) elutasít (400)', async () => {
    const email = `new_${uid()}@test.hu`;
    await request(app).post('/api/auth/send-verification-code').send({ email });
    const res = await request(app).post('/api/auth/register').send({ email, password: 'short', verificationCode: lastSentCode() });
    expect(res.status).toBe(400);
  });

  it('már létező e-mail címmel nem lehet újra regisztrálni (409)', async () => {
    const existing = await createUser();
    const res = await request(app).post('/api/auth/send-verification-code').send({ email: existing.email });
    expect(res.status).toBe(409);
  });

  it('ugyanarra a címre 60 mp-en belül nem küld újabb kódot (429)', async () => {
    const email = `new_${uid()}@test.hu`;
    const first = await request(app).post('/api/auth/send-verification-code').send({ email });
    const second = await request(app).post('/api/auth/send-verification-code').send({ email });
    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(second.body.retryAfterSeconds).toBeGreaterThan(0);
    expect(mockedSendCode).toHaveBeenCalledTimes(1);
  });
});

describe('Bejelentkezés', () => {
  it('jóváhagyott felhasználó tokent kap és a szerepköre visszajön', async () => {
    const user = await createUser({ role: Role.ADMIN, password: 'Titok1234' });
    const res = await request(app).post('/api/auth/login').send({ email: user.email, password: 'Titok1234' });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ id: user.id, email: user.email, role: 'admin' });
    expect(res.body.user.permissions).toContain('users:manage');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('a belépés frissíti az utolsó belépés idejét', async () => {
    const user = await createUser({ password: 'Titok1234' });
    await request(app).post('/api/auth/login').send({ email: user.email, password: 'Titok1234' });
    const reloaded = await AppDataSource.getRepository(User).findOneByOrFail({ id: user.id });
    expect(reloaded.lastLoginAt).not.toBeNull();
  });

  it('rossz jelszóval 401', async () => {
    const user = await createUser({ password: 'Titok1234' });
    const res = await request(app).post('/api/auth/login').send({ email: user.email, password: 'rossz-jelszo' });
    expect(res.status).toBe(401);
  });

  it('ismeretlen e-mail címmel 401, ugyanazzal az üzenettel (nem szivárogtat felhasználót)', async () => {
    const user = await createUser({ password: 'Titok1234' });
    const wrongPw = await request(app).post('/api/auth/login').send({ email: user.email, password: 'x' });
    const unknown = await request(app).post('/api/auth/login').send({ email: 'nincs@test.hu', password: 'x' });
    expect(unknown.status).toBe(401);
    expect(unknown.body.message).toBe(wrongPw.body.message);
  });

  it('jóváhagyásra váró felhasználó nem léphet be (403)', async () => {
    const user = await createUser({ isApproved: false, password: 'Titok1234' });
    const res = await request(app).post('/api/auth/login').send({ email: user.email, password: 'Titok1234' });
    expect(res.status).toBe(403);
  });

  it('hiányzó mezőkkel 400', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.hu' });
    expect(res.status).toBe(400);
  });
});

describe('Elfelejtett jelszó', () => {
  it('teljes folyamat: kód kérése → új jelszó → belépés az új jelszóval', async () => {
    const user = await createUser({ password: 'RegiJelszo1' });

    const forgot = await request(app).post('/api/auth/forgot-password').send({ email: user.email });
    expect(forgot.status).toBe(200);
    const code = lastSentCode();

    const reset = await request(app).post('/api/auth/reset-password').send({ email: user.email, code, newPassword: 'UjJelszo123' });
    expect(reset.status).toBe(200);

    const oldLogin = await request(app).post('/api/auth/login').send({ email: user.email, password: 'RegiJelszo1' });
    const newLogin = await request(app).post('/api/auth/login').send({ email: user.email, password: 'UjJelszo123' });
    expect(oldLogin.status).toBe(401);
    expect(newLogin.status).toBe(200);
  });

  it('nem létező fiókra 404', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'nincs@test.hu' });
    expect(res.status).toBe(404);
  });

  it('60 mp-en belül nem kérhető újabb kód (429)', async () => {
    const user = await createUser();
    await request(app).post('/api/auth/forgot-password').send({ email: user.email });
    const second = await request(app).post('/api/auth/forgot-password').send({ email: user.email });
    expect(second.status).toBe(429);
  });

  it('rossz kóddal nem állítható át a jelszó (400)', async () => {
    const user = await createUser();
    await request(app).post('/api/auth/forgot-password').send({ email: user.email });
    const wrong = lastSentCode() === '000000' ? '111111' : '000000';
    const res = await request(app).post('/api/auth/reset-password').send({ email: user.email, code: wrong, newPassword: 'UjJelszo123' });
    expect(res.status).toBe(400);
  });

  it('lejárt kóddal nem állítható át a jelszó (400)', async () => {
    const user = await createUser();
    await request(app).post('/api/auth/forgot-password').send({ email: user.email });
    const code = lastSentCode();
    await AppDataSource.getRepository(User).update(user.id, { resetCodeExpiresAt: new Date(Date.now() - 1000) });

    const res = await request(app).post('/api/auth/reset-password').send({ email: user.email, code, newPassword: 'UjJelszo123' });
    expect(res.status).toBe(400);
  });

  it('a kód egyszer használható fel', async () => {
    const user = await createUser();
    await request(app).post('/api/auth/forgot-password').send({ email: user.email });
    const code = lastSentCode();
    const first = await request(app).post('/api/auth/reset-password').send({ email: user.email, code, newPassword: 'UjJelszo123' });
    const second = await request(app).post('/api/auth/reset-password').send({ email: user.email, code, newPassword: 'MasikJelszo1' });
    expect(first.status).toBe(200);
    expect(second.status).toBe(400);
  });

  it('rövid új jelszót elutasít (400)', async () => {
    const user = await createUser();
    await request(app).post('/api/auth/forgot-password').send({ email: user.email });
    const res = await request(app).post('/api/auth/reset-password').send({ email: user.email, code: lastSentCode(), newPassword: 'rovid' });
    expect(res.status).toBe(400);
  });
});

describe('Saját profil (/api/auth/me)', () => {
  it('token nélkül 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('staff a saját szerepkörét és jogait kapja', async () => {
    const staff = await createUser({ role: Role.STAFF });
    const res = await request(app).get('/api/auth/me').set('Authorization', bearer(staff));
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('staff');
    expect(res.body.permissions).toContain('rentals:create');
    expect(res.body.permissions).not.toContain('games:write');
  });

  it('a szerepkör-változás azonnal látszik a régi tokennel is', async () => {
    const user = await createUser({ role: Role.STAFF });
    const token = bearer(user);
    await AppDataSource.getRepository(User).update(user.id, { role: Role.ADMIN });
    const res = await request(app).get('/api/auth/me').set('Authorization', token);
    expect(res.body.role).toBe('admin');
    expect(res.body.permissions).toContain('users:manage');
  });
});

describe('Védett végpontok (JWT)', () => {
  it('token nélkül 401', async () => {
    const res = await request(app).get('/api/games');
    expect(res.status).toBe(401);
  });

  it('érvénytelen tokennel 401', async () => {
    const res = await request(app).get('/api/games').set('Authorization', 'Bearer ez.nem.jwt');
    expect(res.status).toBe(401);
  });

  it('"Bearer" előtag nélküli fejléccel 401', async () => {
    const user = await createUser();
    const token = bearer(user).replace('Bearer ', '');
    const res = await request(app).get('/api/games').set('Authorization', token);
    expect(res.status).toBe(401);
  });

  it('érvényes tokennel 200', async () => {
    const user = await createUser();
    const res = await request(app).get('/api/games').set('Authorization', bearer(user));
    expect(res.status).toBe(200);
  });
});
