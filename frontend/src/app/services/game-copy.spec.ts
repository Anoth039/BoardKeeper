import { TestBed } from '@angular/core/testing';

import { GameCopy } from './game-copy';

describe('GameCopy', () => {
  let service: GameCopy;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GameCopy);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
