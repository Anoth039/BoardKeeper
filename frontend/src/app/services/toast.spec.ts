import { TestBed } from '@angular/core/testing';

import { ToastService } from './toast';

describe('Értesítési szolgáltatás', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
  });

  it('létrejön', () => {
    expect(service).toBeTruthy();
  });
});
