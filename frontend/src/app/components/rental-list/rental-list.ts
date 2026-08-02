import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RentalService } from '../../services/rental';
import { isRentalOverdue, Rental, rentalDisplayStatus, RentalStatus, rentalStatusBadgeClass } from '../../models/rental.model';
import { RentalForm } from '../rental-form/rental-form';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-rental-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RentalForm],
  templateUrl: './rental-list.html',
  styleUrl: './rental-list.css'
})
export class RentalListComponent implements OnInit {
  rentals: Rental[] = [];
  searchTerm = '';
  statusFilter: 'all' | RentalStatus = 'all';
  showForm = false;

  isOverdue = isRentalOverdue;
  statusBadgeClass = rentalStatusBadgeClass;
  displayStatus = rentalDisplayStatus;

  constructor(private rentalService: RentalService, private cdr: ChangeDetectorRef, public authService: AuthService) {}

  ngOnInit(): void {
    this.loadRentals();
  }

  loadRentals(): void {
    this.rentalService.getAll().subscribe({
      next: (data) => {
        this.rentals = data;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load rentals', err);
        this.cdr.detectChanges();
      }
    });
  }

  get isAdmin(): boolean {
    return this.authService.getCurrentUser()?.role === 'admin';
  }

  get filteredRentals(): Rental[] {
    let result = this.rentals;

    if (this.statusFilter !== 'all') {
      result = result.filter(r => r.status === this.statusFilter);
    }

    if (this.searchTerm.trim() !== '') {
      const term = this.searchTerm.trim().toLowerCase();
      result = result.filter(r =>
        `${r.member?.firstName} ${r.member?.lastName}`.toLowerCase().includes(term)
        || r.gameCopy?.game?.title.toLowerCase().includes(term)
      );
    }

    return [...result].sort((a, b) => {
      const priorityDiff = this.statusPriority(a) - this.statusPriority(b);
      if (priorityDiff !== 0) return priorityDiff;
      return b.rentalDate.localeCompare(a.rentalDate);
    });
  }

  private statusPriority(rental: Rental): number {
    if (this.isOverdue(rental)) return 0;
    if (rental.status === RentalStatus.ACTIVE) return 1;
    return 2;
  }

  openForm(): void {
    this.showForm = true;
    this.cdr.detectChanges();
  }

  onFormCreated(): void {
    this.showForm = false;
    this.loadRentals();
  }

  onFormCancelled(): void {
    this.showForm = false;
    this.cdr.detectChanges();
  }

  returnRental(rental: Rental): void {
    if (!confirm(`Mark "${rental.gameCopy?.game?.title}" as returned by ${rental.member?.firstName}?`)) return;

    this.rentalService.return(rental.id).subscribe({
      next: (updated) => {
        rental.status = updated.status;
        rental.returnDate = updated.returnDate;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to return rental', err);
        alert('Failed to mark this rental as returned.');
        this.cdr.detectChanges();
      }
    });
  }

  handledByInitials(rental: Rental): string {
    if (!rental.handledBy?.email) return '?';
    return rental.handledBy.email.charAt(0).toUpperCase();
  }

  returnedByInitials(rental: Rental): string {
    if (!rental.returnedBy?.email) return '?';
    return rental.returnedBy.email.charAt(0).toUpperCase();
  }
}