import { provideRouter } from '@angular/router';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RentalListComponent } from './rental-list';

describe('Kölcsönzések listázása', () => {
  let component: RentalListComponent;
  let fixture: ComponentFixture<RentalListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RentalListComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(RentalListComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('létrejön', () => {
    expect(component).toBeTruthy();
  });
});
