import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
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
    itemTypeOptions: Option[] = [];
    itemTypeCodes: Record<string, string> = {};
    customsOptions: Option[] = [];
    regimeOptions: Option[] = [];
    defaultUnit = '';

    applyScope: 'current' | 'all' | 'period' = 'current';
    periodFrom: Date | null = null;
    periodTo: Date | null = null;
    applicable: any[] = [];
    selectedTargets: any[] = [];
    applied: any[] = [];
    selectedApplied: any = null;
    applyMode: 'PERCENT' | 'AMOUNT' = 'PERCENT';
    applyPercent: number | null = null;
    applyAmount: number | null = null;

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
        const exportLists: [string, (o: Option[]) => void][] = [
            ['tipo-item', (o) => (this.itemTypeOptions = o)],
            ['recinto-fiscal', (o) => (this.customsOptions = o)],
            ['regimen', (o) => (this.regimeOptions = o)]
        ];
        for (const [catalog, assign] of exportLists) {
            this.catalogs.getItems(catalog).subscribe({
                next: (rows) => {
                    const active = rows.filter((r) => r.active);
                    if (catalog === 'tipo-item') active.forEach((r) => (this.itemTypeCodes[r.id] = String(r.code)));
                    assign(active.map((r) => ({ label: `${r.code} - ${r.description}`, value: r.id })));
                },
                error: () => this.showError(`No se pudo cargar el catálogo ${catalog}`)
            });
        }
    }

    // Los datos de exportación solo aplican a la factura de exportación (DTE 11)
    // Con tipo de item "Servicios" (código 2) no aplican aduana ni régimen
    get showCustomsFields(): boolean {
        return this.itemTypeCodes[this.invoice?.itemTypeId] !== '2';
    }

    onItemTypeChange() {
        if (!this.showCustomsFields) {
            this.invoice.customsId = null;
            this.invoice.regimeId = null;
        }
    }

    get isExport(): boolean {
        return this.selectedDocumentType?.dteType === '11';
    }

    get readonly(): boolean {
        return this.invoice.status === 'ANULADA' || this.invoice.status === 'VALIDADA';
    }

    get isValidated(): boolean {
        return this.invoice.status === 'VALIDADA';
    }

    get isDraft(): boolean {
        return this.isSaved && this.invoice.status === 'BORRADOR';
    }

    statusSeverity(status: string): string {
        return status === 'ANULADA' ? 'danger' : status === 'VALIDADA' ? 'success' : 'info';
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
        this.applied = [];
        this.applicable = [];
        this.selectedTargets = [];
        this.applyScope = 'current';
        this.periodFrom = this.periodTo = null;
        this.resetApplyForm();
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
        if (this.isNote) this.loadApplications();
    }

    private headerIncomplete(): boolean {
        const required = ['documentDate', 'documentTypeId', 'clientId', 'billToName'];
        if (this.isExport) required.push('itemTypeId');
        if (this.isExport && this.showCustomsFields) required.push('customsId', 'regimeId');
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
            exempt: this.isExport,
            valueWithIva: false
        };
    }

    onDefaultUnitChange() {
        if (this.useDefaultUnit) this.lineForm.unit = this.defaultUnit;
    }

    selectLine(line: any) {
        if (this.readonly || line.applicationTargetId) return;
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
            exempt: this.isExport || !!f.exempt,
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

    // En exportación la venta es exenta: se marca la venta externa y cada ítem como exento
    onDocumentTypeChange() {
        if (this.isExport) {
            this.invoice.isExternalSale = true;
            this.lineForm.exempt = true;
            this.lines = this.lines.map((l) => ({ ...l, exempt: true }));
        } else {
            this.invoice.itemTypeId = this.invoice.customsId = this.invoice.regimeId = null;
        }
        this.recalculate();
    }

    private calculate(lines: any[]) {
        const calculated = lines.map((l) => {
            const gross = (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0);
            const exempt = this.isExport || !!l.exempt;
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

    validate() {
        this.changeStatus(
            this.invoiceService.validate(this.invoice.id),
            'Factura validada; ya no se puede editar',
            'No se pudo validar la factura',
            (updated) => {
                this.invoice = { ...this.invoice, status: updated?.status || 'VALIDADA' };
                if (this.isNote) this.loadApplications();
            }
        );
    }

    unvalidate() {
        this.changeStatus(
            this.invoiceService.unvalidate(this.invoice.id),
            'Factura desvalidada; ya se puede editar',
            'No se pudo desvalidar la factura',
            (updated) => {
                this.invoice = { ...this.invoice, status: updated?.status || 'BORRADOR' };
                if (this.isNote) this.loadApplications();
            }
        );
    }

    validateRow(row: any) {
        this.changeStatus(this.invoiceService.validate(row.id), 'Factura validada', 'No se pudo validar la factura', () => this.load());
    }

    unvalidateRow(row: any) {
        this.changeStatus(this.invoiceService.unvalidate(row.id), 'Factura desvalidada', 'No se pudo desvalidar la factura', () => this.load());
    }

    private changeStatus(request: Observable<any>, success: string, failure: string, done: (updated: any) => void) {
        request.subscribe({
            next: (updated) => {
                done(updated);
                this.messageService.add({ severity: 'success', summary: 'Éxito', detail: success });
            },
            error: (err) => this.showError(err?.error?.error || failure)
        });
    }

    annulInvoice(row: any) {
        this.confirmationService.confirm({
            message: `¿Desea anular la factura ${row.documentNumber}? El registro se conservará para no perder el correlativo.`,
            header: 'Confirmar Anulación',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.invoiceService.annul(row.id).subscribe({
                    next: () => {
                        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Factura anulada; el correlativo se conservó' });
                        this.load();
                    },
                    error: (err) => this.showError(err?.error?.error || 'No se pudo anular la factura')
                });
            }
        });
    }

    deleteInvoice(row: any) {
        this.confirmationService.confirm({
            message: `¿Está seguro de que desea eliminar la factura ${row.documentNumber}? Solo se puede eliminar la que tenga el último correlativo y el contador se ajustará.`,
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

    // ----- Aplicaciones de notas sobre un crédito fiscal -----
    applicationsDialog = false;
    applicationsLoading = false;
    applicationsTarget: any = null;
    targetApplications: any[] = [];

    get applicationsNet(): number {
        return round2(
            this.targetApplications
                .filter((a) => a.status !== 'ANULADA')
                .reduce((s, a) => s + (a.effect === 'INCREASE' ? a.amount : -a.amount), 0)
        );
    }

    viewApplications(target: any) {
        this.applicationsTarget = target;
        this.targetApplications = [];
        this.applicationsLoading = true;
        this.applicationsDialog = true;
        this.invoiceService.queryApplications({ targetId: target.id }).subscribe({
            next: (rows) => {
                this.targetApplications = rows;
                this.applicationsLoading = false;
            },
            error: (err) => {
                this.applicationsLoading = false;
                this.showError(err?.error?.error || 'No se pudieron cargar las aplicaciones');
            }
        });
    }

    // ----- Aplicación de documentos (notas de débito/crédito) -----
    get isNote(): boolean {
        return ['05', '06'].includes(this.selectedDocumentType?.dteType);
    }

    onTabChange(index: number) {
        if (index === 1 && this.isNote && this.isSaved) this.loadApplications();
    }

    loadApplications() {
        if (!this.isSaved) return;
        this.invoiceService.getApplications(this.invoice.id).subscribe({
            next: (rows) => {
                this.applied = rows;
                this.selectedApplied = null;
            },
            error: (err) => this.showError(err?.error?.error || 'No se pudieron cargar las aplicaciones')
        });
        this.loadApplicable();
    }

    loadApplicable() {
        const monthStr = (d: Date | null) => (d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}` : '');
        if (this.applyScope === 'period' && !this.periodFrom) {
            this.applicable = [];
            return;
        }
        this.invoiceService.getApplicable(this.invoice.id, this.applyScope, monthStr(this.periodFrom), monthStr(this.periodTo)).subscribe({
            next: (rows) => {
                this.applicable = rows;
                this.selectedTargets = [];
                this.resetApplyForm();
            },
            error: (err) => this.showError(err?.error?.error || 'No se pudieron cargar los documentos por aplicar')
        });
    }

    availableOf(row: any): number {
        return row.available === null || row.available === undefined ? Infinity : row.available;
    }

    get isDebitNote(): boolean {
        return this.selectedDocumentType?.dteType === '06';
    }

    get singleTarget(): any | null {
        return this.selectedTargets.length === 1 ? this.selectedTargets[0] : null;
    }

    get applyAmountPreview(): number | null {
        const target = this.singleTarget;
        if (!target) return null;
        return this.applyMode === 'PERCENT' ? round2(((this.applyPercent || 0) * target.total) / 100) : this.applyAmount;
    }

    resetApplyForm() {
        this.applyMode = 'PERCENT';
        this.applyPercent = null;
        this.applyAmount = null;
    }

    addApplication() {
        if (!this.selectedTargets.length) return this.showError('Seleccione al menos un documento');
        if (this.applyMode === 'PERCENT' && !(this.applyPercent && this.applyPercent > 0 && this.applyPercent <= 100)) {
            return this.showError('Ingrese un porcentaje mayor a 0 y hasta 100');
        }
        if (this.applyMode === 'AMOUNT') {
            if (!this.singleTarget) return this.showError('El monto fijo solo se puede aplicar a un documento; use porcentaje para varios');
            if (!(this.applyAmount && this.applyAmount > 0)) return this.showError('Ingrese el monto a aplicar');
        }
        const selectedIds = new Set(this.selectedTargets.map((t) => t.id));
        const kept = this.applied
            .filter((a) => !selectedIds.has(a.targetId))
            .map((a) => ({ targetId: a.targetId, mode: 'AMOUNT', amount: a.amount }));
        const added = this.selectedTargets.map((t) => ({ targetId: t.id, mode: this.applyMode, percent: this.applyPercent, amount: this.applyAmount }));
        this.persistApplications([...kept, ...added], 'Aplicación agregada (temporal hasta validar la nota)');
    }

    removeApplication() {
        if (!this.selectedApplied) return;
        const rest = this.applied
            .filter((a) => a.targetId !== this.selectedApplied.targetId)
            .map((a) => ({ targetId: a.targetId, mode: 'AMOUNT', amount: a.amount }));
        this.persistApplications(rest, 'Aplicación eliminada');
    }

    private persistApplications(items: any[], success: string) {
        const unitName = this.unitOptions.find((o) => o.value === this.defaultUnit)?.label ?? '';
        this.invoiceService.saveApplications(this.invoice.id, items, this.defaultUnit, unitName).subscribe({
            next: () => {
                this.messageService.add({ severity: 'success', summary: 'Éxito', detail: success });
                this.loadApplications();
                this.refreshLines();
            },
            error: (err) => this.showError(err?.error?.error || 'No se pudo guardar la aplicación')
        });
    }

    // El servidor genera las líneas de ajuste; se traen sin pisar los cambios sin guardar del encabezado
    private refreshLines() {
        this.invoiceService.getById(this.invoice.id).subscribe({
            next: (data) => {
                this.lines = data.lines || [];
                this.recalculate();
                this.resetLineForm();
            },
            error: () => this.showError('No se pudo actualizar el detalle de la nota')
        });
    }

    get totalApplied(): number {
        return round2(this.applied.reduce((s, a) => s + a.amount, 0));
    }
}
