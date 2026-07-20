import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MemberForm } from './member-form';

describe('MemberForm', () => {
  let component: MemberForm;
  let fixture: ComponentFixture<MemberForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MemberForm],
    }).compileComponents();

    fixture = TestBed.createComponent(MemberForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
