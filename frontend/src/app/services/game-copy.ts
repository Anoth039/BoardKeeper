import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { GameCopy } from '../models/game.model';

@Injectable({
  providedIn: 'root'
})
export class GameCopyService {
  private apiUrl = 'http://localhost:3000/api/game-copies';

  constructor(private http: HttpClient) {}

  create(copy: { gameId: number; condition: string; copyNumber?: string }): Observable<GameCopy> {
    return this.http.post<GameCopy>(this.apiUrl, copy);
  }

  update(id: number, copy: Partial<GameCopy>): Observable<GameCopy> {
    return this.http.put<GameCopy>(`${this.apiUrl}/${id}`, copy);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}