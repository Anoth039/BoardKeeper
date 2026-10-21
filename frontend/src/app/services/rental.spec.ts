import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RentalService } from './rental';

describe('Kölcsönzések kezelése', () => {
  let service: RentalService;
  let http: HttpTestingController;
  const api = 'http://localhost:3000/api/rentals';
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(RentalService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lekéri a kölcsönzéseket, és kölcsönzést indít a kiválasztott taggal és példánnyal', () => {
    service.getAll().subscribe(result => expect(result).toEqual([]));
    const all = http.expectOne(api);
    expect(all.request.method).toBe('GET');
    all.flush([]);

    const payload = { memberId: 2, gameCopyId: 8, rentalDate: '2026-10-15', dueDate: '2026-10-22' };
    service.create(payload).subscribe();
    const create = http.expectOne(api);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(payload);
    create.flush({ id: 11, ...payload, status: 'active' });
  });

  it('lekéri a kölcsönzéshez tartozó díjakat', () => {
    const charges = { rentalCharge: 1000, lateFeeCharged: 0, replacementFeeCharged: 0, totalCharged: 1000 };
    service.getCharges(11).subscribe(result => expect(result).toEqual(charges));
    const req = http.expectOne(`${api}/11/charges`);
    expect(req.request.method).toBe('GET');
    req.flush(charges);
  });

  it('kezeli a visszavételt és a kölcsönzés határidejének meghosszabbítását', () => {
    service.return(11, { condition: 'damaged', notes: 'A doboz sérült' }).subscribe();
    const returned = http.expectOne(`${api}/11/return`);
    expect(returned.request.method).toBe('PUT');
    expect(returned.request.body).toEqual({ condition: 'damaged', notes: 'A doboz sérült' });
    returned.flush({ id: 11, status: 'returned' });

    service.extend(11, '2026-10-29').subscribe();
    const extend = http.expectOne(`${api}/11/extend`);
    expect(extend.request.method).toBe('PUT');
    expect(extend.request.body).toEqual({ newDueDate: '2026-10-29' });
    extend.flush({ id: 11 });
  });

  it('elveszettként jelöli, illetve törli a kölcsönzést', () => {
    service.markLost(11).subscribe();
    const lost = http.expectOne(`${api}/11/lost`);
    expect(lost.request.method).toBe('PUT');
    expect(lost.request.body).toEqual({});
    lost.flush({ id: 11, status: 'lost' });

    service.delete(11).subscribe();
    const del = http.expectOne(`${api}/11`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
  });
});
