import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MemberService } from '../../services/member';
import { Member } from '../../models/member.model';
import { AutofocusDirective } from '../../directives/autofocus';
import { DialogService } from '../../services/dialog';
import { ToastService } from '../../services/toast';

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

  constructor(private fb: FormBuilder, private memberService: MemberService, private cdr: ChangeDetectorRef,
    private dialogService: DialogService, private toastService: ToastService) {
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

    const request = this.isEditMode
      ? this.memberService.update(this.memberToEdit!.id, this.form.value)
      : this.memberService.create(this.form.value);

    request.subscribe({
      next: () => {
        this.submitting = false;
        const memberName = `${this.form.value.firstName} ${this.form.value.lastName}`;
        const actionLabel = this.isEditMode ? 'updated' : 'created';
        this.toastService.success(`Member "${memberName}" ${actionLabel} successfully.`);
        
        if (!this.isEditMode) {
          this.form.reset();
        }
        this.memberSaved.emit();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.submitting = false;
        if (err.status === 409) {
          this.toastService.error('A member with this email already exists.');
        } else {
          this.toastService.error('Failed to save member. Please check the fields and try again.');
        }
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