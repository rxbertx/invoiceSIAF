import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface CardWithMeta {
    id: string;
    title?: string;
    completed?: boolean;
    completedAt?: string;
    assignees?: Assignee[];
    dueDate?: string;
    startDate?: string;
    listTitle: string;
    listId: string;
}

interface Assignee {
    _id?: string;
    name: string;
    image?: string;
}

interface MemberStat {
    _id: string;
    name: string;
    image?: string;
    initials: string;
    color: string;
    assigned: number;
    collaborations: number;
    completed: number;
    pending: number;
    inProgress: number;
    stopped: number;
    overdue: number;
    completedPercent: number;
}

const AVATAR_COLORS = [
    '#6366f1', '#f59e0b', '#10b981', '#f97316',
    '#8b5cf6', '#06b6d4', '#ec4899', '#ef4444'
];

@Component({
    selector: 'app-kpi',
    templateUrl: './kpi.component.html',
    styleUrls: ['./kpi.component.scss']
})
export class KpiComponent implements OnInit {
    boards: any[] = [];
    selectedBoard: any = null;
    lists: any[] = [];
    loading = false;

    allCards: CardWithMeta[] = [];
    today = new Date();

    // Panel de Control stats
    totalCards = 0;
    completedCards = 0;
    pendingCards = 0;
    inProgressCards = 0;
    overdueCards = 0;
    withDueDateCards = 0;
    completedLateCards = 0;
    stoppedCards = 0;
    progressPercent = 0;
    progressDashoffset = 283;

    // KPI por miembro
    memberStats: MemberStat[] = [];

    constructor(private http: HttpClient) {}

    ngOnInit() {
        this.http.get<any[]>('/api/boards-kanban').subscribe(boards => {
            this.boards = boards;
        });
    }

    onBoardChange() {
        if (!this.selectedBoard) return;
        this.loading = true;
        const id = this.selectedBoard._id || this.selectedBoard.id;
        this.http.get<any>(`/api/kanban-lists/${id}`).subscribe(res => {
            this.lists = res.data || [];
            this.computeStats();
            this.loading = false;
        });
    }

    /** Clasifica el nombre de una lista en un estatus conocido */
    private normalizeList(title: string): 'pendiente' | 'proceso' | 'detenida' {
        const t = (title || '').toLowerCase();
        if (t.includes('proceso') || t.includes('curso') || t.includes('progreso')) return 'proceso';
        if (t.includes('detenid') || t.includes('bloquead') || t.includes('pausad')) return 'detenida';
        return 'pendiente';
    }

    /** Días restantes hasta el vencimiento del tablero (dueDate); null si no hay fecha */
    get diasVencimiento(): number | null {
        const due = this.selectedBoard?.dueDate;
        if (!due) return null;
        const hoy = this.toDay(new Date());
        const vence = this.toDay(due);
        return Math.round((vence.getTime() - hoy.getTime()) / 86400000);
    }

    /** Color tipo semáforo según días restantes: verde (>5), amarillo (5-3... 4/5), rojo (<=3) */
    get vencimientoColor(): string {
        const d = this.diasVencimiento;
        if (d === null) return '#6b7280';
        if (d <= 3) return '#ef4444';   // rojo: 3 días o menos (incluye vencidos)
        if (d <= 5) return '#f59e0b';   // amarillo: 4 o 5 días
        return '#10b981';               // verde: más de 5 días
    }

    /** Texto descriptivo del vencimiento */
    get vencimientoLabel(): string {
        const d = this.diasVencimiento;
        if (d === null) return 'Sin fecha definida';
        if (d < 0) return `Venció hace ${Math.abs(d)} día(s)`;
        if (d === 0) return 'Vence hoy';
        if (d === 1) return 'Falta 1 día';
        return `Faltan ${d} días`;
    }

    /** Trunca una fecha al inicio del día local, para comparar solo por día */
    private toDay(value: any): Date {
        const d = new Date(value);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    private computeStats() {
        this.allCards = [];

        for (const list of this.lists) {
            for (const card of (list.cards || [])) {
                this.allCards.push({
                    ...card,
                    listTitle: list.title,
                    listId: list.listId || list._id
                });
            }
        }

        const now = new Date();
        now.setHours(0, 0, 0, 0);

        this.totalCards = this.allCards.length;
        this.completedCards = this.allCards.filter(c => c.completed).length;
        this.withDueDateCards = this.allCards.filter(c => !!c.dueDate).length;

        this.overdueCards = this.allCards.filter(c => {
            if (!c.dueDate || c.completed) return false;
            return new Date(c.dueDate) < now;
        }).length;

        this.completedLateCards = this.allCards.filter(c => {
            if (!c.dueDate || !c.completed || !c.completedAt) return false;
            // Se compara por día: cerrar el mismo día del vencimiento es "a tiempo"
            return this.toDay(c.completedAt) > this.toDay(c.dueDate);
        }).length;

        // El estatus real de una tarea abierta es la lista en la que está
        const abiertas = this.allCards.filter(c => !c.completed);
        this.pendingCards = abiertas.filter(c => this.normalizeList(c.listTitle) === 'pendiente').length;
        this.inProgressCards = abiertas.filter(c => this.normalizeList(c.listTitle) === 'proceso').length;
        this.stoppedCards = abiertas.filter(c => this.normalizeList(c.listTitle) === 'detenida').length;

        this.progressPercent = this.totalCards > 0
            ? Math.round((this.completedCards / this.totalCards) * 100)
            : 0;

        // SVG circle circumference = 2 * PI * r (r=45) ≈ 283
        this.progressDashoffset = Math.round(283 - (283 * this.progressPercent) / 100);

        this.computeMemberStats();
    }

    private computeMemberStats() {
        const memberMap = new Map<string, MemberStat>();
        let colorIdx = 0;

        for (const card of this.allCards) {
            if (!card.assignees || card.assignees.length === 0) continue;
            // Completada fuera de tiempo: cerrada después del día de vencimiento
            const isCompletedLate = !!(card.dueDate && card.completed && card.completedAt &&
                this.toDay(card.completedAt) > this.toDay(card.dueDate));
            const estatus = this.normalizeList(card.listTitle);

            for (const assignee of card.assignees) {
                const key = assignee._id || assignee.name;
                if (!memberMap.has(key)) {
                    const initials = this.getInitials(assignee.name);
                    memberMap.set(key, {
                        _id: key,
                        name: assignee.name,
                        image: assignee.image,
                        initials,
                        color: AVATAR_COLORS[colorIdx++ % AVATAR_COLORS.length],
                        assigned: 0,
                        collaborations: 0,
                        completed: 0,
                        pending: 0,
                        inProgress: 0,
                        stopped: 0,
                        overdue: 0,
                        completedPercent: 0
                    });
                }

                const stat = memberMap.get(key)!;
                stat.assigned++;
                if (card.assignees!.length > 1) stat.collaborations++;
                if (card.completed) {
                    stat.completed++;
                } else if (estatus === 'proceso') {
                    stat.inProgress++;
                } else if (estatus === 'detenida') {
                    stat.stopped++;
                } else {
                    stat.pending++;
                }
                if (isCompletedLate) stat.overdue++;
            }
        }

        this.memberStats = Array.from(memberMap.values()).map(s => ({
            ...s,
            completedPercent: s.assigned > 0 ? Math.round((s.completed / s.assigned) * 100) : 0
        }));
    }

    private getInitials(name: string): string {
        const parts = name.trim().split(' ');
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return name.substring(0, 2).toUpperCase();
    }
}
