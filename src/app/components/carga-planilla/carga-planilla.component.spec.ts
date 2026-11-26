import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CargaPlanillaComponent } from './carga-planilla.component';

describe('CargaPlanillaComponent', () => {
  let component: CargaPlanillaComponent;
  let fixture: ComponentFixture<CargaPlanillaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CargaPlanillaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CargaPlanillaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
