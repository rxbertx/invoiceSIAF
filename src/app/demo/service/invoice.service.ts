import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class InvoiceService {
    private apiUrl = '/api/invoices';

    constructor(private http: HttpClient) {}

    getAll(): Observable<any[]> {
        return this.http.get<any[]>(this.apiUrl);
    }

    getById(id: string): Observable<any> {
        return this.http.get<any>(`${this.apiUrl}/${id}`);
    }

    create(invoice: any): Observable<any> {
        return this.http.post<any>(this.apiUrl, invoice);
    }

    update(id: string, invoice: any): Observable<any> {
        return this.http.put<any>(`${this.apiUrl}/${id}`, invoice);
    }

    annul(id: string): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/${id}/annul`, {});
    }

    delete(id: string): Observable<any> {
        return this.http.delete<any>(`${this.apiUrl}/${id}`);
    }
}
