import { provideRouter } from '@angular/router';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RentalForm } from './rental-form';

describe('Kölcsönzés űrlapja', () => {
  let component: RentalForm;
  let fixture: ComponentFixture<RentalForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RentalForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(RentalForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('létrejön', () => {
    expect(component).toBeTruthy();
  });
});
