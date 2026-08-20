import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SystemUser } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  private apiUrl = 'http://localhost:3000/api/users';

  constructor(private http: HttpClient) {}

  getAll(): Observable<SystemUser[]> {
    return this.http.get<SystemUser[]>(this.apiUrl);
  }

  toggleApproval(id: number): Observable<SystemUser> {
    return this.http.patch<SystemUser>(`${this.apiUrl}/${id}/toggle-approval`, {});
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}