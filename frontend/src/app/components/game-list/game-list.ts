import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GameService } from '../../services/game';
import { GameCopyService } from '../../services/game-copy';
import { CopyAuditLog, Game, GameCopy } from '../../models/game.model';
import { GameForm } from '../game-form/game-form';
import { AuthService } from '../../services/auth';
import { DialogService } from '../../services/dialog';
import { ToastService } from '../../services/toast';

@Component({
  selector: 'app-game-list',
  standalone: true,
  imports: [CommonModule, FormsModule, GameForm],
  templateUrl: './game-list.html',
  styleUrl: './game-list.css'
})
export class GameListComponent implements OnInit {
  games: Game[] = [];
  showForm = false;
  editingGame: Game | null = null;
  selectedGameForCopies: Game | null = null;
  searchTerm = '';

  showAuditLog = false;
  auditLogs: CopyAuditLog[] = [];
  auditLoading = false;

  expandedCards: { [key: number]: boolean } = {};
  hasOverflow: { [key: number]: boolean } = {};

  newCopyCondition = 'new';
  newCopyNumber = '';
  addingCopy = false;

  bulkMode = false;
  bulkPrefix = '';
  bulkStartNumber = 1;
  bulkQuantity = 2;
  bulkCondition = 'new';
  addingBulk = false;

  editingCopyId: number | null = null;
  editCopyCondition = 'good';
  editCopyNumber = '';
  editCopyNotes = '';

  copySearchTerm = '';
  copyFilterCondition = 'all';
  copyFilterAvailability = 'all';

  constructor(private gameService: GameService, private gameCopyService: GameCopyService, private cdr: ChangeDetectorRef,
    public authService: AuthService, private dialogService: DialogService, private toastService: ToastService) {}

  ngOnInit(): void {
    this.loadGames();
  }

  loadGames(): void {
    this.gameService.getAll().subscribe({
      next: (data) => {
        this.games = data;
        if (this.selectedGameForCopies) {
          const refreshed = data.find(g => g.id === this.selectedGameForCopies!.id);
          this.selectedGameForCopies = refreshed || null;
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load games', err);
        this.toastService.error('Failed to load games.');
        this.cdr.detectChanges();
      }
    });
  }

  openAddForm(): void {
    this.editingGame = null;
    this.showForm = true;
    this.cdr.detectChanges();
  }

  openEditForm(game: Game): void {
    this.editingGame = game;
    this.showForm = true;
    this.cdr.detectChanges();
  }

  onFormSaved(): void {
    this.showForm = false;
    this.editingGame = null;
    this.loadGames();
    this.cdr.detectChanges();
  }

  onFormCancelled(): void {
    this.showForm = false;
    this.editingGame = null;
    this.cdr.detectChanges();
  }

  openCopiesModal(game: Game): void {
    this.selectedGameForCopies = game;
    this.resetNewCopyForm();
    this.resetCopyFilters();
    this.editingCopyId = null;
    this.cdr.detectChanges();
  }

  closeCopiesModal(): void {
    this.selectedGameForCopies = null;
    this.showAuditLog = false;
    this.auditLogs = [];
    this.resetCopyFilters();
    this.bulkMode = false;
    this.bulkPrefix = '';
    this.cdr.detectChanges();
  }

  resetNewCopyForm(): void {
    this.newCopyCondition = 'new';
    this.newCopyNumber = '';
    this.cdr.detectChanges();
  }

  addCopy(): void {
    if (!this.selectedGameForCopies) return;

    const trimmedNumber = this.newCopyNumber.trim();

    if (trimmedNumber.length < 3 || trimmedNumber.length > 12) {
      this.toastService.error('Copy name/number must be between 3 and 12 characters.');
      this.cdr.detectChanges();
      return;
    }

    const isDuplicate = this.selectedGameForCopies.copies?.some(
      copy => copy.copyNumber.toLowerCase() === trimmedNumber.toLowerCase()
    );

    if (isDuplicate) {
      this.toastService.error('A copy with this name already exists for this game.');
      this.cdr.detectChanges();
      return;
    }

    this.addingCopy = true;
    this.cdr.detectChanges();

    this.gameCopyService.create({
      gameId: this.selectedGameForCopies.id,
      condition: this.newCopyCondition,
      copyNumber: trimmedNumber
    }).subscribe({
      next: () => {
        this.addingCopy = false;
        this.toastService.success('Copy added successfully.');
        this.resetNewCopyForm();
        this.loadGames();
      },
      error: (err) => {
        this.addingCopy = false;
        this.toastService.error(err.error?.message || 'Failed to add copy.');
        console.error(err);
        this.cdr.detectChanges();
      }
    });
  }

  get bulkPreview(): string[] {
    if (!this.bulkPrefix.trim() || this.bulkQuantity < 1) return [];
    return Array.from({ length: Math.min(this.bulkQuantity, 20) }, (_, i) =>
      `${this.bulkPrefix.trim()}-${String(this.bulkStartNumber + i).padStart(2, '0')}`
    );
  }

  toggleBulkMode(): void {
    this.bulkMode = !this.bulkMode;
    this.bulkPrefix = '';
    this.bulkQuantity = 2;
    this.bulkStartNumber = 1;
    this.bulkCondition = 'new';
    this.cdr.detectChanges();
  }

  addBulkCopies(): void {
    if (!this.selectedGameForCopies) return;

    const invalid = this.bulkPreview.find(n => n.length < 3 || n.length > 12);
    if (invalid) {
      this.toastService.error(`Generated name "${invalid}" is invalid (must be 3–12 characters). Use a shorter prefix.`);
      this.cdr.detectChanges();
      return;
    }

    this.addingBulk = true;

    this.gameCopyService.createBulk({
      gameId: this.selectedGameForCopies.id,
      condition: this.bulkCondition,
      prefix: this.bulkPrefix.trim(),
      startNumber: this.bulkStartNumber,
      quantity: this.bulkQuantity,
    }).subscribe({
      next: (newCopies) => {
        this.addingBulk = false;
        this.selectedGameForCopies!.copies = [
          ...(this.selectedGameForCopies!.copies || []),
          ...newCopies
        ];
        const gameInList = this.games.find(g => g.id === this.selectedGameForCopies!.id);
        if (gameInList) gameInList.copies = this.selectedGameForCopies!.copies;
        this.bulkStartNumber = this.bulkStartNumber + this.bulkQuantity;
        this.toastService.success(`Added ${newCopies.length} copy/copies.`);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.addingBulk = false;
        this.toastService.error(err.error?.message || 'Failed to add copies.');
        this.cdr.detectChanges();
      }
    });
  }

  startEditCopy(copy: GameCopy): void {
    this.editingCopyId = copy.id;
    this.editCopyCondition = copy.condition;
    this.editCopyNumber = copy.copyNumber || '';
    this.editCopyNotes = copy.notes || '';
    this.cdr.detectChanges();
  }

  cancelEditCopy(): void {
    this.editingCopyId = null;
    this.editCopyNotes = '';
    this.cdr.detectChanges();
  }

  saveEditCopy(copyId: number): void {
    const trimmedNumber = this.editCopyNumber.trim();

    if (trimmedNumber.length < 3 || trimmedNumber.length > 12) {
      this.toastService.error('Copy name/number must be between 3 and 12 characters.');
      this.cdr.detectChanges();
      return;
    }

    const isDuplicate = this.selectedGameForCopies?.copies?.some(
      copy => copy.id !== copyId && copy.copyNumber.toLowerCase() === trimmedNumber.toLowerCase()
    );

    if (isDuplicate) {
      this.toastService.error('A copy with this name already exists for this game.');
      this.cdr.detectChanges();
      return;
    }

    this.cdr.detectChanges();

    const isAvailable = this.editCopyCondition !== 'lost';

    this.gameCopyService.update(copyId, {
      condition: this.editCopyCondition as any,
      copyNumber: trimmedNumber,
      notes: this.editCopyNotes.trim() || null,
      isAvailable: isAvailable
    }).subscribe({
      next: () => {
        if (this.selectedGameForCopies?.copies) {
          const target = this.selectedGameForCopies.copies.find(c => c.id === copyId);
          if (target) {
            target.copyNumber = trimmedNumber;
            target.condition = this.editCopyCondition as any;
            target.notes = this.editCopyNotes.trim() || null;
            target.isAvailable = isAvailable;
          }
        }
        this.editingCopyId = null;
        this.editCopyNotes = '';
        this.toastService.success('Copy updated successfully.');
        this.cdr.detectChanges();
        this.loadGames();
      },
      error: (err) => {
        this.toastService.error(err.error?.message || 'Failed to update copy.');
        console.error(err);
        this.cdr.detectChanges();
      }
    });
  }

  async deleteCopy(copy: GameCopy): Promise<void> {
    const confirmed = await this.dialogService.confirm({
      title: 'Delete Game Copy',
      message: `Are you sure you want to delete Copy #${copy.copyNumber}? This action cannot be undone.`,
      confirmLabel: 'Delete Copy',
      type: 'danger',
    });
    if (!confirmed) return;

    this.gameCopyService.delete(copy.id).subscribe({
      next: () => {
        this.toastService.success(`Copy #${copy.copyNumber} deleted.`);
        this.loadGames();
      },
      error: (err) => {
        const message = err.error?.message || 'Failed to delete this copy. Please try again.';
        this.toastService.error(message);
        console.error(err);
        this.cdr.detectChanges();
      }
    });
  }

  async deleteGame(game: Game): Promise<void> {
    const copyCount = game.copies?.length || 0;
    const message = copyCount > 0
      ? `Delete "${game.title}"? This will also permanently delete all ${copyCount} associated copy/copies.`
      : `Permanently delete "${game.title}"? This action cannot be undone.`;

    const confirmed = await this.dialogService.confirm({
      title: 'Delete Game',
      message,
      confirmLabel: 'Delete Game',
      type: 'danger',
    });
    if (!confirmed) return;

    this.gameService.delete(game.id).subscribe({
      next: () => {
        this.games = this.games.filter(g => g.id !== game.id);
        this.toastService.success(`"${game.title}" deleted.`);
        this.cdr.detectChanges();
      },
      error: (err) => {
        const message = err.error?.message || 'Failed to delete this game. Please try again.';
        this.toastService.error(message);
        console.error(err);
        this.cdr.detectChanges();
      }
    });
  }

  get filteredGames(): Game[] {
    if (this.searchTerm.trim() === '') return this.games;

    const term = this.searchTerm.trim().toLowerCase();
    return this.games.filter(game =>
      game.title.toLowerCase().includes(term)
      || (game.category?.toLowerCase().includes(term) ?? false)
    );
  }

  get filteredCopies(): GameCopy[] {
    if (!this.selectedGameForCopies?.copies) return [];

    return this.selectedGameForCopies.copies.filter(copy => {
      const matchesSearch = this.copySearchTerm.trim() === ''
        || copy.copyNumber.toLowerCase().includes(this.copySearchTerm.trim().toLowerCase());

      const matchesCondition = this.copyFilterCondition === 'all'
        || copy.condition === this.copyFilterCondition;

      const matchesAvailability = this.copyFilterAvailability === 'all'
        || (this.copyFilterAvailability === 'available' && copy.isAvailable)
        || (this.copyFilterAvailability === 'rented' && !copy.isAvailable && copy.condition !== 'lost');

      return matchesSearch && matchesCondition && matchesAvailability;
    });
  }

  get isAdmin(): boolean {
    return this.authService.getCurrentUser()?.role === 'admin';
  }

  resetCopyFilters(): void {
    this.copySearchTerm = '';
    this.copyFilterCondition = 'all';
    this.copyFilterAvailability = 'all';
    this.cdr.detectChanges();
  }

  availableCount(game: Game): number {
    return game.copies?.filter(copy => copy.isAvailable).length || 0;
  }

  conditionBadgeClass(condition: string): string {
    switch (condition) {
      case 'new': return 'bg-primary';
      case 'good': return 'bg-success';
      case 'worn': return 'bg-warning';
      case 'damaged': return 'bg-danger';
      case 'lost': return 'bg-dark';
      default: return 'bg-secondary';
    }
  }

  ageRatingColor(rating: number): string {
    switch (rating) {
      case 3:  return '#22c55e';
      case 7:  return '#14b8a6';
      case 12: return '#eab308';
      case 16: return '#f97316';
      case 18: return '#ef4444';
      default: return '#71717a';
    }
  }

  formatPlayTime(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
  }

  capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  toggleDescription(gameId: number): void {
    this.expandedCards[gameId] = !this.expandedCards[gameId];
    this.hasOverflow[gameId] = true;
    this.cdr.detectChanges();
  }

  openAuditLog(): void {
    if (!this.selectedGameForCopies) return;
    this.showAuditLog = true;
    this.auditLoading = true;
    this.cdr.detectChanges();

    this.gameCopyService.getAuditLog(this.selectedGameForCopies.id).subscribe({
      next: (logs) => {
        this.auditLogs = logs;
        this.auditLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.auditLoading = false;
        this.toastService.error('Failed to load audit log.');
        this.cdr.detectChanges();
      }
    });
  }

  closeAuditLog(): void {
    this.showAuditLog = false;
    this.auditLogs = [];
    this.cdr.detectChanges();
  }

  auditActionLabel(action: string): string {
    switch (action) {
      case 'created': return 'Created';
      case 'condition_changed': return 'Condition';
      case 'name_changed': return 'Renamed';
      case 'notes_changed': return 'Notes';
      case 'deleted': return 'Deleted';
      default: return action;
    }
  }

  auditActionClass(action: string): string {
    switch (action) {
      case 'created': return 'text-success';
      case 'deleted': return 'text-danger';
      case 'condition_changed': return 'text-warning';
      default: return 'text-secondary';
    }
  }

  auditTimeAgo(dateStr: string): string {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    const days = Math.floor(diff / 86400);
    return days === 1 ? 'yesterday' : `${days} days ago`;
  }
}