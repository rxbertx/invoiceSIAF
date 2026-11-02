import { Component, OnInit } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { DocumentTypeService } from 'src/app/demo/service/document-type.service';

@Component({
    selector: 'app-document-types',
    templateUrl: './document-types.component.html',
    providers: [MessageService, ConfirmationService]
})
export class DocumentTypesComponent implements OnInit {
    items: any[] = [];
    item: any = {};
    dialog = false;
    submitted = false;
    saving = false;
    loading = false;

    private readonly requiredFields = ['dteType', 'controlNumber', 'serial', 'version', 'documentCode', 'description'];

    constructor(
        private service: DocumentTypeService,
        private messageService: MessageService,
        private confirmationService: ConfirmationService
    ) {}

    ngOnInit() {
        this.load();
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
                this.showError('No se pudieron cargar los tipos de documento');
            }
        });
    }

    openNew() {
        this.item = { active: true, version: 1 };
        this.submitted = false;
        this.dialog = true;
    }

    edit(item: any) {
        this.item = { ...item };
        this.submitted = false;
        this.dialog = true;
    }

    isInvalid(field: string): boolean {
        return this.submitted && !String(this.item[field] ?? '').trim();
    }

    save() {
        this.submitted = true;
        if (this.requiredFields.some((f) => this.isInvalid(f))) {
            return;
        }

        this.saving = true;
        const isUpdate = !!this.item.id;
        const request = isUpdate ? this.service.update(this.item.id, this.item) : this.service.create(this.item);

        request.subscribe({
            next: () => {
                this.messageService.add({ severity: 'success', summary: 'Éxito', detail: isUpdate ? 'Tipo de documento actualizado' : 'Tipo de documento creado' });
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
            message: `¿Está seguro de que desea eliminar el tipo de documento "${item.description}"?`,
            header: 'Confirmar Eliminación',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.service.delete(item.id).subscribe({
                    next: () => {
                        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Registro eliminado' });
                        this.load();
                    },
                    error: (err) => this.showError(err?.error?.error || 'No se pudo eliminar el registro')
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
