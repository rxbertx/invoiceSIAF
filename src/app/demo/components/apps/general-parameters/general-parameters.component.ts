import { Component, OnInit } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { GeneralParameterService } from 'src/app/demo/service/general-parameter.service';
import { GlobalCatalogService } from 'src/app/demo/service/global-catalog.service';

interface Option {
    label: string;
    value: string;
}

@Component({
    selector: 'app-general-parameters',
    templateUrl: './general-parameters.component.html',
    providers: [MessageService, ConfirmationService]
})
export class GeneralParametersComponent implements OnInit {
    items: any[] = [];
    item: any = {};
    dialog = false;
    submitted = false;
    saving = false;
    loading = false;
    activeTab = 0;

    establishmentTypes: Option[] = [];
    economicActivities: Option[] = [];
    municipalities: any[] = [];
    departments: Option[] = [
        'AHUACHAPAN', 'SANTA ANA', 'SONSONATE', 'CHALATENANGO', 'LA LIBERTAD', 'SAN SALVADOR', 'CUSCATLAN',
        'LA PAZ', 'CABAÑAS', 'SAN VICENTE', 'USULUTAN', 'SAN MIGUEL', 'MORAZAN', 'LA UNION'
    ].map((d) => ({ label: d, value: d }));
    environments: Option[] = [
        { label: '00 - Pruebas', value: '00' },
        { label: '01 - Producción', value: '01' }
    ];

    private readonly requiredFields = [
        'companyName', 'nit', 'registration', 'address', 'establishmentType',
        'phone', 'email', 'economicActivity', 'department', 'municipalityId'
    ];

    constructor(
        private service: GeneralParameterService,
        private catalogs: GlobalCatalogService,
        private messageService: MessageService,
        private confirmationService: ConfirmationService
    ) {}

    ngOnInit() {
        this.load();
        this.loadCatalog('tipo-establecimiento', (o) => (this.establishmentTypes = o));
        this.loadCatalog('actividades-economicas', (o) => (this.economicActivities = o));
        this.catalogs.getItems('municipios').subscribe({
            next: (rows) => (this.municipalities = rows.filter((r) => r.active)),
            error: () => this.showError('No se pudo cargar un catálogo necesario')
        });
    }

    // El nombre del municipio inicia con su departamento; los códigos se repiten entre departamentos
    get municipalityOptions(): Option[] {
        const dept = String(this.item.department ?? '').toUpperCase();
        return this.municipalities
            .filter((m) => !dept || String(m.description).toUpperCase().startsWith(dept))
            .map((m) => ({ label: `${m.code} - ${m.description}`, value: m.id }));
    }

    onDepartmentChange() {
        const selected = this.municipalities.find((m) => m.id === this.item.municipalityId);
        if (selected && !String(selected.description).toUpperCase().startsWith(String(this.item.department).toUpperCase())) {
            this.item.municipalityId = null;
        }
    }

    private loadCatalog(key: string, assign: (options: Option[]) => void) {
        this.catalogs.getItems(key).subscribe({
            next: (rows) => assign(rows.filter((r) => r.active).map((r) => ({ label: `${r.code} - ${r.description}`, value: r.code }))),
            error: () => this.showError('No se pudo cargar un catálogo necesario')
        });
    }

    load() {
        this.loading = true;
        this.service.getAll().subscribe({
            next: (data) => {
                this.items = data;
                this.loading = false;
            },
            error: () => {
                this.loading = false;
                this.showError('No se pudieron cargar los parámetros generales');
            }
        });
    }

    labelOf(options: Option[], value: string): string {
        return options.find((o) => o.value === value)?.label ?? value ?? '';
    }

    openNew() {
        this.item = { environment: '01', mailPort: 587, mailEnableSsl: true };
        this.openDialog();
    }

    edit(item: any) {
        this.item = { ...item };
        this.openDialog();
    }

    private openDialog() {
        this.submitted = false;
        this.activeTab = 0;
        this.dialog = true;
    }

    isInvalid(field: string): boolean {
        return this.submitted && !String(this.item[field] ?? '').trim();
    }

    save() {
        this.submitted = true;
        if (this.requiredFields.some((f) => this.isInvalid(f))) {
            this.activeTab = 0;
            return;
        }

        this.saving = true;
        const isUpdate = !!this.item.id;
        const request = isUpdate ? this.service.update(this.item.id, this.item) : this.service.create(this.item);

        request.subscribe({
            next: () => {
                this.messageService.add({ severity: 'success', summary: 'Éxito', detail: isUpdate ? 'Parámetros actualizados' : 'Parámetros creados' });
                this.saving = false;
                this.dialog = false;
                this.load();
            },
            error: (err) => {
                this.saving = false;
                this.showError(err?.error?.error || 'No se pudo guardar el registro');
            }
        });
    }

    remove(item: any) {
        this.confirmationService.confirm({
            message: `¿Está seguro de que desea eliminar la empresa "${item.companyName}"?`,
            header: 'Confirmar Eliminación',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.service.delete(item.id).subscribe({
                    next: () => {
                        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Registro eliminado' });
                        this.load();
                    },
                    error: () => this.showError('No se pudo eliminar el registro')
                });
            }
        });
    }

    hideDialog() {
        this.dialog = false;
        this.submitted = false;
    }

    private showError(detail: string) {
        this.messageService.add({ severity: 'error', summary: 'Error', detail });
    }
}
