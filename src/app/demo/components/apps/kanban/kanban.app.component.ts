import { Component, OnInit, OnDestroy } from '@angular/core';
import { KanbanList, KanbanCard } from 'src/app/demo/api/kanban';
import { Subscription } from 'rxjs';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { KanbanService } from './service/kanban.service';
import { MessageService } from 'primeng/api';
import { ActivatedRoute } from '@angular/router';
import { DatabaseService } from 'src/app/demo/service/boards-kanban.service';

@Component({
    templateUrl: './kanban.app.component.html',
    styleUrls: ['./kanban.app.component.scss']
})
export class KanbanAppComponent implements OnInit, OnDestroy {
    sidebarVisible: boolean = false;

    lists: KanbanList[] = [];

    listIds: string[] = [];

    subscription = new Subscription();

    style!: HTMLStyleElement;

    isMobileDevice: boolean = false;

    listDialog: boolean = false;

    listName: string = '';

    boardId: string = '';

    boardTitle: string = '';

    constructor(
        private kanbanService: KanbanService,
        private route: ActivatedRoute,
        private messageService: MessageService,
        private dbService: DatabaseService
    ) {}

    ngOnInit() {
        this.removeLayoutResponsive();
        this.isMobileDevice = this.kanbanService.isMobileDevice();

        // Obtenemos el ID de la ruta y luego nos suscribimos a los cambios de las listas
        this.subscription.add(
            this.route.params.subscribe(params => {
                this.boardId = params['boardId'];
                if (this.boardId) {
                    this.kanbanService.getListsByBoardId(this.boardId);
                    this.loadBoardTitle();
                }
            })
        );

        // Separamos la suscripción de datos para evitar duplicidad y fugas de memoria
        this.subscription.add(
            this.kanbanService.lists$.subscribe((data) => {
                this.lists = data;
                this.listIds = this.lists.map((l) => l.listId || '');
            })
        );
    }

    private loadBoardTitle() {
        this.dbService.getBoardsKanban().subscribe((boards) => {
            const board = (boards || []).find((b: any) => (b.id || b._id) === this.boardId);
            this.boardTitle = board?.title || '';
        });
    }

    toggleSidebar() {
        this.sidebarVisible = true;
    }

    addList() {
        this.listName = '';
        this.listDialog = true;
    }

    saveList(name: string) {
        if (name && name.trim()) {
            this.kanbanService.addList(name.trim()).subscribe(() => {
                this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Lista creada correctamente' });
                this.listDialog = false;
            });
        }
    }

    dropList(event: CdkDragDrop<KanbanList[]>) {
        moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
        // Actualizamos los listIds locales para el tracking de drag & drop de tarjetas
        this.listIds = this.lists.map((l) => l.listId || '');
        // Persistimos el nuevo orden en la base de datos
        //this.kanbanService.reorderLists(this.boardId, this.listIds).subscribe();
    }

    onCardDrop(event: any, targetListId: string) {
        if (event.previousContainer === event.container) {
            // Reordenar dentro de la misma lista
            moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
            // Opcional: Persistir el reordenamiento de tarjetas en la misma lista aquí
        } else {
            const card: KanbanCard = event.item.data; // Requiere [cdkDragData] en el hijo
            const sourceListId: string = event.previousContainer.id; // Requiere [id] en el hijo

            console.log(`Intentando mover card ${card.id} de ${sourceListId} a ${targetListId}`);

            if (card && sourceListId && targetListId && sourceListId !== targetListId) {
                // 1. Mover visualmente de inmediato (Optimistic UI)
                transferArrayItem(
                    event.previousContainer.data,
                    event.container.data,
                    event.previousIndex,
                    event.currentIndex
                );

                // Actualizamos campos de completado localmente según lista destino
                const targetList = this.lists.find(l => l.listId === targetListId);
                const isCompletedList = targetList?.title?.toLowerCase() === 'completadas';
                card.completed = isCompletedList;
                // Inicio del día local, para que la fecha de cierre no se corra al día siguiente en UTC
                const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
                card.completedAt = isCompletedList ? hoy.toISOString() : undefined;

                // 2. Intentar persistir en MongoDB
                this.kanbanService.moveCard(card, targetListId, sourceListId).subscribe({
                    next: (res: any) => {
                        // Sincronizamos con lo que devolvió el servidor
                        if (res?.card) {
                            card.completed = res.card.completed;
                            card.completedAt = res.card.completedAt;
                        }
                        this.messageService.add({
                            severity: 'success',
                            summary: 'Movimiento Guardado',
                            detail: 'La tarjeta se ha movido permanentemente.'
                        });
                    },
                    error: (err) => {
                        console.error('Error al guardar el movimiento:', err);
                        
                        // 3. Rollback: Si falla el servidor (ej: 500), regresamos la tarjeta a su origen
                        transferArrayItem(
                            event.container.data,
                            event.previousContainer.data,
                            event.currentIndex,
                            event.previousIndex
                        );
                        
                        this.messageService.add({ 
                            severity: 'error', 
                            summary: 'Error de Sincronización', 
                            detail: 'No se pudo guardar el cambio. La tarjeta ha vuelto a su posición original.' 
                        });
                    }
                });
            }
        }
    }

    removeLayoutResponsive() {
        this.style = document.createElement('style');
        this.style.innerHTML = `
                .layout-content {
                    width: 100%;
                }
                
                .layout-topbar {
                    width: 100%;
                }
            `;
        document.head.appendChild(this.style);
    }

    ngOnDestroy(): void {
        this.subscription.unsubscribe();
        document.head.removeChild(this.style);
    }
}
