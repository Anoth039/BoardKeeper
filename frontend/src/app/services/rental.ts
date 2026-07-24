import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Rental } from '../models/rental.model';

@Injectable({
  providedIn: 'root'
})
export class RentalService {
  private apiUrl = 'http://localhost:3000/api/rentals';

  constructor(private http: HttpClient) {}

  getAll(): Observable<Rental[]> {
    return this.http.get<Rental[]>(this.apiUrl);
  }

  create(rental: { memberId: number; gameCopyId: number; rentalDate: string; dueDate: string }): Observable<Rental> {
    return this.http.post<Rental>(this.apiUrl, rental);
  }

  return(rentalId: number): Observable<Rental> {
    return this.http.put<Rental>(`${this.apiUrl}/${rentalId}/return`, {});
  }
}