import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {

  constructor(private http: HttpClient, private router: Router) { }

  getEventos(): Observable<any[]> {
    return this.http.get<any[]>('/api/eventos');
  }

  login(credentials: any): Observable<any> {
    return this.http.post<any>('/api/login', credentials);
  }

  logout() {
    localStorage.removeItem('currentUser');
    this.router.navigate(['/auth/login']);
  }
}