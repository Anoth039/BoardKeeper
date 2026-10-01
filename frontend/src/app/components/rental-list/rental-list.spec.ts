import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RentalListComponent } from './rental-list';

describe('RentalListComponent', () => {
  let component: RentalListComponent;
  let fixture: ComponentFixture<RentalListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RentalListComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RentalListComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
