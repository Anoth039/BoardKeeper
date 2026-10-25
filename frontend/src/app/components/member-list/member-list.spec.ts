import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { MemberListComponent } from './member-list';
import { MemberService } from '../../services/member';
import { AuthService } from '../../services/auth';
import { DialogService } from '../../services/dialog';
import { ToastService } from '../../services/toast';
import { Member } from '../../models/member.model';

describe('Tagok listázása', () => {
  let component: MemberListComponent;
  let fixture: ComponentFixture<MemberListComponent>;

  const membersData: Member[] = [
    { id: 1, firstName: 'Zita', lastName: 'Nagy', email: 'zita@example.com', isActive: true, createdAt: '2026-01-01' },
    { id: 2, firstName: 'Anna', lastName: 'Kiss', email: 'anna@example.com', isActive: true, createdAt: '2026-01-01' },
    { id: 3, firstName: 'Béla', lastName: 'Teszt', email: 'bela@example.com', isActive: false, createdAt: '2026-01-01' },
  ];

  const memberService = { getAll: vi.fn(), getById: vi.fn(), update: vi.fn(), delete: vi.fn() };
  const dialogService = { confirm: vi.fn() };
  const toastService = { success: vi.fn(), error: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    memberService.getAll.mockReturnValue(of(membersData));
    memberService.getById.mockReturnValue(of({ ...membersData[0], rentals: [] }));
    memberService.update.mockReturnValue(of({ ...membersData[0], isActive: false }));
    memberService.delete.mockReturnValue(of(undefined));
    dialogService.confirm.mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [MemberListComponent],
      providers: [
        { provide: MemberService, useValue: memberService },
        { provide: AuthService, useValue: { can: () => false } },
        { provide: DialogService, useValue: dialogService },
        { provide: ToastService, useValue: toastService },
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MemberListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('betölti a tagokat, és előre sorolja az aktív tagokat', () => {
    expect(memberService.getAll).toHaveBeenCalledOnce();
    expect(component.filteredMembers.map(member => member.id)).toEqual([2, 1, 3]);
  });

  it('név és e-mail-cím alapján keres', () => {
    component.searchTerm = 'ANNA';
    expect(component.filteredMembers.map(member => member.id)).toEqual([2]);

    component.searchTerm = 'zita@example.com';
    expect(component.filteredMembers.map(member => member.id)).toEqual([1]);
  });

  it('az inaktív tagot nem engedi kikapcsolni, ha aktív kölcsönzése van', () => {
    const member = membersData[0];
    memberService.getById.mockReturnValue(of({
      ...member,
      rentals: [{ id: 100, status: 'active' }],
    }));

    component.toggleActive(member);

    expect(memberService.getById).toHaveBeenCalledWith(member.id);
    expect(memberService.update).not.toHaveBeenCalled();
    expect(toastService.error).toHaveBeenCalledWith(expect.stringContaining('they have 1 active rental'));
  });

  it('a tag kezdőbetűit nagybetűvel adja vissza', () => {
    expect(component.memberInitials(membersData[1])).toBe('AK');
  });
});
