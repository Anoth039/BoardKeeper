import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { App } from './app';
import { AuthService } from './services/auth';

describe('Alkalmazás', () => {
  const auth = {
    isLoggedIn: vi.fn(),
    refreshUser: vi.fn(),
    logout: vi.fn(),
    can: vi.fn().mockReturnValue(false),
    getCurrentUser: vi.fn().mockReturnValue(null),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    auth.isLoggedIn.mockReturnValue(false);
    auth.can.mockReturnValue(false);
    auth.getCurrentUser.mockReturnValue(null);

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
      ],
    }).compileComponents();
  });

  it('létrehozza az alkalmazást és betölti a gyermekkomponenseket', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
    fixture.destroy();
  });
});
