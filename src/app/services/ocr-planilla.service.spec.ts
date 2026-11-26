import { TestBed } from '@angular/core/testing';

import { OcrPlanillaService } from './ocr-planilla.service';

describe('OcrPlanillaService', () => {
  let service: OcrPlanillaService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OcrPlanillaService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
