import { TestBed } from '@angular/core/testing';

import { PdfService } from './pdf';

describe('PDF-szolgáltatás', () => {
  let service: PdfService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PdfService);
  });

  it('létrejön', () => {
    expect(service).toBeTruthy();
  });
});
