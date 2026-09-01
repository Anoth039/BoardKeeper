import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface DialogConfig {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: 'danger' | 'warning' | 'primary';
}

@Injectable({ providedIn: 'root' })
export class DialogService {
  private dialogSubject = new Subject<DialogConfig & { resolve: (result: boolean) => void }>();
  dialog$ = this.dialogSubject.asObservable();

  confirm(config: DialogConfig): Promise<boolean> {
    return new Promise((resolve) => {
      this.dialogSubject.next({ ...config, resolve });
    });
  }
}