import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RentalList } from './rental-list';

describe('RentalList', () => {
  let component: RentalList;
  let fixture: ComponentFixture<RentalList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RentalList],
    }).compileComponents();

    fixture = TestBed.createComponent(RentalList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
