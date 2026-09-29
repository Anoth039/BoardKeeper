import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MemberPicker } from './member-picker';

describe('MemberPicker', () => {
  let component: MemberPicker;
  let fixture: ComponentFixture<MemberPicker>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MemberPicker],
    }).compileComponents();

    fixture = TestBed.createComponent(MemberPicker);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
