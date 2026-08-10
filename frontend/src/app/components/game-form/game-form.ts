import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { GameService } from '../../services/game';
import { Game } from '../../models/game.model';

function maxNotLessThanMinValidator(group: AbstractControl): ValidationErrors | null {
  const min = group.get('minPlayers')?.value;
  const max = group.get('maxPlayers')?.value;
  if (min != null && max != null && max < min) {
    return { maxLessThanMin: true };
  }
  return null;
}

const PRESET_CATEGORIES = [
  'Strategy', 'Party', 'Family', 'Cooperative',
  'Card Game', 'RPG', 'Trivia', 'Economic', 'Puzzle'
];

@Component({
  selector: 'app-game-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './game-form.html',
  styleUrl: './game-form.css'
})
export class GameForm implements OnInit, OnChanges {
  @Input() gameToEdit: Game | null = null;
  @Output() gameSaved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  form: FormGroup;
  submitting = false;
  errorMessage = '';

  presetCategories = PRESET_CATEGORIES;
  useCustomCategory = false;
  selectedPresetCategory = '';

  constructor(private fb: FormBuilder, private gameService: GameService, private cdr: ChangeDetectorRef) {
    this.form = this.fb.group({
      title: ['', Validators.required],
      description: [''],
      minPlayers: [1, [Validators.required, Validators.min(1)]],
      maxPlayers: [4, [Validators.required, Validators.min(1)]],
      category: [''],
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

  private populateFormIfEditing(): void {
    if (this.gameToEdit) {
      const cat = this.gameToEdit.category || '';
      const isPreset = PRESET_CATEGORIES.includes(cat);
      this.useCustomCategory = !!cat && !isPreset;
      this.selectedPresetCategory = isPreset ? cat : '';

      this.form.patchValue({
        title: this.gameToEdit.title,
        description: this.gameToEdit.description,
        minPlayers: this.gameToEdit.minPlayers,
        maxPlayers: this.gameToEdit.maxPlayers,
        category: cat,
        ageRating: this.gameToEdit.ageRating,
        estimatedTimeMinutes: this.gameToEdit.estimatedTimeMinutes,
        imageUrl: this.gameToEdit.imageUrl
      });
    } else {
      this.useCustomCategory = false;
      this.selectedPresetCategory = '';
    }
  }

  get isEditMode(): boolean {
    return !!this.gameToEdit;
  }

  onPresetCategoryChange(value: string): void {
    if (value === '__custom__') {
      this.useCustomCategory = true;
      this.form.patchValue({ category: '' });
    } else {
      this.useCustomCategory = false;
      this.form.patchValue({ category: value });
    }
    this.cdr.detectChanges();
  }

  backToPreset(): void {
    this.useCustomCategory = false;
    this.selectedPresetCategory = '';
    this.form.patchValue({ category: '' });
    this.cdr.detectChanges();
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.cdr.detectChanges();
      return;
    }

    this.submitting = true;
    this.errorMessage = '';

    const request = this.isEditMode
      ? this.gameService.update(this.gameToEdit!.id, this.form.value)
      : this.gameService.create(this.form.value);

    request.subscribe({
      next: () => {
        this.submitting = false;
        if (!this.isEditMode) {
          this.form.reset({ minPlayers: 1, maxPlayers: 4 });
          this.useCustomCategory = false;
          this.selectedPresetCategory = '';
        }
        this.gameSaved.emit();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.submitting = false;
        this.errorMessage = 'Failed to save game. Please check the fields and try again.';
        console.error(err);
        this.cdr.detectChanges();
      }
    });
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}