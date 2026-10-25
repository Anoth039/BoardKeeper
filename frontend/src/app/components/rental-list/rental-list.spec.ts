import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { RentalListComponent } from './rental-list';
import { RentalService } from '../../services/rental';
import { AuthService } from '../../services/auth';
import { PdfService } from '../../services/pdf';
import { DialogService } from '../../services/dialog';
import { ToastService } from '../../services/toast';
import { Rental, RentalStatus } from '../../models/rental.model';

describe('Kölcsönzések listázása', () => {
  let component: RentalListComponent;
  let fixture: ComponentFixture<RentalListComponent>;

  const rentalsData: Rental[] = [
    {
      id: 1, rentalDate: '2026-10-01', dueDate: '2026-10-08', originalDueDate: '2026-10-08',
      returnDate: null, status: RentalStatus.ACTIVE, gameTitleSnapshot: 'Catan', copyLabelSnapshot: 'CAT-01',
      member: { id: 1, firstName: 'Anna', lastName: 'Teszt', email: 'anna@example.com', isActive: true, createdAt: '2026-01-01' },
      createdAt: '2026-10-01',
    },
    {
      id: 2, rentalDate: '2026-10-03', dueDate: '2026-10-10', originalDueDate: '2026-10-10',
      returnDate: '2026-10-09', status: RentalStatus.RETURNED, gameTitleSnapshot: 'Ticket to Ride', copyLabelSnapshot: 'TTR-01',
      member: { id: 2, firstName: 'Béla', lastName: 'Minta', email: 'bela@example.com', isActive: true, createdAt: '2026-01-01' },
      createdAt: '2026-10-03',
    },
    {
      id: 3, rentalDate: '2026-10-05', dueDate: '2026-10-12', originalDueDate: '2026-10-12',
      returnDate: null, status: RentalStatus.LOST, gameTitleSnapshot: 'Carcassonne', copyLabelSnapshot: 'CAR-01',
      member: { id: 3, firstName: 'Csilla', lastName: 'Példa', email: 'csilla@example.com', isActive: true, createdAt: '2026-01-01' },
      createdAt: '2026-10-05',
    },
  ];

  const rentals = { getAll: vi.fn(), getCharges: vi.fn(), return: vi.fn() };
  const toast = { success: vi.fn(), error: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    rentals.getAll.mockReturnValue(of(rentalsData));
    rentals.getCharges.mockReturnValue(of({ rentalCharge: 1200, lateFeeCharged: 0, replacementFeeCharged: 0, totalCharged: 1200 }));
    rentals.return.mockReturnValue(of({ ...rentalsData[0], status: RentalStatus.RETURNED }));
    await TestBed.configureTestingModule({
      imports: [RentalListComponent],
      providers: [
        { provide: RentalService, useValue: rentals },
        { provide: AuthService, useValue: { can: () => false } },
        { provide: PdfService, useValue: { generateRentalReceipt: vi.fn() } },
        { provide: DialogService, useValue: { confirm: vi.fn() } },
        { provide: ToastService, useValue: toast },
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RentalListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('betölti a kölcsönzéseket a szolgáltatásból', () => {
    expect(rentals.getAll).toHaveBeenCalledOnce();
    expect(component.rentals).toHaveLength(3);
  });

  it('állapot és keresőkifejezés alapján szűri a kölcsönzéseket', () => {
    component.statusFilter = RentalStatus.ACTIVE;
    component.searchTerm = 'anna';
    expect(component.filteredRentals.map(rental => rental.id)).toEqual([1]);

    component.searchTerm = 'carcassonne';
    expect(component.filteredRentals).toHaveLength(0);
  });

  it('a kölcsönzés és a határidő dátumtartománya alapján szűr', () => {
    component.rentalDateFrom = '2026-10-03';
    component.rentalDateTo = '2026-10-05';
    component.dueDateFrom = '2026-10-10';

    expect(component.filteredRentals.map(rental => rental.id)).toEqual([3, 2]);
  });

  it('visszavételkor elmenti az állapotot és a levágott megjegyzést', () => {
    const rental = { ...rentalsData[0] };
    component.returningRental = rental;
    component.returnCondition = 'worn';
    component.returnNotes = '  sérült doboz  ';

    component.submitReturn();

    expect(rentals.return).toHaveBeenCalledWith(rental.id, {
      condition: 'worn',
      notes: 'sérült doboz',
    });
    expect(component.returningRental).toBeNull();
    expect(toast.success).toHaveBeenCalledWith('Rental for "Catan" marked as returned.');
    expect(rentals.getAll).toHaveBeenCalledTimes(2);
  });

  it('megadja az aktív szűrők számát, és törli az összes szűrőt', () => {
    component.statusFilter = RentalStatus.ACTIVE;
    component.rentalDateFrom = '2026-10-01';
    component.dueDateTo = '2026-10-31';
    component.searchTerm = 'Anna';
    expect(component.activeFilterCount).toBe(3);

    component.clearFilters();

    expect(component.searchTerm).toBe('');
    expect(component.statusFilter).toBe('all');
    expect(component.rentalDateFrom).toBe('');
    expect(component.rentalDateTo).toBe('');
    expect(component.dueDateFrom).toBe('');
    expect(component.dueDateTo).toBe('');
    expect(component.filteredRentals).toHaveLength(3);
  });
});
