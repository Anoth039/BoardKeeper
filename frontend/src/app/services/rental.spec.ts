import { TestBed } from '@angular/core/testing';

import { Rental } from './rental';

describe('Rental', () => {
  let service: Rental;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Rental);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
