import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManageSignature } from './manage-signature';

describe('ManageSignature', () => {
  let component: ManageSignature;
  let fixture: ComponentFixture<ManageSignature>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManageSignature],
    }).compileComponents();

    fixture = TestBed.createComponent(ManageSignature);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
