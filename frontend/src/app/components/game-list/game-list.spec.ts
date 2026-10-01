import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameListComponent } from './game-list';

describe('GameListComponent', () => {
  let component: GameListComponent;
  let fixture: ComponentFixture<GameListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameListComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GameListComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
