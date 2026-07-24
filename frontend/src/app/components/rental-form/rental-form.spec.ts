import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RentalForm } from './rental-form';

describe('RentalForm', () => {
  let component: RentalForm;
  let fixture: ComponentFixture<RentalForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RentalForm],
    }).compileComponents();

    fixture = TestBed.createComponent(RentalForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
