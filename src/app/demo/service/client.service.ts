import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class ClientService {
    private apiUrl = '/api/clients';

    constructor(private http: HttpClient) {}

    getClients(): Observable<any[]> {
        return this.http.get<any[]>(this.apiUrl);
    }

    createClient(client: any): Observable<any> {
        return this.http.post<any>(this.apiUrl, client);
    }

    updateClient(id: string, client: any): Observable<any> {
        return this.http.put<any>(`${this.apiUrl}/${id}`, client);
    }

    deleteClient(id: string): Observable<any> {
        return this.http.delete<any>(`${this.apiUrl}/${id}`);
    }
}
