import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class UserManagementService {
    private apiUrl = '/api/users';

    constructor(private http: HttpClient) {}

    getUsers(): Observable<any[]> {
        return this.http.get<any[]>(this.apiUrl);
    }

    createUser(user: any): Observable<any> {
        return this.http.post<any>(this.apiUrl, user);
    }

    updateUser(id: string, user: any): Observable<any> {
        return this.http.put<any>(`${this.apiUrl}/${id}`, user);
    }

    deleteUser(id: string): Observable<any> {
        return this.http.delete<any>(`${this.apiUrl}/${id}`);
    }
}