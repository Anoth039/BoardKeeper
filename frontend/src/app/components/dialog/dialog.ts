import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { DialogService, DialogConfig } from '../../services/dialog';

@Component({
  selector: 'app-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dialog.html',
  styleUrl: './dialog.css'
})
export class DialogComponent implements OnInit, OnDestroy {
  visible = false;
  config: DialogConfig | null = null;
  private resolve: ((result: boolean) => void) | null = null;
  private sub!: Subscription;

  constructor(private dialogService: DialogService) {}

  ngOnInit(): void {
    this.sub = this.dialogService.dialog$.subscribe((data) => {
      const { resolve, ...config } = data;
      this.config = config;
      this.resolve = resolve;
      this.visible = true;
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  confirm(): void {
    this.resolve?.(true);
    this.visible = false;
  }

  cancel(): void {
    this.resolve?.(false);
    this.visible = false;
  }

  get confirmBtnClass(): string {
    switch (this.config?.type) {
      case 'danger': return 'btn-danger';
      case 'warning': return 'btn-warning';
      default: return 'btn-primary';
    }
  }
}