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

    validate(id: string): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/${id}/validate`, {});
    }

    unvalidate(id: string): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/${id}/unvalidate`, {});
    }

    delete(id: string): Observable<any> {
        return this.http.delete<any>(`${this.apiUrl}/${id}`);
    }

    getApplicable(id: string, scope: string, from?: string, to?: string): Observable<any[]> {
        const params: Record<string, string> = { scope };
        if (from) params['from'] = from;
        if (to) params['to'] = to;
        return this.http.get<any[]>(`${this.apiUrl}/${id}/applicable`, { params });
    }

    getApplications(id: string): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/${id}/applications`);
    }

    saveApplications(id: string, applications: any[], unit: string, unitName: string): Observable<any[]> {
        return this.http.put<any[]>(`${this.apiUrl}/${id}/applications`, { applications, unit, unitName });
    }

    queryApplications(filters: Record<string, string>): Observable<any[]> {
        return this.http.get<any[]>('/api/invoice-applications', { params: filters });
    }
}
