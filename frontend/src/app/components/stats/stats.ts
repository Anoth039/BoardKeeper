import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatsService } from '../../services/stats';
import { Stats } from '../../models/stats.model';

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

  maxRentalCount(list: { rentalCount: string }[]): number {
    return Math.max(...list.map(item => Number(item.rentalCount)), 1);
  }
}