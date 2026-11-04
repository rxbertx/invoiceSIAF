import { Component, OnInit } from '@angular/core';
import { InvoiceService } from 'src/app/demo/service/invoice.service';

interface TypeCount {
    type: string;
    count: number;
    color: string;
}

interface MonthTotal {
    label: string;
    count: number;
    total: number;
}

const TYPE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#06b6d4', '#ec4899', '#8b5cf6', '#f97316', '#ef4444'];
const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

@Component({
    templateUrl: './banking.dashboard.component.html'
})
export class BankingDashboardComponent implements OnInit {

    currentUser: any = null;
    loading = true;
    error = false;

    year = new Date().getFullYear();
    totalFacturas = 0;
    typeCounts: TypeCount[] = [];
    monthTotals: MonthTotal[] = [];

    typeChartData: any;
    typeChartOptions: any;
    monthChartData: any;
    monthChartOptions: any;

    constructor(private invoiceService: InvoiceService) {
        this.currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
    }

    ngOnInit() {
        this.invoiceService.getAll().subscribe({
            next: (rows) => {
                this.build((rows || []).filter((i) => i.status !== 'ANULADA'));
                this.loading = false;
            },
            error: () => {
                this.error = true;
                this.loading = false;
            }
        });
    }

    private build(invoices: any[]) {
        this.totalFacturas = invoices.length;

        const byType = new Map<string, number>();
        invoices.forEach((i) => {
            const type = i.documentType || 'Sin tipo';
            byType.set(type, (byType.get(type) || 0) + 1);
        });
        this.typeCounts = [...byType.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([type, count], idx) => ({ type, count, color: TYPE_COLORS[idx % TYPE_COLORS.length] }));

        this.monthTotals = MONTHS.map((label) => ({ label, count: 0, total: 0 }));
        invoices.forEach((i) => {
            const date = new Date(i.documentDate);
            if (isNaN(date.getTime()) || date.getFullYear() !== this.year) return;
            const m = this.monthTotals[date.getMonth()];
            m.count++;
            m.total += Number(i.totals?.total) || 0;
        });
        this.monthTotals.forEach((m) => (m.total = Math.round(m.total * 100) / 100));

        const style = getComputedStyle(document.documentElement);
        const textColor = style.getPropertyValue('--text-color') || '#ccc';
        const gridColor = style.getPropertyValue('--surface-border') || '#444';

        this.typeChartData = {
            labels: this.typeCounts.map((t) => t.type),
            datasets: [{ data: this.typeCounts.map((t) => t.count), backgroundColor: this.typeCounts.map((t) => t.color), borderWidth: 0 }]
        };
        this.typeChartOptions = {
            cutout: '65%',
            plugins: { legend: { display: false } }
        };

        this.monthChartData = {
            labels: this.monthTotals.map((m) => m.label),
            datasets: [{ label: 'Total facturado', data: this.monthTotals.map((m) => m.total), backgroundColor: '#6366f1', borderRadius: 6 }]
        };
        this.monthChartOptions = {
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx: any) => {
                            const m = this.monthTotals[ctx.dataIndex];
                            return ` $${m.total.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${m.count} facturas)`;
                        }
                    }
                }
            },
            scales: {
                x: { ticks: { color: textColor }, grid: { display: false } },
                y: { ticks: { color: textColor }, grid: { color: gridColor }, beginAtZero: true }
            }
        };
    }

    get yearTotal(): number {
        return this.monthTotals.reduce((s, m) => s + m.total, 0);
    }

    get yearCount(): number {
        return this.monthTotals.reduce((s, m) => s + m.count, 0);
    }

    get userInitials(): string {
        if (!this.currentUser?.name) return '?';
        const parts = this.currentUser.name.trim().split(' ');
        return parts.length >= 2
            ? (parts[0][0] + parts[1][0]).toUpperCase()
            : this.currentUser.name.substring(0, 2).toUpperCase();
    }
}