import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Stats } from '../models/stats.model';

@Injectable({
  providedIn: 'root'
})
export class StatsService {
  private apiUrl = 'http://localhost:3000/api/stats';

  constructor(private http: HttpClient) {}

  get(): Observable<Stats> {
    return this.http.get<Stats>(this.apiUrl);
  }
}