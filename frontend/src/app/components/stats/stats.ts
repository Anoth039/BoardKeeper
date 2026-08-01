import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatsService } from '../../services/stats';
import { Stats, UnusedGame } from '../../models/stats.model';

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stats.html',
  styleUrl: './stats.css'
})
export class StatsPage implements OnInit {
  stats: Stats | null = null;
  loading = true;

  constructor(private statsService: StatsService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.statsService.get().subscribe({
      next: (data) => {
        this.stats = data;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load stats', err);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  rankBadgeClass(index: number): string {
    switch (index) {
      case 0: return 'rank-gold';
      case 1: return 'rank-silver';
      case 2: return 'rank-bronze';
      default: return 'rank-default';
    }
  }

  unusedGameLabel(game: UnusedGame): string {
    if (game.lastRentedDate) {
      return this.timeAgo(game.lastRentedDate);
    }

    const createdDaysAgo = Math.floor(
      (new Date().getTime() - new Date(game.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (createdDaysAgo <= 7) {
      return 'Recently added';
    }

    return 'Not rented yet';
  }

  private timeAgo(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    const diffDays = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 30) return `${diffDays} days ago`;

    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths === 1) return '1 month ago';
    if (diffMonths < 12) return `${diffMonths} months ago`;

    const diffYears = Math.floor(diffMonths / 12);
    return diffYears === 1 ? '1 year ago' : `${diffYears} years ago`;
  }
}