import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { MemberPicker } from './member-picker';
import { Member } from '../../models/member.model';

describe('Tag kiválasztása', () => {
  let component: MemberPicker;
  let fixture: ComponentFixture<MemberPicker>;

  const members: Member[] = [
    { id: 1, firstName: 'Anna', lastName: 'Teszt', email: 'anna@example.com', isActive: true, createdAt: '2026-01-01' },
    { id: 2, firstName: 'Béla', lastName: 'Minta', email: 'bela@example.com', isActive: true, createdAt: '2026-01-01' },
    { id: 3, firstName: 'Csilla', lastName: 'Példa', email: 'csilla@example.com', isActive: false, createdAt: '2026-01-01' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [MemberPicker] }).compileComponents();
    fixture = TestBed.createComponent(MemberPicker);
    component = fixture.componentInstance;
    component.members = members;
    fixture.detectChanges();
  });

  it('csak aktív tagokat kínál fel, és név vagy e-mail alapján szűr', () => {
    expect(component.filtered.map(member => member.id)).toEqual([1, 2]);
    component.search = 'BELA@EXAMPLE.COM';
    expect(component.filtered.map(member => member.id)).toEqual([2]);
  });

  it('kiválasztáskor eseményt küld, és bezárja a listát', () => {
    const picked = vi.fn();
    component.picked.subscribe(picked);
    component.open = true;

    component.select(members[0]);

    expect(component.search).toBe('Anna Teszt');
    expect(component.open).toBe(false);
    expect(picked).toHaveBeenCalledWith(members[0]);
  });

  it('keresés módosításakor törli a korábbi kiválasztást', () => {
    const picked = vi.fn();
    component.picked.subscribe(picked);

    component.onSearchChange('Béla');

    expect(component.open).toBe(true);
    expect(component.search).toBe('Béla');
    expect(picked).toHaveBeenCalledWith(null);
  });
});
