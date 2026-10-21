import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MemberService } from './member';

describe('Tagok kezelése', () => {
  let service: MemberService;
  let http: HttpTestingController;
  const api = 'http://localhost:3000/api/members';
  const member = { id: 5, firstName: 'Anna', lastName: 'Teszt', email: 'anna@example.com', isActive: true };
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(MemberService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lekéri a tagok listáját és egy tag adatait', () => {
    service.getAll().subscribe(result => expect(result).toEqual([member]));
    const all = http.expectOne(api);
    expect(all.request.method).toBe('GET');
    all.flush([member]);

    service.getById(5).subscribe(result => expect(result).toEqual(member));
    const one = http.expectOne(`${api}/5`);
    expect(one.request.method).toBe('GET');
    one.flush(member);
  });

  it('létrehozza, módosítja és törli a tagokat', () => {
    const values = { firstName: 'Anna', lastName: 'Teszt', email: 'anna@example.com' };
    service.create(values).subscribe();
    const create = http.expectOne(api);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(values);
    create.flush(member);

    service.update(5, { phone: '+361234567' }).subscribe();
    const update = http.expectOne(`${api}/5`);
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual({ phone: '+361234567' });
    update.flush(member);

    service.delete(5).subscribe();
    const del = http.expectOne(`${api}/5`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
  });
});
