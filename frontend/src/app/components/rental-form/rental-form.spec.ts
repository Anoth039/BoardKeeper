import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ElementRef } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { RentalForm } from './rental-form';
import { RentalService } from '../../services/rental';
import { MemberService } from '../../services/member';
import { GameService } from '../../services/game';
import { DialogService } from '../../services/dialog';
import { ToastService } from '../../services/toast';
import { Member } from '../../models/member.model';
import { Game } from '../../models/game.model';

describe('Kölcsönzés űrlapja', () => {
  let component: RentalForm;
  let fixture: ComponentFixture<RentalForm>;

  const activeMember: Member = {
    id: 1, firstName: 'Anna', lastName: 'Teszt', email: 'anna@example.com',
    isActive: true, createdAt: '2026-01-01',
  };
  const inactiveMember: Member = {
    id: 2, firstName: 'Béla', lastName: 'Teszt', email: 'bela@example.com',
    isActive: false, createdAt: '2026-01-01',
  };
  const game: Game = {
    id: 10, title: 'Catan', minPlayers: 3, maxPlayers: 4, pricePerDay: 1200,
    createdAt: '2026-01-01',
    copies: [
      { id: 101, copyNumber: 'CAT-01', condition: 'good', isAvailable: true, notes: null, createdAt: '2026-01-01' },
      { id: 102, copyNumber: 'CAT-02', condition: 'good', isAvailable: false, notes: null, createdAt: '2026-01-01' },
      { id: 103, copyNumber: 'CAT-03', condition: 'lost', isAvailable: true, notes: null, createdAt: '2026-01-01' },
    ],
  };

  const rentals = { create: vi.fn() };
  const members = { getAll: vi.fn() };
  const games = { getAll: vi.fn() };
  const dialogs = { confirm: vi.fn() };
  const toast = { success: vi.fn(), error: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    rentals.create.mockReturnValue(of({ id: 50 }));
    members.getAll.mockReturnValue(of([activeMember, inactiveMember]));
    games.getAll.mockReturnValue(of([game]));
    await TestBed.configureTestingModule({
      imports: [RentalForm],
      providers: [
        { provide: RentalService, useValue: rentals },
        { provide: MemberService, useValue: members },
        { provide: GameService, useValue: games },
        { provide: DialogService, useValue: dialogs },
        { provide: ToastService, useValue: toast },
        { provide: ElementRef, useValue: { nativeElement: document.createElement('div') } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RentalForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('csak aktív tagokat tölt be, és nem kínálja fel a nem kölcsönözhető példányokat', () => {
    expect(component.members.map(member => member.id)).toEqual([1]);
    expect(component.games).toEqual([game]);

    component.selectMember(activeMember);
    component.selectGame(game);

    expect(component.availableCopiesForSelectedGame.map(copy => copy.id)).toEqual([101]);
  });

  it('hiányzó adatok esetén nem indít kölcsönzést', () => {
    component.onSubmit();

    expect(rentals.create).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Please fill in all fields.');
    expect(component.submitting).toBe(false);
  });

  it('nem enged a kölcsönzés napjánál korábbi határidőt', () => {
    component.selectMember(activeMember);
    component.selectGame(game);
    component.selectCopy(101);
    component.rentalDate = '2026-10-10';
    component.dueDate = '2026-10-09';

    component.onSubmit();

    expect(rentals.create).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Due date cannot be before the rental date.');
  });

  it('a kiválasztott taggal és példánnyal létrehozza a kölcsönzést', () => {
    const created = vi.fn();
    component.rentalCreated.subscribe(created);
    component.selectMember(activeMember);
    component.selectGame(game);
    component.selectCopy(101);
    component.rentalDate = '2026-10-10';
    component.dueDate = '2026-10-17';

    component.onSubmit();

    expect(rentals.create).toHaveBeenCalledWith({
      memberId: 1,
      gameCopyId: 101,
      rentalDate: '2026-10-10',
      dueDate: '2026-10-17',
    });
    expect(toast.success).toHaveBeenCalledWith('Rental for "Catan" created successfully.');
    expect(created).toHaveBeenCalledOnce();
    expect(component.submitting).toBe(false);
  });

  it('a szerver hibáját megjeleníti, és visszaállítja a beküldés állapotát', () => {
    rentals.create.mockReturnValue(throwError(() => ({ error: { message: 'Member has overdue rentals.' } })));
    component.selectMember(activeMember);
    component.selectGame(game);
    component.selectCopy(101);
    component.rentalDate = '2026-10-10';
    component.dueDate = '2026-10-17';
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    component.onSubmit();

    expect(toast.error).toHaveBeenCalledWith('Member has overdue rentals.');
    expect(component.submitting).toBe(false);
    errorSpy.mockRestore();
  });
});
