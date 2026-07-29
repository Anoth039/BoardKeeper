import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MemberService } from '../../services/member';
import { Member } from '../../models/member.model';
import { isRentalOverdue, rentalDisplayStatus, RentalStatus, rentalStatusBadgeClass } from '../../models/rental.model';

@Component({
  selector: 'app-member-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './member-detail.html',
  styleUrl: './member-detail.css'
})
export class MemberDetail implements OnInit {
  member: Member | null = null;
  loading = true;
  notFound = false;

  statusBadgeClass = rentalStatusBadgeClass;
  displayStatus = rentalDisplayStatus;
  isOverdue = isRentalOverdue;

  constructor(private route: ActivatedRoute, private router: Router, private memberService: MemberService, 
    private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));

    this.memberService.getById(id).subscribe({
      next: (data) => {
        this.member = data;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load member', err);
        this.loading = false;
        this.notFound = true;
        this.cdr.detectChanges();
      }
    });
  }

  get activeRentals() {
    return this.member?.rentals?.filter(r => r.status === RentalStatus.ACTIVE) || [];
  }

  get pastRentals() {
    return this.member?.rentals?.filter(r => r.status !== RentalStatus.ACTIVE) || [];
  }

  get initials(): string {
  if (!this.member) return '';
  return `${this.member.firstName.charAt(0)}${this.member.lastName.charAt(0)}`.toUpperCase();
  }

  get memberSince(): string {
    if (!this.member) return '';
    return new Date(this.member.createdAt).toLocaleDateString(undefined, {
      year: 'numeric', month: 'long'
    });
  }
}