export interface TopGame {
  title: string;
  rentalCount: string;
}

export interface TopMember {
  firstName: string;
  lastName: string;
  rentalCount: string;
}

export interface Stats {
  totalGames: number;
  totalCopies: number;
  activeMembers: number;
  inactiveMembers: number;
  activeRentals: number;
  overdueRentals: number;
  topGamesThisMonth: TopGame[];
  topMembersAllTime: TopMember[];
}