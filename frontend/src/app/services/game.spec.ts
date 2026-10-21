import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { GameService } from './game';

describe('Társasjátékok kezelése', () => {
  let service: GameService;
  let http: HttpTestingController;
  const api = 'http://localhost:3000/api/games';
  const game = { id: 2, title: 'Catan', minPlayers: 3, maxPlayers: 4, pricePerDay: 1200, replacementValue: 15000 };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(GameService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lekéri a társasjátékok listáját és egy játék adatait', () => {
    service.getAll().subscribe(result => expect(result).toEqual([game]));
    const all = http.expectOne(api);
    expect(all.request.method).toBe('GET');
    all.flush([game]);

    service.getById(2).subscribe(result => expect(result).toEqual(game));
    const one = http.expectOne(`${api}/2`);
    expect(one.request.method).toBe('GET');
    one.flush(game);
  });

  it('a megadott adatokkal létrehozza és módosítja a társasjátékot', () => {
    const values = { title: 'Catan', pricePerDay: 1200 };
    service.create(values).subscribe();
    const create = http.expectOne(api);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(values);
    create.flush(game);

    service.update(2, { title: 'Catan Revised' }).subscribe();
    const update = http.expectOne(`${api}/2`);
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual({ title: 'Catan Revised' });
    update.flush(game);
  });

  it('kezeli a várólistát, és törli a társasjátékot', () => {
    service.getQueue(2).subscribe();
    const get = http.expectOne(`${api}/2/queue`);
    expect(get.request.method).toBe('GET');
    get.flush([]);

    service.joinQueue(2, 8).subscribe();
    const join = http.expectOne(`${api}/2/queue`);
    expect(join.request.method).toBe('POST');
    expect(join.request.body).toEqual({ memberId: 8 });
    join.flush({ id: 9 });

    service.leaveQueue(2, 9).subscribe();
    const leave = http.expectOne(`${api}/2/queue/9`);
    expect(leave.request.method).toBe('DELETE');
    leave.flush(null);

    service.delete(2).subscribe();
    const del = http.expectOne(`${api}/2`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
  });
});
