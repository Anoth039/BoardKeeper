import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { MemberForm } from './member-form';
import { MemberService } from '../../services/member';
import { DialogService } from '../../services/dialog';
import { ToastService } from '../../services/toast';

describe('Tag adatainak kezelése', () => {
  let fixture: ComponentFixture<MemberForm>;
  let component: MemberForm;
  const members = { create: vi.fn(), update: vi.fn() };
  const dialogs = { confirm: vi.fn() };
  const toast = { success: vi.fn(), error: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    members.create.mockReturnValue(of({ id: 1 }));
    members.update.mockReturnValue(of({ id: 1 }));
    await TestBed.configureTestingModule({
      imports: [MemberForm],
      providers: [
        { provide: MemberService, useValue: members },
        { provide: DialogService, useValue: dialogs },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(MemberForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('kötelezővé teszi a nevet és az érvényes e-mail-címet', () => {
    component.onSubmit();
    expect(component.form.invalid).toBe(true);
    expect(component.form.touched).toBe(true);
    expect(members.create).not.toHaveBeenCalled();

    component.form.patchValue({ firstName: 'Anna', lastName: 'Teszt', email: 'invalid-email' });
    expect(component.form.invalid).toBe(true);
  });

  it('a megadott adatokkal hozza létre a tagot', () => {
    const saved = vi.fn();
    component.memberSaved.subscribe(saved);
    component.form.setValue({ firstName: 'Anna', lastName: 'Teszt', email: 'anna@example.com', phone: '+361234567' });
    component.onSubmit();
    expect(members.create).toHaveBeenCalledWith({ firstName: 'Anna', lastName: 'Teszt', email: 'anna@example.com', phone: '+361234567' });
    expect(saved).toHaveBeenCalledOnce();
    expect(toast.success).toHaveBeenCalledWith('Member "Anna Teszt" created successfully.');
    expect(component.submitting).toBe(false);
  });

  it('jelzi, ha az e-mail-cím már használatban van', () => {
    members.create.mockReturnValue(throwError(() => ({ status: 409 })));
    component.form.setValue({ firstName: 'Anna', lastName: 'Teszt', email: 'anna@example.com', phone: '' });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    component.onSubmit();
    expect(toast.error).toHaveBeenCalledWith('A member with this email already exists.');
    expect(component.submitting).toBe(false);
    errorSpy.mockRestore();
  });
});
