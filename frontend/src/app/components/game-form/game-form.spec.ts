import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { GameForm } from './game-form';
import { GameService } from '../../services/game';
import { DialogService } from '../../services/dialog';
import { ToastService } from '../../services/toast';

describe('Társasjáték adatainak kezelése', () => {
  let fixture: ComponentFixture<GameForm>;
  let component: GameForm;
  const games = { create: vi.fn(), update: vi.fn() };
  const dialogs = { confirm: vi.fn() };
  const toast = { success: vi.fn(), error: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    games.create.mockReturnValue(of({ id: 1 }));
    games.update.mockReturnValue(of({ id: 1 }));
    dialogs.confirm.mockResolvedValue(true);
    await TestBed.configureTestingModule({
      imports: [GameForm],
      providers: [
        { provide: GameService, useValue: games },
        { provide: DialogService, useValue: dialogs },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(GameForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('hibás űrlapnál megjelöli a kötelező mezőket, és nem menti el az adatokat', () => {
    component.onSubmit();
    expect(component.form.invalid).toBe(true);
    expect(component.form.touched).toBe(true);
    expect(games.create).not.toHaveBeenCalled();
  });

  it('hibát jelez, ha a maximális játékosszám kisebb a minimálisnál', () => {
    component.form.patchValue({
      title: 'Catan', minPlayers: 5, maxPlayers: 4,
      pricePerDay: 1000, replacementValue: 10000,
    });
    expect(component.form.hasError('maxLessThanMin')).toBe(true);
    component.onSubmit();
    expect(games.create).not.toHaveBeenCalled();
  });

  it('egységesíti az új kategória nevét, és nem enged duplikációt', () => {
    component.customCategoryInput = '  sci-Fi   games ';
    component.addCustomCategory();
    expect(component.selectedCategories).toContain('Sci-fi Games');
    expect(component.customCategoryInput).toBe('');

    component.customCategoryInput = 'sci-figames';
    component.addCustomCategory();
    expect(component.selectedCategories).toHaveLength(1);
    expect(toast.error).toHaveBeenCalledWith('Category "Sci-fi Games" has already been added.');
  });

  it('mentéskor a kategóriákat vesszővel elválasztva küldi el', () => {
    const saved = vi.fn();
    component.gameSaved.subscribe(saved);
    component.form.patchValue({
      title: 'Catan', description: 'A strategy game', minPlayers: 2, maxPlayers: 4,
      categories: ['Strategy', 'Family'], pricePerDay: 1200, replacementValue: 15000,
    });

    component.onSubmit();

    expect(games.create).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Catan',
      minPlayers: 2,
      maxPlayers: 4,
      category: 'Strategy, Family',
      pricePerDay: 1200,
      replacementValue: 15000,
    }));
    expect(saved).toHaveBeenCalledOnce();
    expect(toast.success).toHaveBeenCalledWith('Game "Catan" created successfully.');
  });
});
