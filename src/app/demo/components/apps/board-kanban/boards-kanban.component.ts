import { Component, OnInit } from '@angular/core';
import { DatabaseService } from 'src/app/demo/service/boards-kanban.service';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

@Component({
    selector: 'app-boards-kanban',
    templateUrl: './boards-kanban.component.html',
    styleUrls: ['./boards-kanban.component.scss'],
    providers: [MessageService, ConfirmationService]
})
export class BoardsKanbanComponent implements OnInit {
    boards: any[] = [];
    board: any = {};
    boardDialog: boolean = false;
    submitted: boolean = false;
    loading = false;
    statuses: any[] = [
        { label: 'Activo', value: 'ACTIVE' },
        { label: 'Inactivo', value: 'INACTIVE' }
    ];

    /** Usuarios disponibles para asignar como coordinador */
    coordinators: any[] = [];

    private currentUser: any = null;

    constructor(
        private dbService: DatabaseService,
        private http: HttpClient,
        private messageService: MessageService,
        private confirmationService: ConfirmationService,
        private router: Router
    ) {
        this.currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
    }

    ngOnInit() {
        this.loadBoards();
        this.loadCoordinators();
    }

    loadCoordinators() {
        this.http.get<any[]>('/api/users').subscribe({
            next: users => this.coordinators = users
                .filter(u => u.role === 'COORDINADOR')
                .map(u => ({
                    label: u.name,
                    value: u._id || u.id
                })),
            error: () => this.coordinators = []
        });
    }

    loadBoards() {
        this.loading = true;
        const isAdmin = this.currentUser?.role === 'ADMIN';

        this.dbService.getBoardsKanban().pipe(
            switchMap(boards => {
                if (isAdmin || !boards.length) return of({ boards, isAdmin });

                // Para no-admins: verificar en cuáles tiene al menos una tarea asignada
                const checks = boards.map(b =>
                    this.http.get<any>(`/api/kanban-lists/${b._id || b.id}`).pipe(
                        catchError(() => of({ data: [] }))
                    )
                );
                return forkJoin(checks).pipe(
                    switchMap(results => {
                        const filtered = boards.filter((_, i) =>
                            this.boardHasAssignedCard(results[i]?.data || [])
                        );
                        return of({ boards: filtered, isAdmin: false });
                    })
                );
            })
        ).subscribe({
            next: ({ boards }: any) => {
                this.boards = boards;
                this.loading = false;
            },
            error: () => this.loading = false
        });
    }

    private boardHasAssignedCard(lists: any[]): boolean {
        const userId = this.currentUser?._id || this.currentUser?.id;
        const userName = this.currentUser?.name;
        for (const list of lists) {
            for (const card of (list.cards || [])) {
                if (!card.assignees?.length) continue;
                const match = card.assignees.some((a: any) =>
                    (userId && String(a._id) === String(userId)) ||
                    (userName && a.name === userName)
                );
                if (match) return true;
            }
        }
        return false;
    }

    openNew() {
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
        // Guardamos el creador (usuario logueado); no se muestra en la vista
        this.board = {
            status: 'ACTIVE',
            createdAt: new Date(),
            userId: currentUser?._id || currentUser?.id || null,
            createdByName: currentUser?.name || null
        };
        this.submitted = false;
        this.boardDialog = true;
    }

    editBoard(board: any) {
        this.board = { ...board };
        // p-calendar requiere un objeto Date; el backend devuelve la fecha como string
        if (this.board.dueDate) {
            this.board.dueDate = new Date(this.board.dueDate);
        }
        this.boardDialog = true;
    }

    deleteBoard(board: any) {
        this.confirmationService.confirm({
            message: `¿Está seguro de que desea eliminar el tablero "${board.title}"? Esta acción eliminará permanentemente todas las listas y tarjetas relacionadas.`,
            header: 'Confirmar Eliminación',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Sí',
            rejectLabel: 'No',
            accept: () => {
                this.dbService.deleteBoardKanban(board.id).subscribe(() => {
                    this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Tablero Eliminado' });
                    this.loadBoards();
                });
            }
        });
    }

    hideDialog() {
        this.boardDialog = false;
        this.submitted = false;
    }

    saveBoard() {
        this.submitted = true;

        // Guardamos también el nombre del coordinador para poder mostrarlo sin re-consultar usuarios
        this.board.coordinatorName = this.coordinators
            .find(c => c.value === this.board.coordinatorId)?.label || null;

        if (this.board.title?.trim()) {
            if (this.board.id) {
                this.dbService.updateBoardKanban(this.board.id, this.board).subscribe(() => {
                    this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Tablero Actualizado' });
                    this.loadBoards();
                    this.boardDialog = false;
                });
            } else {
                this.dbService.createBoardKanban(this.board).subscribe(() => {
                    this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Tablero Creado' });
                    this.loadBoards();
                    this.boardDialog = false;
                });
            }
        }
    }

    openBoard(boardId: string) {
        this.router.navigate(['/apps/kanban', boardId]);
    }

    onGlobalFilter(table: Table, event: Event) {
        table.filterGlobal((event.target as HTMLInputElement).value, 'contains');
    }

    getSeverity(status: string) {
        switch (status) {
            case 'ACTIVE': return 'success';
            case 'INACTIVE': return 'danger';
            default: return 'info';
        }
    }

    viewBoard(i:any){
        this.router.navigate(['/apps/kanban', i.id]);
    }
}