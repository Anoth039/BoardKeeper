import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '../../services/user';
import { SystemUser } from '../../models/user.model';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users.html',
  styleUrl: './users.css'
})
export class UsersPage implements OnInit {
  users: SystemUser[] = [];
  searchTerm = '';
  loading = true;

  constructor(private userService: UserService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.userService.getAll().subscribe({
      next: (data) => {
        this.users = data;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load users', err);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  get filteredUsers(): SystemUser[] {
    if (!this.searchTerm.trim()) {
      return this.users;
    }
    const term = this.searchTerm.trim().toLowerCase();
    return this.users.filter(u => u.email.toLowerCase().includes(term));
  }

  get pendingUsers(): SystemUser[] {
    return this.filteredUsers.filter(u => !u.isApproved && u.role !== 'admin');
  }

  get approvedUsers(): SystemUser[] {
    return this.filteredUsers.filter(u => u.isApproved && u.role !== 'admin');
  }

  toggleApproval(user: SystemUser): void {
    const action = user.isApproved ? 'revoke access from' : 'approve';
    if (!confirm(`Are you sure you want to ${action} ${user.email}?`)) return;

    this.userService.toggleApproval(user.id).subscribe({
      next: (updated) => {
        user.isApproved = updated.isApproved;
        this.cdr.detectChanges();
      },
      error: (err) => {
        alert(err.error?.message || 'Failed to update user.');
        this.cdr.detectChanges();
      }
    });
  }

  deleteUser(user: SystemUser): void {
    if (!confirm(`Permanently delete ${user.email}? This cannot be undone.`)) return;

    this.userService.delete(user.id).subscribe({
      next: () => {
        this.users = this.users.filter(u => u.id !== user.id);
        this.cdr.detectChanges();
      },
      error: (err) => {
        alert(err.error?.message || 'Failed to delete user.');
        this.cdr.detectChanges();
      }
    });
  }

  userInitials(email: string): string {
    return email.charAt(0).toUpperCase();
  }

  memberSince(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  lastLogin(user: SystemUser): string {
    if (!user.lastLoginAt) return 'Never logged in';
    const days = Math.floor(
      (Date.now() - new Date(user.lastLoginAt).getTime()) / 86400000
    );
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days} days ago`;
    const months = Math.floor(days / 30);
    return months === 1 ? '1 month ago' : `${months} months ago`;
  }
}