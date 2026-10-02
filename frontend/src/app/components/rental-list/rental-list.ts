import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RentalService, RentalCharges } from '../../services/rental';
import { AuthService } from '../../services/auth';
import { Rental, RentalStatus, isRentalOverdue, isRentalDueSoon } from '../../models/rental.model';
import { RentalForm } from '../rental-form/rental-form';
import { dateString } from '../../utils/date';
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

  returningRental: Rental | null = null;
  returnCondition = 'good';
  returnNotes = '';
  returnCharges: RentalCharges | null = null;

  returnRental(rental: Rental): void {
    this.returningRental = rental;
    this.returnCondition = rental.gameCopy?.condition || 'good';
    this.returnNotes = rental.gameCopy?.notes || '';
    this.returnCharges = null;
    this.cdr.detectChanges();

    this.rentalService.getCharges(rental.id).subscribe({
      next: (charges) => {
        if (this.returningRental?.id !== rental.id) return;
        this.returnCharges = charges;
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  get returnExtensionFee(): number {
    const c = this.returnCharges;
    return c ? Math.round((c.totalCharged - c.rentalCharge - c.lateFeeCharged) * 100) / 100 : 0;
  }

  private readonly conditionOrder = ['new', 'good', 'worn', 'damaged'];

  get returnConditionOptions(): string[] {
    const current = this.returningRental?.gameCopy?.condition || 'good';
    return this.conditionOrder.slice(Math.max(0, this.conditionOrder.indexOf(current)));
  }

  get returnDirty(): boolean {
    const copy = this.returningRental?.gameCopy;
    return this.returnCondition !== (copy?.condition || 'good')
      || this.returnNotes.trim() !== (copy?.notes || '').trim();
  }

  async cancelReturn(): Promise<void> {
    if (this.returnDirty) {
      const confirmed = await this.dialogService.confirm({
        title: 'Unsaved Changes',
        message: 'Are you sure you want to close? You have unsaved changes.',
        confirmLabel: 'Discard',
        type: 'warning'
      });
      if (!confirmed) return;
    }
    this.returningRental = null;
    this.cdr.detectChanges();
  }

  submitReturn(): void {
    const rental = this.returningRental;
    if (!rental) return;
    const title = rental.gameCopy?.game?.title || rental.gameTitleSnapshot;

    this.rentalService.return(rental.id, { condition: this.returnCondition, notes: this.returnNotes.trim() }).subscribe({
      next: (updated) => {
        Object.assign(rental, updated);
        this.returningRental = null;
        this.toastService.success(`Rental for "${title}" marked as returned.`);
        this.loadRentals();
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
        Object.assign(rental, updated);
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

  private charge(value: number | null | undefined): number | null {
    return value == null ? null : Number(value);
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
      'Rental Charge': this.charge(r.rentalCharge),
      'Late Fee': this.charge(r.lateFeeCharged),
      'Extension Fee': this.charge(r.extensionFeeCharged || null),
      'Replacement Fee': this.charge(r.replacementFeeCharged),
      'Total Charged': this.charge(r.totalCharged),
      'Rented out by': r.handledBy?.email || '—',
      'Checked in by': r.returnedBy?.email || '—',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const lastRow = XLSX.utils.decode_range(ws['!ref'] ?? 'A1').e.r;
    for (let r = 1; r <= lastRow; r++) {
      for (let c = 9; c <= 13; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (cell) cell.z = '$#,##0.00';
      }
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rentals');

    const colWidths = [
      { wch: 22 }, { wch: 28 }, { wch: 24 }, { wch: 14 },
      { wch: 12 }, { wch: 14 }, { wch: 15 }, { wch: 14 },
      { wch: 14 }, { wch: 13 }, { wch: 11 }, { wch: 13 },
      { wch: 15 }, { wch: 13 }, { wch: 26 }, { wch: 26 },
    ];
    ws['!cols'] = colWidths;

    XLSX.writeFile(wb, `rentals-export-${dateString()}.xlsx`);
    this.toastService.success('Rentals exported to Excel successfully.');
  }

  getMaxDueDate(dueDate: string): string {
    return dateString(14, dueDate);
  }

  startExtend(rental: Rental): void {
    this.extendingRentalId = rental.id;
    this.extendDueDate = dateString(7, rental.dueDate);
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