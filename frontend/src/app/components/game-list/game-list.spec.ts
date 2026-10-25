import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { GameListComponent } from './game-list';
import { GameService } from '../../services/game';
import { GameCopyService } from '../../services/game-copy';
import { AuthService } from '../../services/auth';
import { DialogService } from '../../services/dialog';
import { ToastService } from '../../services/toast';
import { MemberService } from '../../services/member';
import { AgeRating, Game } from '../../models/game.model';

describe('Társasjátékok listázása', () => {
  let component: GameListComponent;
  let fixture: ComponentFixture<GameListComponent>;

  const gamesData: Game[] = [
    {
      id: 1, title: 'Catan', category: 'Strategy', minPlayers: 3, maxPlayers: 4,
      estimatedTimeMinutes: 90, ageRating: AgeRating.AGE_12, createdAt: '2026-01-01',
      copies: [{ id: 11, copyNumber: 'CAT-01', condition: 'good', isAvailable: true, notes: null, createdAt: '2026-01-01' }],
    },
    {
      id: 2, title: 'Dixit', category: 'Family', minPlayers: 3, maxPlayers: 6,
      estimatedTimeMinutes: 30, ageRating: AgeRating.AGE_7, createdAt: '2026-01-01',
      copies: [{ id: 21, copyNumber: 'DIX-01', condition: 'good', isAvailable: false, notes: null, createdAt: '2026-01-01' }],
    },
    {
      id: 3, title: 'Carcassonne', category: 'Strategy', minPlayers: 2, maxPlayers: 5,
      estimatedTimeMinutes: 45, ageRating: AgeRating.AGE_7, createdAt: '2026-01-01', copies: [],
    },
  ];

  const gameService = { getAll: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    gameService.getAll.mockReturnValue(of(gamesData));
    await TestBed.configureTestingModule({
      imports: [GameListComponent],
      providers: [
        { provide: GameService, useValue: gameService },
        { provide: GameCopyService, useValue: {} },
        { provide: AuthService, useValue: { can: () => false } },
        { provide: DialogService, useValue: { confirm: vi.fn() } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: MemberService, useValue: { getAll: vi.fn().mockReturnValue(of([])) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GameListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('betölti a társasjátékokat', () => {
    expect(gameService.getAll).toHaveBeenCalledOnce();
    expect(component.games).toHaveLength(3);
  });

  it('cím és kategória alapján, kis- és nagybetűtől függetlenül keres', () => {
    component.searchTerm = 'CATAN';
    expect(component.filteredGames.map(game => game.id)).toEqual([1]);

    component.searchTerm = 'strategy';
    expect(component.filteredGames.map(game => game.id)).toEqual([1, 3]);
  });

  it('csak a megadott játékosszámnak megfelelő játékokat adja vissza', () => {
    component.playerCountFilter = 2;
    expect(component.filteredGames.map(game => game.id)).toEqual([3]);

    component.playerCountFilter = 4;
    expect(component.filteredGames.map(game => game.id)).toEqual([1, 2, 3]);
  });

  it('elérhetőség szerint szűr, és törli a szűrőket', () => {
    component.availabilityFilter = 'available';
    expect(component.filteredGames.map(game => game.id)).toEqual([1]);
    expect(component.activeFilterCount).toBe(1);

    component.clearFilters();

    expect(component.availabilityFilter).toBe('all');
    expect(component.searchTerm).toBe('');
    expect(component.playerCountFilter).toBeNull();
    expect(component.filteredGames).toHaveLength(3);
  });
});
