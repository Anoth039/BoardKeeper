import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MemberService } from '../../services/member';
import { Member } from '../../models/member.model';
import { MemberForm } from '../member-form/member-form';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';
import { isRentalOverdue } from '../../models/rental.model';
import { DialogService } from '../../services/dialog';

@Component({
  selector: 'app-member-list',
  standalone: true,
  imports: [CommonModule, FormsModule, MemberForm, RouterLink],
  templateUrl: './member-list.html',
  styleUrl: './member-list.css'
})
export class MemberListComponent implements OnInit {
  members: Member[] = [];
  searchTerm = '';
  successMessage = '';
  sortAsc = true;
  showForm = false;
  editingMember: Member | null = null;
  copiedMemberId: number | null = null;

  constructor(private memberService: MemberService, private cdr: ChangeDetectorRef, public authService: AuthService, private dialogService: DialogService) {}

  ngOnInit(): void {
    this.loadMembers();
  }

  loadMembers(): void {
    this.memberService.getAll().subscribe({
      next: (data) => {
        this.members = data;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load members', err);
        this.cdr.detectChanges();
      }
    });
  }

  get filteredMembers(): Member[] {
    let result = this.members;

    if (this.searchTerm.trim() !== '') {
      const term = this.searchTerm.trim().toLowerCase();
      result = result.filter(m =>
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(term)
        || m.email.toLowerCase().includes(term)
      );
    }

    return [...result].sort((a, b) => {
      const statusDiff = Number(b.isActive) - Number(a.isActive);
      if (statusDiff !== 0) return statusDiff;

      const nameA = `${a.firstName} ${a.lastName}`;
      const nameB = `${b.firstName} ${b.lastName}`;

      return this.sortAsc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });
  }

  get isAdmin(): boolean {
    return this.authService.getCurrentUser()?.role === 'admin';
  }

  hasOverdueRental(member: Member): boolean {
    return member.rentals?.some(r => isRentalOverdue(r)) ?? false;
  }

  memberInitials(member: Member): string {
    return `${member.firstName.charAt(0)}${member.lastName.charAt(0)}`.toUpperCase();
  }

  copyEmail(email: string, memberId: number): void {
    navigator.clipboard.writeText(email).then(() => {
      this.copiedMemberId = memberId;
      this.successMessage = 'Email copied to clipboard!';
      this.cdr.detectChanges();

      setTimeout(() => {
        if (this.copiedMemberId === memberId) {
          this.copiedMemberId = null;
          this.successMessage = '';
          this.cdr.detectChanges();
        }
      }, 2000);
    });
  }

  openAddForm(): void {
    this.editingMember = null;
    this.showForm = true;
    this.cdr.detectChanges();
  }

  openEditForm(member: Member): void {
    this.editingMember = member;
    this.showForm = true;
    this.cdr.detectChanges();
  }

  onFormSaved(): void {
    this.showForm = false;
    this.editingMember = null;
    this.loadMembers();
    this.cdr.detectChanges();
  }

  onFormCancelled(): void {
    this.showForm = false;
    this.editingMember = null;
    this.cdr.detectChanges();
  }

  toggleActive(member: Member): void {
    const newStatus = !member.isActive;

    if (!newStatus) {
      this.memberService.getById(member.id).subscribe({
        next: (fullMember) => {
          const activeRentalCount = fullMember.rentals?.filter(r => r.status === 'active').length || 0;

          if (activeRentalCount > 0) {
            alert(`Cannot deactivate ${member.firstName} ${member.lastName} — they have ${activeRentalCount} active rental(s). Please return them first.`);
            this.cdr.detectChanges();
            return;
          }

          this.confirmAndToggle(member, newStatus);
        },
        error: (err) => {
          console.error('Failed to check member rentals', err);
          this.cdr.detectChanges();
        }
      });
    } else {
      this.confirmAndToggle(member, newStatus);
    }
  }

  async confirmAndToggle(member: Member, newStatus: boolean): Promise<void> {
    const action = newStatus ? 'Reactivate' : 'Deactivate';
    const actionLower = action.toLowerCase();
    const memberName = `${member.firstName} ${member.lastName}`;

    const confirmed = await this.dialogService.confirm({
      title: `${action} Member`,
      message: `Are you sure you want to ${actionLower} ${memberName}? ${newStatus ? 'They will regain access to rent items.' : 'They will no longer be able to rent items.'}`,
      confirmLabel: action,
      type: newStatus ? 'primary' : 'warning',
    });
    if (!confirmed) return;

    this.memberService.update(member.id, { isActive: newStatus }).subscribe({
      next: (updated) => {
        member.isActive = updated.isActive;
        this.cdr.detectChanges();
      },
      error: (err) => {
        const message = err.error?.message || 'Failed to update member status.';
        alert(message);
        console.error(err);
        this.cdr.detectChanges();
      }
    });
  }

  async deleteMember(member: Member): Promise<void> {
    const memberName = `${member.firstName} ${member.lastName}`;

    const confirmed = await this.dialogService.confirm({
      title: 'Delete Member',
      message: `Permanently delete "${memberName}"? This action cannot be undone and will remove all associated member records.`,
      confirmLabel: 'Delete Member',
      type: 'danger',
    });
    if (!confirmed) return;

    this.memberService.delete(member.id).subscribe({
      next: () => {
        this.members = this.members.filter(m => m.id !== member.id);
        this.cdr.detectChanges();
      },
      error: (err) => {
        const message = err.error?.message || 'Failed to delete this member.';
        alert(message);
        console.error(err);
        this.cdr.detectChanges();
      }
    });
  }
}