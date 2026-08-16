import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BackToTop } from './back-to-top';

describe('BackToTop', () => {
  let component: BackToTop;
  let fixture: ComponentFixture<BackToTop>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BackToTop],
    }).compileComponents();

    fixture = TestBed.createComponent(BackToTop);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
