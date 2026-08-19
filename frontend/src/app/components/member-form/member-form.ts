import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MemberService } from '../../services/member';
import { Member } from '../../models/member.model';
import { AutofocusDirective } from '../../directives/autofocus';

@Component({
  selector: 'app-member-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AutofocusDirective],
  templateUrl: './member-form.html',
  styleUrl: './member-form.css'
})
export class MemberForm implements OnInit, OnChanges {
  @Input() memberToEdit: Member | null = null;
  @Output() memberSaved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  form: FormGroup;
  submitting = false;
  errorMessage = '';

  constructor(private fb: FormBuilder, private memberService: MemberService, private cdr: ChangeDetectorRef) {
    this.form = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', Validators.pattern(/^\+?[\d\s\-().]{6,20}$/)]
    });
  }

  ngOnInit(): void {
    this.populateFormIfEditing();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['memberToEdit']) {
      this.populateFormIfEditing();
    }
  }

  private populateFormIfEditing(): void {
    if (this.memberToEdit) {
      this.form.patchValue({
        firstName: this.memberToEdit.firstName,
        lastName: this.memberToEdit.lastName,
        email: this.memberToEdit.email,
        phone: this.memberToEdit.phone
      });
    }
  }

  get isEditMode(): boolean {
    return !!this.memberToEdit;
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
      ? this.memberService.update(this.memberToEdit!.id, this.form.value)
      : this.memberService.create(this.form.value);

    request.subscribe({
      next: () => {
        this.submitting = false;
        if (!this.isEditMode) {
          this.form.reset();
        }
        this.memberSaved.emit();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.submitting = false;
        if (err.status === 409) {
          this.errorMessage = 'A member with this email already exists.';
        } else {
          this.errorMessage = 'Failed to save member. Please check the fields and try again.';
        }
        console.error(err);
        this.cdr.detectChanges();
      }
    });
  }

  onCancel(): void {
    if (this.form.dirty && !confirm('Are you sure? You have unsaved changes.')) return;
    this.cancelled.emit();
  }
}