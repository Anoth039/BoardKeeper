import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, ValidationErrors, AbstractControl } from '@angular/forms';
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
  
@Component({
  selector: 'app-game-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
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

  constructor(private fb: FormBuilder, private gameService: GameService, private cdr: ChangeDetectorRef) {
    this.form = this.fb.group({
      title: ['', Validators.required],
      description: [''],
      minPlayers: [1, [Validators.required, Validators.min(1)]],
      maxPlayers: [4, [Validators.required, Validators.min(1)]],
      category: [''],
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
      this.form.patchValue({
        title: this.gameToEdit.title,
        description: this.gameToEdit.description,
        minPlayers: this.gameToEdit.minPlayers,
        maxPlayers: this.gameToEdit.maxPlayers,
        category: this.gameToEdit.category,
        imageUrl: this.gameToEdit.imageUrl
      });
    }
  }

  get isEditMode(): boolean {
    return !!this.gameToEdit;
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
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