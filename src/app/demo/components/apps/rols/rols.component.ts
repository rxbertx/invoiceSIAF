import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { GLOBAL_CATALOGS } from 'src/app/demo/service/global-catalog.service';

interface MenuOption {
    key: string;
    label: string;
    icon: string;
}

interface RolRow {
    rol: string;
    label: string;
    permissions: { [key: string]: boolean };
    editing: boolean;
}

@Component({
    selector: 'app-rols',
    templateUrl: './rols.component.html',
    providers: [MessageService]
})
export class RolsComponent implements OnInit {

    menuOptions: MenuOption[] = [
        { key: 'principal',          label: 'Principal',               icon: 'pi pi-home' },
        { key: 'gestion-tableros',   label: 'Gestión de Tableros',     icon: 'pi pi-list' },
        { key: 'gestion-usuarios',   label: 'Gestión de Usuarios',     icon: 'pi pi-users' },
        { key: 'kpi-proyectos',      label: 'KPI Proyectos',           icon: 'pi pi-chart-bar' },
        { key: 'clientes',           label: 'Clientes',                icon: 'pi pi-id-card' },
        { key: 'facturacion',        label: 'Facturación',             icon: 'pi pi-file-edit' },
        { key: 'admin-roles',        label: 'Administrador de Roles',  icon: 'pi pi-shield' },
        { key: 'admin-correlativos', label: 'Administrador de Correlativos', icon: 'pi pi-sort-numeric-up' },
        { key: 'admin-documentos',   label: 'Catálogo FE: Documentos', icon: 'pi pi-file' },
        { key: 'config-correo',      label: 'Configuración Correo',    icon: 'pi pi-envelope' },
        { key: 'configuraciones',    label: 'Configuraciones',         icon: 'pi pi-cog' },
        { key: 'cat-parametros-generales', label: 'Catálogo FE: Parámetros Generales', icon: 'pi pi-database' },
        ...GLOBAL_CATALOGS.map((c) => ({ key: `cat-${c.key}`, label: `Catálogo FE: ${c.label}`, icon: 'pi pi-database' }))
    ];

    roles: RolRow[] = [
        { rol: 'ADMIN',       label: 'Administrador', permissions: {}, editing: false },
        { rol: 'COORDINADOR', label: 'Coordinador',   permissions: {}, editing: false },
        { rol: 'OPERATIVO',   label: 'Operativo',     permissions: {}, editing: false },
        { rol: 'VIEWER',      label: 'Visualizador',  permissions: {}, editing: false }
    ];

    loading = false;
    saving = false;

    readonly ROL_COLORS: { [key: string]: string } = {
        ADMIN:       '#6366f1',
        COORDINADOR: '#f59e0b',
        OPERATIVO:   '#10b981',
        VIEWER:      '#06b6d4'
    };

    constructor(private http: HttpClient, private messageService: MessageService) {}

    ngOnInit() {
        this.initDefaults();
        this.loadPermissions();
    }

    private initDefaults() {
        for (const row of this.roles) {
            for (const opt of this.menuOptions) {
                // Admin tiene todo por defecto
                row.permissions[opt.key] = row.rol === 'ADMIN';
            }
        }
    }

    loadPermissions() {
        this.loading = true;
        this.http.get<any[]>('/api/rol-permissions').subscribe({
            next: (data) => {
                if (data && data.length) {
                    for (const saved of data) {
                        const row = this.roles.find(r => r.rol === saved.rol);
                        if (row) row.permissions = { ...row.permissions, ...saved.permissions };
                    }
                }
                this.loading = false;
            },
            error: () => this.loading = false
        });
    }

    toggleEdit(row: RolRow) {
        row.editing = !row.editing;
    }

    saveRow(row: RolRow) {
        this.saving = true;
        this.http.put('/api/rol-permissions', { rol: row.rol, permissions: row.permissions }).subscribe({
            next: () => {
                row.editing = false;
                this.saving = false;
                this.messageService.add({ severity: 'success', summary: 'Guardado', detail: `Permisos de ${row.label} actualizados` });
            },
            error: () => {
                this.saving = false;
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron guardar los permisos' });
            }
        });
    }

    cancelEdit(row: RolRow) {
        row.editing = false;
        this.loadPermissions();
    }

    getRolColor(rol: string): string {
        return this.ROL_COLORS[rol] || '#64748b';
    }

    allEnabled(row: RolRow): boolean {
        return this.menuOptions.every(o => row.permissions[o.key]);
    }

    toggleAll(row: RolRow, value: boolean) {
        for (const opt of this.menuOptions) {
            row.permissions[opt.key] = value;
        }
    }

    countEnabled(row: RolRow): number {
        return this.menuOptions.filter(o => row.permissions[o.key]).length;
    }
}
