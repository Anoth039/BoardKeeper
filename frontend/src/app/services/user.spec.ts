import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { UserService } from './user';

describe('Felhasználók kezelése', () => {
  let service: UserService;
  let http: HttpTestingController;
  const api = 'http://localhost:3000/api/users';
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(UserService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lekéri a rendszerben regisztrált felhasználókat', () => {
    service.getAll().subscribe(result => expect(result).toEqual([]));
    const req = http.expectOne(api);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('kezeli a felhasználók jóváhagyását és törlését', () => {
    service.toggleApproval(3).subscribe();
    const toggle = http.expectOne(`${api}/3/toggle-approval`);
    expect(toggle.request.method).toBe('PATCH');
    expect(toggle.request.body).toEqual({});
    toggle.flush({ id: 3 });

    service.toggleApproval(3, 'admin').subscribe();
    const promote = http.expectOne(`${api}/3/toggle-approval`);
    expect(promote.request.body).toEqual({ role: 'admin' });
    promote.flush({ id: 3, role: 'admin' });

    service.delete(3).subscribe();
    const del = http.expectOne(`${api}/3`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
  });
});
