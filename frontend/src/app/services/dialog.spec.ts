import { TestBed } from '@angular/core/testing';

import { DialogService } from './dialog';

describe('Párbeszédablak-szolgáltatás', () => {
  let service: DialogService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DialogService);
  });

  it('létrejön', () => {
    expect(service).toBeTruthy();
  });
});
