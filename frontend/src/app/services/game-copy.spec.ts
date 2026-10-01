import { TestBed } from '@angular/core/testing';

import { GameCopyService } from './game-copy';

describe('GameCopyService', () => {
  let service: GameCopyService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GameCopyService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
