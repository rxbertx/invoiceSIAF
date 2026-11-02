import { Component, OnInit } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { InvoiceSequenceService } from 'src/app/demo/service/invoice-sequence.service';
import { DocumentTypeService } from 'src/app/demo/service/document-type.service';

@Component({
    selector: 'app-invoice-sequences',
    templateUrl: './invoice-sequences.component.html',
    providers: [MessageService, ConfirmationService]
})
export class InvoiceSequencesComponent implements OnInit {
    items: any[] = [];
    documentTypes: any[] = [];
    item: any = {};
    isNew = false;
    dialog = false;
    submitted = false;
    saving = false;
    loading = false;

    constructor(
        private service: InvoiceSequenceService,
        private documentTypeService: DocumentTypeService,
        private messageService: MessageService,
        private confirmationService: ConfirmationService
    ) {}

    ngOnInit() {
        this.load();
        this.documentTypeService.getAll().subscribe({
            next: (rows) => (this.documentTypes = rows.filter((r) => r.active).map((r) => ({ label: r.description, value: r.id, code: r.documentCode }))),
            error: () => this.showError('No se pudieron cargar los tipos de documento')
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
                this.showError('No se pudieron cargar los correlativos');
            }
        });
    }

    openNew() {
        this.item = { documentTypeId: null, prefix: '', year: new Date().getFullYear(), lastNumber: 0, active: true };
        this.isNew = true;
        this.submitted = false;
        this.dialog = true;
    }

    edit(item: any) {
        this.item = { ...item };
        this.isNew = false;
        this.submitted = false;
        this.dialog = true;
    }

    onTypeChange() {
        this.item.prefix = this.documentTypes.find((t) => t.value === this.item.documentTypeId)?.code ?? '';
    }

    get nextPreview(): string {
        const last = Number(this.item.lastNumber) || 0;
        return `${this.item.prefix ?? ''}-${this.item.year ?? ''}${String(last + 1).padStart(6, '0')}`;
    }

    save() {
        this.submitted = true;
        if (!this.item.year || !this.item.documentTypeId || !String(this.item.prefix ?? '').trim() || this.item.lastNumber === null || this.item.lastNumber === undefined) {
            return;
        }

        this.saving = true;
        const request = this.isNew
            ? this.service.create(this.item)
            : this.service.update(this.item.id, { lastNumber: this.item.lastNumber, active: this.item.active });

        request.subscribe({
            next: () => {
                this.messageService.add({ severity: 'success', summary: 'Éxito', detail: this.isNew ? 'Correlativo creado' : 'Correlativo actualizado' });
                this.saving = false;
                this.dialog = false;
                this.load();
            },
            error: (err) => {
                this.saving = false;
                this.showError(err?.error?.error || 'No se pudo guardar el correlativo');
            }
        });
    }

    remove(item: any) {
        this.confirmationService.confirm({
            message: `¿Está seguro de que desea eliminar el correlativo de ${item.documentType} del año ${item.year}?`,
            header: 'Confirmar Eliminación',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.service.delete(item.id).subscribe({
                    next: () => {
                        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Correlativo eliminado' });
                        this.load();
                    },
                    error: (err) => this.showError(err?.error?.error || 'No se pudo eliminar el correlativo')
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
