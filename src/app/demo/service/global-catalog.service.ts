import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface CatalogField {
    key: string;
    label: string;
    type: 'number' | 'boolean' | 'country';
    required?: boolean;
}

export interface CatalogConfig {
    key: string;
    label: string;
    icon: string;
    descriptionLabel?: string;
    fields?: CatalogField[];
}

export const GLOBAL_CATALOGS: CatalogConfig[] = [
    { key: 'forma-pago', label: 'Forma de pago', icon: 'pi pi-fw pi-wallet' },
    {
        key: 'paises',
        label: 'Países',
        icon: 'pi pi-fw pi-globe',
        descriptionLabel: 'Nombre país',
        fields: [
            { key: 'countryNumber', label: 'Código país', type: 'number', required: true },
            { key: 'isCentralAmerican', label: 'Es centroamericano', type: 'boolean' }
        ]
    },
    {
        key: 'departamentos',
        label: 'Departamentos',
        icon: 'pi pi-fw pi-map',
        fields: [
            { key: 'departmentNumber', label: 'Código departamento', type: 'number', required: true },
            { key: 'countryId', label: 'País', type: 'country', required: true }
        ]
    },
    {
        key: 'municipios',
        label: 'Municipios',
        icon: 'pi pi-fw pi-map-marker',
        fields: [{ key: 'countryId', label: 'País', type: 'country' }]
    },
    { key: 'recinto-fiscal', label: 'Recinto Fiscal', icon: 'pi pi-fw pi-building' },
    { key: 'regimen', label: 'Régimen', icon: 'pi pi-fw pi-book' },
    { key: 'tipo-establecimiento', label: 'Tipo de establecimiento', icon: 'pi pi-fw pi-home' },
    { key: 'tipo-item', label: 'Tipo de item', icon: 'pi pi-fw pi-tag' },
    { key: 'unidades-medida', label: 'Unidades de medida', icon: 'pi pi-fw pi-sliders-h' },
    { key: 'actividades-economicas', label: 'Actividades económicas', icon: 'pi pi-fw pi-briefcase' }
];

// Opciones de menú exclusivas del rol ADMIN (catálogos globales y tipos de documento)
export const isAdminOnlyKey = (key: string): boolean => key === 'admin-documentos' || key.startsWith('cat-');

@Injectable({
    providedIn: 'root'
})
export class GlobalCatalogService {
    private apiUrl = '/api/global-catalogs';

    constructor(private http: HttpClient) {}

    getItems(catalog: string): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/${catalog}`);
    }

    createItem(catalog: string, item: any): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/${catalog}`, item);
    }

    updateItem(catalog: string, id: string, item: any): Observable<any> {
        return this.http.put<any>(`${this.apiUrl}/${catalog}/${id}`, item);
    }

    deleteItem(catalog: string, id: string): Observable<any> {
        return this.http.delete<any>(`${this.apiUrl}/${catalog}/${id}`);
    }
}
