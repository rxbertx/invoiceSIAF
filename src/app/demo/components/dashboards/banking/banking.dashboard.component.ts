import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

interface ProjectKpi {
    boardId: string;
    boardName: string;
    asignadas: number;
    completadas: number;
    pendientes: number;
    enProceso: number;
    fueraDetiempo: number;
    detenidas: number;
    listas: ListaBadge[];
    progreso: number;
    diasRestantes: number | null;
    dueDate: any;
}

interface MemberKpi {
    key: string;
    name: string;
    image?: string;
    initials: string;
    color: string;
    asignadas: number;
    completadas: number;
    pendientes: number;
    enProceso: number;
    detenidas: number;
    fueraDetiempo: number;
    progreso: number;
    boardIds: Set<string>;
    proyectos: number;
    proyectosNombres: string[];
}

interface ListaBadge {
    nombre: string;
    count: number;
    color: string;
}

const LIST_COLORS = [
    '#6366f1', '#f59e0b', '#10b981', '#f97316',
    '#8b5cf6', '#06b6d4', '#ec4899', '#ef4444'
];

@Component({
    templateUrl: './banking.dashboard.component.html'
})
export class BankingDashboardComponent implements OnInit {

    currentUser: any = null;
    isAdmin = false;
    loading = true;

    // Labels dinámicos según rol
    labelProyectos = '';
    labelAsignadas = '';
    labelProximas = '';
    labelCerradas = '';

    // Stats
    totalProyectos = 0;
    tareasProximasVencer = 0;
    tareasCerradasSemana = 0;
    totalTareasAsignadas = 0;

    // KPI por proyecto
    proyectosKpi: ProjectKpi[] = [];

    // KPI general por miembro (acumulado de todos los proyectos)
    miembrosKpi: MemberKpi[] = [];
    private memberMap = new Map<string, MemberKpi>();

    constructor(private http: HttpClient) {
        this.currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
        this.isAdmin = this.currentUser?.role === 'ADMIN';

        if (this.isAdmin) {
            this.labelProyectos  = 'Total Proyectos';
            this.labelAsignadas  = 'Total Tareas';
            this.labelProximas   = 'Vencen esta Semana';
            this.labelCerradas   = 'Cerradas esta Semana';
        } else {
            this.labelProyectos  = 'Mis Proyectos';
            this.labelAsignadas  = 'Total Tareas Asignadas';
            this.labelProximas   = 'Próximas a Vencer';
            this.labelCerradas   = 'Cerradas esta Semana';
        }
    }

    ngOnInit() {
        this.loadStats();
    }

    private loadStats() {
        const { start, end } = this.getWeekRange();

        this.http.get<any[]>('/api/boards-kanban').pipe(
            switchMap(boards => {
                if (!boards.length) return of({ boards: [], results: [] });
                const requests = boards.map(b =>
                    this.http.get<any>(`/api/kanban-lists/${b._id || b.id}`).pipe(
                        catchError(() => of({ data: [] }))
                    )
                );
                return forkJoin(requests).pipe(
                    switchMap(results => of({ boards, results }))
                );
            })
        ).subscribe({
            next: ({ boards, results }: any) => {
                let proximasVencer = 0;
                let cerradasSemana = 0;
                let totalAsignadas = 0;
                const kpis: ProjectKpi[] = [];
                this.memberMap.clear();

                for (let i = 0; i < results.length; i++) {
                    const board = boards[i];
                    const lists: any[] = results[i]?.data || [];

                    const listaMap = new Map<string, { count: number; colorIdx: number }>();
                    let asignadas = 0;
                    let completadas = 0;
                    let pendientes = 0;
                    let enProceso = 0;
                    let detenidas = 0;
                    let fueraDetiempo = 0;
                    let colorIdx = 0;

                    for (const list of lists) {
                        for (const card of (list.cards || [])) {
                            // Admin cuenta todas las cards; el resto solo las asignadas
                            if (!this.isAdmin && !this.isAssigned(card)) continue;

                            asignadas++;
                            totalAsignadas++;

                            if (card.completed) {
                                completadas++;
                                if (card.completedAt) {
                                    const closed = new Date(card.completedAt);
                                    if (closed >= start && closed <= end) cerradasSemana++;
                                }
                                // Se compara por día: cerrar el mismo día del vencimiento es "a tiempo"
                                if (card.dueDate && card.completedAt &&
                                    this.toDay(card.completedAt) > this.toDay(card.dueDate)) {
                                    fueraDetiempo++;
                                }
                            } else {
                                // El estatus real de la tarea es la lista en la que está
                                switch (this.normalizeList(list.title)) {
                                    case 'proceso':  enProceso++; break;
                                    case 'detenida': detenidas++; break;
                                    default:         pendientes++; break;
                                }
                                if (card.dueDate) {
                                    const due = new Date(card.dueDate);
                                    const today = new Date(); today.setHours(0, 0, 0, 0);
                                    if (due >= start && due <= end) proximasVencer++;
                                }
                            }

                            this.acumularMiembros(card, list.title, board._id || board.id, board.title);

                            const listName = list.title || 'Sin lista';
                            if (!listaMap.has(listName)) {
                                listaMap.set(listName, { count: 0, colorIdx: colorIdx++ });
                            }
                            listaMap.get(listName)!.count++;
                        }
                    }

                    if (asignadas === 0) continue;

                    const listas: ListaBadge[] = Array.from(listaMap.entries()).map(([nombre, v]) => ({
                        nombre,
                        count: v.count,
                        color: LIST_COLORS[v.colorIdx % LIST_COLORS.length]
                    }));

                    kpis.push({
                        boardId: board._id || board.id,
                        boardName: board.title || 'Sin nombre',
                        asignadas,
                        completadas,
                        pendientes,
                        enProceso,
                        fueraDetiempo,
                        detenidas,
                        listas,
                        progreso: asignadas > 0 ? Math.round((completadas / asignadas) * 100) : 0,
                        diasRestantes: this.diasParaVencer(board.dueDate),
                        dueDate: board.dueDate
                    });
                }

                this.totalProyectos = kpis.length;
                this.tareasProximasVencer = proximasVencer;
                this.tareasCerradasSemana = cerradasSemana;
                this.totalTareasAsignadas = totalAsignadas;
                this.proyectosKpi = kpis;
                this.miembrosKpi = Array.from(this.memberMap.values())
                    .map(m => ({
                        ...m,
                        proyectos: m.boardIds.size,
                        progreso: m.asignadas > 0 ? Math.round((m.completadas / m.asignadas) * 100) : 0
                    }))
                    .sort((a, b) => b.asignadas - a.asignadas);
                this.loading = false;
            },
            error: () => this.loading = false
        });
    }

    /** Acumula los contadores de una tarjeta en cada uno de sus responsables */
    private acumularMiembros(card: any, listTitle: string, boardId: string, boardName: string) {
        for (const assignee of (card.assignees || [])) {
            const key = assignee._id || assignee.name;
            if (!key) continue;

            if (!this.memberMap.has(key)) {
                this.memberMap.set(key, {
                    key,
                    name: assignee.name,
                    image: assignee.image,
                    initials: this.getInitials(assignee.name),
                    color: LIST_COLORS[this.memberMap.size % LIST_COLORS.length],
                    asignadas: 0,
                    completadas: 0,
                    pendientes: 0,
                    enProceso: 0,
                    detenidas: 0,
                    fueraDetiempo: 0,
                    progreso: 0,
                    boardIds: new Set<string>(),
                    proyectos: 0,
                    proyectosNombres: []
                });
            }

            const m = this.memberMap.get(key)!;
            if (boardId && !m.boardIds.has(boardId)) {
                m.boardIds.add(boardId);
                if (boardName) m.proyectosNombres.push(boardName);
            }
            m.asignadas++;

            if (card.completed) {
                m.completadas++;
                if (card.dueDate && card.completedAt &&
                    this.toDay(card.completedAt) > this.toDay(card.dueDate)) {
                    m.fueraDetiempo++;
                }
            } else {
                switch (this.normalizeList(listTitle)) {
                    case 'proceso':  m.enProceso++; break;
                    case 'detenida': m.detenidas++; break;
                    default:         m.pendientes++; break;
                }
            }
        }
    }

    private getInitials(name: string): string {
        if (!name) return '?';
        const parts = name.trim().split(' ');
        return parts.length >= 2
            ? (parts[0][0] + parts[1][0]).toUpperCase()
            : name.substring(0, 2).toUpperCase();
    }

    /** Texto de la burbuja de vencimiento */
    venceLabel(dias: number | null): string {
        if (dias === null) return '';
        if (dias < 0) return `Venció hace ${Math.abs(dias)}d`;
        if (dias === 0) return 'Vence hoy';
        if (dias === 1) return 'Vence mañana';
        return `${dias} días`;
    }

    /** Color de la burbuja según urgencia */
    venceColor(dias: number | null): string {
        if (dias === null) return '#6366f1';
        if (dias <= 0) return '#ef4444';   // vencido / hoy → rojo
        if (dias <= 2) return '#f97316';   // muy próximo → naranja
        return '#f59e0b';                  // 3-5 días → ámbar
    }

    /**
     * Días restantes hasta el vencimiento (dueDate).
     * Devuelve null si no hay fecha o si aún faltan más de 5 días (no se alerta).
     * Puede ser 0 (vence hoy) o negativo (ya vencido).
     */
    private diasParaVencer(dueDate: any): number | null {
        if (!dueDate) return null;
        const hoy = this.toDay(new Date());
        const vence = this.toDay(dueDate);
        const dias = Math.round((vence.getTime() - hoy.getTime()) / 86400000);
        return dias <= 5 ? dias : null;
    }

    /** Trunca una fecha al inicio del día local, para comparar solo por día */
    private toDay(value: any): Date {
        const d = new Date(value);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    /** Clasifica el nombre de una lista en un estatus conocido */
    private normalizeList(title: string): 'pendiente' | 'proceso' | 'detenida' {
        const t = (title || '')
            .toLowerCase()
            .normalize('NFD').replace(/[̀-ͯ]/g, '');
        if (t.includes('proceso') || t.includes('curso') || t.includes('progreso')) return 'proceso';
        if (t.includes('detenid') || t.includes('bloquead') || t.includes('pausad')) return 'detenida';
        return 'pendiente';
    }

    private isAssigned(card: any): boolean {
        if (!card.assignees?.length) return false;
        const userId = this.currentUser?._id || this.currentUser?.id;
        const userName = this.currentUser?.name;
        return card.assignees.some((a: any) =>
            (userId && String(a._id) === String(userId)) ||
            (userName && a.name === userName)
        );
    }

    private getWeekRange(): { start: Date; end: Date } {
        const now = new Date();
        const day = now.getDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        const monday = new Date(now);
        monday.setDate(now.getDate() + diffToMonday);
        monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        return { start: monday, end: sunday };
    }

    get userInitials(): string {
        if (!this.currentUser?.name) return '?';
        const parts = this.currentUser.name.trim().split(' ');
        return parts.length >= 2
            ? (parts[0][0] + parts[1][0]).toUpperCase()
            : this.currentUser.name.substring(0, 2).toUpperCase();
    }
}
