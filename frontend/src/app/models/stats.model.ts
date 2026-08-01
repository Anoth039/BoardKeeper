export interface TopGame {
  title: string;
  rentalCount: string;
}

export interface UnusedGame {
  title: string;
  imageUrl?: string;
  lastRentedDate: string | null;
  createdAt: string;
}

export interface Stats {
  totalGames: number;
  totalCopies: number;
  activeMembers: number;
  inactiveMembers: number;
  activeRentals: number;
  overdueRentals: number;
  topGamesThisMonth: TopGame[];
  unusedGames: UnusedGame[];
}