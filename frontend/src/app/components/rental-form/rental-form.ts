import { Component, EventEmitter, Output, OnInit, ChangeDetectorRef, HostListener, ElementRef } from '@angular/core';
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

  memberSearchTerm = '';
  showMemberDropdown = false;

  gameSearchTerm = '';
  showGameDropdown = false;

  rentalDate = this.today();
  dueDate = this.inOneWeek();

  submitting = false;
  errorMessage = '';

  constructor(private rentalService: RentalService, private memberService: MemberService, private gameService: GameService,
    private cdr: ChangeDetectorRef, private elementRef: ElementRef) {}

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

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.showMemberDropdown = false;
      this.showGameDropdown = false;
      this.cdr.detectChanges();
    }
  }

  get filteredMembers(): Member[] {
    if (this.memberSearchTerm.trim() === '') return this.members;
    const term = this.memberSearchTerm.trim().toLowerCase();
    return this.members.filter(m =>
      `${m.firstName} ${m.lastName}`.toLowerCase().includes(term)
      || m.email.toLowerCase().includes(term)
    );
  }

  get filteredGames(): Game[] {
    if (this.gameSearchTerm.trim() === '') return this.games;
    const term = this.gameSearchTerm.trim().toLowerCase();
    return this.games.filter(g => g.title.toLowerCase().includes(term));
  }

  get selectedMember(): Member | null {
    return this.members.find(m => m.id === this.selectedMemberId) || null;
  }

  get selectedGame(): Game | null {
    return this.games.find(g => g.id === this.selectedGameId) || null;
  }

  get availableCopiesForSelectedGame(): GameCopy[] {
    return this.selectedGame?.copies?.filter(c => c.isAvailable) || [];
  }

  selectMember(member: Member): void {
    this.selectedMemberId = member.id;
    this.memberSearchTerm = '';
    this.showMemberDropdown = false;
    this.cdr.detectChanges();
  }

  selectGame(game: Game): void {
    this.selectedGameId = game.id;
    this.selectedCopyId = null;
    this.gameSearchTerm = '';
    this.showGameDropdown = false;
    this.cdr.detectChanges();
  }

  clearMemberSelection(): void {
    this.selectedMemberId = null;
    this.cdr.detectChanges();
  }

  clearGameSelection(): void {
    this.selectedGameId = null;
    this.selectedCopyId = null;
    this.cdr.detectChanges();
  }

  get minRentalDate(): string {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  }

  get maxRentalDate(): string {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  }

  get minDueDate(): string {
    return this.rentalDate || this.today();
  }

  get maxDueDate(): string {
    const d = new Date();
    d.setDate(d.getDate() + 60);
    return d.toISOString().split('T')[0];
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
        this.errorMessage = err.error?.message || 'Failed to create rental.';
        console.error(err);
        this.cdr.detectChanges();
      }
    });
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}