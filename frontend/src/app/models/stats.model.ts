export interface StatsSummary {
  totalGames: number;
  totalCopies: number;
  availableCopies: number;
  activeMembers: number;
  activeRentals: number;
  dueSoonRentals: number;
  overdueRentals: number;
}

export interface MonthlyBreakdown {
  active: number;
  overdue: number;
  returned: number;
  lost: number;
}

export interface TopGame {
  title: string;
  rentalCount: string;
}

export interface RentalActivityPoint {
  date: string;
  count: number;
}

export interface UnusedGame {
  title: string;
  imageUrl: string | null;
  lastRentedDate: string | null;
  createdAt: string;
}

export interface Stats {
  summary: StatsSummary;
  monthlyBreakdown: MonthlyBreakdown;
  topGamesThisMonth: TopGame[];
  rentalActivity: RentalActivityPoint[];
  unusedGames: UnusedGame[];
}