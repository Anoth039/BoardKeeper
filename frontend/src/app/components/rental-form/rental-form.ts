import { Component, EventEmitter, Output, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RentalService } from '../../services/rental';
import { MemberService } from '../../services/member';
import { GameService } from '../../services/game';
import { Member } from '../../models/member.model';
import { Game, GameCopy } from '../../models/game.model';

@Component({
  selector: 'app-rental-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rental-form.html',
  styleUrl: './rental-form.css'
})
export class RentalForm implements OnInit {
  @Output() rentalCreated = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  members: Member[] = [];
  games: Game[] = [];

  selectedMemberId: number | null = null;
  selectedGameId: number | null = null;
  selectedCopyId: number | null = null;

  rentalDate = this.today();
  dueDate = this.inOneWeek();

  submitting = false;
  errorMessage = '';

  constructor(private rentalService: RentalService, private memberService: MemberService, 
    private gameService: GameService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.memberService.getAll().subscribe({
      next: (data) => {
        this.members = data.filter(m => m.isActive);
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Failed to load members', err)
    });

    this.gameService.getAll().subscribe({
      next: (data) => {
        this.games = data;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Failed to load games', err)
    });
  }

  get availableCopiesForSelectedGame(): GameCopy[] {
    const game = this.games.find(g => g.id === this.selectedGameId);
    return game?.copies?.filter(c => c.isAvailable) || [];
  }

  onGameChange(): void {
    this.selectedCopyId = null;
  }

  private today(): string {
    return new Date().toISOString().split('T')[0];
  }

  private inOneWeek(): string {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  }

  onSubmit(): void {
    this.errorMessage = '';

    if (!this.selectedMemberId || !this.selectedCopyId || !this.rentalDate || !this.dueDate) {
      this.errorMessage = 'Please fill in all fields.';
      this.cdr.detectChanges();
      return;
    }

    if (this.dueDate < this.rentalDate) {
      this.errorMessage = 'Due date cannot be before the rental date.';
      this.cdr.detectChanges();
      return;
    }

    this.submitting = true;

    this.rentalService.create({
      memberId: this.selectedMemberId,
      gameCopyId: this.selectedCopyId,
      rentalDate: this.rentalDate,
      dueDate: this.dueDate
    }).subscribe({
      next: () => {
        this.submitting = false;
        this.rentalCreated.emit();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.submitting = false;
        if (err.status === 409) {
          this.errorMessage = 'This copy is no longer available.';
        } else {
          this.errorMessage = 'Failed to create rental.';
        }
        console.error(err);
        this.cdr.detectChanges();
      }
    });
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}