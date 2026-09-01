import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ToastService, ToastMessage } from '../../services/toast';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.html',
  styleUrl: './toast.css'
})
export class ToastComponent implements OnInit, OnDestroy {
  toast: ToastMessage | null = null;
  private sub!: Subscription;
  private timer: any;

  constructor(private toastService: ToastService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.sub = this.toastService.toast$.subscribe((toast) => {
      clearTimeout(this.timer);
      this.toast = toast;
      this.cdr.detectChanges();

      this.timer = setTimeout(() => {
        this.toast = null;
        this.cdr.detectChanges();
      }, 5000);
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    clearTimeout(this.timer);
  }

  dismiss(): void {
    clearTimeout(this.timer);
    this.toast = null;
    this.cdr.detectChanges();
  }
}