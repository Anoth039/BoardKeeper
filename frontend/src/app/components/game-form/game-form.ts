import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { GameService } from '../../services/game';
import { Game } from '../../models/game.model';
import { AutofocusDirective } from '../../directives/autofocus';
import { DialogService } from '../../services/dialog';
import { ToastService } from '../../services/toast';

function maxNotLessThanMinValidator(group: AbstractControl): ValidationErrors | null {
  const min = group.get('minPlayers')?.value;
  const max = group.get('maxPlayers')?.value;
  if (min != null && max != null && max < min) {
    return { maxLessThanMin: true };
  }
  return null;
}

const PRESET_CATEGORIES = ['Strategy', 'Party', 'Family', 'Cooperative', 'Card Game', 'RPG', 'Trivia', 'Economic', 'Puzzle'];

@Component({
  selector: 'app-game-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, AutofocusDirective],
  templateUrl: './game-form.html',
  styleUrl: './game-form.css'
})
export class GameForm implements OnInit, OnChanges {
  @Input() gameToEdit: Game | null = null;
  @Output() gameSaved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  form: FormGroup;
  submitting = false;

  presetCategories = PRESET_CATEGORIES;
  customCategoryInput = '';

  constructor(private fb: FormBuilder, private gameService: GameService, private cdr: ChangeDetectorRef,
    private dialogService: DialogService, private toastService: ToastService) {
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

  ngOnInit(): void {
    this.populateFormIfEditing();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['gameToEdit']) {
      this.populateFormIfEditing();
    }
  }

  get selectedCategories(): string[] {
    return this.form.get('categories')?.value || [];
  }

  private populateFormIfEditing(): void {
    if (this.gameToEdit) {
      let initialCategories: string[] = [];
      if (Array.isArray((this.gameToEdit as any).categories)) {
        initialCategories = (this.gameToEdit as any).categories;
      } else if (this.gameToEdit.category) {
        initialCategories = this.gameToEdit.category.split(',').map(c => c.trim()).filter(Boolean);
      }

      this.form.patchValue({
        title: this.gameToEdit.title,
        description: this.gameToEdit.description,
        minPlayers: this.gameToEdit.minPlayers,
        maxPlayers: this.gameToEdit.maxPlayers,
        categories: initialCategories,
        ageRating: this.gameToEdit.ageRating,
        estimatedTimeMinutes: this.gameToEdit.estimatedTimeMinutes,
        imageUrl: this.gameToEdit.imageUrl
      });
    } else {
      this.form.patchValue({ categories: [] });
    }
  }

  get isEditMode(): boolean {
    return !!this.gameToEdit;
  }

  isCategorySelected(cat: string): boolean {
    return this.selectedCategories.includes(cat);
  }

  toggleCategory(cat: string): void {
    const current = [...this.selectedCategories];
    const index = current.indexOf(cat);

    if (index > -1) {
      current.splice(index, 1);
    } else {
      current.push(cat);
    }

    this.form.patchValue({ categories: current });
    this.form.markAsDirty();
    this.cdr.detectChanges();
  }

  addCustomCategory(): void {
    const trimmed = this.customCategoryInput.trim();
    if (!trimmed) return;

    const normalize = (str: string) => str.toLowerCase().replace(/\s+/g, '');

    const existingCategory = this.selectedCategories.find(
      cat => normalize(cat) === normalize(trimmed)
    );

    if (existingCategory) {
      this.toastService.error(`Category "${existingCategory}" has already been added.`);
      this.cdr.detectChanges();
      return;
    }

    const formatted = trimmed.split(/\s+/).map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');

    const updated = [...this.selectedCategories, formatted];
    this.form.patchValue({ categories: updated });
    this.form.markAsDirty();
    this.customCategoryInput = '';
    this.cdr.detectChanges();
  }

  removeCategory(cat: string): void {
    const current = this.selectedCategories.filter(c => c !== cat);
    this.form.patchValue({ categories: current });
    this.form.markAsDirty();
    this.cdr.detectChanges();
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.cdr.detectChanges();
      return;
    }

    this.submitting = true;

    const { categories, ...formValues } = this.form.value;

    const payload = {
      ...formValues,
      category: (categories || []).join(', ')
    };

    const request = this.isEditMode ? this.gameService.update(this.gameToEdit!.id, payload) : this.gameService.create(payload);

    request.subscribe({
      next: () => {
        this.submitting = false;
        const actionLabel = this.isEditMode ? 'updated' : 'created';
        this.toastService.success(`Game "${payload.title}" ${actionLabel} successfully.`);
        if (!this.isEditMode) {
          this.form.reset({ minPlayers: 1, maxPlayers: 4, categories: [] });
        }
        this.gameSaved.emit();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.submitting = false;
        this.toastService.error(err.error?.message || 'Failed to save game. Please check the fields and try again.');
        console.error(err);
        this.cdr.detectChanges();
      }
    });
  }

  async onCancel(): Promise<void> {
    if (this.form.dirty) {
      const confirmed = await this.dialogService.confirm({
        title: 'Unsaved Changes',
        message: 'Are you sure you want to close? You have unsaved changes.',
        confirmLabel: 'Discard',
        type: 'warning'
      });
      if (!confirmed) return;
    }
    this.cancelled.emit();
  }
}