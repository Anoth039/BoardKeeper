import { provideRouter } from '@angular/router';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MemberPicker } from './member-picker';

describe('Tag kiválasztása', () => {
  let component: MemberPicker;
  let fixture: ComponentFixture<MemberPicker>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MemberPicker],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(MemberPicker);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('létrejön', () => {
    expect(component).toBeTruthy();
  });
});
