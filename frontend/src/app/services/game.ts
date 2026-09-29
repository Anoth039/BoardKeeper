import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Game, QueueEntry } from '../models/game.model';

@Injectable({
  providedIn: 'root'
})
export class GameService {
  private apiUrl = 'http://localhost:3000/api/games';

  constructor(private http: HttpClient) {}

  getAll(): Observable<Game[]> {
    return this.http.get<Game[]>(this.apiUrl);
  }

  getById(id: number): Observable<Game> {
    return this.http.get<Game>(`${this.apiUrl}/${id}`);
  }

  create(game: Partial<Game>): Observable<Game> {
    return this.http.post<Game>(this.apiUrl, game);
  }

  update(id: number, game: Partial<Game>): Observable<Game> {
    return this.http.put<Game>(`${this.apiUrl}/${id}`, game);
  }

  getQueue(gameId: number): Observable<QueueEntry[]> {
    return this.http.get<QueueEntry[]>(`${this.apiUrl}/${gameId}/queue`);
  }

  joinQueue(gameId: number, memberId: number): Observable<QueueEntry> {
    return this.http.post<QueueEntry>(`${this.apiUrl}/${gameId}/queue`, { memberId });
  }

  leaveQueue(gameId: number, entryId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${gameId}/queue/${entryId}`);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}