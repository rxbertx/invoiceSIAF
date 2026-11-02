import { Component, OnInit } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ClientService } from 'src/app/demo/service/client.service';
import { DocumentTypeService } from 'src/app/demo/service/document-type.service';
import { GlobalCatalogService } from 'src/app/demo/service/global-catalog.service';
import { InvoiceService } from 'src/app/demo/service/invoice.service';

interface Option {
    label: string;
    value: string;
}

// Deben coincidir con las reglas de invoices.js (el servidor recalcula al guardar)
const IVA_RATE = 0.13;
const RETENTION_RATE = 0.01;
const RETENTION_MIN_BASE = 100;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const pad = (n: number) => String(n).padStart(2, '0');
const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromDateStr = (s: string) => {
    const [y, m, d] = s.substring(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
};

@Component({
    selector: 'app-invoicing',
    templateUrl: './invoicing.component.html',
    providers: [MessageService, ConfirmationService]
})
export class InvoicingComponent implements OnInit {
    view: 'list' | 'edit' = 'list';
    activeTab = 0;
    loading = false;
    saving = false;
    submitted = false;

    invoices: any[] = [];
    invoice: any = {};
    lines: any[] = [];
    totals = { ventaTotal: 0, iva: 0, subTotal: 0, ivaRetention: 0, total: 0 };

    lineForm: any = {};
    selectedLine: any = null;
    useDefaultUnit = true;

    clients: any[] = [];
    clientOptions: Option[] = [];
    unitOptions: Option[] = [];
    conceptOptions: Option[] = [];
    defaultUnit = '';

    documentTypeList: any[] = [];
    documentTypes: Option[] = [];

    constructor(
        private invoiceService: InvoiceService,
        private clientService: ClientService,
        private documentTypeService: DocumentTypeService,
        private catalogs: GlobalCatalogService,
        private messageService: MessageService,
        private confirmationService: ConfirmationService
    ) {}

    ngOnInit() {
        this.load();
        this.documentTypeService.getAll().subscribe({
            next: (rows) => {
                this.documentTypeList = rows;
                this.documentTypes = rows.filter((d) => d.active).map((d) => ({ label: d.description, value: d.id }));
            },
            error: () => this.showError('No se pudieron cargar los tipos de documento')
        });
        this.clientService.getClients().subscribe({
            next: (data) => {
                this.clients = data.filter((c) => c.isActive);
                this.clientOptions = this.clients.map((c) => ({ label: c.name, value: c.id }));
            },
            error: () => this.showError('No se pudieron cargar los clientes')
        });
        this.catalogs.getItems('unidades-medida').subscribe({
            next: (rows) => {
                const active = rows.filter((r) => r.active);
                this.unitOptions = active.map((r) => ({ label: r.description, value: r.code }));
                this.defaultUnit = active.find((r) => r.description.toLowerCase() === 'otra')?.code ?? '';
            },
            error: () => this.showError('No se pudo cargar el catálogo de unidades de medida')
        });
    }

    get readonly(): boolean {
        return this.invoice.status === 'ANULADA';
    }

    get isSaved(): boolean {
        return !!this.invoice.id;
    }

    get selectedClient(): any {
        return this.clients.find((c) => c.id === this.invoice.clientId);
    }

    get selectedDocumentType(): any {
        return this.documentTypeList.find((d) => d.id === this.invoice.documentTypeId);
    }

    get defaultDocumentTypeId(): string | null {
        const active = this.documentTypeList.filter((d) => d.active);
        return (active.find((d) => d.dteType === '03') ?? active[0])?.id ?? null;
    }

    get retentionAgent(): boolean {
        return !!this.selectedClient?.isLargeTaxpayer && this.selectedDocumentType?.dteType === '03';
    }

    // Vista previa de la línea en edición, calculada con las mismas reglas que el resto de la factura
    get linePreview(): { value: number; iva: number; ivaRetention: number } {
        const candidate = { ...this.lineForm };
        const others = this.lines.filter((l) => l !== this.selectedLine);
        const calculated = this.calculate([...others, candidate]);
        const last = calculated.lines[calculated.lines.length - 1];
        return { value: last.value + last.exemptValue, iva: last.iva, ivaRetention: last.ivaRetention };
    }

    load() {
        this.loading = true;
        this.invoiceService.getAll().subscribe({
            next: (data) => {
                this.invoices = data;
                this.loading = false;
            },
            error: () => {
                this.loading = false;
                this.showError('No se pudieron cargar las facturas');
            }
        });
    }

    newInvoice() {
        this.invoice = {
            documentDate: new Date(),
            documentTypeId: this.defaultDocumentTypeId,
            isExternalSale: false
        };
        this.lines = [];
        this.openEditor();
    }

    openInvoice(row: any) {
        this.invoiceService.getById(row.id).subscribe({
            next: (data) => {
                this.setInvoice(data);
                this.openEditor();
            },
            error: () => this.showError('No se pudo cargar la factura')
        });
    }

    private setInvoice(data: any) {
        const { lines, ...header } = data;
        this.invoice = { ...header, documentDate: fromDateStr(header.documentDate) };
        // Facturas anteriores al administrador solo tienen el texto del tipo
        if (!this.invoice.documentTypeId) {
            this.invoice.documentTypeId = this.documentTypeList.find((d) => d.description === header.documentType)?.id ?? null;
        }
        this.lines = lines || [];
        this.recalculate();
    }

    private openEditor() {
        this.submitted = false;
        this.activeTab = 0;
        this.resetLineForm();
        this.recalculate();
        this.view = 'edit';
    }

    undo() {
        if (this.isSaved) {
            this.openInvoice(this.invoice);
        } else {
            this.newInvoice();
        }
    }

    exit() {
        this.view = 'list';
        this.load();
    }

    // ----- Encabezado -----
    onClientChange() {
        const client = this.selectedClient;
        this.invoice.billToName = client?.name ?? '';
        this.invoice.accountingDescription = client?.name ?? '';
        this.recalculate();
    }

    isInvalid(field: string): boolean {
        const value = this.invoice[field];
        return this.submitted && (value === undefined || value === null || String(value).trim() === '');
    }

    goToDetail() {
        this.submitted = true;
        if (this.headerIncomplete()) {
            return;
        }
        this.activeTab = 1;
    }

    private headerIncomplete(): boolean {
        const required = ['documentDate', 'documentTypeId', 'clientId', 'billToName'];
        return required.some((f) => this.isInvalid(f));
    }

    // ----- Detalle -----
    resetLineForm() {
        this.useDefaultUnit = true;
        this.selectedLine = null;
        this.lineForm = {
            unit: this.defaultUnit,
            description: '',
            quantity: 1,
            unitPrice: 0,
            exempt: false,
            valueWithIva: false
        };
    }

    onDefaultUnitChange() {
        if (this.useDefaultUnit) this.lineForm.unit = this.defaultUnit;
    }

    selectLine(line: any) {
        if (this.readonly) return;
        this.lineForm = { ...line };
        this.useDefaultUnit = !!this.defaultUnit && line.unit === this.defaultUnit;
    }

    private buildLine(): any | null {
        const f = this.lineForm;
        if (!f.description?.trim() || !f.unit || !(f.quantity > 0) || f.unitPrice === null || f.unitPrice < 0) {
            this.showError('Complete detalle, unidad, cantidad (mayor a 0) y precio unitario');
            return null;
        }
        return {
            description: f.description.trim(),
            unit: f.unit,
            unitName: this.unitOptions.find((o) => o.value === f.unit)?.label ?? '',
            quantity: f.quantity,
            unitPrice: f.unitPrice,
            exempt: !!f.exempt,
            valueWithIva: !!f.valueWithIva
        };
    }

    addLine() {
        const line = this.buildLine();
        if (!line) return;
        this.lines = [...this.lines, line];
        this.recalculate();
        this.resetLineForm();
    }

    modifyLine() {
        const line = this.buildLine();
        const index = this.lines.indexOf(this.selectedLine);
        if (!line || index < 0) return;
        this.lines = this.lines.map((l, i) => (i === index ? line : l));
        this.recalculate();
        this.resetLineForm();
    }

    removeLine() {
        this.lines = this.lines.filter((l) => l !== this.selectedLine);
        this.recalculate();
        this.resetLineForm();
    }

    private calculate(lines: any[]) {
        const calculated = lines.map((l) => {
            const gross = (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0);
            const exempt = !!l.exempt;
            const base = exempt || !l.valueWithIva ? gross : gross / (1 + IVA_RATE);
            const iva = exempt ? 0 : l.valueWithIva ? gross - base : base * IVA_RATE;
            return { ...l, value: exempt ? 0 : round2(base), exemptValue: exempt ? round2(base) : 0, iva: round2(iva), ivaRetention: 0 };
        });
        const taxable = calculated.reduce((s, l) => s + l.value, 0);
        if (this.retentionAgent && taxable >= RETENTION_MIN_BASE) {
            for (const l of calculated) l.ivaRetention = round2(l.value * RETENTION_RATE);
        }
        const sum = (field: string) => round2(calculated.reduce((s, l) => s + l[field], 0));
        const ventaTotal = round2(sum('value') + sum('exemptValue'));
        const iva = sum('iva');
        const ivaRetention = sum('ivaRetention');
        const subTotal = round2(ventaTotal + iva);
        return { lines: calculated, totals: { ventaTotal, iva, subTotal, ivaRetention, total: round2(subTotal - ivaRetention) } };
    }

    recalculate() {
        const result = this.calculate(this.lines);
        this.lines = result.lines;
        this.totals = result.totals;
        this.selectedLine = null;
    }

    // ----- Persistencia -----
    save() {
        this.submitted = true;
        if (this.headerIncomplete()) {
            this.activeTab = 0;
            return;
        }

        const payload = {
            ...this.invoice,
            documentDate: toDateStr(this.invoice.documentDate),
            lines: this.lines
        };
        this.saving = true;
        const request = this.isSaved ? this.invoiceService.update(this.invoice.id, payload) : this.invoiceService.create(payload);
        request.subscribe({
            next: (saved) => {
                this.saving = false;
                this.setInvoice(saved);
                this.messageService.add({ severity: 'success', summary: 'Éxito', detail: `Factura ${saved.documentNumber} guardada` });
            },
            error: (err) => {
                this.saving = false;
                this.showError(err?.error?.error || 'No se pudo guardar la factura');
            }
        });
    }

    annul() {
        this.confirmationService.confirm({
            message: `¿Desea anular la factura ${this.invoice.documentNumber}? Esta acción no se puede deshacer.`,
            header: 'Confirmar Anulación',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.invoiceService.annul(this.invoice.id).subscribe({
                    next: () => {
                        this.invoice = { ...this.invoice, status: 'ANULADA' };
                        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Factura anulada' });
                    },
                    error: (err) => this.showError(err?.error?.error || 'No se pudo anular la factura')
                });
            }
        });
    }

    deleteInvoice(row: any) {
        this.confirmationService.confirm({
            message: `¿Está seguro de que desea eliminar la factura ${row.documentNumber}?`,
            header: 'Confirmar Eliminación',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.invoiceService.delete(row.id).subscribe({
                    next: () => {
                        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Factura eliminada' });
                        this.load();
                    },
                    error: (err) => this.showError(err?.error?.error || 'No se pudo eliminar la factura')
                });
            }
        });
    }

    private showError(detail: string) {
        this.messageService.add({ severity: 'error', summary: 'Error', detail });
    }
}
