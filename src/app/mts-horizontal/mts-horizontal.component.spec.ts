import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MtsHorizontalComponent } from './mts-horizontal.component';

describe('MtsHorizontalComponent', () => {
  let component: MtsHorizontalComponent;
  let fixture: ComponentFixture<MtsHorizontalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MtsHorizontalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MtsHorizontalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
