import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import { Rental, RentalStatus } from '../models/rental.model';
import { daysBetween, formatDate, pluralDays } from '../utils/date';

type RGB = [number, number, number];

const COLOR = {
  dark: [30, 35, 42] as RGB,
  muted: [115, 122, 132] as RGB,
  border: [225, 228, 233] as RGB,
  danger: [180, 40, 40] as RGB,
};

const STORE_INFO = '123 Main Street, Suite A • support@boardkeeper.com • (555) 019-2834';

const money = (n: number): string => `$${Number(n || 0).toFixed(2)}`;

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
    this.drawText(doc, formatDate(new Date()), W - m, 24, { color: COLOR.muted, align: 'right' });

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
    const returnLabel = rental.status === RentalStatus.LOST ? 'MARKED AS LOST' : 'RETURNED ON';

    this.drawLabel(doc, 'RENTED ON', m, y);
    this.drawLabel(doc, returnLabel, col2, y);

    y += 7;
    this.drawText(doc, formatDate(rental.rentalDate), m, y, { size: 10, bold: true });
    this.drawText(doc, formatDate(rental.returnDate || rental.dueDate), col2, y, { size: 10, bold: true });

    if (status.subLabel) {
      y += 4.5;
      this.drawText(doc, status.subLabel, col2, y, { size: 7.5, bold: true, color: status.subLabelColor || COLOR.muted });
    }

    if (rental.totalCharged != null) {
      y += 13;
      this.drawDivider(doc, m, y, W - m);
      y += 9;
      y = this.drawCharges(doc, rental, m, W, y);
    }

    this.drawDivider(doc, m, H - 22, W - m);
    const footerLines = doc.splitTextToSize(status.footer, W - m * 2);
    this.drawText(doc, footerLines, W / 2, H - 14, { size: 7.5, color: COLOR.muted, align: 'center' });

    return doc;
  }

  private drawCharges(doc: jsPDF, rental: Rental, m: number, W: number, y: number): number {
    this.drawLabel(doc, 'CHARGES', m, y);
    y += 7;

    const daysRented = Math.max(1, daysBetween(rental.rentalDate, rental.returnDate ?? new Date()));
    const rate = rental.pricePerDaySnapshot ?? 0;

    y = this.drawChargeRow(doc, `Rental: ${money(rate)}/day × ${pluralDays(daysRented)}`, rental.rentalCharge ?? 0, m, W, y);

    if (rental.lateFeeCharged) {
      const lateDays = Math.max(0, daysBetween(rental.dueDate, rental.returnDate ?? new Date()));
      y = this.drawChargeRow(doc, `Late fee: ${pluralDays(lateDays)} overdue`, rental.lateFeeCharged, m, W, y, COLOR.danger);
    }

    if (rental.extensionFeeCharged) {
      const count = rental.extensions?.length ?? 0;
      y = this.drawChargeRow(doc, `Extension fee${count ? ` (${count}x)` : ''}`, rental.extensionFeeCharged, m, W, y);
    }

    if (rental.replacementFeeCharged) {
      y = this.drawChargeRow(doc, 'Replacement fee (item lost)', rental.replacementFeeCharged, m, W, y, COLOR.danger);
    }

    y += 2;
    this.drawDivider(doc, m, y, W - m);
    y += 7;
    this.drawText(doc, 'TOTAL', m, y, { size: 10, bold: true });
    this.drawText(doc, money(rental.totalCharged ?? 0), W - m, y, { size: 11, bold: true, align: 'right' });

    return y;
  }

  private drawChargeRow(doc: jsPDF, label: string, amount: number, m: number, W: number, y: number, color: RGB = COLOR.dark): number {
    this.drawText(doc, label, m, y, { size: 8.5, color: COLOR.muted });
    this.drawText(doc, money(amount), W - m, y, { size: 8.5, color, align: 'right' });
    return y + 6;
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
    if (rental.status === RentalStatus.LOST) {
      const daysPastDue = daysBetween(rental.dueDate, rental.returnDate ?? new Date());
      const wasOverdue = daysPastDue > 0;

      return {
        label: 'LOST',
        subLabel: wasOverdue ? `(${pluralDays(daysPastDue)} past due)` : null,
        subLabelColor: COLOR.muted,
        bg: [226, 227, 229] as RGB,
        fg: [33, 37, 41] as RGB,
        footer: 'This copy has been marked as lost. Please contact us if you have any questions.',
      };
    }

    const daysLate = daysBetween(rental.dueDate, rental.returnDate ?? new Date());
    const wasOverdue = daysLate > 0;

    return {
      label: 'RETURNED',
      subLabel: wasOverdue ? `(Returned ${pluralDays(daysLate)} late)` : null,
      subLabelColor: COLOR.danger,
      bg: [209, 250, 229] as RGB,
      fg: [6, 95, 70] as RGB,
      footer: 'Thank you for returning this game. We hope you enjoyed it!',
    };
  }
}