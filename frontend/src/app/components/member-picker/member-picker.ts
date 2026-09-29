import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Member } from '../../models/member.model';

@Component({
  selector: 'app-member-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './member-picker.html',
  styleUrl: './member-picker.css'
})
export class MemberPicker {
  @Input() members: Member[] = [];
  @Output() picked = new EventEmitter<Member | null>();

  search = '';
  open = false;

  get filtered(): Member[] {
    const term = this.search.trim().toLowerCase();
    const active = this.members.filter(m => m.isActive);
    if (!term) return active.slice(0, 8);
    return active.filter(m =>
      `${m.firstName} ${m.lastName}`.toLowerCase().includes(term) || m.email?.toLowerCase().includes(term)
    ).slice(0, 8);
  }

  onSearchChange(value: string): void {
    this.search = value;
    this.open = true;
    this.picked.emit(null);
  }

  select(member: Member): void {
    this.search = `${member.firstName} ${member.lastName}`;
    this.open = false;
    this.picked.emit(member);
  }

  onBlur(): void {
    setTimeout(() => this.open = false, 150);
  }

  clear(): void {
    this.search = '';
    this.open = false;
    this.picked.emit(null);
  }
}