import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { GameCopyService } from './game-copy';

describe('Társasjáték-példányok kezelése', () => {
  let service: GameCopyService;
  let http: HttpTestingController;
  const api = 'http://localhost:3000/api/game-copies';
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(GameCopyService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('a megadott adatok alapján létrehoz egy vagy több példányt', () => {
    const copy = { gameId: 3, condition: 'good', copyNumber: 'CAT-01' };
    service.create(copy).subscribe();
    const single = http.expectOne(api);
    expect(single.request.method).toBe('POST');
    expect(single.request.body).toEqual(copy);
    single.flush({ id: 1, ...copy });

    const bulk = { gameId: 3, condition: 'new', prefix: 'CAT', startNumber: 2, quantity: 4 };
    service.createBulk(bulk).subscribe();
    const many = http.expectOne(`${api}/bulk`);
    expect(many.request.method).toBe('POST');
    expect(many.request.body).toEqual(bulk);
    many.flush([]);
  });

  it('módosítja a példányt, kezeli a foglalását, és lekéri a változások naplóját', () => {
    service.update(4, { condition: 'damaged' }).subscribe();
    const update = http.expectOne(`${api}/4`);
    expect(update.request.method).toBe('PUT');
    update.flush({ id: 4 });

    service.reserve(4, 7, '2026-10-20').subscribe();
    const reserve = http.expectOne(`${api}/4/reserve`);
    expect(reserve.request.body).toEqual({ memberId: 7, reservedUntil: '2026-10-20' });
    reserve.flush({ id: 4 });

    service.cancelReservation(4).subscribe();
    const cancel = http.expectOne(`${api}/4/reserve`);
    expect(cancel.request.method).toBe('DELETE');
    cancel.flush({ id: 4 });

    service.getAuditLog(3).subscribe();
    const audit = http.expectOne(`${api}/audit/3`);
    expect(audit.request.method).toBe('GET');
    audit.flush([]);

    service.delete(4).subscribe();
    const del = http.expectOne(`${api}/4`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
  });
});
