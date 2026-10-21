import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app';
import { AppDataSource } from '../../src/data-source';
import { User } from '../../src/entities/User';
import { Role } from '../../src/permissions';
import { initDb, closeDb, resetDb, createStaff, createAdmin, createGame, createCopy, createMember, createRentalDirect, bearer, createUser } from '../helpers';

jest.mock('../../src/mailer', () => ({
  sendCodeEmail: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  sendReservationEmail: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  sendApprovalEmail: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));

beforeAll(initDb);
afterAll(closeDb);
beforeEach(resetDb);

const validGame = { title: 'Catan', minPlayers: 3, maxPlayers: 4, pricePerDay: 3, replacementValue: 45 };

describe('Szerepkör alapú jogosultság (staff vs. admin)', () => {
  describe('elveszettnek jelölés és statisztika', () => {
    it('staff NEM jelölhet kölcsönzést elveszettnek (403), admin igen', async () => {
      const staff = await createStaff();
      const admin = await createAdmin();
      const copy = await createCopy(await createGame());
      const member = await createMember();
      const rental = await createRentalDirect(member, copy);

      const denied = await request(app).put(`/api/rentals/${rental.id}/lost`).set('Authorization', bearer(staff)).send();
      expect(denied.status).toBe(403);
      const ok = await request(app).put(`/api/rentals/${rental.id}/lost`).set('Authorization', bearer(admin)).send();
      expect(ok.status).toBe(200);
    });

    it('staff láthatja a statisztikát (200)', async () => {
      const staff = await createStaff();
      const res = await request(app).get('/api/stats').set('Authorization', bearer(staff));
      expect(res.status).toBe(200);
    });
  });

  describe('a jogosultság minden kérésnél az adatbázisból jön', () => {
    it('a visszavont (nem jóváhagyott) felhasználó tokenje azonnal érvénytelen (401)', async () => {
      const staff = await createStaff();
      const token = bearer(staff);
      await request(app).get('/api/games').set('Authorization', token).expect(200);

      await AppDataSource.getRepository(User).update(staff.id, { isApproved: false });
      const res = await request(app).get('/api/games').set('Authorization', token);
      expect(res.status).toBe(401);
    });

    it('a törölt felhasználó tokenje érvénytelen (401)', async () => {
      const staff = await createStaff();
      const token = bearer(staff);
      await AppDataSource.getRepository(User).delete(staff.id);
      const res = await request(app).get('/api/games').set('Authorization', token);
      expect(res.status).toBe(401);
    });

    it('a szerepkör-lefokozás azonnal érvényesül, a régi tokennel is', async () => {
      const admin = await createAdmin();
      const token = bearer(admin);
      await request(app).post('/api/games').set('Authorization', token).send(validGame).expect(201);

      await AppDataSource.getRepository(User).update(admin.id, { role: Role.STAFF });
      const res = await request(app).post('/api/games').set('Authorization', token).send({ ...validGame, title: 'Másik' });
      expect(res.status).toBe(403);
    });
  });

  describe('játékok', () => {
    it('staff NEM hozhat létre játékot (403)', async () => {
      const staff = await createStaff();
      const res = await request(app).post('/api/games').set('Authorization', bearer(staff)).send(validGame);
      expect(res.status).toBe(403);
    });

    it('admin létrehozhat játékot (201)', async () => {
      const admin = await createAdmin();
      const res = await request(app).post('/api/games').set('Authorization', bearer(admin)).send(validGame);
      expect(res.status).toBe(201);
    });

    it('staff NEM módosíthat és NEM törölhet játékot (403)', async () => {
      const staff = await createStaff();
      const game = await createGame();
      const put = await request(app).put(`/api/games/${game.id}`).set('Authorization', bearer(staff)).send({ title: 'Új' });
      const del = await request(app).delete(`/api/games/${game.id}`).set('Authorization', bearer(staff));
      expect(put.status).toBe(403);
      expect(del.status).toBe(403);
    });

    it('staff láthatja a játékokat (200)', async () => {
      const staff = await createStaff();
      await createGame();
      const res = await request(app).get('/api/games').set('Authorization', bearer(staff));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });

  describe('példányok', () => {
    it('staff NEM hozhat létre és NEM törölhet példányt (403)', async () => {
      const staff = await createStaff();
      const game = await createGame();
      const copy = await createCopy(game);
      const post = await request(app).post('/api/game-copies').set('Authorization', bearer(staff)).send({ gameId: game.id, copyNumber: 'ABC-1' });
      const del = await request(app).delete(`/api/game-copies/${copy.id}`).set('Authorization', bearer(staff));
      expect(post.status).toBe(403);
      expect(del.status).toBe(403);
    });

    it('staff NEM olvashatja az auditnaplót, admin igen', async () => {
      const staff = await createStaff();
      const admin = await createAdmin();
      const game = await createGame();
      const s = await request(app).get(`/api/game-copies/audit/${game.id}`).set('Authorization', bearer(staff));
      const a = await request(app).get(`/api/game-copies/audit/${game.id}`).set('Authorization', bearer(admin));
      expect(s.status).toBe(403);
      expect(a.status).toBe(200);
    });
  });

  describe('tagok és kölcsönzések', () => {
    it('staff létrehozhat tagot (201)', async () => {
      const staff = await createStaff();
      const res = await request(app).post('/api/members').set('Authorization', bearer(staff))
        .send({ firstName: 'Anna', lastName: 'Kiss', email: 'anna@test.hu' });
      expect(res.status).toBe(201);
    });

    it('staff NEM törölhet tagot (403)', async () => {
      const staff = await createStaff();
      const member = await createMember();
      const res = await request(app).delete(`/api/members/${member.id}`).set('Authorization', bearer(staff));
      expect(res.status).toBe(403);
    });

    it('staff NEM törölhet kölcsönzést, admin igen', async () => {
      const staff = await createStaff();
      const admin = await createAdmin();
      const game = await createGame();
      const copy = await createCopy(game);
      const member = await createMember();
      const rental = await createRentalDirect(member, copy);

      const s = await request(app).delete(`/api/rentals/${rental.id}`).set('Authorization', bearer(staff));
      const a = await request(app).delete(`/api/rentals/${rental.id}`).set('Authorization', bearer(admin));
      expect(s.status).toBe(403);
      expect(a.status).toBe(204);
    });
  });

  describe('felhasználókezelés', () => {
    it('staff NEM listázhatja a felhasználókat (403)', async () => {
      const staff = await createStaff();
      const res = await request(app).get('/api/users').set('Authorization', bearer(staff));
      expect(res.status).toBe(403);
    });

    it('admin listázhatja a felhasználókat, és nem látja a jelszóhasht', async () => {
      const admin = await createAdmin();
      await createUser();
      const res = await request(app).get('/api/users').set('Authorization', bearer(admin));
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
      expect(JSON.stringify(res.body)).not.toContain('password_hash');
    });
  });
});
