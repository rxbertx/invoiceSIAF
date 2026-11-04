import { Component, OnInit } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ClientService } from 'src/app/demo/service/client.service';
import { GlobalCatalogService } from 'src/app/demo/service/global-catalog.service';

interface Option {
    label: string;
    value: string;
}

const normalize = (s: any) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();

@Component({
    selector: 'app-clients',
    templateUrl: './clients.component.html',
    providers: [MessageService, ConfirmationService]
})
export class ClientsComponent implements OnInit {
    clients: any[] = [];
    client: any = {};
    clientDialog = false;
    submitted = false;
    saving = false;
    loading = false;
    private businessNameLinkedToName = false;

    personTypes = ['Natural', 'Jurídica'];
    documentTypes = ['NIT', 'DUI', 'Pasaporte', 'Otros'];
    // Listas alimentadas por los catálogos configurados
    countries: any[] = [];
    departments: any[] = [];
    municipalities: any[] = [];
    establishmentTypes: Option[] = [];
    economicActivities: Option[] = [];

    private readonly requiredFields = [
        'name', 'businessName', 'personType', 'country', 'department', 'email', 'phone',
        'documentType', 'documentNumber', 'establishmentType', 'economicActivity'
    ];

    constructor(
        private clientService: ClientService,
        private catalogs: GlobalCatalogService,
        private messageService: MessageService,
        private confirmationService: ConfirmationService
    ) {}

    ngOnInit() {
        this.loadClients();
        this.catalogs.getItems('paises').subscribe({
            next: (rows) => {
                this.countries = rows.filter((r) => r.active);
                this.applyForeignLocationDefaults();
            },
            error: () => this.showError('No se pudo cargar el catálogo de países')
        });
        this.catalogs.getItems('departamentos').subscribe({
            next: (rows) => {
                this.departments = rows.filter((r) => r.active);
                this.applyForeignLocationDefaults();
            },
            error: () => this.showError('No se pudo cargar el catálogo de departamentos')
        });
        this.catalogs.getItems('municipios').subscribe({
            next: (rows) => {
                this.municipalities = rows.filter((r) => r.active);
                this.applyForeignLocationDefaults();
            },
            error: () => this.showError('No se pudo cargar el catálogo de municipios')
        });
        this.catalogs.getItems('tipo-establecimiento').subscribe({
            next: (rows) => (this.establishmentTypes = rows.filter((r) => r.active).map((r) => ({ label: r.description, value: r.description }))),
            error: () => this.showError('No se pudo cargar el catálogo de tipo de establecimiento')
        });
        this.catalogs.getItems('actividades-economicas').subscribe({
            next: (rows) => (this.economicActivities = rows.filter((r) => r.active).map((r) => ({ label: `${r.code} - ${r.description}`, value: r.code }))),
            error: () => this.showError('No se pudo cargar el catálogo de actividades económicas')
        });
    }

    // La razón social se sincroniza hasta que el usuario la edita manualmente.
    onNameChange(name: string) {
        if (this.businessNameLinkedToName) this.client.businessName = name;
    }

    onBusinessNameChange() {
        this.businessNameLinkedToName = false;
    }

    onTaxpayerChange() {
        if (this.client.isForeign) {
            this.client.isTaxpayer = false;
        }
        if (!this.client.isTaxpayer) this.client.ivaRegistration = '';
    }

    onForeignChange() {
        if (!this.client.isForeign) return;
        this.client.paysIva = false;
        this.client.isLargeTaxpayer = false;
        this.client.isTaxpayer = false;
        this.client.ivaRegistration = '';
    }

    get countryOptions(): Option[] {
        return this.withCurrent(this.countries.map((c) => ({ label: c.description, value: c.description })), 'country');
    }

    get departmentOptions(): Option[] {
        const options = this.isForeignCountry
            ? [{ label: this.foreignDepartment?.description ?? 'Otro (Para extranjeros)', value: this.foreignDepartment?.description ?? 'Otro (Para extranjeros)' }]
            : this.departments
                  .filter((d) => d.countryId === this.homeCountry?.id && !/^otro \(para\s+extranjeros\)$/i.test(d.description))
                  .map((d) => ({ label: `${d.code} - ${d.description}`, value: d.description }));
        return this.withCurrent(options, 'department');
    }

    get municipalityOptions(): Option[] {
        const country = this.countries.find((c) => c.description === this.client.country);
        if (this.isForeignCountry) {
            const foreignMunicipality = this.foreignMunicipality;
            return foreignMunicipality ? [{ label: foreignMunicipality.description, value: foreignMunicipality.id }] : [];
        }
        const dept = normalize(this.client.department);
        return this.municipalities
            .filter((m) => country && m.countryId === country.id)
            .filter((m) => !dept || normalize(m.description).startsWith(dept))
            .map((m) => ({ label: `${m.code} - ${m.description}`, value: m.id }));
    }

    get homeCountry(): any {
        return this.countries.find((c) => normalize(c.description) === 'EL SALVADOR');
    }

    get isForeignCountry(): boolean {
        return !!this.client.country && normalize(this.client.country) !== 'EL SALVADOR';
    }

    private get foreignDepartment(): any {
        return this.departments.find((d) => /^otro \(para\s+extranjeros\)$/i.test(d.description));
    }

    private get foreignMunicipality(): any {
        return this.municipalities.find((m) => /^otro \(para\s+extranjeros\)$/i.test(m.description));
    }

    get establishmentTypeOptions(): Option[] {
        return this.withCurrent(this.establishmentTypes, 'establishmentType');
    }

    get economicActivityOptions(): Option[] {
        return this.withCurrent(this.economicActivities, 'economicActivity');
    }

    // Conserva visible un valor guardado que ya no está en el catálogo activo
    private withCurrent(options: Option[], field: string): Option[] {
        const current = this.client[field];
        return current && !options.some((o) => o.value === current) ? [{ label: current, value: current }, ...options] : options;
    }

    onCountryOrDepartmentChange() {
        if (this.isForeignCountry) {
            this.applyForeignLocationDefaults();
            return;
        }
        if (this.client.municipalityId && !this.municipalityOptions.some((o) => o.value === this.client.municipalityId)) {
            this.client.municipalityId = null;
            this.client.municipality = '';
        }
    }

    onCountryChange() {
        if (this.isForeignCountry) {
            this.client.isForeign = true;
            this.onForeignChange();
            this.applyForeignLocationDefaults();
            this.applyForeignCatalogDefaults();
        } else {
            this.client.isForeign = false;
            if (/^otro \(para\s+extranjeros\)$/i.test(this.client.department || '')) this.client.department = '';
            this.client.municipalityId = null;
            this.client.municipality = '';
        }
        this.onCountryOrDepartmentChange();
    }

    private applyForeignLocationDefaults() {
        if (!this.isForeignCountry) return;
        this.client.department = this.foreignDepartment?.description ?? 'Otro (Para extranjeros)';
        const municipality = this.foreignMunicipality;
        this.client.municipalityId = municipality?.id ?? null;
        this.client.municipality = municipality?.description ?? 'Otro (Para extranjeros)';
    }

    private applyForeignCatalogDefaults(onlyEmpty = false) {
        if (!this.isForeignCountry) return;
        if (!onlyEmpty || !this.client.documentType) this.client.documentType = 'Otros';
        if (!onlyEmpty || !this.client.establishmentType) this.client.establishmentType = 'Casa matriz';
        if (!onlyEmpty || !this.client.economicActivity) this.client.economicActivity = '10005';
    }

    onMunicipalityChange() {
        const m = this.municipalities.find((x) => x.id === this.client.municipalityId);
        this.client.municipality = m?.description ?? '';
    }

    // Clientes anteriores guardaban texto libre: se enlaza por nombre sin distinguir mayúsculas ni tildes
    private alignLegacyValues(client: any) {
        const match = (options: string[], value: string) => options.find((o) => normalize(o) === normalize(value));
        client.country = match(this.countries.map((c) => c.description), client.country) ?? client.country;
        client.department = match(this.departments.map((d) => d.description), client.department) ?? client.department;
        client.establishmentType = match(this.establishmentTypes.map((o) => o.value), client.establishmentType) ?? client.establishmentType;
        if (!client.municipalityId && client.municipality) {
            const candidates = this.municipalities.filter((m) => normalize(m.description) === normalize(client.municipality));
            if (candidates.length === 1) client.municipalityId = candidates[0].id;
        }
        if (this.isForeignCountry || client.isForeign) {
            client.isForeign = true;
            this.onForeignChange();
            if (this.isForeignCountry) this.applyForeignLocationDefaults();
        }
    }

    loadClients() {
        this.loading = true;
        this.clientService.getClients().subscribe({
            next: (data) => {
                this.clients = data;
                this.loading = false;
            },
            error: () => {
                this.loading = false;
                this.showError('No se pudieron cargar los clientes');
            }
        });
    }

    openNew() {
        this.businessNameLinkedToName = true;
        this.client = {
            name: '',
            businessName: '',
            municipality: '',
            municipalityId: null,
            isActive: true,
            isForeign: false,
            isLargeTaxpayer: false,
            paysIva: true,
            isTaxpayer: false,
            ivaRegistration: ''
        };
        this.submitted = false;
        this.clientDialog = true;
    }

    editClient(client: any) {
        this.client = { ...client };
        this.businessNameLinkedToName = !this.client.businessName || this.client.businessName === this.client.name;
        this.alignLegacyValues(this.client);
        this.applyForeignCatalogDefaults(true);
        this.submitted = false;
        this.clientDialog = true;
    }

    isInvalid(field: string): boolean {
        const value = this.client[field];
        return this.submitted && (value === undefined || value === null || String(value).trim() === '');
    }

    saveClient() {
        this.submitted = true;
        if (this.isForeignCountry) this.applyForeignLocationDefaults();
        if (
            this.requiredFields.some((f) => this.isInvalid(f)) ||
            (this.isForeignCountry && this.isInvalid('municipalityId')) ||
            (this.client.isTaxpayer && this.isInvalid('ivaRegistration'))
        ) {
            return;
        }

        this.saving = true;
        const isUpdate = !!this.client.id;
        const request = isUpdate
            ? this.clientService.updateClient(this.client.id, this.client)
            : this.clientService.createClient(this.client);

        request.subscribe({
            next: () => {
                this.messageService.add({ severity: 'success', summary: 'Éxito', detail: isUpdate ? 'Cliente actualizado' : 'Cliente creado' });
                this.saving = false;
                this.clientDialog = false;
                this.loadClients();
            },
            error: () => {
                this.saving = false;
                this.showError('No se pudo guardar el cliente');
            }
        });
    }

    deleteClient(client: any) {
        this.confirmationService.confirm({
            message: `¿Está seguro de que desea eliminar al cliente "${client.name}"?`,
            header: 'Confirmar Eliminación',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.clientService.deleteClient(client.id).subscribe({
                    next: () => {
                        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Cliente eliminado' });
                        this.loadClients();
                    },
                    error: () => this.showError('No se pudo eliminar el cliente')
                });
            }
        });
    }

    hideDialog() {
        this.clientDialog = false;
        this.submitted = false;
    }

    private showError(detail: string) {
        this.messageService.add({ severity: 'error', summary: 'Error', detail });
    }
}
