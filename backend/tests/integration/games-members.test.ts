import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app';
import { initDb, closeDb, resetDb, createAdmin, createStaff, createGame, createMember, bearer } from '../helpers';
import { User } from '../../src/entities/User';

jest.mock('../../src/mailer', () => ({
  sendCodeEmail: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  sendReservationEmail: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  sendApprovalEmail: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));

let admin: User;
let staff: User;

beforeAll(initDb);
afterAll(closeDb);
beforeEach(async () => {
  await resetDb();
  admin = await createAdmin();
  staff = await createStaff();
});

const gameBody = (over: Record<string, unknown> = {}) => ({
  title: 'Carcassonne', minPlayers: 2, maxPlayers: 5, pricePerDay: 2.5, replacementValue: 30, ...over,
});

describe('Játékok', () => {
  const post = (body: object) => request(app).post('/api/games').set('Authorization', bearer(admin)).send(body);

  it('érvényes adatokkal létrejön (201) és a mezők tárolódnak', async () => {
    const res = await post(gameBody({ category: 'családi, stratégia', ageRating: 7 }));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: 'Carcassonne', minPlayers: 2, maxPlayers: 5, pricePerDay: 2.5, replacementValue: 30 });
    expect(res.body.id).toEqual(expect.any(Number));
  });

  it('a cím elejéről/végéről levágja a szóközöket', async () => {
    const res = await post(gameBody({ title: '  Azul  ' }));
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Azul');
  });

  it.each([
    ['cím', { title: '' }],
    ['minimális játékosszám', { minPlayers: undefined }],
    ['maximális játékosszám', { maxPlayers: undefined }],
  ])('hiányzó %s esetén 400', async (_name, patch) => {
    const res = await post(gameBody(patch));
    expect(res.status).toBe(400);
  });

  it.each([
    ['0 napi díj', { pricePerDay: 0 }],
    ['negatív napi díj', { pricePerDay: -1 }],
    ['0 pótlási érték', { replacementValue: 0 }],
    ['hiányzó napi díj', { pricePerDay: undefined }],
  ])('%s esetén 400', async (_name, patch) => {
    const res = await post(gameBody(patch));
    expect(res.status).toBe(400);
  });

  it('azonos című játék nem hozható létre újra, kis/nagybetűtől függetlenül (409)', async () => {
    await post(gameBody({ title: 'Wingspan' })).expect(201);
    const res = await post(gameBody({ title: 'WINGSPAN' }));
    expect(res.status).toBe(409);
  });

  it('ismétlődő kategóriát elutasít (400)', async () => {
    const res = await post(gameBody({ category: 'Családi, családi' }));
    expect(res.status).toBe(400);
  });

  it('listázza a játékokat', async () => {
    await createGame({ title: 'A' });
    await createGame({ title: 'B' });
    const res = await request(app).get('/api/games').set('Authorization', bearer(staff));
    expect(res.status).toBe(200);
    expect(res.body.map((g: { title: string }) => g.title).sort()).toEqual(['A', 'B']);
  });

  it('lekérdezi az azonosító alapján', async () => {
    const game = await createGame({ title: 'Splendor' });
    const res = await request(app).get(`/api/games/${game.id}`).set('Authorization', bearer(staff));
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Splendor');
  });

  it('nem létező azonosítóra 404', async () => {
    const res = await request(app).get('/api/games/999999').set('Authorization', bearer(staff));
    expect(res.status).toBe(404);
  });

  it('admin módosíthatja', async () => {
    const game = await createGame({ title: 'Régi cím' });
    const res = await request(app).put(`/api/games/${game.id}`).set('Authorization', bearer(admin)).send({ title: 'Új cím' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Új cím');
  });

  it('admin törölheti, utána 404', async () => {
    const game = await createGame();
    const del = await request(app).delete(`/api/games/${game.id}`).set('Authorization', bearer(admin));
    expect([200, 204]).toContain(del.status);
    const get = await request(app).get(`/api/games/${game.id}`).set('Authorization', bearer(staff));
    expect(get.status).toBe(404);
  });
});

describe('Tagok', () => {
  const post = (body: object) => request(app).post('/api/members').set('Authorization', bearer(staff)).send(body);
  const memberBody = (over: Record<string, unknown> = {}) => ({
    firstName: 'Béla', lastName: 'Nagy', email: `bela_${Date.now()}@test.hu`, ...over,
  });

  it('érvényes adatokkal létrejön (201), alapból aktív', async () => {
    const res = await post(memberBody({ phone: '+36 30 123 4567' }));
    expect(res.status).toBe(201);
    expect(res.body.isActive).toBe(true);
  });

  it.each([
    ['keresztnév', { firstName: undefined }],
    ['vezetéknév', { lastName: undefined }],
    ['e-mail', { email: undefined }],
  ])('hiányzó %s esetén 400', async (_n, patch) => {
    const res = await post(memberBody(patch));
    expect(res.status).toBe(400);
  });

  it('túl hosszú keresztnevet (> 30) elutasít (400)', async () => {
    const res = await post(memberBody({ firstName: 'x'.repeat(31) }));
    expect(res.status).toBe(400);
  });

  it('túl hosszú vezetéknevet (> 30) elutasít (400)', async () => {
    const res = await post(memberBody({ lastName: 'x'.repeat(31) }));
    expect(res.status).toBe(400);
  });

  it('érvénytelen telefonszámot elutasít (400)', async () => {
    const res = await post(memberBody({ phone: 'nem-telefon' }));
    expect(res.status).toBe(400);
  });

  it('duplikált e-mail címet elutasít (409)', async () => {
    const existing = await createMember({ email: 'dup@test.hu' });
    const res = await post(memberBody({ email: existing.email }));
    expect(res.status).toBe(409);
  });

  it('listázza és azonosító alapján lekérdezi a tagokat', async () => {
    const m = await createMember({ firstName: 'Kata' });
    const list = await request(app).get('/api/members').set('Authorization', bearer(staff));
    const one = await request(app).get(`/api/members/${m.id}`).set('Authorization', bearer(staff));
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(one.body.firstName).toBe('Kata');
  });

  it('nem létező tagra 404', async () => {
    const res = await request(app).get('/api/members/999999').set('Authorization', bearer(staff));
    expect(res.status).toBe(404);
  });
});
