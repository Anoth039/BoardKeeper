import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameList } from './game-list';

describe('GameList', () => {
  let component: GameList;
  let fixture: ComponentFixture<GameList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameList],
    }).compileComponents();

    fixture = TestBed.createComponent(GameList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
