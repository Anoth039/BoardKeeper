import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatsService } from '../../services/stats';
import { Stats, UnusedGame } from '../../models/stats.model';
import { Chart, registerables } from 'chart.js';
import { formatDate, timeAgo } from '../../utils/date';
import { ThemeService } from '../../services/theme';

Chart.register(...registerables);

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stats.html',
  styleUrl: './stats.css'
})
export class StatsPage implements OnInit, AfterViewInit, OnDestroy {
  stats: Stats | null = null;
  loading = true;

  @ViewChild('topGamesCanvas') topGamesCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('activityCanvas') activityCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('statusCanvas') statusCanvas!: ElementRef<HTMLCanvasElement>;

  private charts: Chart[] = [];
  private viewReady = false;
  private dataReady = false;

  constructor(private statsService: StatsService, private cdr: ChangeDetectorRef, private themeService: ThemeService) {
    effect(() => {
      this.themeService.theme();
      if (this.viewReady && this.dataReady) this.renderAll();
    });
  }

  ngOnInit(): void {
    this.statsService.get().subscribe({
      next: (data) => {
        this.stats = data;
        this.loading = false;
        this.dataReady = true;
        this.cdr.detectChanges();
        if (this.viewReady) this.renderAll();
      },
      error: (err) => {
        console.error('Failed to load stats', err);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    if (this.dataReady) this.renderAll();
  }

  ngOnDestroy(): void {
    this.charts.forEach(c => c.destroy());
  }

  private renderAll(): void {
    this.charts.forEach(c => c.destroy());
    this.charts = [];
    setTimeout(() => {
      this.renderTopGames();
      this.renderActivity();
      this.renderStatus();
    });
  }

  private chartColors() {
    const style = getComputedStyle(document.documentElement);
    return {
      text: style.getPropertyValue('--bs-body-color').trim() || '#212529',
      grid: style.getPropertyValue('--bk-divider').trim() || '#f1f3f5',
      surface: style.getPropertyValue('--bk-surface').trim() || '#fff',
    };
  }

  private renderTopGames(): void {
    if (!this.topGamesCanvas || !this.stats) return;
    const games = this.stats.topGamesThisMonth;
    const truncate = (str: string, len = 15) => str.length > len ? str.slice(0, len) + '…' : str;
    const colors = this.chartColors();

    const chart = new Chart(this.topGamesCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels: games.length ? games.map(g => truncate(g.title)) : ['No data'],
        datasets: [{
          label: 'Rentals',
          data: games.length ? games.map(g => Number(g.rentalCount)) : [0],
          backgroundColor: games.map((_, i) => [
            '#0d6efd', '#6610f2', '#d63384', '#fd7e14', '#20c997'
          ][i % 5]),
          borderRadius: 6,
          maxBarThickness: 32,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.raw} rental${Number(ctx.raw) !== 1 ? 's' : ''}`
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { stepSize: 1, precision: 0, color: colors.text },
            grid: { color: colors.grid }
          },
          y: { ticks: { color: colors.text }, grid: { display: false } }
        }
      }
    });
    this.charts.push(chart);
  }

  private renderActivity(): void {
    if (!this.activityCanvas || !this.stats) return;
    const points = this.stats.rentalActivity;
    const colors = this.chartColors();

    const chart = new Chart(this.activityCanvas.nativeElement, {
      type: 'line',
      data: {
        labels: points.map(p => formatDate(p.date, 'short')),
        datasets: [{
          label: 'Rentals',
          data: points.map(p => p.count),
          borderColor: '#6610f2',
          backgroundColor: 'rgba(102,16,242,0.08)',
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: '#6610f2',
          pointHoverRadius: 6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.raw} rental${Number(ctx.raw) !== 1 ? 's' : ''}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1, precision: 0, color: colors.text },
            grid: { color: colors.grid }
          },
          x: { ticks: { color: colors.text }, grid: { display: false } }
        }
      }
    });
    this.charts.push(chart);
  }

  private renderStatus(): void {
    if (!this.statusCanvas || !this.stats) return;
    const b = this.stats.monthlyBreakdown;
    const total = b.active + b.overdue + b.returned + b.lost;
    const colors = this.chartColors();

    const chart = new Chart(this.statusCanvas.nativeElement, {
      type: 'doughnut',
      data: {
        labels: ['Active', 'Overdue', 'Returned', 'Lost'],
        datasets: [{
          data: [b.active, b.overdue, b.returned, b.lost],
          backgroundColor: ['#0d6efd', '#dc3545', '#198754', '#3f4040'],
          borderWidth: 3,
          borderColor: colors.surface,
          hoverOffset: 6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 12, padding: 14, font: { size: 12 }, color: colors.text }
          },
          tooltip: {
            callbacks: {
              label: ctx => {
                const val = Number(ctx.raw);
                const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                return ` ${val} (${pct}%)`;
              }
            }
          }
        }
      }
    });
    this.charts.push(chart);
  }

  unusedGameLabel(game: UnusedGame): string {
    if (game.lastRentedDate) return timeAgo(game.lastRentedDate, { capitalize: true });
    return 'Never rented';
  }

  get totalRentalsThisMonth(): number {
    if (!this.stats?.monthlyBreakdown) return 0;
    const b = this.stats.monthlyBreakdown;
    return b.active + b.overdue + b.returned + b.lost;
  }
}