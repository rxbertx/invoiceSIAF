import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class InvoiceSequenceService {
    private apiUrl = '/api/invoice-sequences';

    constructor(private http: HttpClient) {}

    getAll(): Observable<any[]> {
        return this.http.get<any[]>(this.apiUrl);
    }

    create(item: any): Observable<any> {
        return this.http.post<any>(this.apiUrl, item);
    }

    update(id: string, item: any): Observable<any> {
        return this.http.put<any>(`${this.apiUrl}/${encodeURIComponent(id)}`, item);
    }

    delete(id: string): Observable<any> {
        return this.http.delete<any>(`${this.apiUrl}/${encodeURIComponent(id)}`);
    }
}
