import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';

const ALL_ITEMS = [
    {
        key: 'principal',
        label: 'Principal',
        icon: 'pi pi-fw pi-home',
        routerLink: ['/dashboard-banking']
    },
    {
        key: 'gestion-tableros',
        label: 'Gestión Proyectos',
        icon: 'pi pi-fw pi-list',
        routerLink: ['/apps/boards-kanban']
    },
    {
        key: 'kpi-proyectos',
        label: 'KPI Proyectos',
        icon: 'pi pi-fw pi-chart-bar',
        routerLink: ['/apps/kpi']
    },
    {
        key: 'configuraciones',
        label: 'Configuraciones',
        icon: 'pi pi-fw pi-cog',
        items: [
            {
                key: 'gestion-usuarios',
                label: 'Gestión Usuarios',
                icon: 'pi pi-fw pi-users',
                routerLink: ['/pages/user-management']
            },
            {
                key: 'admin-roles',
                label: 'Administrador de Roles',
                icon: 'pi pi-fw pi-shield',
                routerLink: ['/apps/rols']
            },
            {
                key: 'config-correo',
                label: 'Configuración Correo',
                icon: 'pi pi-fw pi-envelope',
                routerLink: ['/apps/smtp-config']
            }
        ]
    }
];

@Component({
    selector: 'app-menu',
    templateUrl: './app.menu.component.html'
})
export class AppMenuComponent implements OnInit {
    model: any[] = [];

    constructor(private http: HttpClient) {}

    ngOnInit() {
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
        const rol = currentUser?.role || '';

        // Admin siempre tiene acceso total sin consultar la API
        if (rol === 'ADMIN') {
            this.buildMenu(null);
            return;
        }

        this.http.get<any[]>('/api/rol-permissions').pipe(
            catchError(() => of([]))
        ).subscribe(perms => {
            const rolPerms = perms.find((p: any) => p.rol === rol);
            this.buildMenu(rolPerms?.permissions || {});
        });
    }

    private buildMenu(permissions: { [key: string]: boolean } | null) {
        // null = admin (acceso total), objeto = permisos guardados del rol
        // Un permiso aplica al item y, para menús con hijos, se filtran también los sub-items;
        // el padre solo se muestra si le queda al menos un hijo visible
        const allowed = (key: string) => permissions === null || permissions[key] === true;

        const items = ALL_ITEMS
            .map((item: any) => {
                if (!item.items) return allowed(item.key) ? item : null;
                const children = item.items.filter((child: any) => allowed(child.key));
                return children.length ? { ...item, items: children } : null;
            })
            .filter(Boolean);

        this.model = [
            {
                label: 'Menú',
                icon: 'pi pi-fw pi-bars',
                items
            }
        ];
    }
}
