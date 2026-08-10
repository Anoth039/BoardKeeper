import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RentalService } from '../../services/rental';
import { AuthService } from '../../services/auth';
import { Rental, RentalStatus, isRentalOverdue, isRentalDueSoon } from '../../models/rental.model';
import { RentalForm } from '../rental-form/rental-form';
import { PdfService } from '../../services/pdf';

@Component({
  selector: 'app-rental-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RentalForm],
  templateUrl: './rental-list.html',
  styleUrl: './rental-list.css'
})
export class RentalListComponent implements OnInit {
  rentals: Rental[] = [];
  showForm = false;

  searchTerm = '';
  statusFilter: 'all' | RentalStatus = 'all';
  rentalDateFrom = '';
  rentalDateTo = '';
  dueDateFrom = '';
  dueDateTo = '';
  showFilters = false;

  isOverdue = isRentalOverdue;
  isDueSoon = isRentalDueSoon;

  constructor(private rentalService: RentalService, public authService: AuthService, private pdfService: PdfService, private cdr: ChangeDetectorRef) {}

  get isAdmin(): boolean {
    return this.authService.getCurrentUser()?.role === 'admin';
  }

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

  get activeFilterCount(): number {
    let count = 0;
    if (this.statusFilter !== 'all') count++;
    if (this.rentalDateFrom) count++;
    if (this.rentalDateTo) count++;
    if (this.dueDateFrom) count++;
    if (this.dueDateTo) count++;
    return count;
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.statusFilter = 'all';
    this.rentalDateFrom = '';
    this.rentalDateTo = '';
    this.dueDateFrom = '';
    this.dueDateTo = '';
    this.cdr.detectChanges();
  }

  get filteredRentals(): Rental[] {
    let result = this.rentals;

    if (this.statusFilter !== 'all') {
      result = result.filter(r => r.status === this.statusFilter);
    }

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.trim().toLowerCase();
      result = result.filter(r =>
        `${r.member?.firstName ?? ''} ${r.member?.lastName ?? ''}`.toLowerCase().includes(term)
        || (r.gameCopy?.game?.title ?? r.gameTitleSnapshot ?? '').toLowerCase().includes(term)
        || (r.gameCopy?.copyNumber ?? r.copyLabelSnapshot ?? '').toLowerCase().includes(term)
        || r.member?.email?.toLowerCase().includes(term)
      );
    }

    if (this.rentalDateFrom) {
      result = result.filter(r => r.rentalDate >= this.rentalDateFrom);
    }
    if (this.rentalDateTo) {
      result = result.filter(r => r.rentalDate <= this.rentalDateTo);
    }

    if (this.dueDateFrom) {
      result = result.filter(r => r.dueDate >= this.dueDateFrom);
    }
    if (this.dueDateTo) {
      result = result.filter(r => r.dueDate <= this.dueDateTo);
    }

    return [...result].sort((a, b) => {
      const pa = this.statusPriority(a);
      const pb = this.statusPriority(b);
      if (pa !== pb) return pa - pb;
      return b.rentalDate.localeCompare(a.rentalDate);
    });
  }

  private statusPriority(rental: Rental): number {
    if (isRentalOverdue(rental)) return 0;
    if (isRentalDueSoon(rental)) return 1;
    if (rental.status === RentalStatus.ACTIVE) return 2;
    return 3;
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
    if (!confirm(`Mark "${rental.gameCopy?.game?.title || rental.gameTitleSnapshot}" (${rental.gameCopy?.copyNumber || rental.copyLabelSnapshot}) as returned by ${rental.member?.firstName}?`)) return;

    this.rentalService.return(rental.id).subscribe({
      next: (updated) => {
        rental.status = updated.status;
        rental.returnDate = updated.returnDate;
        this.cdr.detectChanges();
      },
      error: (err) => {
        alert(err.error?.message || 'Failed to return rental.');
        this.cdr.detectChanges();
      }
    });
  }

  markLost(rental: Rental): void {
    if (!confirm(`Mark "${rental.gameCopy?.game?.title || rental.gameTitleSnapshot}" (${rental.gameCopy?.copyNumber || rental.copyLabelSnapshot}) as lost?`)) return;

    this.rentalService.markLost(rental.id).subscribe({
      next: (updated) => {
        rental.status = updated.status;
        rental.returnDate = updated.returnDate;
        this.cdr.detectChanges();
      },
      error: (err) => {
        alert(err.error?.message || 'Failed to mark as lost.');
        this.cdr.detectChanges();
      }
    });
  }

  handledByInitials(rental: Rental): string {
    return rental.handledBy?.email?.charAt(0).toUpperCase() || '?';
  }

  returnedByInitials(rental: Rental): string {
    return rental.returnedBy?.email?.charAt(0).toUpperCase() || '?';
  }

  downloadReceipt(rental: Rental): void {
    this.pdfService.generateRentalReceipt(rental);
  }
}