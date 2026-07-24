import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MemberService } from '../../services/member';
import { Member } from '../../models/member.model';
import { MemberForm } from '../member-form/member-form';
import { RouterLink } from '@angular/router';

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

  showForm = false;
  editingMember: Member | null = null;

  constructor(private memberService: MemberService, private cdr: ChangeDetectorRef) {}

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
      return a.lastName.localeCompare(b.lastName);
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

  private confirmAndToggle(member: Member, newStatus: boolean): void {
    const action = newStatus ? 'reactivate' : 'deactivate';
    if (!confirm(`Are you sure you want to ${action} ${member.firstName} ${member.lastName}?`)) return;

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
}