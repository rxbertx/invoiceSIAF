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

  getBoards(): Observable<any[]> {
    return this.http.get<any[]>('/api/boards');
  }

  createBoard(board: any): Observable<any> {
    return this.http.post<any>('/api/boards', board);
  }

  updateBoard(id: string, board: any): Observable<any> {
    return this.http.put<any>(`/api/boards/${id}`, board);
  }

  deleteBoard(id: string): Observable<any> {
    return this.http.delete<any>(`/api/boards/${id}`);
  }

  getBoardsKanban(): Observable<any[]> {
    return this.http.get<any[]>('/api/boards-kanban');
  }

  createBoardKanban(board: any): Observable<any> {
    return this.http.post<any>('/api/boards-kanban', board);
  }

  updateBoardKanban(id: string, board: any): Observable<any> {
    return this.http.put<any>(`/api/boards-kanban/${id}`, board);
  }

  deleteBoardKanban(id: string): Observable<any> {
    return this.http.delete<any>(`/api/boards-kanban/${id}`);
  }

  login(credentials: any): Observable<any> {
    return this.http.post<any>('/api/login', credentials);
  }

  logout() {
    localStorage.removeItem('currentUser');
    this.router.navigate(['/auth/login']);
  }
}