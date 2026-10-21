import { provideRouter } from '@angular/router';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MemberDetail } from './member-detail';

describe('Tag adatlapja', () => {
  let component: MemberDetail;
  let fixture: ComponentFixture<MemberDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MemberDetail],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(MemberDetail);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('létrejön', () => {
    expect(component).toBeTruthy();
  });
});
