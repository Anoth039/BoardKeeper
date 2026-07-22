import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GameService } from '../../services/game';
import { GameCopyService } from '../../services/game-copy';
import { Game, GameCopy } from '../../models/game.model';
import { GameForm } from '../game-form/game-form';

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
  editCopyAvailable = true;

  copySearchTerm = '';
  copyFilterCondition = 'all';
  copyFilterAvailability = 'all';

  constructor(private gameService: GameService, private gameCopyService: GameCopyService, private cdr: ChangeDetectorRef) {}

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

    this.addingCopy = true;
    this.copyErrorMessage = '';

    this.gameCopyService.create({
      gameId: this.selectedGameForCopies.id,
      condition: this.newCopyCondition,
      copyNumber: this.newCopyNumber || undefined
    }).subscribe({
      next: () => {
        this.addingCopy = false;
        this.resetNewCopyForm();
        this.loadGames();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.addingCopy = false;
        this.copyErrorMessage = 'Failed to add copy.';
        console.error(err);
        this.cdr.detectChanges();
      }
    });
  }

  startEditCopy(copy: GameCopy): void {
    this.editingCopyId = copy.id;
    this.editCopyCondition = copy.condition;
    this.editCopyNumber = copy.copyNumber || '';
    this.editCopyAvailable = copy.isAvailable;
  }

  cancelEditCopy(): void {
    this.editingCopyId = null;
  }

  saveEditCopy(copyId: number): void {
    this.gameCopyService.update(copyId, {
      condition: this.editCopyCondition as any,
      copyNumber: this.editCopyNumber || undefined,
      isAvailable: this.editCopyAvailable
    }).subscribe({
      next: () => {
        this.editingCopyId = null;
        this.loadGames();
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Failed to update copy', err)
    });
  }

  deleteCopy(copyId: number): void {
    if (!confirm('Delete this copy? This cannot be undone.')) return;

    this.gameCopyService.delete(copyId).subscribe({
      next: () => {
        this.loadGames();
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Failed to delete copy', err)
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
        console.error('Failed to delete game', err);
        alert('Failed to delete this game. Please try again.');
        this.cdr.detectChanges();
      }
    });
  }

  getCopyLabel(copy: GameCopy): string {
    if (copy.copyNumber) return copy.copyNumber;
    const copies = this.selectedGameForCopies?.copies || [];
    const index = copies.findIndex(c => c.id === copy.id);
    return `Copy #${index + 1}`;
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
        || this.getCopyLabel(copy).toLowerCase().includes(this.copySearchTerm.trim().toLowerCase());

      const matchesCondition = this.copyFilterCondition === 'all'
        || copy.condition === this.copyFilterCondition;

      const matchesAvailability = this.copyFilterAvailability === 'all'
        || (this.copyFilterAvailability === 'available' && copy.isAvailable)
        || (this.copyFilterAvailability === 'rented' && !copy.isAvailable);

      return matchesSearch && matchesCondition && matchesAvailability;
    });
  }

  resetCopyFilters(): void {
    this.copySearchTerm = '';
    this.copyFilterCondition = 'all';
    this.copyFilterAvailability = 'all';
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
      default: return 'bg-secondary';
    }
  }
}