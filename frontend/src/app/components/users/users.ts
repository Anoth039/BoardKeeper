import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '../../services/user';
import { Role, SystemUser } from '../../models/user.model';
import { FormsModule } from '@angular/forms';
import { DialogService } from '../../services/dialog';
import { ToastService } from '../../services/toast';
import { formatDate, timeAgo } from '../../utils/date';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users.html',
  styleUrl: './users.css'
})
export class UsersPage implements OnInit {
  users: SystemUser[] = [];
  selectedRoles: Record<number, Role> = {};
  searchTerm = '';
  loading = true;

  constructor(private userService: UserService, private cdr: ChangeDetectorRef, 
    private dialogService: DialogService, private toastService: ToastService) {}

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
        this.toastService.error('Failed to load users.');
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
    return this.filteredUsers.filter(u => !u.isApproved);
  }

  get approvedUsers(): SystemUser[] {
    return this.filteredUsers.filter(u => u.isApproved);
  }

  roleFor(user: SystemUser): Role {
    return this.selectedRoles[user.id] ?? 'staff';
  }

  setRole(user: SystemUser, role: Role): void {
    this.selectedRoles[user.id] = role;
  }

  async toggleApproval(user: SystemUser): Promise<void> {
    const role = this.roleFor(user);
    const approving = !user.isApproved;
    const confirmed = await this.dialogService.confirm({
      title: user.isApproved ? 'Revoke Access' : 'Approve User',
      message: approving
        ? `Approve ${user.email} as ${role}?${role === 'admin' ? ' Administrators have full access and cannot be demoted or removed from this page.' : ''}`
        : `Are you sure you want to revoke access from ${user.email}?`,
      confirmLabel: user.isApproved ? 'Revoke' : 'Approve',
      type: user.isApproved ? 'danger' : 'primary',
    });
    if (!confirmed) return;

    this.userService.toggleApproval(user.id, approving ? role : undefined).subscribe({
      next: (updated) => {
        user.isApproved = updated.isApproved;
        user.role = updated.role;
        const actionLabel = updated.isApproved ? 'approved' : 'revoked access for';
        this.toastService.success(`Successfully ${actionLabel} ${user.email}.`);
        this.cdr.detectChanges();
      },
      error: (err) => {
        const message = err.error?.message || 'Failed to update user.';
        this.toastService.error(message);
        this.cdr.detectChanges();
      }
    });
  }

  async deleteUser(user: SystemUser): Promise<void> {
    const confirmed = await this.dialogService.confirm({
      title: 'Delete User',
      message: `Permanently delete ${user.email}? This cannot be undone.`,
      confirmLabel: 'Delete',
      type: 'danger',
    });
    if (!confirmed) return;

    this.userService.delete(user.id).subscribe({
      next: () => {
        this.users = this.users.filter(u => u.id !== user.id);
        this.toastService.success(`User ${user.email} deleted.`);
        this.cdr.detectChanges();
      },
      error: (err) => {
        const message = err.error?.message || 'Failed to delete user.';
        this.toastService.error(message);
        this.cdr.detectChanges();
      }
    });
  }

  userInitials(email: string): string {
    return email.charAt(0).toUpperCase();
  }

  memberSince(dateStr: string): string {
    return formatDate(dateStr);
  }

  lastLogin(user: SystemUser): string {
    if (!user.lastLoginAt) return 'Never logged in';
    return timeAgo(user.lastLoginAt, { capitalize: true });
  }
}