import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GameService } from '../../services/game';
import { GameCopyService } from '../../services/game-copy';
import { Game, GameCopy } from '../../models/game.model';
import { GameForm } from '../game-form/game-form';
import { AuthService } from '../../services/auth';

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
  gameSearchTerm = '';

  newCopyCondition = 'new';
  newCopyNumber = '';
  addingCopy = false;
  copyErrorMessage = '';

  editingCopyId: number | null = null;
  editCopyCondition = 'good';
  editCopyNumber = '';

  copySearchTerm = '';
  copyFilterCondition = 'all';
  copyFilterAvailability = 'all';

  constructor(private gameService: GameService, private gameCopyService: GameCopyService, 
    private cdr: ChangeDetectorRef, public authService: AuthService) {}

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
      error: (err) => console.error('Failed to load games', err)
    });
  }

  openAddForm(): void {
    this.editingGame = null;
    this.showForm = true;
  }

  openEditForm(game: Game): void {
    this.editingGame = game;
    this.showForm = true;
  }

  onFormSaved(): void {
    this.showForm = false;
    this.editingGame = null;
    this.loadGames();
  }

  onFormCancelled(): void {
    this.showForm = false;
    this.editingGame = null;
  }

  openCopiesModal(game: Game): void {
    this.selectedGameForCopies = game;
    this.resetNewCopyForm();
    this.resetCopyFilters();
    this.editingCopyId = null;
  }

  closeCopiesModal(): void {
    this.selectedGameForCopies = null;
    this.resetCopyFilters();
  }

  resetNewCopyForm(): void {
    this.newCopyCondition = 'new';
    this.newCopyNumber = '';
    this.copyErrorMessage = '';
  }

  addCopy(): void {
    if (!this.selectedGameForCopies) return;

    const trimmedNumber = this.newCopyNumber.trim();

    if (trimmedNumber.length < 3 || trimmedNumber.length > 40) {
      this.copyErrorMessage = 'Copy name/number must be between 3 and 40 characters.';
      this.cdr.detectChanges();
      return;
    }

    const isDuplicate = this.selectedGameForCopies.copies?.some(
      copy => copy.copyNumber.toLowerCase() === trimmedNumber.toLowerCase()
    );

    if (isDuplicate) {
      this.copyErrorMessage = 'A copy with this name already exists for this game.';
      this.cdr.detectChanges();
      return;
    }

    this.addingCopy = true;
    this.copyErrorMessage = '';

    this.gameCopyService.create({
      gameId: this.selectedGameForCopies.id,
      condition: this.newCopyCondition,
      copyNumber: trimmedNumber
    }).subscribe({
      next: () => {
        this.addingCopy = false;
        this.resetNewCopyForm();
        this.loadGames();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.addingCopy = false;
        this.copyErrorMessage = err.error?.message || 'Failed to add copy.';
        console.error(err);
        this.cdr.detectChanges();
      }
    });
  }

  startEditCopy(copy: GameCopy): void {
    this.editingCopyId = copy.id;
    this.editCopyCondition = copy.condition;
    this.editCopyNumber = copy.copyNumber || '';
  }

  cancelEditCopy(): void {
    this.editingCopyId = null;
  }

  saveEditCopy(copyId: number): void {
    const trimmedNumber = this.editCopyNumber.trim();

    if (trimmedNumber.length < 3 || trimmedNumber.length > 40) {
      alert('Copy name/number must be between 3 and 40 characters.');
      return;
    }

    const isDuplicate = this.selectedGameForCopies?.copies?.some(
      copy => copy.id !== copyId && copy.copyNumber.toLowerCase() === trimmedNumber.toLowerCase()
    );

    if (isDuplicate) {
      alert('A copy with this name already exists for this game.');
      return;
    }

    this.gameCopyService.update(copyId, {
      condition: this.editCopyCondition as any,
      copyNumber: trimmedNumber
    }).subscribe({
      next: () => {
        this.editingCopyId = null;
        this.loadGames();
        this.cdr.detectChanges();
      },
      error: (err) => {
        alert(err.error?.message || 'Failed to update copy.');
        console.error(err);
        this.cdr.detectChanges();
      }
    });
  }

  deleteCopy(copyId: number): void {
    const copy = this.selectedGameForCopies?.copies?.find(c => c.id === copyId);
    if (copy && !copy.isAvailable) {
      alert('This copy is currently rented out and cannot be deleted.');
      return;
    }

    if (!confirm('Delete this copy? This cannot be undone.')) return;

    this.gameCopyService.delete(copyId).subscribe({
      next: () => {
        this.loadGames();
        this.cdr.detectChanges();
      },
      error: (err) => {
        const message = err.error?.message || 'Failed to delete this copy. Please try again.';
        alert(message);
        console.error(err);
        this.cdr.detectChanges();
      }
    });
  }

  deleteGame(game: Game): void {
    const confirmed = confirm(
      `Delete "${game.title}"? This will also delete all ${game.copies?.length || 0} copies of it. This cannot be undone.`
    );
    if (!confirmed) return;

    this.gameService.delete(game.id).subscribe({
      next: () => {
        this.games = this.games.filter(g => g.id !== game.id);
        this.cdr.detectChanges();
      },
      error: (err) => {
        const message = err.error?.message || 'Failed to delete this game. Please try again.';
        alert(message);
        console.error(err);
        this.cdr.detectChanges();
      }
    });
  }

  get filteredGames(): Game[] {
    if (this.gameSearchTerm.trim() === '') return this.games;

    const term = this.gameSearchTerm.trim().toLowerCase();
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
        || (this.copyFilterAvailability === 'available' && copy.isAvailable && copy.condition !== 'lost')
        || (this.copyFilterAvailability === 'rented' && !copy.isAvailable);

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
  }

  availableCount(game: Game): number {
    return game.copies?.filter(copy => copy.isAvailable && copy.condition !== 'lost').length || 0;
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
}