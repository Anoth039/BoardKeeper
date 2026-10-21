import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { StatsService } from './stats';

describe('Statisztikák lekérése', () => {
  let service: StatsService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(StatsService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lekéri az áttekintő oldal statisztikáit', () => {
    const stats = { totalGames: 12, totalMembers: 40, activeRentals: 6 };
    service.get().subscribe(result => expect(result).toEqual(stats));
    const req = http.expectOne('http://localhost:3000/api/stats');
    expect(req.request.method).toBe('GET');
    req.flush(stats);
  });
});
