import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RentalService } from '../../services/rental';
import { AuthService } from '../../services/auth';
import { Rental, RentalStatus, isRentalOverdue, isRentalDueSoon } from '../../models/rental.model';
import { RentalForm } from '../rental-form/rental-form';
import { PdfService } from '../../services/pdf';
import * as XLSX from 'xlsx';
import { SafePipe } from '../../pipes/safe-pipe';
import { DialogService } from '../../services/dialog';
import { ToastService } from '../../services/toast';

@Component({
  selector: 'app-rental-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RentalForm, SafePipe],
  templateUrl: './rental-list.html',
  styleUrl: './rental-list.css'
})
export class RentalListComponent implements OnInit {
  rentals: Rental[] = [];
  showForm = false;

  extendingRentalId: number | null = null;
  extendDueDate = '';

  searchTerm = '';
  statusFilter: 'all' | RentalStatus = 'all';
  rentalDateFrom = '';
  rentalDateTo = '';
  dueDateFrom = '';
  dueDateTo = '';
  showFilters = false;
  previewPdfUrl: string | null = null;
  previewRental: Rental | null = null;

  isOverdue = isRentalOverdue;
  isDueSoon = isRentalDueSoon;

  constructor(private rentalService: RentalService, public authService: AuthService, private pdfService: PdfService, 
    private cdr: ChangeDetectorRef, private dialogService: DialogService, private toastService: ToastService) {}

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
        this.toastService.error('Failed to load rentals.');
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

  async returnRental(rental: Rental): Promise<void> {
    const title = rental.gameCopy?.game?.title || rental.gameTitleSnapshot;
    const confirmed = await this.dialogService.confirm({
      title: 'Return Rental',
      message: `Mark "${title}" [${rental.gameCopy?.copyNumber || rental.copyLabelSnapshot}] as returned by ${rental.member?.firstName}?`,
      confirmLabel: 'Return',
      type: 'primary',
    });
    if (!confirmed) return;

    this.rentalService.return(rental.id).subscribe({
      next: (updated) => {
        rental.status = updated.status;
        rental.returnDate = updated.returnDate;
        this.toastService.success(`Rental for "${title}" marked as returned.`);
        this.cdr.detectChanges();
      },
      error: (err) => {
        const message = err.error?.message || 'Failed to return rental.';
        this.toastService.error(message);
        this.cdr.detectChanges();
      }
    });
  }

  async markLost(rental: Rental): Promise<void> {
    const title = rental.gameCopy?.game?.title || rental.gameTitleSnapshot;
    const confirmed = await this.dialogService.confirm({
      title: 'Mark as Lost',
      message: `Mark "${title}" [${rental.gameCopy?.copyNumber || rental.copyLabelSnapshot}] as lost?`,
      confirmLabel: 'Mark Lost',
      type: 'danger',
    });
    if (!confirmed) return;

    this.rentalService.markLost(rental.id).subscribe({
      next: (updated) => {
        rental.status = updated.status;
        rental.returnDate = updated.returnDate;
        this.toastService.success(`Rental for "${title}" marked as lost.`);
        this.cdr.detectChanges();
      },
      error: (err) => {
        const message = err.error?.message || 'Failed to mark as lost.';
        this.toastService.error(message);
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

  previewReceipt(rental: Rental): void {
    this.previewPdfUrl = this.pdfService.generateRentalReceiptDataUrl(rental);
    this.previewRental = rental;
    this.cdr.detectChanges();
  }

  closePreview(): void {
    this.previewPdfUrl = null;
    this.previewRental = null;
    this.cdr.detectChanges();
  }

  downloadFromPreview(): void {
    if (this.previewRental) {
      this.pdfService.generateRentalReceipt(this.previewRental);
    }
  }

  private rentalStatusLabel(rental: Rental): string {
    if (isRentalOverdue(rental)) return 'overdue';
    if (isRentalDueSoon(rental)) return 'due soon';
    return rental.status;
  }

  exportToExcel(): void {
    if (!this.isAdmin) return;
    
    const rows = this.filteredRentals.map(r => ({
      'Member': r.member ? `${r.member.firstName} ${r.member.lastName}` : 'Unknown',
      'Email': r.member?.email || '—',
      'Game': r.gameCopy?.game?.title || r.gameTitleSnapshot || 'Unknown',
      'Copy': r.gameCopy?.copyNumber || r.copyLabelSnapshot || '—',
      'Status': this.rentalStatusLabel(r),
      'Rental Date': r.rentalDate,
      'Original Due Date': r.originalDueDate,
      'Due Date': r.dueDate,
      'Return Date': r.returnDate || '—',
      'Rented out by': r.handledBy?.email || '—',
      'Checked in by': r.returnedBy?.email || '—',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rentals');

    const colWidths = [
      { wch: 22 }, { wch: 28 }, { wch: 24 }, { wch: 14 },
      { wch: 12 }, { wch: 14 }, { wch: 15 }, { wch: 14 },
      { wch: 14 }, { wch: 26 }, { wch: 26 },
    ];
    ws['!cols'] = colWidths;

    const date = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `rentals-export-${date}.xlsx`);
    this.toastService.success('Rentals exported to Excel successfully.');
  }

  startExtend(rental: Rental): void {
    this.extendingRentalId = rental.id;
    const d = new Date(rental.dueDate);
    d.setDate(d.getDate() + 7);
    this.extendDueDate = d.toISOString().split('T')[0];
    this.cdr.detectChanges();
  }

  cancelExtend(): void {
    this.extendingRentalId = null;
    this.extendDueDate = '';
    this.cdr.detectChanges();
  }

  async submitExtend(rental: Rental): Promise<void> {
    if (!this.extendDueDate) return;
    const title = rental.gameCopy?.game?.title || rental.gameTitleSnapshot;
    const confirmed = await this.dialogService.confirm({
      title: 'Extend Rental',
      message: `Extend rental for "${title}" [${rental.gameCopy?.copyNumber || rental.copyLabelSnapshot}] until ${this.extendDueDate}?`,
      confirmLabel: 'Extend',
      type: 'primary',
    });
    if (!confirmed) return;

    const formattedDueDate = this.extendDueDate;

    this.rentalService.extend(rental.id, this.extendDueDate).subscribe({
      next: () => {
        this.extendingRentalId = null;
        this.extendDueDate = '';
        this.toastService.success(`Rental for "${title}" extended until ${formattedDueDate}.`);
        this.loadRentals(); 
      },
      error: (err) => {
        const message = err.error?.message || 'Failed to extend rental.';
        this.toastService.error(message);
        this.cdr.detectChanges();
      }
    });
  }
}