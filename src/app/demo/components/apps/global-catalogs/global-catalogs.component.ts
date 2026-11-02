import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ConfirmationService, MessageService } from 'primeng/api';
import { GLOBAL_CATALOGS, CatalogConfig, CatalogField, GlobalCatalogService } from 'src/app/demo/service/global-catalog.service';

@Component({
    selector: 'app-global-catalogs',
    templateUrl: './global-catalogs.component.html',
    providers: [MessageService, ConfirmationService]
})
export class GlobalCatalogsComponent implements OnInit, OnDestroy {
    catalogKey = '';
    catalogLabel = '';
    descriptionLabel = 'Descripción';
    extraFields: CatalogField[] = [];
    countryOptions: { label: string; value: string }[] = [];
    items: any[] = [];
    item: any = {};
    itemDialog = false;
    submitted = false;
    saving = false;
    loading = false;

    private sub?: Subscription;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private catalogService: GlobalCatalogService,
        private messageService: MessageService,
        private confirmationService: ConfirmationService
    ) {}

    ngOnInit() {
        this.sub = this.route.paramMap.subscribe((params) => {
            const catalog = GLOBAL_CATALOGS.find((c) => c.key === params.get('catalog'));
            if (!catalog) {
                this.router.navigate(['/notfound']);
                return;
            }
            this.applyCatalog(catalog);
            this.itemDialog = false;
            this.loadItems();
        });
    }

    private applyCatalog(catalog: CatalogConfig) {
        this.catalogKey = catalog.key;
        this.catalogLabel = catalog.label;
        this.descriptionLabel = catalog.descriptionLabel ?? 'Descripción';
        this.extraFields = catalog.fields ?? [];
        this.countryOptions = [];
        if (this.extraFields.some((f) => f.type === 'country')) {
            const key = catalog.key;
            this.catalogService.getItems('paises').subscribe({
                next: (rows) => {
                    if (key !== this.catalogKey) return;
                    this.countryOptions = rows.filter((r) => r.active).map((r) => ({ label: r.description, value: r.id }));
                },
                error: () => this.showError('No se pudo cargar el catálogo de países')
            });
        }
    }

    countryName(id: string | null): string {
        return this.countryOptions.find((o) => o.value === id)?.label ?? '';
    }

    ngOnDestroy() {
        this.sub?.unsubscribe();
    }

    loadItems() {
        const key = this.catalogKey;
        this.items = [];
        this.loading = true;
        this.catalogService.getItems(key).subscribe({
            next: (data) => {
                // Ignora respuestas de un catálogo anterior si el usuario ya cambió de vista
                if (key !== this.catalogKey) return;
                this.items = data;
                this.loading = false;
            },
            error: () => {
                if (key !== this.catalogKey) return;
                this.loading = false;
                this.showError('No se pudo cargar el catálogo');
            }
        });
    }

    openNew() {
        this.item = { active: true };
        for (const f of this.extraFields) {
            if (f.type === 'boolean') this.item[f.key] = false;
            else if (f.type === 'country') this.item[f.key] = null;
        }
        this.submitted = false;
        this.itemDialog = true;
    }

    editItem(item: any) {
        this.item = { ...item };
        this.submitted = false;
        this.itemDialog = true;
    }

    isInvalid(field: string): boolean {
        return this.submitted && !String(this.item[field] ?? '').trim();
    }

    private hasInvalidFields(): boolean {
        return this.isInvalid('code') || this.isInvalid('description') || this.extraFields.some((f) => f.required && this.isInvalid(f.key));
    }

    saveItem() {
        this.submitted = true;
        if (this.hasInvalidFields()) {
            return;
        }

        this.saving = true;
        const isUpdate = !!this.item.id;
        const request = isUpdate
            ? this.catalogService.updateItem(this.catalogKey, this.item.id, this.item)
            : this.catalogService.createItem(this.catalogKey, this.item);

        request.subscribe({
            next: () => {
                this.messageService.add({ severity: 'success', summary: 'Éxito', detail: isUpdate ? 'Registro actualizado' : 'Registro creado' });
                this.saving = false;
                this.itemDialog = false;
                this.loadItems();
            },
            error: (err) => {
                this.saving = false;
                this.showError(err?.error?.error || 'No se pudo guardar el registro');
            }
        });
    }

    deleteItem(item: any) {
        this.confirmationService.confirm({
            message: `¿Está seguro de que desea eliminar "${item.description}"?`,
            header: 'Confirmar Eliminación',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.catalogService.deleteItem(this.catalogKey, item.id).subscribe({
                    next: () => {
                        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Registro eliminado' });
                        this.loadItems();
                    },
                    error: (err) => this.showError(err?.error?.error || 'No se pudo eliminar el registro')
                });
            }
        });
    }

    hideDialog() {
        this.itemDialog = false;
        this.submitted = false;
    }

    private showError(detail: string) {
        this.messageService.add({ severity: 'error', summary: 'Error', detail });
    }
}
