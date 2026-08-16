import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import { Rental, RentalStatus } from '../models/rental.model';

type RGB = [number, number, number];

const COLOR = {
  dark: [30, 35, 42] as RGB,
  muted: [115, 122, 132] as RGB,
  border: [225, 228, 233] as RGB,
  danger: [180, 40, 40] as RGB,
};

const STORE_INFO = '123 Main Street, Suite A • support@boardkeeper.com • (555) 019-2834';

interface TextOptions {
  size?: number;
  bold?: boolean;
  color?: RGB;
  align?: 'left' | 'center' | 'right';
}

@Injectable({ providedIn: 'root' })
export class PdfService {

  generateRentalReceiptDataUrl(rental: Rental): string {
    const doc = this.buildReceiptDoc(rental);
    return doc.output('datauristring');
  }

  generateRentalReceipt(rental: Rental): void {
    const doc = this.buildReceiptDoc(rental);
    const memberName = rental.member
      ? `${rental.member.firstName} ${rental.member.lastName}`
      : 'unknown-member';
    const slug = memberName.replace(/\s+/g, '-').toLowerCase();
    
    doc.save(`receipt-${String(rental.id).padStart(4, '0')}-${slug}.pdf`);
  }

  private buildReceiptDoc(rental: Rental): jsPDF {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const m = 18;

    const member = rental.member ? `${rental.member.firstName} ${rental.member.lastName}` : 'Unknown Member';
    const game = rental.gameCopy?.game?.title || rental.gameTitleSnapshot || 'Unknown Game';
    const copy = rental.gameCopy?.copyNumber || rental.copyLabelSnapshot || '—';
    const contact = [rental.member?.email, rental.member?.phone].filter(Boolean).join('   •   ');
    const status = this.getStatus(rental);

    this.drawText(doc, 'BoardKeeper', m, 18, { size: 18, bold: true });
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    this.drawBadge(doc, status.label, m + doc.getTextWidth('BoardKeeper') + 4, 13, status.bg, status.fg);

    this.drawText(doc, STORE_INFO, m, 23, { size: 6.5, color: COLOR.muted });
    this.drawText(doc, 'GAME RENTAL RECEIPT', W - m, 14, { color: COLOR.muted, align: 'right' });
    this.drawText(doc, `#${String(rental.id).padStart(4, '0')}`, W - m, 19, { bold: true, align: 'right' });
    this.drawText(doc, this.fmt(new Date().toISOString()), W - m, 24, { color: COLOR.muted, align: 'right' });

    this.drawDivider(doc, m, 30, W - m);

    let y = 42;

    this.drawLabel(doc, 'MEMBER', m, y);
    y += 7;
    this.drawText(doc, member, m, y, { size: 13, bold: true });
    if (contact) {
      y += 5;
      this.drawText(doc, contact, m, y, { color: COLOR.muted });
    }

    y += 17;
    this.drawLabel(doc, 'RENTAL', m, y);
    y += 7;
    
    const gameLines = doc.splitTextToSize(game, W - m * 2 - 20).slice(0, 2);
    this.drawText(doc, gameLines, m, y, { size: 13, bold: true });

    y += 6;
    this.drawText(doc, `Copy Number: ${copy}`, m, y, { color: COLOR.muted });

    y += 14;
    this.drawDivider(doc, m, y, W - m);
    y += 9;

    const col2 = W / 2 + 4;
    const returnLabel = rental.status === RentalStatus.RETURNED ? 'RETURNED ON' : rental.status === RentalStatus.LOST ? 'MARKED AS LOST' : 'DUE DATE';

    this.drawLabel(doc, 'RENTED ON', m, y);
    this.drawLabel(doc, returnLabel, col2, y);

    y += 7;
    this.drawText(doc, this.fmt(rental.rentalDate), m, y, { size: 10, bold: true });
    this.drawText(doc, this.fmt(rental.returnDate || rental.dueDate), col2, y, { size: 10, bold: true });

    if (status.subLabel) {
      y += 4.5;
      this.drawText(doc, status.subLabel, col2, y, { size: 7.5, bold: true, color: status.subLabelColor || COLOR.muted });
    }

    this.drawDivider(doc, m, H - 22, W - m);
    const footerLines = doc.splitTextToSize(status.footer, W - m * 2);
    this.drawText(doc, footerLines, W / 2, H - 14, { size: 7.5, color: COLOR.muted, align: 'center' });

    return doc;
  }

  private drawText(doc: jsPDF, text: string | string[], x: number, y: number, opts: TextOptions = {}): void {
    const { size = 8, bold = false, color = COLOR.dark, align = 'left' } = opts;
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(text, x, y, { align });
  }

  private drawLabel(doc: jsPDF, text: string, x: number, y: number): void {
    this.drawText(doc, text, x, y, { size: 7, bold: true, color: COLOR.muted });
  }

  private drawDivider(doc: jsPDF, x1: number, y: number, x2: number): void {
    doc.setDrawColor(...COLOR.border);
    doc.line(x1, y, x2, y);
  }

  private drawBadge(doc: jsPDF, label: string, x: number, y: number, bg: RGB, fg: RGB): void {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    const pillW = doc.getTextWidth(label) + 6;
    doc.setFillColor(...bg);
    doc.roundedRect(x, y, pillW, 5.5, 2.75, 2.75, 'F');
    doc.setTextColor(...fg);
    doc.text(label, x + pillW / 2, y + 3.8, { align: 'center' });
  }

  private getStatus(rental: Rental) {
    if (rental.status === RentalStatus.RETURNED) {
      const returnDate = rental.returnDate ? new Date(rental.returnDate) : new Date();
      const dueDate = new Date(rental.dueDate);
      
      returnDate.setHours(0, 0, 0, 0);
      dueDate.setHours(0, 0, 0, 0);

      const daysLate = Math.round((returnDate.getTime() - dueDate.getTime()) / 86400000);
      const wasOverdue = daysLate > 0;

      return {
        label: 'RETURNED',
        subLabel: wasOverdue ? `(Returned ${daysLate} day${daysLate !== 1 ? 's' : ''} late)` : null,
        subLabelColor: COLOR.danger,
        bg: [209, 250, 229] as RGB,
        fg: [6, 95, 70] as RGB,
        footer: 'Thank you for returning this game. We hope you enjoyed it!',
      };
    }

    if (rental.status === RentalStatus.LOST) {
      const lostDate = rental.returnDate ? new Date(rental.returnDate) : new Date();
      const dueDate = new Date(rental.dueDate);

      lostDate.setHours(0, 0, 0, 0);
      dueDate.setHours(0, 0, 0, 0);

      const daysPastDue = Math.round((lostDate.getTime() - dueDate.getTime()) / 86400000);
      const wasOverdue = daysPastDue > 0;

      return {
        label: 'LOST',
        subLabel: wasOverdue ? `(${daysPastDue} day${daysPastDue !== 1 ? 's' : ''} past due)` : null,
        subLabelColor: COLOR.muted,
        bg: [226, 227, 229] as RGB,
        fg: [33, 37, 41] as RGB,
        footer: 'This copy has been marked as lost. Please contact us if you have any questions.',
      };
    }

    const today = new Date().setHours(0, 0, 0, 0);
    const due = new Date(rental.dueDate).setHours(0, 0, 0, 0);
    const days = Math.round((due - today) / 86400000);
    const overdue = days < 0;

    return {
      label: overdue ? 'OVERDUE' : 'ACTIVE',
      subLabel: overdue
        ? `${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} overdue`
        : days === 0 ? 'Due today' : `${days} day${days !== 1 ? 's' : ''} remaining`,
      subLabelColor: overdue ? COLOR.danger : COLOR.muted,
      bg: (overdue ? [248, 215, 218] : [219, 234, 254]) as RGB,
      fg: (overdue ? [114, 28, 36] : [30, 64, 175]) as RGB,
      footer: overdue
        ? 'This rental is overdue. Please return the game as soon as possible.'
        : 'Please return this game by the due date. Thank you for using BoardKeeper!',
    };
  }

  private fmt(date: string): string {
    return new Date(date).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
}