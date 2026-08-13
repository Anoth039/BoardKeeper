import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { GameService } from '../../services/game';
import { Game } from '../../models/game.model';

function maxNotLessThanMinValidator(group: AbstractControl): ValidationErrors | null {
  const min = group.get('minPlayers')?.value;
  const max = group.get('maxPlayers')?.value;
  return min != null && max != null && max < min ? { maxLessThanMin: true } : null;
}

const PRESET_CATEGORIES = ['Strategy', 'Party', 'Family', 'Cooperative', 'Card Game', 'RPG', 'Trivia', 'Economic', 'Puzzle'];

@Component({
  selector: 'app-game-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './game-form.html',
  styleUrl: './game-form.css'
})
export class GameForm implements OnChanges {
  @Input() gameToEdit: Game | null = null;
  @Output() gameSaved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  form: FormGroup;
  submitting = false;
  errorMessage = '';
  presetCategories = PRESET_CATEGORIES;
  customCategoryInput = '';

  constructor(private fb: FormBuilder, private gameService: GameService, private cdr: ChangeDetectorRef) {
    this.form = this.fb.group({
      title: ['', Validators.required],
      description: [''],
      minPlayers: [1, [Validators.required, Validators.min(1)]],
      maxPlayers: [4, [Validators.required, Validators.min(1)]],
      categories: [[] as string[]],
      ageRating: [null],
      estimatedTimeMinutes: [null, Validators.min(1)],
      imageUrl: ['']
    }, { validators: maxNotLessThanMinValidator });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['gameToEdit']) {
      this.populateFormIfEditing();
    }
  }

  get selectedCategories(): string[] {
    return this.form.get('categories')?.value || [];
  }

  get isEditMode(): boolean {
    return !!this.gameToEdit;
  }

  private populateFormIfEditing(): void {
    if (!this.gameToEdit) {
      this.form.patchValue({ categories: [] });
      return;
    }

    const rawCats = (this.gameToEdit as any).categories;
    const initialCategories = Array.isArray(rawCats)
      ? rawCats
      : (this.gameToEdit.category || '').split(',').map(c => c.trim()).filter(Boolean);

    this.form.patchValue({
      ...this.gameToEdit,
      categories: initialCategories
    });
  }

  isCategorySelected(cat: string): boolean {
    return this.selectedCategories.includes(cat);
  }

  toggleCategory(cat: string): void {
    const current = this.selectedCategories;
    const updated = current.includes(cat) ? current.filter(c => c !== cat) : [...current, cat];
    this.errorMessage = '';
    this.form.patchValue({ categories: updated });
  }

  addCustomCategory(): void {
    const trimmed = this.customCategoryInput.trim();
    if (!trimmed) return;

    const normalize = (str: string) => str.toLowerCase().replace(/\s+/g, '');
    const existingCategory = this.selectedCategories.find(cat => normalize(cat) === normalize(trimmed));

    if (existingCategory) {
      this.errorMessage = `Category "${existingCategory}" has already been added.`;
      return;
    }

    const formatted = trimmed
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    this.form.patchValue({ categories: [...this.selectedCategories, formatted] });
    this.customCategoryInput = '';
    this.errorMessage = '';
  }

  removeCategory(cat: string): void {
    this.form.patchValue({ categories: this.selectedCategories.filter(c => c !== cat) });
    this.errorMessage = '';
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.errorMessage = '';

    const { categories, ...formValues } = this.form.value;
    const payload = {
      ...formValues,
      category: (categories || []).join(', ')
    };

    const request = this.isEditMode ? this.gameService.update(this.gameToEdit!.id, payload) : this.gameService.create(payload);

    request.subscribe({
      next: () => {
        this.submitting = false;
        if (!this.isEditMode) {
          this.form.reset({ minPlayers: 1, maxPlayers: 4, categories: [] });
        }
        this.gameSaved.emit();
      },
      error: (err) => {
        this.submitting = false;
        this.errorMessage = err.error?.message || 'Failed to save game. Please check the fields and try again.';
        this.cdr.detectChanges();
      }
    });
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}